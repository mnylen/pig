var helpers = require('./helpers'),
     expect = require('chai').expect,
         fs = require('fs')

describe('hooks', function() {
    after(helpers.cleanUpTestContainers)

    describe('when hooks return successfully', function() {
        before(function(done) {
            var container = {
                "name": "test-container",
                "image": "ubuntu",
                "volumes": { "./tmp":"/tmp-data" },
                "command": ["cat", "/tmp-data/lorem.txt"],
                "hooks":{
                    "before": "./test/hooks/create-tmp.sh",
                    "after": "./test/hooks/clean-tmp.sh"
                }
            }

            helpers.commands(container).start(container, [], { recreate: true }, done)
        })

        it('executes before hook', function(done) {
            helpers.logsOutput('test-container', function(stdout) {
                expect(stdout).to.eql('lorem ipsum dolor sit amet\n\n')
                done()
            })
        })

        it('executes after hook', function() {
            expect(fs.existsSync('tmp')).to.be.false
        })
    })

    describe('when before hook exits with non-zero code', function() {
        var container = {
            "name": "test-container-before-fail",
            "image": "ubuntu",
            "command": ["echo", "Hello, world!"],
            "hooks": {
                "before": "./test/hooks/fail.sh"
            }
        }

        it('returns an error', function(done) {
            helpers.commands(container).start(container, [], { recreate: true }, function(err) {
                expect(err).to.not.be.undefined
                expect(err.message).to.eql('Hook ./test/hooks/fail.sh returned with code 1 != 0')
                done()
            })
        })

        it('does not start the container', function(done) {
            helpers.commands(container).start(container, [], { recreate: true }, function() {
                helpers.logsOutput('test-container-before-fail', function(stdout, stderr) {
                    expect(stdout).to.eql('')
                    done()
                })
            })
        })
    })

    describe('when after hook exits with non-zero code', function() {
        var container = {
            "name": "test-container-before-fail",
            "image": "ubuntu",
            "command": ["echo", "Hello, world!"],
            "hooks": {
                "after": "./test/hooks/fail.sh"
            }
        }

        it('returns an error', function(done) {
            helpers.commands(container).start(container, [], { recreate: true }, function(err) {
                expect(err).to.not.be.undefined
                expect(err.message).to.eql('Hook ./test/hooks/fail.sh returned with code 1 != 0')
                done()
            })
        })

        it('but does not affect the already running/exited container', function(done) {
            helpers.commands(container).start(container, [], { recreate: true }, function() {
                helpers.logsOutput('test-container-before-fail', function(stdout, stderr) {
                    expect(stdout).to.eql('Hello, world!\n')
                    done()
                })
            })
        })
    })

    describe('when after hook fails in linked container', function() {
        var containers = {
            "linked": {
                "name": "test-container-linked",
                "image": "ubuntu",
                "command": ["echo", "Hello from linked container!"],
                "daemon": true,
                "hooks": {
                    "after": "./test/hooks/fail.sh"
                }
            },

            "container": {
                "name": "test-container-with-linked-container-after-hook-fail",
                "image": "ubuntu",
                "command": ["echo", "Hello from container!"],
                "links": ["linked"]
            }
        }

        it('does not start the container', function(done) {
            helpers.commands(containers).start(containers.container, [], { recreate: true }, function(err) {
                expect(err).to.not.be.undefined
                expect(err.message).to.eql('Hook ./test/hooks/fail.sh returned with code 1 != 0')

                helpers.logsOutput('test-container-with-linked-container-after-hook-fail', function(stdout) {
                    expect(stdout).to.eql('')
                    done() 
                })
            })
        })
    })
})

