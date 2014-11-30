var commands = require('../lib/commands'),
     helpers = require('./helpers'),
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

        var stdout = ""
        before(function(done) {
            helpers.captureStdout(function(data) {
                stdout += data
            }, function(uncapture) {
                commands.start(container, [container], [], { interactive: false }, function() {
                    uncapture()
                    done()
                })
            })
        })

        it('makes host files readable inside container', function() {
            expect(stdout).to.eql('lorem ipsum dolor sit amet\n\n' +
                                  'all work and no play makes jack a dull boy\n\n')
        })
    })
})
