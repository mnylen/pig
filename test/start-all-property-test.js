var helpers = require('./helpers'),
     expect = require('chai').expect

describe('startAll property', function() {
    after(helpers.cleanUpTestContainers)

    it('starts all listed containers in daemon mode', function(done) {
        var config = {
            "foo":{
                "name":"test-foo",
                "image":"ubuntu",
                "command":["echo", "foo"]
            },
            "bar":{
                "name":"test-bar",
                "image":"ubuntu",
                "command":["echo", "bar"]
            },
            "baz":{
                "startAll":["foo", "bar"]
            }
        }

        helpers.commands(config).start(config.baz, [], { recreate: true }, function(err) {
            expect(err).to.be.undefined

            helpers.logsOutput('test-foo', function(stdout) {
                expect(stdout).to.eql('foo\n')

                helpers.logsOutput('test-bar', function(stdout) {
                    expect(stdout).to.eql('bar\n')
                    done()
                })
            })
        })
    })
})
