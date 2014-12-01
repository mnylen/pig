var helpers = require('./helpers'),
      expect = require('chai').expect,
      domain = require('domain'),
        exec = require('child_process').exec,
           _ = require('lodash')

describe('pig.json validations', function() {
    afterEach(helpers.cleanUpTestContainers)

    describe('link validations', function(done) {
        it('throws Error when a linked container does not exist in pig.json', function(done) {
            var container = {
                "name": "test-container",
                "image": "ubuntu",
                "command": ["echo", "Hello, world!"],
                "links": ["foo"]
            }

            helpers.commands(container).start(container, [], { recreate:  true }, function(err) {
                expect(err.message).to.eql('Could not resolve link foo for test-container')
                done()
            })
        })

        it('throws Error when trying to link container to itself', function(done) {
            var container = {
                "name": "test-container",
                "image": "ubuntu",
                "command": ["echo", "Hello, world!"],
                "daemon": true,
                "links": ["container"] 
            }

            helpers.commands(container).start(container, [], { recreate: true}, function(err) {
                expect(err.message).to.eql('Container test-container is linking to itself.')
                done()
            })
        })

        it('throws Error when linked container is not a daemon', function(done) {
            var containers = {
                "another": {
                    "name": "test-another",
                    "image": "ubuntu",
                    "command": ["echo", "Hello, world!"],
                },
                "container": {
                    "name": "test-container",
                    "image": "ubuntu",
                    "command": ["echo", "Hello, World!"],
                    "links": ["another"]
                }
            } 

            helpers.commands(containers).start(containers.container, [], { recreate: true }, function(err) {
                expect(err.message).to.eql('Link another for test-container is not a daemon. Only daemons can be linked to.')
                done()
            })
        })
    })
})
