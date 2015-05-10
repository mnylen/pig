var spawn = require('child_process').spawn,
  helpers = require('./helpers'),
   errors = require('./errors'),
        _ = require('lodash')

module.exports = function(containers, options) {
    var logger = require('./logger')(options)
    var stop = require('./commands/stop')(logger)
    var start = require('./commands/start')(containers, options, logger)

    function bash(container) {
        spawn('docker', [
            'exec',
            '-it',
            container.name,
            '/bin/bash'
        ], { stdio: 'inherit' })
    }

    function startContainer(container, commandArgs, startOptions, done) {
        start(container, commandArgs, startOptions, done)
    }

    function stopContainer(container, done) {
        stop(container, {removeStopped: false}, done)
    }

    function removeContainer(container, done) {
        stop(container, {removeStopped: true}, done)
    }

    function startDaemons(startOptions, done) {
        done = done || _.noop

        var daemons = _.filter(containers, { daemon: true })
        helpers.asyncIterate(daemons, function(container, next) {
            start(container, [], startOptions, next)
        }, done)
    }

    function stopDaemons(done) {
        done = done || _.noop

        var daemons = _.filter(containers, { daemon: true })
        helpers.asyncIterate(daemons, function(container, next) {
            stop(container, null, next)
        }, done)
    }

    function docker(command, args, callback) {
        var child = spawn('docker', [command].concat(args), { stdio: 'inherit' })
        child.on('exit', function(code) {
            if (code === 0) {
                callback()
            } else {
                callback(new errors.PigError('Running docker ' + command + ' ' + args.join(' ') + ' failed with exit code ' + code + ' != 0'))
            }
        })
    }

    return {
        start: startContainer,
        stop: stopContainer,
        remove: removeContainer,
        bash: bash,
        startDaemons: startDaemons,
        stopDaemons: stopDaemons,
        docker: docker
    }
}

