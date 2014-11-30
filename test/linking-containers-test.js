var commands = require('../lib/commands'),
     helpers = require('./helpers'),
      expect = require('chai').expect,
        exec = require('child_process').exec,
           _ = require('lodash')

describe('linking containers', function() {
    after(helpers.cleanUpTestContainers)

    var stdout = ""
    before(function(done) {
        helpers.cleanUpTestContainers(function() {
            var containers = {
                "fileserver":{
                    "name": "test-fileserver",
                    "daemon": true,
                    "image": "python",
                    "command": ["python", "-mhttp.server", "8080"],
                    "workdir": "/data",
                    "volumes": { "./test/data1": "/data" },
                },

                "container":{
                    "name": "test-container",
                    "image": "python",
                    "volumes": { "./test/data2": "/data" },
                    "command": ["/data/request-file.sh"],
                    "links": ["fileserver"]
                }
            }

            helpers.captureStdout(function(data) {
                stdout += data
            }, function(uncapture) {
                commands.start(containers.container, containers, [], { interactive: false }, function() {
                    uncapture()
                    done()
                })
            })
        })
    })

    it('links the listed containers', function() {
        expect(stdout).to.eql('lorem ipsum dolor sit amet\n\n')
    })

    it('leaves linked containers running', function(done) {
        exec('docker inspect test-fileserver', function(err, stdout) {
            if (err) {
                throw new Error('test-fileserver was expected to be running')
            } else {
                done()
            }
        })
    })
})
