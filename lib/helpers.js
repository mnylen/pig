var exec = require('child_process').exec,
       _ = require('lodash')


module.exports.asyncIterate = function(array, callback, done) {
    function iterate(idx) {
        var current = array[idx]

        if (current) {
            callback(current, function() { iterate(idx+1) }, function(err) { done(err) })
        } else {
            done()
        }
    }

    iterate(0)
}

module.exports.checkRunning = function(container, callback) {
    exec('docker inspect ' + container.name, function(err, stdout) {
        if (err) {
            callback(false)
        } else {
            var info = _.head(JSON.parse(stdout))
            var isRunning = info && info.State ? !!info.State.Running : false
            callback(isRunning)
        }
    })
}

module.exports.checkCreated = function(container, callback) {
    exec('docker inspect ' + container.name, function(err) {
        var isCreated = err ? false : true
        callback(isCreated)
    })
}
