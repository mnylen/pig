var fs = require('fs'),
errors = require('./errors'),
     _ = require('lodash'),
  path = require('path'),
  yaml = require('js-yaml')

module.exports.fromFile = function(file) {
    var config = null

    if (path.extname(file) === '.json') {
      config = fromJsonFile(file);
    } else if (path.extname(file) === '.yml') {
      config = fromYamlFile(file);
    } else {
      throw new errors.ConfigError('Unknown file format: ' + file)
    }

    return resolveIncludes(config)
}

function fromJsonFile(file){
  try {
      return JSON.parse(fs.readFileSync(file))
  } catch (err) {
      throw new errors.ConfigError('Invalid JSON:\n' + err.stack)
  }
}

function fromYamlFile(file){
  try {
      return yaml.safeLoad(fs.readFileSync(file))
  } catch (err) {
      throw new errors.ConfigError('Invalid Yaml:\n' + err.stack)
  }
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
