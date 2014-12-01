var helpers = require('./helpers'),
     expect = require('chai').expect,
       exec = require('child_process').exec,
          _ = require('lodash')

describe('linking containers', function() {
    after(helpers.cleanUpTestContainers)

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

            var commands = require('../lib/commands')(containers, { interactive: false })
            commands.start(containers.container, [], { recreate : true }, done)
        })
    })

    it('links the listed containers', function(done) {
        helpers.logsOutput('test-container', function(stdout) {
            expect(stdout).to.eql('lorem ipsum dolor sit amet\n\n')
            done()
        })
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
