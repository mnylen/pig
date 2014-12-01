var helpers = require('./helpers'),
     expect = require('chai').expect,
       exec = require('child_process').exec,
          _ = require('lodash')

describe('bind mounting volumes', function() {
    after(helpers.cleanUpTestContainers)

    describe('using volumes property', function() {
        var relativeDataPath = "./test/data1"
        var absoluteDatapath = process.cwd() + "/test/data2"

        var volumes = {}
        volumes[relativeDataPath] = "/data1"
        volumes[absoluteDatapath] = "/data2"

        var container = {
            "image": "ubuntu",
            "name": "test-lorem",
            "command": ["cat", "/data1/lorem.txt", "/data2/jack.txt"],
            "volumes": volumes 
        }

        var commands = require('../lib/commands')({ container: container }, { interactive: false })

        before(function(done) {
            commands.start(container, [], { recreate : true }, done) 
        })

        it('makes host files readable inside container', function(done) {
            helpers.logsOutput('test-lorem', function(stdout) {
                expect(stdout).to.eql('lorem ipsum dolor sit amet\n\n' +
                                      'all work and no play makes jack a dull boy\n\n')

                done()
            })
        })
    })

    describe('using volumesFrom property', function() {
        var containers = {
            "data":{
                "image": "ubuntu",
                "name": "test-data",
                "daemon": true,
                "command": ["tail", "-f", "/dev/null"],
                "volumes": { "./test/data1": "/data" }
            },

            "container":{
                "image": "ubuntu",
                "name": "test-container",
                "command": ["cat", "/data/lorem.txt"],
                "volumesFrom": ["data"]
            }
        }

        var commands = require('../lib/commands')(containers, { interactive: false })

        before(function(done) {
            commands.start(containers.container, [], { recreate : true }, done)
        })

        it('makes volumes from other container available inside container', function(done) {
            helpers.logsOutput('test-container', function(stdout) {
                expect(stdout).to.eql('lorem ipsum dolor sit amet\n\n')
                done()
            })
        })
    })
})

