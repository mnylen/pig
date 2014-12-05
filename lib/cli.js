var errors = require('./errors')

var usage = "Usage: pig COMMAND NAME [& args]\n\n" +
            "Commands:\n" +
            "  start   Start named service. \n" +
            "  stop    Stop named service\n" +
            "  up      Start all daemons from pig.json\n" +
            "  down    Stop all daemons in pig.json\n" +
            "  bash    Attach /bin/bash to named service (for debug)\n"

function parseArgs(args) {
    var command     = args[0]
    var name        = args[1]
    var remainder  = args.slice(2)
    var interactive = !(process.env["NONINTERACTIVE"] === 'true')
    var verbose     = process.env["VERBOSE"] === 'true'

    return {
        command: command,
        name: name,
        remainder: remainder,
        options: { interactive: interactive, verbose: verbose },
    }
}

function getContainer(config, args) {
    if (!args.name) {
        throw new errors.PigError('No container name given\n' + usage)
    }

    var container = config[args.name]
    if (container) {
        return container 
    } else {
        throw new errors.PigError("Container '" + args.name + "' not found")
    }
}

function handleError(err) {
    if (err instanceof errors.ConfigError) {
        process.stderr.write('error in pig.json: ' + err.message + '\n')
        process.exit(1)
    } else if (err instanceof errors.PigError) {
        process.stderr.write('error: ' + err.message + '\n')
        process.exit(1)
    } else if (err) {
        throw err
    }
}

function main(args, callback) {
    var config = require('./config').fromFile('pig.json')
    var commands = require('./commands')(config, args.options)

    switch (args.command) {
        case "start":
            commands.start(getContainer(config, args), args.remainder, { recreate: true }, callback)
            break

        case "stop":
            commands.stop(getContainer(config, args), callback)
            break

        case "bash":
            commands.bash(getContainer(config, args), callback)
            break

        case "up":
            commands.startDaemons(callback)
            break

        case "down":
            commands.stopDaemons(callback)
            break

        case undefined:
            callback(new errors.PigError('No command specified\n' + usage))
            break

        default:
            callback(new errors.PigError('Unknown command \'' + args.command + '\'\n' + usage))
            break
    }
}

module.exports.main = function() {
    try {
        var cmdArgs = parseArgs(process.argv.slice(2))
        main(cmdArgs, handleError)
    } catch (err) {
        handleError(err)
    }
}