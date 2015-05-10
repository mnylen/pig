# pig

A tool for configuring and starting Docker containers in development and ci environment.

## License

MIT. See LICENSE

## Features

* Configure containers in clear json or yml syntax
* Automatically starts linked containers
* Mount volumes, forward ports
* Supports building images using a Dockerfile template
* Supports before/after hooks for container startup
* Supports including other pig files 

## Installation

    npm install docker-pig

## Sample

Given the following `pig.json`

    {
        "db":{
            "name": "my-project-mongo",
            "image":"mongo:2.6.4",
            "daemon":true
        },

        "myapp":{
            "name":"my-project-app",
            "image":"mongo:2.6.4",
            "command":["bash"],
            "links":["db"]
        }
    }

You can now `pig start myapp` to start your app (a bash terminal) plus the MongoDB server on background.

The MongoDB container is linked to your app using `--link`, so you can now access it from `db:27017` (or use `$MONGO_PORT_27017_TCP_ADDR`) 

    root@281b802b0e52:/# mongo db:27017 

Even better, you can now add this to `pig.json`:

    "mongoshell":{
        "name":"my-project-mongoshell",
        "image":"mongo:2.6.4",
        "command":["mongo", "db:27017"]
    }

And use `pig start mongoshell` whenever you need mongo shell access.

## Command reference

* `start [-R|--no-recreate] CONTAINER [args]` - starts container,  passing `args` to it's command 
* `stop CONTAINER` - stops container
* `rm CONTAINER` - removes container
* `bash CONTAINER` - executes a bash inside running container
* `logs CONTAINER [opts]` - show `docker logs` output for container with the given `opts` (`-t` for tail, `-f` for follow, anything `docker logs` accepts)
* `inspect CONTAINER` - show `docker inspect` output for container
* `up [-R|--no-recreate]` - start all daemons
* `down` - stop all daemons

The default behaviour is that containers are re-created every time when `start` or `up` command is executed.
If you want to prevent this behaviour and start existing container instead, add either `-R` or 
`--no-recreate` flag to your `start`/`up` command.

## Basic configuration properties

| Property | Example | Explanation |
|----------|---------|-------------|
| `image (String)` | `"ubuntu:14.04"` | image to run the container off |
| `name (String)` | `"my-project-app"` | system-wide unique name for the container (passed to `--name` for `docker run`) |
| `command (Array)` | `["echo", "Hello, world!"]` | command to run (must be passed as an array) |
| `workdir (String)` | `"/project"` |  working directory |
| `ports (Array)` | `["27017:27017"]` | port mappings |
| `daemon (Boolean)` | `true` | start container in daemon mode |

`name` and either `image`, `build` or `buildTemplate` are required. Otherwise, all properties are optional.

## Linking

Use the `links` property. This must be an array of links to configure for the container. The linked containers are
started automatically (if not yet started) when starting the container. Example:

    "links": ["db"]

Note, the entries in the array must reference the configuration name of the container and not it's `name` property.
So if you have:

    "db": {
        "name":"mongo",
        "image":"mongo:2.6.4"
    }

and want to link to that, refer to `db` in your `links` property, not `mongo`. The link will be aliased as `db`
(the actual command line option passed to `docker run` will be `--link mongo:db`)

You can also use  `externalLinks` which takes an array of whatever Docker's `--link` expects
(for example, `"externalLinks": ["name1:alias1", "name2:alias2"]`). This can be used if you need to link to containers
not configured in pig.json

**NOTE**: When you link containers, make sure linked containers have `daemon` property set to `true`. Otherwise,
starting the container will fail.

## Mounting volumes

You can mount volumes to your container by supplying `volumes` configuration property. It expects an object with
`hostPath` as key (can be relative) and `containerPath` as value. For example the following would mount current
working directory as `/project` inside the container:

    "volumes": { ".": "/project"  }

Alternatively, you can define another data container with the volumes and then use `volumesFrom` to use Docker's
own `--volumes-from` support. For example, if you had `data1` and `data2` containers defined, you could then have
their volumes in your container with:

    "volumesFrom": ["data1", "data2"]

Don't worry about starting those: `start` automatically starts any containers you specify in `volumesFrom`

## Passing environment variables

Use `environment` property, which expects an `Object` of `{name:value}` pairs. Each pair will be passed
to `docker run` as `-e name=value`.

If you want, you can also use `$envname` syntax in the value to substitute runtime environment values.

An example:

    "environment":{
        "foo":"bar",
        "bar":"$foo"
    }

The above configuration would add `-e foo=bar -e bar=$foo`, substituting `$foo` with whatever the value
for `$foo` would be at the time of running. 

## Building

If you must use a custom image, you can specify it to be built by pig with `build` property, which
expects a path to the directory containing `Dockerfile`. The image will be tagged as `NAME-image`

Need more power to building? Use `buildTemplate` property to build your image using a `Dockerfile`
generated from a template. The `buildTemplate` property must be an `Object` with the following keys:

* `path` - path to a directory containing a file called `Dockerfile.template`
* `data` - an `Object` of variable `{name:value}` pairs you want to pass to your build (environment variables are automatically available in `env`)

The `Dockerfile.template` is then rendered using [lodash template](https://lodash.com/docs#template) as `Dockerfile`
and built using `docker build` as `NAME-image`

Example `Dockerfile.template`:

    FROM ubuntu

    <% if (env.http_proxy) { %>ENV http_proxy <%= env.http_proxy %><% } %>

    CMD ["env"]

An example `pig.json`:

    {
        "container":{
            "name":"my-app",
            "buildTemplate":{"path":"."}
        }
    }

Output of running `http_proxy=http://proxy.com pig start container` should now contain line `http_proxy=http://proxy.com`.

How cool is that?

## Before and after hooks

Need to run stuff before starting a container? Or after it? Use `hooks` property:

    "hooks":{
        "before":"./download-data.sh",
        "after":"./wait-until-fully-started.sh"
    }

Adding that to your configuration will run the before hook `download-data.sh` before starting the container. The hook must return
with status `0` or otherwise the container won't start. 

The after hook `wait-until-fully-started.sh` is executed after the container has started. The after hook is very useful in
scenarios where you need to wait for the container be fully started (all ports bound to etc.) until moving on.

If after hook in linked container exits with non-zero code, the container won't be started.

The hooks must be executable scripts. They will be run in the host machine, not inside a docker container. You can, however, use
docker (or even pig) in your own hook scripts.

## Including configuration from other file

You can include all containers from another pig.json to your current one by using the `include` directive at the top
level of your pig.json. This is useful when you have organized your application into smaller projects with their
own pig.jsons and you wish to create a master configuration that collects all these together.

To use, simply list all pig.jsons to include as `{path:prefix}` pairs. The containers defined in `path` will then
be available with `prefix/NAME` using `start`, `stop` or `bash` commands.

As an example, if you had `bar/pig.json` and `foo/pig.json`, you could include them like this:

    {
        "include":{
            "bar/pig.json":"bar",
            "foo/pig.json":"foo"
        }
    }

Now any container defined in `foo/pig.json` could be started with `pig start foo/NAME`, and containers in
`bar/pig.json` with `pig start bar/NAME`.

Starting a container that was included will chdir to the directory where the configuration exists, so any
paths will still be relative to the original configuration (not the including one).

## Starting a group of containers as daemons

If you know you need a specific set of containers started for a task, you can create a container with just
`startAll` property with a list of all containers to start:

    {
        "include":{
            "payments/pig.json":"payments",
            "orders/pig.json":"orders",
            "site/pig.json":"site"
        },
        "everything":{
            "startAll":[
                "payments/server",
                "orders/server",
                "site/server"
            ]
        }
    }

Now running `pig start everything` would start included `payments/server`, `orders/server` and `site/server`
containers.

Using `startAll` is roughly equivalent to calling `pig start` for each of the listed containers separately.
The difference is that all listed containers will be started in daemon mode, regardless of the `daemon`
property value.

## VERBOSE and NONINTERACTIVE

Not going well? Set `VERBOSE=true` to get some output.

Having problems with hanging builds, or in general with pseudo-ttys? Use `NONINTERACTIVE=true` to start containers without `-it`

## using YAML instead

The pig.json file shown above can also be written as pig.yml:

    db:
        name: my-project-mongo
        image: mongo:2.6.4
        daemon: true
        
    myapp:
        name: my-project-app
        image: mongo:2.6.4
        command:
            - bash
        links:
            - db
    
    

    
## Why not just use fig?

I can't speak for you, but my reasons for not using fig after trying it out were:
 
* doesn't setup port mappings for one-off containers
* doesn't start data containers for one-off containers automatically 
* `fig up` starts everything, no way to omit launching "development" containers (mongo shell, sbt, lein, ...)

Basically I wanted to use fig for one-off containers and they didn't work like I wanted. 

Also, sadly, fig didn't provide solution to some of the problems we had solved with our messy docker environment startup scripts: 

* some services take a long time to fully start, so we need to wait until we execute tests against them (see hooks above)

* `docker build` does not allow environment variables and running `docker build` in our CI environment requires `http_proxy` set, but the same proxy on local machine breaks everything (hence, build from template - see building above)

## Contributing

Fork the repo, send in pull requests. Remember to update documentation!

Run tests using `mocha test` (you might need to `docker pull ubuntu` and `docker pull python` first). Also, depending on how fast your
computer is, you might need to run mocha with `--timeout 3000` or higher.

