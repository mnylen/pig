var  fs = require('fs'),
   exec = require('child_process').exec,
  spawn = require('child_process').spawn,
helpers = require('./helpers'),
   path = require('path'),
      _ = require('lodash')

module.exports = function(containers, options) {
    var logger = require('./logger')(options)

    function checkRunning(container, callback) {
        exec('docker inspect ' + container.name, function(err) {
            var isRunning = err ? false : true 
            callback(isRunning)
        })
    }

    function rm(container, done) {
        done = done || _.noop 

        exec('docker rm ' + container.name, function(err) {
            done()
        })
    }

    function stop(container, done) {
        done = done || _.noop 

        checkRunning(container, function(isRunning) {
            if (!isRunning) {
                done()
            } else {
                logger.info("Stopping " + container.name)
                exec('docker stop ' + container.name, function() {
                    rm(container, done)
                })
            }
        })
    }

    function renderTemplate(contextPath, templateData) {
        var templatePath = path.join(contextPath, 'Dockerfile.template')
        var dockerfilePath = path.join(contextPath, 'Dockerfile')

        if (!fs.existsSync(templatePath)) {
            throw new Error("Could not build from template because file template file " + templatePath + " was not found.")
        }

        if (fs.existsSync(dockerfilePath)) {
            throw new Error("Can't build from template because file " + dockerfilePath + " already exists.\n" +
                            "Please make sure your template is not named 'Dockerfile'")
        }
        
        var template = fs.readFileSync(templatePath)
        var contents = _.template(template, templateData)

        fs.writeFileSync(dockerfilePath, contents)
    }

    function build(contextPath, tag, done) {
        var build = spawn('docker', [
            'build',
            '-t',
            tag,
            contextPath 
        ], { stdio: 'inherit' })

        build.on('close', function(status) {
            if (status === 0) {
                done()
            } else {
                done(new Error("Could not build image " + tag + " using Dockerfile in " + contextPath))
            }
        })
    }

    function buildImage(container, done) {
        var contextPath = container.build
        if (container.buildTemplate) {
            contextPath = container.buildTemplate.path
            
            var templateData = _.defaults(container.buildTemplate.data || {}, { env: process.env })
            try {
                renderTemplate(contextPath, templateData) 
            } catch (err) {
                return done(err)
            }
        }

        if (contextPath) {
            var imageName = container.name + "-image"

            logger.info("Building image for " + container.name)
            build(contextPath, imageName, function(err) {
                container.image = imageName
                if (container.buildTemplate) { // clean up rendered Dockerfile 
                    fs.unlinkSync(path.join(contextPath, 'Dockerfile'))
                }

                done(err)
            })
        } else {
            done()
        }
    }


    function startDeps(container, done) {
        var deps = container.links
        deps = deps.concat(container.volumesFrom)

        helpers.asyncIterate(deps, function(name, next, stop) {
            var dependency = containers[name]
            if (!dependency) {
                stop(new Error('Could not resolve link ' + name + ' for ' + container.name))
                return
            }

            if (!dependency.daemon) {
                stop(new Error('Link ' + name + ' for ' + container.name + ' is not a daemon. Only daemons can be linked to.'))
                return
            }

            if (dependency.name === container.name) {
                stop(new Error('Container ' + container.name + ' is linking to itself.'))
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
                done(new Error('Hook ' + cmdLine + ' returned with code ' + status + ' != 0'))
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

    function start(container, commandArgs, startOptions, done) {
        container = _.defaults(container, {
            daemon: false,
            environment: {},
            volumes: {},
            volumesFrom: [],
            links: [],
            externalLinks: [],
            ports: []
        })

        done = done || _.noop 


        function run(callback) {
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
                addOpts('--link', linkedContainer.name + ':' + linkedName)
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

            container.volumesFrom.forEach(function(volumeName) {
                var volumeContainer = containers[volumeName]
                addOpts('--volumes-from', volumeContainer.name)
            })

            var args = ['run']
                .concat(opts)
                .concat(container.image)
                .concat(container.command || [])
                .concat(commandArgs)

            logger.info("Starting " + container.name + ", command line: docker " + args.join(' '))

            spawn('docker', args, { stdio: 'inherit' }).on('close', function(code) {
                if (code !== 0) {
                    callback(new Error('Execution of docker ' + args.join(' ') + ' exited with return code ' + code + ' != 0'))
                } else {
                    callback()
                }
            })
        }

        function startContainer() {
            withHooks(container, function(done) {
                buildImage(container, function(err) {
                    if (err) return done(err)

                    startDeps(container, function(err) {
                        if (err) {
                            done(err)
                        } else {
                            run(done)
                        }
                    })
                })
            }, done)
        }

        checkRunning(container, function(isRunning) {
            if (isRunning && startOptions.recreate) {
                stop(container, startContainer)
            } else if (!isRunning) {
                startContainer()
            } else {
                done() // nothing to be done
            }
        })
    }

    function bash(container) {
        spawn('docker', [
            'exec',
            '-it',
            container.name,
            '/bin/bash'
        ], { stdio: 'inherit' })
    }

    function startDaemons(done) {
        done = done || _.noop

        var daemons = _.filter(containers, { daemon: true })
        helpers.asyncIterate(daemons, function(container, next) {
            start(container, [], { recreate: false }, next)
        }, done)
    }

    function stopDaemons(done) {
        done = done || _.noop

        var daemons = _.filter(containers, { daemon: true })
        helpers.asyncIterate(daemons, function(container, next) {
            stop(container, next)
        }, done)
    }

    return { 
        start: start,
        stop: stop,
        bash: bash,
        startDaemons: startDaemons,
        stopDaemons: stopDaemons
    }
}

