#!/usr/bin/env node 
var fs = require('fs'),
  exec = require('child_process').exec

function noOp() {
    /* do nothing */
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

function start(container, containers) {
    stop(container, containers, function() {
        var opts = ['--name ' + container.name]
        if (container.daemon) {
            opts.push('-d')
        } else {
            opts.push('-it')
            opts.push('--rm')
        }

        if (container.ports) {
            container.ports.forEach(function(port) {
                opts.push('-p ' + port)
            })
        }

        var cmd = ['docker', 'run'].concat(opts).concat(container.image).join(' ')
        exec(cmd, function(err, stdout, stderr) {
            if (err) {
                console.log('err: ' + err, stdout, stderr)
            }
        })
    })
}

function main(args) {
    var containers = JSON.parse(fs.readFileSync('pig.json'))

    var command = args[0]
    var name = args[1]

    var container = containers[name]
    if (!container) {
        throw new Error('Container \'' + name + '\' is not configured in pig.json')
    }

    switch (command) {
        case "start":
            start(container, containers)
            break

        case "stop":
            stop(container, containers)
            break

        case undefined:
            throw new Error('Usage: pig COMMAND [NAME]')

        default:
            throw new Error('Unknown command \'' + command + '\'')
    }
}

try {
    var cmdArgs = process.argv.slice(2)
    main(cmdArgs)
} catch (e) {
    process.stderr.write('error: ' + e.message + '\n')
}
