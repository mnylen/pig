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

    describe('when values use substitution', function() {
        var container = {
            "name": "test-container",
            "image": "ubuntu",
            "command": ["env"],
            "environment":{
                "http_proxy":"$http_proxy",
                "https_proxy":"$https_proxy",
                "no_proxy":"$no_proxy",
                "middle_substitution": "substituting works at middle of string $http_proxy!"
            }
        }

        before(function(done) {
            process.env['http_proxy'] = 'http://localhost:8080'
            process.env['https_proxy'] = 'https://localhost:8080'
            helpers.commands(container).start(container, [], { recreate: true }, done)
        })

        it('passes the runtime values for environment variables to container', function(done) {
            helpers.logsOutput('test-container', function(stdout) {
                expect(stdout).to.include('http_proxy=http://localhost:8080\n')
                expect(stdout).to.include('https_proxy=https://localhost:8080\n')
                expect(stdout).to.include('no_proxy=\n')
                expect(stdout).to.include('middle_substitution=substituting works at middle of string http://localhost:8080!\n')
                done()
            })
        })
    })
})
