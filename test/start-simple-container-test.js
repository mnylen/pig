var commands = require('../lib/commands'),
     helpers = require('./helpers'),
      expect = require('chai').expect,
        exec = require('child_process').exec,
           _ = require('lodash')

describe('starting a simple container', function() {
    var container = {
        "image": "ubuntu",
        "name": "test-container",
        "command": ["echo"] 
    }

    after(helpers.cleanUpTestContainers)

    describe('a non-daemon container', function() {
        before(function(done) {
            var args = ["Hello, world!"]
            commands.start(container, [container], args, { interactive: false }, done)
        })

        it('executes the given command', function(done) {
            helpers.logsOutput('test-container', function(stdout) {
                expect(stdout).to.eql('Hello, world!\n')
                done()
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
            commands.start(daemonContainer, [daemonContainer], [], { }, done)
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
            helpers.logsOutput('test-daemon-container', function(stdout) {
                expect(stdout).to.eql('hello from daemon\n')

                startDaemon('hello again', function(stdout) {
                    helpers.logsOutput('test-daemon-container', function(stdout) {
                        expect(stdout).to.eql('hello again\n')
                        done()
                    })
                })
            })
        })
    })
})

