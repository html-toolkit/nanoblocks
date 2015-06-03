//  Для каждого типа блока ( == вызова nb.define) создается специальный объект,
//  который хранит в себе информацию про конструктор и события, на которые подписывается блок.
//  Кроме того, factory умеет создавать экземпляры нужных блоков.

//  Конструктор.
var Factory = function(name, ctor, events) {
    this.name = name;

    ctor.prototype.name = name;
    this.ctor = ctor;

    this.events = this._prepareEvents(events);
};
module.exports = Factory;

//  ---------------------------------------------------------------------------------------------------------------  //

//  Делим события на DOM и кастомные и создаем объект this.events,
//  в котором хранится информация про события и их обработчики,
//  с примерно такой структурой:
//
//      //  Каждый элемент массива соответствует одному миксину.
//      //  В случае простых блоков в массиве будет ровно один элемент.
//      [
//          {
//              //  DOM-события.
//              dom: {
//                  //  Тип DOM-события.
//                  click: {
//                      //  Селектор DOM-события (может быть пустой строкой).
//                      '': [
//                          //  Этот массив -- это обработчики для блока и его предков.
//                          //  Для "простых" блоков (без наследования), в массиве всегда один хэндлер.
//                          handler1,
//                          handler2,
//                          ...
//                      ],
//                      '.foo': [ handler3 ],
//                      ...
//                  },
//                  ...
//              },
//              //  Кастомные события.
//              custom: {
//                  'open': [ handler4, handler5 ],
//                  ...
//              }
//          }
//      ]
//
//  В общем есть два типа комбинирования классов:
//
//    * Миксины. Каждый миксин добавляет один объект во внешний массив.
//    * Расширение. Каждое расширение добавляет обработчики во внешние массивы.
//
Factory.prototype._prepareEvents = function(events) {
    events = events || {};

    var proto = this.ctor.prototype;

    //  Делим события на DOM и кастомные.
    var dom = {};
    var custom = {};
    var local = {};

    for (var event in events) {
        //  Матчим строки вида 'click' или 'click .foo'.
        var r = _rx_domEvents.exec(event);
        var handlers, key;
        if (r) {
            //  Тип DOM-события, например, click.
            var type = r[1];

            if (type === 'blur') {
                //  Тут те события, которые нужно слушать на конкретной ноде.
                handlers = local[type] || (( local[type] = {} ));
            } else {
                //  Тут все события, которые можно слушать на документе.
                handlers = dom[type] || (( dom[type] = {} ));
            }

            //  Селектор.
            key = r[2] || '';

        } else {
            handlers = custom;
            key = event;
        }

        var handler = events[event];

        //  handlers и key определяют, где именно нужно работать с handler.
        //  Скажем, если event это 'click .foo' или 'init', то это будут соответственно
        //  dom['click']['.foo'] и custom['init'].

        //  Строки превращаем в "ссылку" на метод.
        //  При этом, даже если мы изменим прототип (при наследовании, например),
        //  вызываться будут все равно правильные методы.
        if (typeof handler === 'string') {
            handler = proto[handler];
        }

        if (handler === null) {
            //  @doc
            //  Особый случай, бывает только при наследовании блоков.
            //  null означает, что нужно игнорировать родительские обработчики события.
            handlers[key] = null;
        } else {
            //  Просто добавляем еще один обработчик.
            handlers = handlers[key] || (( handlers[key] = [] ));
            handlers.push(handler);
        }

    }

    //  Для всех типов DOM-событий этого класса вешаем глобальный обработчик на document.
    for (var type in dom) {
        //  При этом, запоминаем, что один раз мы его уже повесили и повторно не вешаем.
        if (!_docEvents[type]) {
            $(document).on(type, function(e) {
                //  Все обработчики вызывают один чудо-метод:

                //  https://github.com/nanoblocks/nanoblocks/issues/48
                //  Цельнотянуто из jquery:
                //
                //  Make sure we avoid non-left-click bubbling in Firefox (#3861)
                if (e.button && e.type === 'click') {
                    return;
                }

                return Factory._onevent(e);
            });

            _docEvents[type] = true;
        }
    }

    //  На локальные события блок подписывается только после создания, потому что только в этот момент создаются настоящие ноды.

    //  Возвращаем структуру, которая будет сохранена в this.events.
    return [
        {
            dom: dom,
            custom: custom,
            local: local
        }
    ];

};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Создаем экземпляр соответствующего класса на переданной ноде node.
//  Опциональный параметр events позволяет сразу навесить на экземпляр блока
//  дополнительных событий (помимо событий, объявленных в nb.define).
Factory.prototype.create = function(node, events) {

    var id = node.getAttribute('id');
    if (!id) {
        //  У блока нет атрибута id. Создаем его, генерим уникальный id.
        //  В следующий раз блок можно будет достать из кэша при по этому id.
        id = 'nb-' + _id++;
        node.setAttribute('id', id);
    }

    //  Инициализируем кэш для блоков ноды, если нужно.
    if ( !_cache[id] ) {
        _cache[id] = {};

        //  FIXME: Что будет, если node.getAttribute('data-nb') !== this.name ?
        //  FIXME: для ручных вызовов nb.block() надо будет дописывать имена блоков в атрибут data-nb
        //  У ноды каждого блока должен быть атрибут data-nb.
        if ( _getName(node) === null ) {
            node.setAttribute('data-nb', this.name);
        }
    }

    //  Создаём блок текущей фабрики для переданной ноды.
    if ( !_cache[id][this.name] ) {

        var block = new this.ctor();

        //  Инициализируем блок.
        block.id = id;
        block.__init(node);

        //  Если переданы events, навешиваем их.
        if (events) {
            for (var event in events) {
                block.on( event, events[event] );
            }
        }

        //  Кэшируем блок. Последующие вызовы nb.block на этой же ноде
        //  достанут блок из кэша.
        _cache[id][this.name] = block;
    }

    return _cache[id][this.name];
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Наследуем события.
//  При наследовании классов необходимо склеить список обработчиков класса
//  с соответствующим списком обработчиков родителя.
//
//      {
//          dom: {
//              'click': {
//                  '.foo': [ .... ] // handlers
//                  ...
//
//  и
//
//      {
//          custom: {
//              'init': [ ... ] // handlers
//
//
Factory.prototype._extendEvents = function(base) {
    //  Это всегда "простой" класс (т.е. не миксин), так что всегда берем нулевой элемент.
    var t_dom = this.events[0].dom;
    var b_dom = base.events[0].dom;

    //  Конкатим обработчиков DOM-событий.
    for (var event in b_dom) {
        extend( t_dom[event] || (( t_dom[event] = {} )), b_dom[event] );
    }

    //  Конкатим обработчиков кастомных событий.
    extend( this.events[0].custom, base.events[0].custom );

    function extend(dest, src) {
        for (var key in src) {
            var s_handlers = src[key];
            var d_handlers = dest[key];

            //  Если встречаем null, это значит, что нужно все родительские обработчики выкинуть.
            dest[key] = (d_handlers === null) ? [] : s_handlers.concat( d_handlers || [] );
        }
    }

};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Единый live-обработчик всех DOM-событий.
Factory._onevent = function(e) {
    var type = e.type;

    //  Нода, на которой произошло событие.
    var origNode = e.target;

    //  Для mouseover/mouseout событий нужна особая обработка.
    var isHover = (type === 'mouseover' || type === 'mouseout');
    //  В случае isHover, это нода, из которой (в которую) переместили указатель мыши.
    var fromNode = e.relatedTarget;

    //  Эти переменные условно "глобальные".
    //  Они все используются нижеописанными функциями, которые имеют побочные эффекты.
    //
    //  Очередной отрезок (см. комментарии ниже).
    var nodes;
    //  Длина массива nodes.
    var n;
    //  Массив с соответствующими $(node) для nodes.
    var $nodes;
    //  Текущая нода блока.
    var blockNode;
    //  Текущее имя блока.
    var name;
    //  Текущая фабрика блоков.
    var factory;

    //  Мы проходим вверх по DOM'у, начиная от e.target до самого верха (<html>).
    //  Пытаемся найти ближайший блок, внутри которого случилось событие и
    //  у которого есть событие, подходящее для текущей ноды.

    //  Переменная цикла.
    var node = origNode;

    //  Оригинальная нода тоже имеет право на события!
    nodes = [];
    $nodes = [];
    n = nodes.length;

    while (1) {
        //  Цепочку нод от e.target до <html> мы разбиваем на отрезки,
        //  по границам блоков. Например:
        //
        //      <html> <!-- node5 -->
        //          <div data-nb="foo"> <!-- node4 -->
        //              <div> <!-- node3 -->
        //                  <div data-nb="bar"> <!-- node2 -->
        //                      <div> <!-- node1 -->
        //                          <span>Hello</span> <!-- node0 -->
        //
        //  Событие случилось на node0 (она же e.target).
        //  Тогда первый отрезок это [ node0, node1, node2 ], второй [ node3, node4 ], ...
        //
        //  Функция findBlockNodes возращает true, если очередной отрезок удалось найти,
        //  и false, если дошли до самого верха, не найдя больше нод блоков.
        //  При этом, она устанавливает значения переменных nodes, n, $nodes, blockNode, name, factory.
        if ( !findBlockNodes() ) {
            //  Все, больше никаких блоков выше node нет.
            break;
        }

        var names = _getNames(name);
        var r = true;

        for (var j = 0; j < names.length; j++) {

            //  Название текущего проверяемого блока.
            var blockName = names[j];

            //  Мы собрали в nodes все ноды внутри блока с именем name.
            factory = Factory.get( blockName );
            //  Берем все события, на которые подписан этот блок.
            var mixinEvents = factory.events;

            //  Для каждого миксина проверяем все ноды из nodes.
            for (var i = 0, l = mixinEvents.length; i < l; i++) {
                //  Пытаемся найти подходящее событие для node среди всех событий миксина.
                if ( checkEvents( blockName, mixinEvents[i].dom[type] ) === false ) {
                    //  Если обработчик вернул false выше текущей ноды обработка события не пойдёт.
                    //  Но на данной ноде событие послушают все блоки.
                    r = false;
                }
            }
        }

        //  Нашли подходящий блок, один из обработчиков события этого блока вернул false.
        //  Значит все, дальше вверх по DOM'у не идем. Т.е. останавливаем "баблинг".
        if (!r) { return false; }

        //  В случае hover-события с определенным fromNode можно останавливаться после первой итерации.
        //  fromNode означает, что мышь передвинули с одной ноды в другую.
        //  Как следствие, это событие касается только непосредственно того блока,
        //  внутри которого находится e.target. Потому что остальные блоки обработали этот ховер
        //  во время предыдущего mouseover/mouseout.
        //
        //  А вот в случае, когда fromNode === null (возможно, когда мышь передвинули, например,
        //  с другого окна в центр нашего окна), все блоки, содержащие e.target должны обработать ховер.
        if (fromNode) { return; }

        //  Догоняем список нод текущей нодой блока.
        nodes.push(node);
        $nodes.push( $(node) );
        n = nodes.length;

        //  Идем еще выше, в новый блок.
        node = node.parentNode;
    }

    function findBlockNodes() {
        //  Сбрасываем значения на каждой итерации.
        blockNode = null;

        var parent;
        //  Идем по DOM'у вверх, начиная с node и заканчивая первой попавшейся нодой блока (т.е. с атрибутом data-nb).
        //  Условие о наличии parentNode позволяет остановиться на ноде <html>.
        while (( parent = node.parentNode )) {
            if (( name = _getName(node) )) {
                blockNode = node;
                break;
            }
            //  При этом в nodes запоминаем только ноды внутри блока.
            nodes.push(node);
            node = parent;
        }

        if (blockNode) {
            if (isHover && fromNode) {
                //  Мы передвинули указатель мыши с одной ноды на другую.
                //  Если e.target это и есть нода блока, то внутренних (nodes) нод нет вообще и
                //  нужно проверить только саму ноду блока. Либо же нужно проверить одну
                //  внутреннюю ноду (e.target) и ноду блока.
                nodes = (origNode === blockNode) ? [] : [ origNode ];
            }
            n = nodes.length;

            return true;
        }
    }

    //  Проверяем все ноды из nodes и отдельно blockNode.
    //  blockName название блока, для которого выполняется проверка
    function checkEvents(blockName, events) {
        if (!events) { return; }

        var R;
        //  Проверяем, матчатся ли ноды какие-нибудь ноды из nodes на какие-нибудь
        //  селекторы из событий блока.
        var node, $node;
        for (var i = 0; i < n; i++) {
            node = nodes[i];
            //  Лениво вычисляем $node.
            $node = $nodes[i] || (( $nodes[i] = $(node) ));

            for (var selector in events) {
                //  Проверяем, матчится ли нода на селектор.
                if (
                    //  Во-первых, для внутренних нод блока должен быть селектор и нода должна ему соответствовать.
                    selector && $node.is(selector) &&
                    //  Во-вторых, для ховер-событий нужен отдельный костыль,
                    //  "преобразующий" события mouseover/mouseout в mouseenter/mouseleave.
                    !(
                        //  Если мы пришли из ноды fromNode,
                        isHover && fromNode &&
                        //  то она должна лежать вне этой ноды.
                        $.contains(node, fromNode)
                    )
                ) {
                    //  Вызываем обработчиков событий.
                    var r = doHandlers( node, blockName, events[selector] );
                    if (r === false) {
                        R = r;
                    }
                }
            }

            //  Стоп "баблинг"! В смысле выше по DOM'у идти не нужно.
            if (R === false) { return R; }
        }

        //  Отдельно обрабатываем ситуацию, когда node === blockNode.
        //  В этом случае мы смотрим только события без селекторов.
        //  События с селектором относятся только к нодам строго внутри блока.
        var handlers = events[''];
        //  Опять таки костыль для ховер-событий.
        if ( handlers && !( isHover && fromNode && $.contains(blockNode, fromNode)) ) {
            return doHandlers(blockNode, blockName, handlers);
        }
    }

    function doHandlers(node, blockName, handlers) {
        //  Блок создаем только один раз и только, если мы таки дошли до сюда.
        //  Т.е. если мы нашли подходящее для node событие.
        var block = factory.create(blockNode);

        //  В handlers лежит цепочка обработчиков этого события.
        //  Самый последний обработчик -- это обработчик собственно этого блока.
        //  Перед ним -- обработчик предка и т.д.
        //  Если в nb.define не был указан базовый блок, то длина цепочки равна 1.
        for (var i = handlers.length; i--; ) {
            //  В обработчик передаем событие и ноду, на которой он сработал.
            var r = handlers[i].call(block, e, node);
            //  Обработчик вернул false или null, значит оставшиеся обработчики не вызываем.
            //  При этом false означает, что не нужно "баблиться" выше по DOM'у.
            if (r === false) { return false; }
            if (r === null) { break; }
        }
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Достаем класс по имени.
Factory.get = function(name) {
    return _factories[name];
};