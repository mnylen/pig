var helpers = require('./helpers'),
     expect = require('chai').expect

describe('starting containers included from another pig.json', function() {
    var mochaWorkingDirectory = process.cwd()
    after(function(done) {
        process.chdir(mochaWorkingDirectory)
        helpers.cleanUpTestContainers(done)
    })

    before(function(done) {
        process.chdir('test/include')

        var config = require('../lib/config').fromFile('pig.json')
        helpers.commands(config).start(config['prefix/container'], [], { recreate: true }, done)
    })

    it('chdirs to included pig path and starts the container', function(done) {
        helpers.logsOutput('test-container', function(stdout) {
            expect(stdout).to.contain('fileserver: lorem ipsum dolor sit amet\n')
            expect(stdout).to.contain('volume: lorem ipsum dolor sit amet\n')
            done()
        })
    })
})
