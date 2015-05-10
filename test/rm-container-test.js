var helpers = require('./helpers'),
     expect = require('chai').expect,
      async = require('async'),
       exec = require('child_process').exec

describe('removing containers', function() {
    after(helpers.cleanUpTestContainers)
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
        }
    }

    var commands = helpers.commands(containers)

    before(function(done) {
        commands.startDaemons({recreate: true}, done)
    })

    it('stops and removes only the selected container', function(done) {
        commands.remove(containers.daemon1, function() {
            containerRunning('test-daemon1', function(running) {
                expect(running).to.eql(false)
                containerExists('test-daemon1', function(exists) {
                    expect(exists).to.eql(false)
                    containerExists('test-daemon2', function(d2Running) {
                        expect(d2Running).to.eql(true)
                        done()
                    })
                })
            })
        })
    })


    function containerExists(name, callback) {
        exec('docker inspect ' + name, function(err) {
            if (err) {
                callback(false)
            } else {
                callback(true)
            }
        })
    }

    function containerRunning(name, callback) {
        exec('docker inspect ' + name, function(err, stdout) {
            if (err) {
                callback(false)
            } else {
                console.log(stdout)
                callback(!!JSON.parse(stdout)[0].State.Running)
            }
        })
    }
})
