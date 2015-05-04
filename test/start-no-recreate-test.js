var helpers = require('./helpers'),
    expect = require('chai').expect,
    exec = require('child_process').exec,
    _ = require('lodash')

describe('starting a simple container without re-creation', function() {
    after(helpers.cleanUpTestContainers)

    var container = {
        "image": "ubuntu",
        "name": "test-container",
        "command": ["sh", "-c", "echo foo >> /tmp/_data && cat /tmp/_data"]
    }

    var commands = require('../lib/commands')(container, { interactive: false })

    it("preserves the container's state", function(done) {
        start(true, function(out) {
            expect(out).to.eql("foo\n")
            commands.stop(container, function() {
                start(false, function(out) {
                  expect(out).to.eql("foo\nfoo\nfoo\n")  // third line comes from log reading
                  done()
                })
            })
        })

        function start(recreate, callback) {
          commands.start(container, [], {recreate: recreate}, function() {
            helpers.logsOutput("test-container", function() {
              helpers.logsOutput("test-container", callback)
            })
          })
        }
    })
})

