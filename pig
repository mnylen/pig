#!/usr/bin/env node 
var fs = require('fs'),
  exec = require('child_process').exec,
 spawn = require('child_process').spawn

function noOp() {
    /* do nothing */
}

function usage() {
    return "Usage: pig COMMAND [SERVICE]\n\n" +
           "Commands:\n" +
           "  start   Start named service\n" +
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
            start(containers[name], containers, function() {
                iterate(idx+1)
            }, true)
        } else {
            done()
        }
    }

    iterate(0)
}

function start(container, containers, done, noRecreate) {
    noRecreate = noRecreate || false
    done = done || noOp

    function doStart() {
        var deps = container.links || []
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

        var args = ['run'].concat(opts).concat(container.image).concat(container.command || [])
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

function main(args) {
    var containers = JSON.parse(fs.readFileSync('pig.json'))

    var command = args[0]
    var name = args[1]

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
            start(container(), containers)
            break

        case "stop":
            stop(container(), containers)
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
