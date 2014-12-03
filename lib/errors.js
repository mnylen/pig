var util = require('util')

function ConfigError(message) {
    Error.call(this)
    Error.captureStackTrace(this, this.constructor)

    this.name = this.constructor.name
    this.message = message
}

util.inherits(ConfigError, Error)

module.exports = {
    ConfigError: ConfigError 
}
