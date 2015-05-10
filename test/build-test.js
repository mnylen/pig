var helpers = require('./helpers'),
     expect = require('chai').expect

describe('building', function() {
    after(helpers.cleanUpTestContainers)

    describe('with Dockerfile', function() {
        it('builds the image using Dockerfile in the specified build context', function(done) {
            var container = {
                "name": "test-dockerfile",
                "build": "test/dockerfile"
            }

            helpers.commands(container).start(container, [], { recreatE: true }, function(err) {
                expect(err).to.be.undefined
                
                helpers.logsOutput('test-dockerfile', function(stdout) {
                    expect(stdout).to.eql('hello, dockerfile\n')
                    done()
                })
            })
        })

        describe('when Dockerfile is broken', function() {
            it('returns an error', function(done) {
                var container = {
                    "name": "test-broken-dockerfile",
                    "build": "test/broken-dockerfile"
                }

                helpers.commands(container).start(container, [], { recreate: true }, function(err) {
                    expect(err).to.not.be.undefined
                    done()
                })
            })
        })
    })

    describe('with template', function() {
        describe('when template is ok', function() {
            function startWithCommand(command, callback) { 
                var container = {
                    "name": "test-container",
                    "command": command,
                    "buildTemplate": {
                        "path": "test/template",
                        "data": { "message": "foobar" }
                    }
                }

                helpers.commands(container).start(container, [], { recreate: true }, function(err) {
                    expect(err).to.be.undefined

                    helpers.logsOutput('test-container', function(stdout, stderr) {
                        callback(stdout, stderr)
                    })
                })
            }

            it('uses Dockerfile.template from given path to build the template', function(done) {
                startWithCommand(['cat', '/greeting.txt'], function(stdout) {
                    expect(stdout).to.eql('hello, world!\n')
                    done()
                })
            })

            it('passes variables to the lodash template', function(done) {
                startWithCommand(['env'], function(stdout) {
                    expect(stdout).to.contain('message=foobar\n')
                    done()
                })
            })

            it('passes process.env to the lodash template as \'env\'', function(done) {
                process.env.somevar = "value"

                startWithCommand(['env'], function(stdout) {
                    expect(stdout).to.contain('env_somevar=value\n')
                    done()
                })
            })
        })

        describe('when rendering template fails because of syntax error', function() {
            it('returns error', function(done) {
                var container = {
                    "name": "test-container",
                    "buildTemplate": {
                        "path": "test/broken-template",
                        "data": { "message": "foobar" }
                    }
                }

                helpers.commands(container).start(container, [], { recreate: true }, function(err) {
                    expect(err).to.not.be.undefined
                    expect(err.message).to.eql("Unexpected identifier")
                    done()
                })
            })
        })
    })
})
