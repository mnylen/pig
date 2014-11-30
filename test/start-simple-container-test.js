var commands = require('../lib/commands'),
      expect = require('chai').expect,
        exec = require('child_process').exec

describe('starting a simple container', function() {
    var container = {
        "image": "ubuntu",
        "name": "test-container",
        "command": ["echo"] 
    }

    var stdout = ""
    var releaseStdout

    before(function(done) {
        captureStdout(function(data, encoding, fd) {
            stdout += data
        }, function(uncapture) {
            var args = ["Hello, world!"]
            commands.start(container, [container], args, { interactive: false }, function() {
                uncapture()
                done()
            }, false)
        })
    })

    it('executes the given command', function() {
        expect(stdout).to.eql('Hello, world!\n')
    })

    it('removes the container afterwards (uses --rm)', function(done) {
        exec('docker inspect test-container', function(err) {
            if (err) {
                done()
            } else {
                throw new Error('test-container was not removed from docker')
            }
        })
    })
})

function captureStdout(onData, block) {
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
