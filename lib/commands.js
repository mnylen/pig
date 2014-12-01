var  fs = require('fs'),
   exec = require('child_process').exec,
  spawn = require('child_process').spawn,
helpers = require('./helpers'),
   path = require('path'),
      _ = require('lodash')

module.exports = function(containers, options) {
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
                exec('docker stop ' + container.name, function() {
                    rm(container, done)
                })
            }
        })
    }

    function build(container, done) {
        var tag = container.name + '-image'

        exec('docker build -t ' + tag + ' ' + container.build, function(err) {
            if (err) {
                throw new Error('Failed to build image for ' + container.name)
            } else {
                done(tag)
            }
        })
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

            start(containers[name], [], { recreate: false }, next)
        }, done)
    }

    function buildImage(container, done) {
        if (container.build) {
            build(container, function(image) {
                container.image = image
                done()
            })
        } else {
            done()
        }
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

        function doStart() {
            buildImage(container, function() {
                startDeps(container, function(err) {
                    if (err) {
                        done(err)
                    } else {
                        run()
                    }
                })
            })
        }

        function run() {
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

            spawn('docker', args, { stdio: 'inherit' }).on('close', function(code) {
                done()
            })
        }

        checkRunning(container, function(isRunning) {
            if (isRunning && startOptions.recreate) {
                stop(container, doStart)
            } else if (!isRunning) {
                doStart()
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
            start(container, containers, [], { recreate: false }, next)
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

