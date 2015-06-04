var nb = {};

var Block = require('./block');
var Factory = require('./factory');
var helpers = require('./helpers');

global.nb = module.exports = nb;

var space;

//  Возвращает информацию про то, инициализирован ли блок на ноде.
//  @param {Element} node Нода, для которой выполняется проверка.
//  @param {string=} blockName (optional) Имя блока, созданность которого проверяется.
nb.hasBlock = function(node, blockName) {
    var id = node.getAttribute('id');
    return !!(id && helpers._cache[id] && (!blockName || helpers._cache[id][blockName]));
};

//  Если передано название блока, создаётся блок этого типа на ноде. Возвращается созданный блок.
//  Если не передано название блока, создаются все блоки на переданной ноде и возвращается первый из созданных блоков.
//
//      var popup = nb.block( document.getElementById('popup') );
//
nb.block = function(node, events, blockName) {
    var name = helpers._getName(node);
    if (!name) {
        //  Эта нода не содержит блока. Ничего не делаем.
        return null;
    }

    //  Если указано имя блока - инициализируем и возвращаем только его.
    if (blockName) {
        return Factory.get(blockName).create(node, events);
    }

    //  Инициализируем все блоки на ноде.
    //  Возвращаем первый из списка блоков.
    return nb.blocks(node, events)[0];
};

//  Метод создает и возвращает все блоки на переданной ноде:
//
//      var popup = nb.blocks( document.getElementById('popup') );
//
nb.blocks = function(node, events) {
    var name = helpers._getName(node);
    if (!name) {
        return [];
    }

    //  Инициализируем все блоки на ноде.
    //  Возвращаем первый из списка блоков.
    var names = helpers._getNames(name);
    var blocks = [];
    for (var i = 0; i < names.length; i++) {
        blocks.push(Factory.get(names[i]).create(node, events));
    }
    return blocks;
};

//  Находим ноду по ее id, создаем на ней блок и возвращаем его.
nb.find = function(id) {
    var node = document.getElementById(id);
    if (node) {
        return nb.block(node);
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Метод определяет новый блок (точнее класс):
//
//      nb.define('popup', {
//          //  События, на которые реагирует блок.
//          events: {
//              'click': 'onclick',             //  DOM-событие.
//              'click .close': 'onclose',      //  DOM-событие с уточняющим селектором.
//              'open': 'onopen',               //  Кастомное событие.
//              'close': function() { ... }     //  Обработчик события можно задать строкой-именем метода, либо же функцией.
//              ...
//          },
//
//          //  Дополнительные методы блока.
//          'onclick': function() { ... },
//          ...
//      });
//
nb.define = function(name, methods, base) {
    if (typeof name !== 'string') {
        //  Анонимный блок.

        //  Сдвигаем параметры.
        base = methods;
        methods = name;
        //  Генерим ему уникальное имя.
        name = 'nb-' + helpers._id++;
    }

    if (base) {
        base = Factory.get(base);
    }

    //  Вытаскиваем из methods информацию про события.
    var events = methods.events;
    //  Оставляем только методы.
    delete methods.events;

    //  Пустой конструктор.
    var ctor = function() {};
    //  Наследуемся либо от дефолтного конструктора, либо от указанного базового.
    helpers.inherit( ctor, (base) ? base.ctor : Block );
    //  Все, что осталось в methods -- это дополнительные методы блока.
    helpers.extend(ctor.prototype, methods);

    var factory = new Factory(name, ctor, events);

    //  Если указан базовый блок, нужно "склеить" события.
    if (base) {
        factory._extendEvents(base);
    }

    //  Сохраняем для дальнейшего применения.
    //  Достать нужную factory можно вызовом Factory.get(name).
    helpers._factories[name] = factory;

    return factory;
};

//  Создаем "космос".
//  Физически это пустой блок, созданный на ноде html.
//  Его можно использовать как глобальный канал для отправки сообщений
//  и для навешивания разных live-событий на html.
var space = nb.define({
    events: {
        'click': function(e) {
            nb.trigger('space:click', e.target);
        }
    }
}).create( document.getElementsByTagName('html')[0] );

nb.on = function(name, handler) {
    return space.on(name, handler);
};

nb.off = function(name, handler) {
    space.off(name, handler);
};

nb.trigger = function(name, params) {
    space.trigger(name, params);
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Неленивая инициализация.
//  Находим все ноды с классом _init и на каждой из них инициализируем блок.
//  По-дефолту ищем ноды во всем документе, но можно передать ноду,
//  внутри которой будет происходить поиск. Полезно для инициализации динамически
//  созданных блоков.
nb.init = function(where) {
    where = where || document;

    var nodes = $(where).find('._init').addBack().filter('._init'); // XXX
    for (var i = 0, l = nodes.length; i < l; i++) {
        nb.block( nodes[i] );
    }
};

//  FIXME метод странный, потому что от него ожидаешь, что он найдёт все блоки внутри ноды и кильнёт их, а он ищет по классу _init только.
//  FIXME тест на то, что подписанные обработчики отписались
nb.destroy = function(where) {
    where = where || document;

    var nodes = $(where).find('._init').addBack().filter('._init');
    for (var i = 0, l = nodes.length; i < l; i++) {
        var node = nodes[i];
        var id = node.getAttribute('id');
        var blocks = _cache[id];
        if (blocks) {
            for (var name in blocks) {
                blocks[name].destroy();
            }
        }
    }
};
