var exec = require('child_process').exec

module.exports.logsOutput = function(name, callback) {
    exec('docker logs ' + name, function(err, stdout, stderr) {
        callback(stdout, stderr)
    })
}

module.exports.commands = function(container) {
    if (container.name) {
        return require('../lib/commands')({ container: container }, { interactive: false })
    } else {
        return require('../lib/commands')(container, { interactive: false })
    }
}

module.exports.cleanUpTestContainers = function(done) {
    exec('docker ps -a |grep test-', function(err, stdout, stderr) {
        var containerIds = stdout
            .split('\n')
            .map(function(line) { return line.split(' ')[0] })
            .filter(function(id) { return id !== '' })

        function iterate(idx) {
            var id = containerIds[idx]
            if (id) {
                exec('docker kill ' + id + ' |xargs docker rm', function() {
                    iterate(idx+1)
                })
            } else {
                done()
            }
        }

        iterate(0)
    })
}
