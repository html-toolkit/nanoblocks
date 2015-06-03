var nb = require('./nb');

if ('undefined' !== typeof module) {
    module.exports = nb;
} else {
    global.nb = nb;
}