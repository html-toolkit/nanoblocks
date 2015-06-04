var Factory = require('./factory');
var helpers = require('./helpers');

//  ---------------------------------------------------------------------------------------------------------------  //

//  Block
//  --------

//  Базовый класс для блоков. В явном виде не используется.
//  Все реальные блоки наследуются от него при помощи функции nb.define.

var Block = function() {};
module.exports = Block;

//  ---------------------------------------------------------------------------------------------------------------  //

//  Публичные методы и свойства блоков
//  ----------------------------------

//  Публичные свойства:
//
//    * name -- имя блока.
//    * node -- html-нода, на которой был проинициализирован блок.

//  Публичные методы у Block:
//
//    * on, off, trigger        -- методы для работы с событиями (кастомными и DOM).
//    * nbdata                  -- получает/меняет/удаляет data-nb-атрибуты блока.
//    * show, hide              -- показывает/прячет блок.
//    * getMod, setMod, delMod  -- методы для работы с модификаторами.

//  ---------------------------------------------------------------------------------------------------------------  //

//  Сам конструктор пустой для удобства наследования,
//  поэтому вся реальная инициализация тут.
Block.prototype.__init = function(node) {
    //  Нода блока.
    this.node = node;

    //  Обработчики кастомных событий.
    this.__handlers = {};

    //  Развешиваем обработчики кастомных событий.
    this.__bindEvents();

    //  Возможность что-то сделать сразу после инициализации.
    this.trigger('init');

    var space = helpers._cache['nb-1']['nb-0'];
    if (space) {
        space.trigger('inited:' + this.id, this);
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Вешаем кастомные (не DOM) события на экземпляр блока.
Block.prototype.__bindEvents = function() {
    var that = this;

    //  Информация про события блока лежат в его factory.
    var mixinEvents = Factory.get(this.name).events;

    //  Вешаем события для каждого миксина отдельно.
    for (var i = 0, l = mixinEvents.length; i < l; i++) {
        var events = mixinEvents[i].custom;
        var local = mixinEvents[i].local;

        for (var event in events) {
            (function(handlers) {
                that.__bindCustomEvent(event, function(e, params) {

                    //  Перебираем обработчики справа налево: самый правый это обработчик самого блока,
                    //  затем родительский и т.д.
                    for (var i = handlers.length; i--; ) {
                        var r = handlers[i].call(that, e, params);
                        //  false означает, что нужно прекратить обработку и не баблиться дальше,
                        //  а null -- что просто прекратить обработку (т.е. не вызывать унаследованные обработчики).
                        if (r === false || r === null) { return r; }
                    }
                });
            })( events[event] );
        }

        //  Навешиваем локальные обработчики (напрямую на ноды).
        //  Для этого вначале собираем строки вида `event selector`
        for (var event in local) {
            for (var selector in local[event]) {
                var suffix = (selector || '').length ? (' ' + selector) : '';
                var eventDefinition = event + suffix;
                var handlers = local[event][selector];
                for (var i = 0; i < handlers.length; i++) {
                    (function(handler) {
                        that.on(eventDefinition, function() {
                            handler.apply(that, arguments);
                        });
                    } (handlers[i]));
                }
            }
        }
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Удаляем блок.
Block.prototype.destroy = function() {

    var mixinEvents = Factory.get(this.name).events;

    for (var i = 0, l = mixinEvents.length; i < l; i++) {
        //  Снимаем все кастомные события.
        for (var event in mixinEvents[i].custom) {
            this.off(event);
        }
        //  Снимаем все локальные события.
        for (var event in mixinEvents[i].local) {
            this.off(event);
        }
    }

    //  Удалем блок из кэша.
    helpers._cache[this.id] = null;
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Работа с событиями
//  ------------------

//  Каждый блок реализует простейший pub/sub + возможность вешать DOM-события.

//  Возвращает список обработчиков события name.
//  Если еще ни одного обработчика не забинжено, возвращает (и сохраняет) пустой список.
Block.prototype.__getHandlers = function(name) {
    var handlers = this.__handlers;

    return handlers[name] || (( handlers[name] = [] ));
};

//  Подписываем обработчик handler на событие name.
//  При этом name может быть вида:
//
//    * 'click'         -- обычное DOM-событие.
//    * 'click .foo'    -- DOM-событие с уточняющим селектором.
//    * 'init'          -- кастомное событие.
//
//  DOM-события вешаются на ноду блока.
//  Помимо этого, есть еще возможность подписаться на DOM-события,
//  повешенные на document (см. nb.define).
//
Block.prototype.on = function(name, handler) {
    var r = helpers._rx_domEvents.exec(name);
    if (r) {
        //  DOM-событие.

        //  В r[1] тип события (например, click), в r[2] необязательный селектор.
        $(this.node).on( r[1], r[2] || '', handler );
    } else {
        //  Кастомное событие.

        this.__bindCustomEvent(name, handler);
    }

    return handler;
};

Block.prototype.__bindCustomEvent = function(name, handler) {
    this.__getHandlers(name).push(handler);
};

//  Отписываем обработчик handler от события name.
//  Если не передать handler, то удалятся вообще все обработчики события name.
//  Типы событий такие же, как и в on().
Block.prototype.off = function(name, handler) {
    var r = helpers._rx_domEvents.exec(name);
    if (r) {
        //  DOM-событие.

        $(this.node).off( r[1], r[2] || '', handler );
    } else {
        //  Кастомное событие.

        if (handler) {
            var handlers = this.__getHandlers(name);
            //  Ищем этот хэндлер среди уже забинженных обработчиков этого события.
            var i = handlers.indexOf(handler);

            //  Нашли и удаляем этот обработчик.
            if (i !== -1) {
                handlers.splice(i, 1);
            }
        } else {
            //  Удаляем всех обработчиков этого события.
            this.__handlers[name] = null;
        }
    }
};

//  "Генерим" кастомное событие name.
//  Т.е. вызываем по очереди (в порядке подписки) все обработчики события name.
//  В каждый передаем name и params.
Block.prototype.trigger = function(name, params) {
    //  Копируем список хэндлеров. Если вдруг внутри какого-то обработчика будет вызван off(),
    //  то мы не потеряем вызов следующего обработчика.
    var handlers = this.__getHandlers(name).slice();

    for (var i = 0, l = handlers.length; i < l; i++) {
        //  Вызываем обработчик в контексте this.
        handlers[i].call(this, name, params);
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Метод возвращает или устанавливает значение data-атрибута блока.
//  Блок имеет доступ (через этот метод) только к data-атрибутам с префиксом nb-.
//  Как следствие, атрибут data-nb недоступен -- он определяет тип блока
//  и менять его не рекомендуется в любом случае.
//
//  Если вызвать метод без аргументов, то он вернет объект со всеми data-атрибутами.
//
Block.prototype.nbdata = function(key, value) {
    return nb.node.data(this.node, key, value);
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Показываем блок.
Block.prototype.show = function() {
    $(this.node).removeClass('_hidden');
    this.trigger('show');
};

//  Прячем блок.
Block.prototype.hide = function() {
    $(this.node).addClass('_hidden');
    this.trigger('hide');
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Работа с модификаторами
//  -----------------------

//  Получить модификатор.
Block.prototype.getMod = function(name) {
    return nb.node.setMod(this.node, name);
};

//  Установить модификатор.
Block.prototype.setMod = function(name, value) {
    nb.node.setMod(this.node, name, value);
};

//  Удалить модификатор.
Block.prototype.delMod = function(name) {
    nb.node.setMod(this.node, name, false);
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Возвращает массив блоков, находящихся внутри блока.
//  Вариант для применения:
//
//      block.children.forEach(function(block) {
//          block.trigger('init');
//      });
//
Block.prototype.children = function() {
    var children = [];

    //  Ищем все ноды с атрибутом data-nb. Это потенциальные блоки.
    var $nodes = $(this.node).find('[data-nb]');
    for (var i = 0, l = $nodes.length; i < l; i++) {
        children = children.concat( nb.blocks( $nodes[i] ) );
    }

    return children;
};
