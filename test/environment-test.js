var helpers = require('./helpers'),
     expect = require('chai').expect

describe('setting environment variables', function() {
    afterEach(helpers.cleanUpTestContainers)

    describe('when values are just regular values', function() {
        var container = {
            "name":"test-container",
            "image":"ubuntu",
            "command": ["env"],
            "environment": {
                "env1":"foo",
                "env2":"bar baz",
            },
        }

        before(function(done) {
            helpers.commands(container).start(container, [], { recreate: true }, done)
        })

        it('passes the environment variables to container', function(done) {
            helpers.logsOutput('test-container', function(stdout) {
                expect(stdout).to.include('env1=foo\n')
                expect(stdout).to.include('env2=bar baz\n')
                done()
            })
        })
    })

})
