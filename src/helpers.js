var helpers = {};
module.exports = helpers;

//  Наследование:
//
//      function Foo() {}
//      Foo.prototype.foo = function() {
//          console.log('foo');
//      };
//
//      function Bar() {}
//      nb.inherit(Bar, Foo);
//
//      var bar = Bar();
//      bar.foo();
//
helpers.inherit = function (child, parent) {
    var F = function() {};
    F.prototype = parent.prototype;
    child.prototype = new F();
    child.prototype.constructor = child;
};

//  Расширение объекта свойствами другого объекта(ов):
//
//      var foo = { foo: 42 };
//      nb.extend( foo, { bar: 24 }, { boo: 66 } );
//
helpers.extend = function (dest) {
    var srcs = [].slice.call(arguments, 1);

    for (var i = 0, l = srcs.length; i < l; i++) {
        var src = srcs[i];
        for (var key in src) {
            dest[key] = src[key];
        }
    }

    return dest;
};

//  Информация про все объявленные блоки.
helpers._factories = {};

//  Список всех уже повешенных на document событий.
helpers._docEvents = {};

//  Список всех поддерживаемых DOM-событий.
helpers._domEvents = [
    'click',
    'dblclick',
    'mouseup',
    'mousedown',
    'keydown',
    'keypress',
    'keyup',
    'input',
    'change',

    // local: вешаются напрямую на ноду блока / подноду блока по селектору
    'blur',

    /*
        FIXME: Сейчас эти события называются mouseover и mouseout.
        'mouseenter',
        'mouseleave',
    */
    'mouseover',
    'mouseout',
    'focusin',
    'focusout'
];

//  Regexp для строк вида 'click', 'click .foo'.
helpers._rx_domEvents = new RegExp( '^(' + helpers._domEvents.join('|') + ')\\b\\s*(.*)?$' );

//  Получает название блока по ноде.
helpers._getName = function(node) {
    var _data_nb = node.getAttribute('data-nb');
    return _data_nb ? _data_nb.trim().replace(/\s+/g, ' ') : _data_nb;
};

helpers._getNames = function(name) {
    return name.split(/\s+/);
};

//  Автоинкрементный id для блоков, у которых нет атрибута id.
helpers._id = 0;

//  Кэш проинициализированных блоков.
//  По id ноды хранится хэш с блоками на ноде.
//  Пример: { 'button-id': { 'popup-toggler': {}, 'counter': {} } }
helpers._cache = {};