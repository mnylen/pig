# pig

Like fig, but geared more towards running one-off containers with background services
automatically started.

## Installation

* Have NodeJS installed
* Run `npm install docker-pig`

## Sample usage

Put the following in `pig.json` in your project root:

    {
      "db":{
        "name": "mongo",
        "image": "mongo:2.6.4",
        "ports": ["27017:27017"],
        "daemon": true
      },

      "dbshell":{
        "name": "mongoshell",
        "image": "mongo:2.6.4",
        "command": ["mongo", "db:27017"],
        "links": ["db"]
      },

      "code":{
        "name": "codedata",
        "image": "busybox",
        "command": ["tail", "-f", "/dev/null"],
        "daemon": true,
        "volumes": {
          ".": "/project"
        }
      },

      "deps":{
        "name": "depsdata",
        "image": "busybox",
        "command": ["tail", "-f", "/dev/null"],
        "daemon": true,
        "volumes": {
          "./deps/m2": "/root/.m2",
          "./deps/lein": "/root/.lein"
        }
      },

      "repl":{
        "name": "repl",
        "image": "pandeiro/lein",
        "command": ["repl", ":start", ":host", "0.0.0.0", ":port", "59593"],
        "volumesFrom": ["code", "deps"],
        "links": ["db"],
        "ports": ["59593:59593"]
      }
    }

Now you can use `pig start repl` and it will start containers `db`, `code`, `deps` and, of course, `repl`.
Happy hacking!

## Command reference

* `start CONTAINER args` - starts the container defined in `pig.json`, passing `args` to it
* `stop CONTAINER args` - stops a container defined in `pig.json`
* `bash CONTAINER` - executes a bash in a running container
* `up` - starts all daemons
* `down` - stops all daemons

## pig.json properties 

All containers must have the following properties:

* `image` - the image to run the container off
* `name` - the name the container will be given
* `command` - command to be executed (defaults to the default command of the image)
* `daemon` - start the container in daemon mode? Defaults to false

### Links 

To link to other containers, use `links` property, which expects an list of container names to link. All
linked containers will be started automatically when you `pig start` the container. The alias for linked
containers will be the configuration name.

Note that you currently need to have `daemon: true` set in any linked container. 

You can also link to external containers which are not configured in `pig.json` using the `externalLinks`
property. For example:

    externalLinks: ["name:alias"]

### Ports

To forward ports, use `ports` property. It expects a list of `hostPort:containerPort` strings. 

### Volumes

To bind mount volumes, use `volumes` property. It expects an object with `hostPath: containerPath` pairs.
For example:

    "volumes": {
      ".": "/project"
    }

Relative `hostPath`s will be resolved automatically

If you have a data container, you can use `volumesFrom` which expects a list of container names
to mount volumes from that container. For example, if you have `data1` and `data2` containers
configured, you can use `volumesFrom` like this:

    "volumesFrom": ["data1", "data2"]

### Other properties

* `workdir` sets the working directory
* `environment` can be used for setting environment variables. Expects an Object with variable names as keys and values as values 

