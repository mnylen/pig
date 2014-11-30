var fs = require('fs'),
  exec = require('child_process').exec,
 spawn = require('child_process').spawn,
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
    var deps = container.links || []
    deps = deps.concat(container.volumesFrom || [])

    function iterate(idx) {
        var name = deps[idx]
        if (name) {
            start(containers[name], containers, [], { interactive: false, recreate: false, quiet: true }, function() {
                iterate(idx+1)
            })
        } else {
            done()
        }
    }

    iterate(0)
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

    done = done || noOp

    function doStart() {
        buildImage(container, function() {
            startDeps(container, containers, function() {
                run()
            })
        })
    }

    function run() {
        var opts = ['--name', container.name]

        function addOpts() {
            var newOpts = Array.prototype.slice.call(arguments)
            newOpts.forEach(function(opt) {
                opts.push(opt)
            })
        }

        if (container.daemon) {
            addOpts('-d')
            options.interactive = false
        } else {
            addOpts('--rm')

            if (options.interactive) {
                addOpts('-it')
            }
        }

        if (container.ports) {
            container.ports.forEach(function(port) {
                addOpts('-p', port)
            })
        }

        if (container.links) {
            container.links.forEach(function(linkedName) {
                var linkedContainer = containers[linkedName]
                addOpts('--link', linkedContainer.name + ':' + linkedName)
            })
        }

        if (container.externalLinks) {
            container.externalLinks.forEach(function(link) {
                addOpts('--link', link)
            })
        }

        if (container.workdir) {
            addOpts('--workdir', container.workdir)
        }

        if (container.environment) {
            for (var name in container.environment) {
                if (container.environment.hasOwnProperty(name)) {
                    var value = container.environment[name]
                    addOpts('-e', name + '=' + value)
                }
            }
        }

        if (container.volumes) {
            for (var hostPath in container.volumes) {
                if (container.volumes.hasOwnProperty(hostPath)) {
                    var containerPath = container.volumes[hostPath]
                    addOpts('-v', path.resolve(hostPath) + ':' + containerPath)
                }
            }
        }

        if (container.volumesFrom) {
            container.volumesFrom.forEach(function(volumeName) {
                var volumeContainer = containers[volumeName]
                addOpts('--volumes-from', volumeContainer.name)
            })
        }

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

function startDaemons(containers) {
    var daemons = _.filter(containers, { daemon: true })

    function iterate(idx) {
        var container = daemons[idx]
        if (container) {
            start(container, containers, [], { recreate: false }, function() {
                iterate(idx+1)
            })
        }
    }

    iterate(0)
}

function stopDaemons(containers) {
    var daemons = _.filter(containers, { daemon: true })

    function iterate(idx) {
        var container = daemons[idx]
        if (container) {
            stop(container, containers, function() {
                iterate(idx+1)
            })
        }
    }

    iterate(0)
}

module.exports = {
    start: start,
    stop: stop,
    startDaemons: startDaemons,
    stopDaemons: stopDaemons,
    bash: bash
}
