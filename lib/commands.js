var  fs = require('fs'),
   exec = require('child_process').exec,
  spawn = require('child_process').spawn,
helpers = require('./helpers'),
   path = require('path'),
      _ = require('lodash')

function noOp() {
    /* do nothing */
}

function checkRunning(container, callback) {
    exec('docker inspect ' + container.name, function(err) {
        var isRunning = err ? false : true 
        callback(isRunning)
    })
}

function rm(container, containers, done) {
    done = done || noOp

    exec('docker rm ' + container.name, function(err) {
        done()
    })
}

function stop(container, containers, done) {
    done = done || noOp

    checkRunning(container, function(isRunning) {
        if (!isRunning) {
            done()
        } else {
            exec('docker stop ' + container.name, function() {
                rm(container, containers, done)
            })
        }
    })
}

function build(container, done) {
    var tag = container.name + '-image'

    exec('docker build -t ' + tag + ' ' + container.build, function(err) {
        if (err) {
            throw new Error('Failed to build image for ' + container.name)
        } else {
            done(tag)
        }
    })
}

function startDeps(container, containers, done) {
    var deps = container.links
    deps = deps.concat(container.volumesFrom)

    helpers.asyncIterate(deps, function(name, next) {
        var dependency = containers[name]

        if (!dependency) {
            throw new Error('Could not resolve link ' + name + ' for ' + container.name)
        }

        if (!dependency.daemon) {
            throw new Error('Link ' + name + ' for ' + container.name + ' is not a daemon. Only daemons can be linked to.')
        }

        start(containers[name], containers, [], {
            interactive: false,
            recreate: false,
            quiet: true
        }, next) 
    }, done)
}

function buildImage(container, done) {
    if (container.build) {
        build(container, function(image) {
            container.image = image
            done()
        })
    } else {
        done()
    }
}

function start(container, containers, commandArgs, options, done) {
    options = _.defaults(options || {}, {
        recreate: true,
        interactive: true
    })

    container = _.defaults(container, {
        daemon: false,
        environment: {},
        volumes: {},
        volumesFrom: [],
        links: [],
        externalLinks: [],
        ports: []
    })

    done = done || noOp

    function doStart() {
        buildImage(container, function() {
            startDeps(container, containers, function() {
                run()
            })
        })
    }

    function run() {
        var opts = []

        function addOpts() {
            var newOpts = Array.prototype.slice.call(arguments)
            newOpts.forEach(function(opt) {
                opts.push(opt)
            })
        }

        addOpts('--name', container.name)

        if (container.daemon) {
            addOpts('-d')
            options.interactive = false
        } else {
            addOpts('--rm')

            if (options.interactive) {
                addOpts('-it')
            }
        }

        if (container.workdir) {
            addOpts('--workdir', container.workdir)
        }

        container.ports.forEach(function(port) {
            addOpts('-p', port)
        })

        container.links.forEach(function(linkedName) {
            var linkedContainer = containers[linkedName]
            addOpts('--link', linkedContainer.name + ':' + linkedName)
        })

        container.externalLinks.forEach(function(link) {
            addOpts('--link', link)
        })

        _.forOwn(container.environment, function(envValue, envName) {
            addOpts('-e', envName + '=' + envValue)
        })

        _.forOwn(container.volumes, function(containerPath, hostPath) {
            addOpts('-v', path.resolve(hostPath) + ':' + containerPath)
        })

        container.volumesFrom.forEach(function(volumeName) {
            var volumeContainer = containers[volumeName]
            addOpts('--volumes-from', volumeContainer.name)
        })

        var args = ['run']
            .concat(opts)
            .concat(container.image)
            .concat(container.command || [])
            .concat(commandArgs)

        if (options.interactive) {
            var child = spawn('docker', args, { stdio: 'inherit' })
            child.on('close', function(code) { done() })
        } else {
            var child = spawn('docker', args)

            if (!options.quiet) {
                child.stdout.on('data', process.stdout.write)
                child.stderr.on('data', process.stderr.write)
            }

            child.on('close', function(code) { done() })
        }
    }

    checkRunning(container, function(isRunning) {
        if (isRunning && options.recreate) {
            stop(container, containers, doStart)
        } else if (!isRunning) {
            doStart()
        } else {
            done() // nothing to be done
        }
    })
}

function bash(container, containers) {
    spawn('docker', [
        'exec',
        '-it',
        container.name,
        '/bin/bash'
    ], { stdio: 'inherit' })
}

function startDaemons(containers, done) {
    done = done || _.noop

    var daemons = _.filter(containers, { daemon: true })
    helpers.asyncIterate(daemons, function(container, next) {
        start(container, containers, [], { recreate: false }, next)
    }, done)
}

function stopDaemons(containers, done) {
    done = done || _.noop

    var daemons = _.filter(containers, { daemon: true })
    helpers.asyncIterate(daemons, function(container, next) {
        stop(container, containers, next)
    }, done)
}

module.exports = {
    start: start,
    stop: stop,
    startDaemons: startDaemons,
    stopDaemons: stopDaemons,
    bash: bash
}
