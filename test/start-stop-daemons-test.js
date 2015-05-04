var helpers = require('./helpers'),
     expect = require('chai').expect,
      async = require('async'),
       exec = require('child_process').exec

describe('starting and stopping daemons', function() {
    after(helpers.cleanUpTestContainers)

    describe('starting when the daemons are stopped', function() {
        var containers = {
            "daemon1":{
                "name": "test-daemon1",
                "image":"ubuntu",
                "daemon":true,
                "command":["echo", "hello from daemon1"]
            },

            "daemon2":{
                "name": "test-daemon2",
                "image":"ubuntu",
                "daemon":true,
                "command":["echo", "hello from daemon2"]
            },

            "nondaemon":{
                "name": "test-nondaemon",
                "image":"ubuntu",
                "command":["echo", "hello from nondaemon"]
            }
        }

        var commands = helpers.commands(containers)

        before(function(done) {
            commands.startDaemons({recreate: true}, done)
        })

        it('starts all containers with daemon: true', function(done) {
            helpers.logsOutput('test-daemon1', function(stdout) {
                expect(stdout).to.eql('hello from daemon1\n')

                helpers.logsOutput('test-daemon2', function(stdout) {
                    expect(stdout).to.eql('hello from daemon2\n')

                    helpers.logsOutput('test-nondaemon', function(stdout) {
                        expect(stdout).to.eql('')
                        done()
                    })
                })
            })
        })

        describe('stopping daemons', function() {
            before(commands.stopDaemons)

            it('stops all daemons but does not remove them', function(done) {
                async.map(['test-daemon1', 'test-daemon2'], containerRunning, function(_, running) {
                    expect(running).to.eql([false, false])
                    async.map(['test-daemon1', 'test-daemon2'], containerExists, function(_, exists) {
                        expect(exists).to.eql([true, true])
                        done()
                    })
                })
            })

            it('leaves non-daemon containers intact', function(done) {
                commands.start(containers.nondaemon, [], { recreate: true }, function() {
                    commands.stopDaemons(function() {
                        containerExists('test-nondaemon', function(_, result) {
                            expect(result).to.eql(true)
                            done()
                        })
                    })
                })
            })
        })

        function containerExists(name, callback) {
            exec('docker inspect ' + name, function(err) {
                if (err) {
                    callback(null, false)
                } else {
                    callback(null, true)
                }
            })
        }

        function containerRunning(name, callback) {
            exec('docker inspect ' + name, function(err, stdout) {
                if (err) {
                    callback(null, false)
                } else {
                    callback(null, !!JSON.parse(stdout)[0].State.Running)
                }
            })
        }
    })
})
