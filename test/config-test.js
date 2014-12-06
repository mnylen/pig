var config = require('../lib/config'),
      path = require('path'),
    expect = require('chai').expect

describe('config', function() {
    var mochaWorkingDirectory = process.cwd()
    afterEach(function() {
        process.chdir(mochaWorkingDirectory)
    })

    describe('with includes', function() {
        it('adds containers from path to the root configuration using prefix', function() {
            process.chdir('test/include')

            expect(config.fromFile('pig.json')).to.eql({
                "prefix/fileserver":{
                    "name":"test-fileserver",
                    "image":"python",
                    "daemon":true,
                    "command":["python", "-mhttp.server", "8080"],
                    "workdir":"/data",
                    "volumes":{
                        "../../data1":"/data"
                    },
                    "pigdir":path.join(process.cwd(), 'another')
                },

                "prefix/container":{
                    "name":"test-container",
                    "build":".",
                    "links":["prefix/fileserver"],
                    "volumesFrom":["prefix/fileserver"],
                    "pigdir":path.join(process.cwd(), 'another')
                }
            })
        })
    })
})