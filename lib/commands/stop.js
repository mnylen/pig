var exec = require('child_process').exec,
 helpers = require('../helpers')

function rm(container, done) {
    done = done || _.noop 

    exec('docker rm ' + container.name, function(err) {
        done()
    })
}

module.exports = function(logger) {
    return function(container, done) {
        done = done || _.noop 

        helpers.checkRunning(container, function(isRunning) {
            if (!isRunning) {
                done()
            } else {
                logger.info("Stopping " + container.name)
                exec('docker stop ' + container.name, function() {
                    rm(container, done)
                })
            }
        })
    }
}
