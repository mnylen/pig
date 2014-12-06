var exec = require('child_process').exec

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
    exec('docker inspect ' + container.name, function(err) {
        var isRunning = err ? false : true 
        callback(isRunning)
    })
}

