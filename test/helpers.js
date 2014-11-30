var exec = require('child_process').exec 

module.exports.captureStdout = function(onData, block) {
    var oldWrite = process.stdout.write

    process.stdout.write = (function(write) {
        return function(string, encoding, fd) {
            onData(string, encoding, fd)
        }
    })(process.stdout.write)

    block(function() {
        process.stdout.write = oldWrite
    })
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
