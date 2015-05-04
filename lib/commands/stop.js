var exec = require('child_process').exec,
       _ = require('lodash'),
 helpers = require('../helpers')

function rm(container, done) {
    done = done || _.noop

    exec('docker rm ' + container.name, function(err) {
        done()
    })
}

module.exports = function(logger) {
    return function(container, opts, done) {
        opts = _.defaults(opts || {}, {removeStopped: false})
        done = done || _.noop

        helpers.checkCreated(container, function(isCreated) {
            if (!isCreated) {
                done()
            } else {
                logger.info("Stopping " + container.name)
                exec('docker stop ' + container.name, function() {
                    if (opts.removeStopped) {
                        rm(container, done)
                    } else {
                        done()
                    }
                })
            }
        })
    }
}
