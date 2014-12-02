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
})

