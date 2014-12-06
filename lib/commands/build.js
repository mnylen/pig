var  fs = require('fs'),
  spawn = require('child_process').spawn,
 errors = require('../errors'),
   path = require('path'),
      _ = require('lodash')

module.exports = function(logger) {
    return function(container, done) {
        var contextPath = container.build
        if (container.buildTemplate) {
            contextPath = container.buildTemplate.path
            
            var templateData = _.defaults(container.buildTemplate.data || {}, { env: process.env })
            try {
                renderTemplate(contextPath, templateData) 
            } catch (err) {
                return done(err)
            }
        }

        if (contextPath) {
            var imageName = container.name + "-image"

            logger.info("Building image for " + container.name)
            build(contextPath, imageName, function(err) {
                container.image = imageName
                if (container.buildTemplate) { // clean up rendered Dockerfile 
                    fs.unlinkSync(path.join(contextPath, 'Dockerfile'))
                }

                done(err)
            })
        } else {
            done()
        }
    }
}

function build(contextPath, tag, done) {
    var build = spawn('docker', [
        'build',
        '-t',
        tag,
        contextPath 
    ], { stdio: 'inherit' })

    build.on('close', function(status) {
        if (status === 0) {
            done()
        } else {
            done(new errors.PigError("Could not build image " + tag + " using Dockerfile in " + contextPath))
        }
    })
}


function renderTemplate(contextPath, templateData) {
    var templatePath = path.join(contextPath, 'Dockerfile.template')
    var dockerfilePath = path.join(contextPath, 'Dockerfile')

    if (!fs.existsSync(templatePath)) {
        throw new errors.PigError("Could not build from template because file template file " + templatePath + " was not found.")
    }

    if (fs.existsSync(dockerfilePath)) {
        throw new errors.PigError("Can't build from template because file " + dockerfilePath + " already exists.\n" +
                                  "Please make sure your template is not named 'Dockerfile'")
    }

    var template = fs.readFileSync(templatePath)
    var contents = _.template(template, templateData)

    fs.writeFileSync(dockerfilePath, contents)
}


