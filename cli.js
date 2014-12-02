var fs = require('fs')

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
        interactive: !(process.env["NONINTERACTIVE"] === 'true'),
        verbose: process.env["VERBOSE"] === 'true'
    }

    var commands = require('./lib/commands')(containers, options)

    switch (command) {
        case "start":
            commands.start(container(), dockerCommandArgs, { recreate: true }, handleError)
            break

        case "stop":
            commands.stop(container())
            break

        case "bash":
            commands.bash(container())
            break

        case "up":
            commands.startDaemons()
            break

        case "down":
            commands.stopDaemons()
            break

        case undefined:
            throw new Error(usage())

        default:
            throw new Error('Unknown command \'' + command + '\'\n' + usage())
    }
}

function handleError(err) {
    if (err) {
        process.stderr.write('error: ' + err.message + '\n')
    }
}

module.exports.main = function() {
    try {
        var cmdArgs = process.argv.slice(2)
        main(cmdArgs)
    } catch (err) {
        handleError(err)
    }
}
