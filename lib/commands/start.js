var  fs = require('fs'),
   exec = require('child_process').exec,
  spawn = require('child_process').spawn,
helpers = require('../helpers'),
 errors = require('../errors'),
   path = require('path'),
      _ = require('lodash')


module.exports = function(containers, options, logger) {
    var build = require('./build')(logger)
    var stop = require('./stop')(logger)

    function start(container, commandArgs, startOptions, done) {
        if (container.startAll) {
            return helpers.asyncIterate(container.startAll, function(name, next, fail) {
                var container = containers[name]
                container.daemon = true

                start(container, [], startOptions, function(err) {
                    if (err) {
                        fail(err)
                    } else {
                        next()
                    }
                })
            }, done)
        }

        var originalWorkingDirectory = process.cwd()

        container = _.defaults(container, {
            daemon: false,
            pigdir: originalWorkingDirectory,
            environment: {},
            volumes: {},
            volumesFrom: [],
            links: [],
            externalLinks: [],
            ports: []
        })

        process.chdir(container.pigdir)

        done = done || _.noop

        helpers.checkCreated(container, function(isCreated) {
            if (isCreated && startOptions.recreate) {
                stop(container, {removeStopped: true}, createAndStartContainer)
            } else if (!isCreated) {
                createAndStartContainer()
            } else {
                startContainer()
            }
        })

        function createAndStartContainer() {
            withHooks(container, function(done) {
                build(container, function(err) {
                    if (err) return done(err)

                    startDeps(container, function(err) {
                        if (err) {
                            done(err)
                        } else {
                            dockerRun(done)
                        }
                    })
                })
            }, function(err) {
                process.chdir(originalWorkingDirectory)
                done(err)
            })
        }

        function startContainer() {
            withHooks(container, function(done) {
                startDeps(container, function(err) {
                    if (err) {
                        done(err)
                    } else {
                        helpers.checkRunning(container, function(isRunning) {
                            if (isRunning) {
                                done()
                            } else {
                                dockerStart(done)
                            }
                        })
                    }
                })
            }, function(err) {
                process.chdir(originalWorkingDirectory)
                done(err)
            })
        }

        function dockerStart(callback) {
            var args = ['start', container.name]
            execDockerCmd(container, args, "Starting", callback)
        }

        function dockerRun(callback) {
            var args = ['run'].concat(runOptions(container, commandArgs))
            execDockerCmd(container, args, "Running", callback)
        }

        function execDockerCmd(container, args, action, callback) {
            logger.info(action + " " + container.name + ", command line: docker " + args.join(' '))

            spawn('docker', args, { stdio: 'inherit' }).on('close', function(code) {
                if (code !== 0) {
                    callback(new errors.PigError('Execution of docker ' + args.join(' ') + ' exited with return code ' + code + ' != 0'))
                } else {
                    callback()
                }
            })
        }
    }

    function startDeps(container, done) {
        var deps = container.links
        deps = deps.concat(container.volumesFrom)

        helpers.asyncIterate(deps, function(name, next, stop) {
            var dependency = containers[name]
            if (!dependency) {
                stop(new errors.ConfigError('Could not resolve link ' + name + ' for ' + container.name))
                return
            }

            if (!dependency.daemon) {
                stop(new errors.ConfigError('Link ' + name + ' for ' + container.name + ' is not a daemon. Only daemons can be linked to.'))
                return
            }

            if (dependency.name === container.name) {
                stop(new errors.ConfigError('Container ' + container.name + ' is linking to itself.'))
                return
            }

            start(containers[name], [], { recreate: false }, function(err) {
                if (err) {
                    stop(err)
                } else {
                    next()
                }
            })
        }, done)
    }


    function runHook(cmdLine, done) {
        var cmd, args
        if (typeof cmdLine === 'string') {
            cmd = cmdLine 
            args = []
        } else {
            cmd = cmdLine[0]
            args = cmdLine.slice(1)
        }

        var hook = spawn(cmd, args, { stdio: 'inherit' })
        hook.on('close', function(status) {
            if (status !== 0) {
                done(new errors.PigError('Hook ' + cmdLine + ' returned with code ' + status + ' != 0'))
            } else {
                done()
            }
        })
    }

    function withHooks(container, runFn, done) {
        function runHookWrapper(cmdLine) {
            if (cmdLine) {
                return function(done) {
                    runHook(cmdLine, done)
                }
            } else {
                return function(done) {
                    done()
                }
            }
        }

        var hooks = _.chain(container.hooks || {})
                     .defaults({ before: null, after: null })
                     .mapValues(runHookWrapper)
                     .value()

        hooks.before(function(err) {
            if (err) return done(err)

            runFn(function(err) {
                if (err) {
                    done(err)
                } else {
                    hooks.after(function(err) {
                        done(err)
                    })
                }
            })
        })
    }

    function runOptions(container, commandArgs) {
        var opts = []

        function addOpts() {
            var newOpts = Array.prototype.slice.call(arguments)
            newOpts.forEach(function(opt) {
                opts.push(opt)
            })
        }

        addOpts('--name', container.name)

        if (container.daemon) {
            addOpts('-d')
        }

        if (options.interactive && !container.daemon) {
            addOpts('-it')
        }

        if (container.workdir) {
            addOpts('--workdir', container.workdir)
        }

        container.ports.forEach(function(port) {
            addOpts('-p', port)
        })

        container.links.forEach(function(linkedName) {
            var linkedContainer = containers[linkedName]
            addOpts('--link', linkedContainer.name + ':' + removePrefix(linkedName))
        })

        container.externalLinks.forEach(function(link) {
            addOpts('--link', link)
        })

        _.forOwn(container.environment, function(envValue, envName) {
            envValue = envValue.replace(/\$([\w_]+)/g, function(s, m) { return process.env[m] || '' })
            addOpts('-e', envName + '=' + envValue)
        })

        _.forOwn(container.volumes, function(containerPath, hostPath) {
            addOpts('-v', path.resolve(hostPath) + ':' + containerPath)
        })

        if (container.hostname) {
            addOpts('-h', container.hostname)
        }

        container.volumesFrom.forEach(function(volumeName) {
            var volumeContainer = containers[volumeName]
            addOpts('--volumes-from', volumeContainer.name)
        })

        return opts
            .concat(container.image)
            .concat(container.command || [])
            .concat(commandArgs)
    }

    function removePrefix(name) {
        var parts = name.split('/')
        return parts[parts.length-1]
    }

    return start
}

