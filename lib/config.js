var fs = require('fs'),
errors = require('./errors'),
     _ = require('lodash'),
  path = require('path')

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


    return resolveIncludes(config)
}

function createPrefixer(prefix) {
    return function(name) {
        return prefix + "/" + name
    }
}

function resolveIncludes(config) {
    var includes = config.include
    delete config.include

    _.forOwn(includes, function(prefix, jsonPath) {
        var includedConfig = exports.fromFile(jsonPath)

        _.forOwn(includedConfig, function(container, name) {
            var addPrefix = createPrefixer(prefix)

            container.pigdir = path.resolve(path.dirname(jsonPath))

            if (container.links) {
                container.links = container.links.map(addPrefix)
            }

            if (container.volumesFrom) {
                container.volumesFrom = container.volumesFrom.map(addPrefix)
            }

            config[addPrefix(name)] = container
        })
    })

    return config
}