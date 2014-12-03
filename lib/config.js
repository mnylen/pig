var fs = require('fs'),
errors = require('./errors')

function read() {
    if (!fs.existsSync('pig.json')) {
        throw new errors.ConfigError('pig.json not found')
    }

    var config
    try {
        config = JSON.parse(fs.readFileSync('pig.json'))
    } catch (err) {
        throw new errors.ConfigError('Invalid JSON:\n' + err.stack)
    }

    return config
}

module.exports = {
    read: read
}

