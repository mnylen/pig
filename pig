#!/usr/bin/env node 
var fs = require('fs'),
  exec = require('child_process').exec,
 spawn = require('child_process').spawn,
  path = require('path')

function noOp() {
    /* do nothing */
}

function usage() {
    return "Usage: pig COMMAND SERVICE [& args]\n\n" +
           "Commands:\n" +
           "  start   Start named service. \n" +
           "  stop    Stop named service\n" +
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

function startDeps(deps, containers, done) {
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

function start(container, containers, commandArgs, done, noRecreate) {
    noRecreate = noRecreate || false
    done = done || noOp

    function doStart() {
        var deps = container.links || []
        deps = deps.concat(container.volumesFrom || [])

        startDeps(deps, containers, run)
    }

    function run() {
        var opts = ['--name', container.name]
        if (container.daemon) {
            opts.push('-d')
        } else {
            opts.push('-it')
            opts.push('--rm')
        }

        if (container.ports) {
            container.ports.forEach(function(port) {
                opts.push('-p')
                opts.push(port)
            })
        }

        if (container.links) {
            container.links.forEach(function(linkedName) {
                var linkedContainer = containers[linkedName]
                opts.push('--link')
                opts.push(linkedContainer.name + ':' + linkedName)
            })
        }

        if (container.workdir) {
            opts.push('--workdir')
            opts.push(container.workdir)
        }

        if (container.volumes) {
            for (var hostPath in container.volumes) {
                if (container.volumes.hasOwnProperty(hostPath)) {
                    var containerPath = container.volumes[hostPath]

                    opts.push('-v')
                    opts.push(path.resolve(hostPath) + ':' + containerPath) 
                }
            }
        }

        if (container.volumesFrom) {
            container.volumesFrom.forEach(function(volumeName) {
                var volumeContainer = containers[volumeName]
                opts.push('--volumes-from')
                opts.push(volumeContainer.name)
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

        case undefined:
            throw new Error(usage())

        default:
            throw new Error('Unknown command \'' + command + '\'\n' + usage())
    }
}

try {
    var cmdArgs = process.argv.slice(2)
    main(cmdArgs)
} catch (e) {
    process.stderr.write('error: ' + e.message + '\n')
}
