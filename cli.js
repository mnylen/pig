var fs = require('fs'),
  exec = require('child_process').exec,
 spawn = require('child_process').spawn,
  path = require('path'),
     _ = require('lodash')

function noOp() {
    /* do nothing */
}

function usage() {
    return "Usage: pig COMMAND SERVICE [& args]\n\n" +
           "Commands:\n" +
           "  start   Start named service. \n" +
           "  stop    Stop named service\n" +
           "  up      Start all daemons from pig.json\n" +
           "  down    Stop all daemons in pig.json\n" +
           "  bash    Attach /bin/bash to named service (for debug)\n"
}

function whenRunning(container, then, andAfter) {
    exec('docker inspect ' + container.name, function(err) {
        if (!err) {
            then(andAfter)
        } else {
            andAfter()
        }
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

    whenRunning(container, function(done) {
        exec('docker stop ' + container.name, function() {
            rm(container, containers, done)
        })
    }, done)
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
            start(containers[name], containers, [], function() {
                iterate(idx+1)
            }, true)
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

function start(container, containers, commandArgs, done, noRecreate) {
    noRecreate = noRecreate || false
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
        } else {
            addOpts('--rm', '-it')
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

        if (container.daemon) {
            exec('docker ' + args.join(' '), done)
        } else {
            spawn('docker', args, { stdio: 'inherit' })
        }
    }

    if (noRecreate) {
        whenRunning(container, function() {
            done()
        }, function() {
            doStart()
        })
    } else {
        stop(container, containers, doStart)
    }
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
            start(container, containers, [], function() {
                iterate(idx+1)
            }, true)
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

function main(args) {
    var containers = JSON.parse(fs.readFileSync('pig.json'))

    var command = args[0]
    var name = args[1]

    var dockerCommandArgs = args.slice(2)

    function container() {
        if (!name) {
            throw new Error(usage())
        }

        var container = containers[name]
        if (!container) {
            throw new Error('Service \'' + name + '\' is not configured in pig.json') 
        }

        return container
    }

    switch (command) {
        case "start":
            start(container(), containers, dockerCommandArgs)
            break

        case "stop":
            stop(container(), containers)
            break

        case "bash":
            bash(container(), containers)
            break

        case "up":
            startDaemons(containers)
            break

        case "down":
            stopDaemons(containers)
            break

        case undefined:
            throw new Error(usage())

        default:
            throw new Error('Unknown command \'' + command + '\'\n' + usage())
    }
}

module.exports.main = function() {
    try {
        var cmdArgs = process.argv.slice(2)
        main(cmdArgs)
    } catch (e) {
        process.stderr.write('error: ' + e.message + '\n')
    }
}
