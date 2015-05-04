var errors = require('./errors'),
        fs = require('fs'),
         _ = require('lodash')

var usage = "Usage: pig COMMAND NAME [& args]\n\n" +
            "Commands:\n" +
            "  start   Start container\n" +
            "  stop    Stop container\n" +
            "  rm      Remove container\n" +
            "  logs    Show docker logs output for container (use -f for follow, -t for tail)\n" +
            "  inspect Show docker inspect output for container\n" +
            "  up      Start all daemons from pig.json\n" +
            "  down    Stop all daemons in pig.json\n" +
            "  bash    Attach /bin/bash to container (for debug)\n"

function parseArgs(args) {
    var command     = args[0]
    var recreate    = _.contains(['--no-recreate', '-R'], args[1]) == false
    var name        = recreate ? args[1] : args[2]
    var remainder   = args.slice(recreate ? 2 : 3)
    var interactive = !(process.env["NONINTERACTIVE"] === 'true')
    var verbose     = process.env["VERBOSE"] === 'true'

    return {
        command: command,
        name: name,
        remainder: remainder,
        options: { interactive: interactive, verbose: verbose, recreate: recreate },
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
        process.stderr.write('error in configuration: ' + err.message + '\n')
        process.exit(1)
    } else if (err instanceof errors.PigError) {
        process.stderr.write('error: ' + err.message + '\n')
        process.exit(1)
    } else if (err) {
        throw err
    }
}

function loadConfiguration(){
  if (fs.existsSync('pig.json') && fs.existsSync('pig.yml')) {
    throw new errors.ConfigError("Can't decide configuration file to load. Both pig.json and pig.yml present. Please remove either one.");
  } else if (fs.existsSync('pig.json')) {
    return require('./config').fromFile('pig.json')
  } else if (fs.existsSync('pig.yml')) {
    return require('./config').fromFile('pig.yml')
  } else {
    throw new errors.ConfigError('Could not find pig.json or pig.yml from current working directory.')
  }
}


function main(args, callback) {
    var config = loadConfiguration()
    var commands = require('./commands')(config, args.options)

    switch (args.command) {
        case "start":
            commands.start(getContainer(config, args), args.remainder, { recreate: args.options.recreate }, callback)
            break

        case "stop":
            commands.stop(getContainer(config, args), callback)
            break

      case "rm":
            commands.remove(getContainer(config, args), callback)
            break

        case "bash":
            commands.bash(getContainer(config, args), callback)
            break

        case "up":
            commands.startDaemons({ recreate: args.options.recreate }, callback)
            break

        case "down":
            commands.stopDaemons(callback)
            break

        case "logs":
        case "inspect":
            commands.docker(args.command, args.remainder.concat([getContainer(config, args).name]), callback)
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
