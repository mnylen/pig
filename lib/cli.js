var fs = require('fs'),
  cmds = require('./commands'),
errors = require('./errors')

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

function container(config, args) {
    var container = config[args.name]
    if (container) {
        return container 
    } else {
        throw new errors.ConfigError("Container '" + args.name + "' not found") 
    }
}

function handleError(err) {
    if (err instanceof errors.ConfigError) {
        process.stderr.write('error in pig.json: ' + err.message + '\n')
    } else if (err) {
        throw err
    }
}

function main(args) {
    var config    = JSON.parse(fs.readFileSync('pig.json'))
    var commands  = cmds(config, args.options)

    switch (args.command) {
        case "start":
            commands.start(container(config, args), args.remainder, { recreate: true }, handleError)
            break

        case "stop":
            commands.stop(container(config, args), handleError)
            break

        case "bash":
            commands.bash(container(config, args), handleError)
            break

        case "up":
            commands.startDaemons(handleError)
            break

        case "down":
            commands.stopDaemons(handleError)
            break

        case undefined:
            process.stdout.write(usage)
            process.exit(1)

        default:
            process.stderr.write("error: Unknown command '" + command + "'.\n")
            process.stderr.write(usage)
            process.exit(1)
    }
}

module.exports.main = function() {
    try {
        var cmdArgs = parseArgs(process.argv.slice(2))
        main(cmdArgs)
    } catch (err) {
        handleError(err)
    }
}
