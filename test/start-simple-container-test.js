var commands = require('../lib/commands'),
      expect = require('chai').expect,
        exec = require('child_process').exec,
           _ = require('lodash')

describe('starting a simple container', function() {
    var container = {
        "image": "ubuntu",
        "name": "test-container",
        "command": ["echo"] 
    }

    var stdout = ""

    after(function(done) {
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
    })

    describe('a non-daemon container', function() {
        before(function(done) {
            captureStdout(function(data, encoding, fd) {
                stdout += data
            }, function(uncapture) {
                var args = ["Hello, world!"]
                commands.start(container, [container], args, { interactive: false }, function() {
                    uncapture()
                    done()
                })
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

    describe('a daemon container', function() {
        var daemonContainer = _.merge({}, container, {
            name: 'test-daemon-container',
            daemon: true
        })

        function startDaemon(message, done) {
            daemonContainer.command = ["echo", message]

            captureStdout(_.noop, function(uncapture) {
                commands.start(daemonContainer, [daemonContainer], [], { }, function() {
                    uncapture()
                    done()
                })
            })
        }

        before(function(done) {
            startDaemon("hello from daemon", done)
        })

        it('is left running on the background', function(done) {
            exec('docker inspect test-daemon-container', function(err) {
                if (err) {
                    throw new Error('test-daemon-container was not running')
                } else {
                    done()
                }
            })
        })

        it('can be restarted using start command again', function(done) {
            exec('docker logs test-daemon-container', function(err, stdout, stderr) {
                expect(stdout).to.eql('hello from daemon\n')

                startDaemon('hello again', function() {
                    exec('docker logs test-daemon-container', function(err, stdout, stderr) {
                        expect(stdout).to.eql('hello again\n')
                        done()
                    })
                })
            })
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
