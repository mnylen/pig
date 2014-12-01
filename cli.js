var   fs = require('fs'),
commands = require('./lib/commands')

function usage() {
    return "Usage: pig COMMAND SERVICE [& args]\n\n" +
           "Commands:\n" +
           "  start   Start named service. \n" +
           "  stop    Stop named service\n" +
           "  up      Start all daemons from pig.json\n" +
           "  down    Stop all daemons in pig.json\n" +
           "  bash    Attach /bin/bash to named service (for debug)\n"
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

    var options = {
        interactive: process.env["NONINTERACTIVE"] === 'true' ? false : true
    }

    switch (command) {
        case "start":
            commands.start(container(), containers, dockerCommandArgs, options, handleError)
            break

        case "stop":
            commands.stop(container(), containers)
            break

        case "bash":
            commands.bash(container(), containers)
            break

        case "up":
            commands.startDaemons(containers)
            break

        case "down":
            commands.stopDaemons(containers)
            break

        case undefined:
            throw new Error(usage())

        default:
            throw new Error('Unknown command \'' + command + '\'\n' + usage())
    }
}

function handleError(err) {
    if (err) {
        process.stderr.write('error: ' + e.message + '\n')
    }
}

module.exports.main = function() {
    try {
        var cmdArgs = process.argv.slice(2)
        main(cmdArgs)
    } catch (e) {
        handleError(err)
    }
}
