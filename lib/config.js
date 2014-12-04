var fs = require('fs'),
errors = require('./errors')

module.exports.fromFile = function(file) {
    if (!fs.existsSync(file)) {
        throw new errors.ConfigError(file + ' not found')
    }

    var config
    try {
        config = JSON.parse(fs.readFileSync(file))
    } catch (err) {
        throw new errors.ConfigError('Invalid JSON:\n' + err.stack)
    }

    return config
}

