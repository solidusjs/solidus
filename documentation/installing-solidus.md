# Installing Solidus

### Overview

The heart of Solidus is a node.js server used to fetch JSON and serve pages. It can be easily run on a Mac or PC for development. It’s also [easily deployed](#) for production and has been [battle tested](http://sparkart.com) running sites serving millions of monthly pageviews.

### Why node?

[node.js](http://nodejs.org) is naturally the best way to work with JSON data on a server — everything is just JavaScript. This also makes it easy to share code and data with the browser. When the server and browser can work together in harmony, a superfast, seamless experience for visitors is the result. On top of this, the incredibly talented node community is hard at work on new ways to solve common challenges such as [working with assets](http://gruntjs.org) and [superfast page serving](http://expressjs.org).


Installing node.js and npm
-------------------------------------------------------------------------------------------

### What's Node.js?

Node server written in JavaScript that is comprised of multiple modules installed by npm.Modules are very granular, which is good. If one module doesn't work out, it can be replaced by another.

**[Download an Installer](http://nodejs.org/download)**


### What’s npm?

npm is a package manager for Node. It's accessed via a CLI (command line interface) and will automatically install any modules defined in the package.json file. By default, Grunt and several Grunt plug-ins are included in a Solidus site.

### Further Reading
* [Node.js](http://nodejs.org/)
* [npm](https://npmjs.org/)



Installing Solidus CLI
-------------------------------------------------------------------------------------------=

### Windows/Mac tabs (switch OS-styled frame)

```
npm install solidus --global
```

It should be installed! Go ahead and try `solidus --help` to see if it worked. If you get a permissions error, try:

```
sudo npm install solidus --global
```


### Common Issues (from GitHub API)

**[Report an Issue](http://github.com/sparkartgroupinc/solidus/issues/new)**



Installing Grunt
-------------------------------------------------------------------------------------------

### What's Grunt?

[Grunt](http://gruntjs.com/) is a task runner that plays well with Node.js. It runs repetitive tasks so you don't have to. Each task comes in the form of a stand-alone plug-in, which makes Grunt easily extensible.

For a default Solidus site, Grunt runs the following tasks:

1. Compiles Sass to CSS
1. Concatenates CSS
1. Minifies the CSS
1. Cleans the CSS
1. Compiles [Handlebars templates](/pages)
1. Concatenates the Handlebars templates
1. Sets up [Require.js](http://requirejs.org/)
1. Minifies JavaScript
1. Sets up [LiveReload](https://npmjs.org/package/livereload)
1. Starts Solidus


### Installing Grunt

Grunt has already been installed via npm. What we're installing is the Grunt CLI. The Grunt CLI adds a command that runs the version of Grunt that's installed next to a Gruntfile.

 `npm install -g grunt-cli`


#### Gruntfile

This file contains the configuration for Grunt, defines the tasks you want it to run, and loads Grunt plugins. Solidus adds some default configuration, but you can add any Grunt plugin you want to help your workflow.


### Installing new Grunt Plug-ins
* [Grunt Plugins](http://gruntjs.com/plugins)


### Further Reading
* [Grunt.js](http://gruntjs.com/)


Installing Sass
-------------------------------------------------------------------------------------------

### What's Sass?

Notes:
- A quicker way to write CSS
- Access to variables, nesting, mixins
- Completely optional, dev can use straight CSS, or LESS or Stylus with a Grunt plug-in.
- Install Ruby Gem for OS X
- Install Ruby for Windows (http://rubyinstaller.org/downloads/)



**New / Existing Site Tabs**

Setup a New Website
-------------------------------------------------------------------------------------------

Now you're ready to start a project. Solidus CLI makes this easy. To start, just navigate to wherever you keep all of your other projects, and run this command:

```
solidus setup site-domain.com
```

This command will create the following folders and files inside a new folder named for the domain:

 - **/assets**
 - **/node_modules** — this contains the Solidus server and all of the other modules that it depends upon.
 - **/resources**
 - **/views**
 - **gruntfile.json**
 - **package.json**
 - **server.js** - this file tells services like Modulus and Nodejitsu how to start the Solidus server.


Working with an Existing Website
-------------------------------------------------------------------------------------------

Notes:
 - Pull down site from Git
 - Run `npm install` to install required modules defined in package.json
 - Run `grunt dev` to activate Grunt which start Solidus



Solidus ♥ Git
-------------------------------------------------------------------------------------------

Whether working alone or as part of a team, we recommend creating a Git repository for every website. Together with GitHub you won’t find a better way to track and share changes or protect yourself from horrible mistakes!

Be sure to keep your website repos clear of files that you didn't create. A global `.gitignore` file is the best way to accomplish this. GitHub has [recommendations on what you should ignore](https://help.github.com/articles/ignoring-files#global-gitignore). Here’s a couple things we’d add to their list:

- `.sass-cache`
- `node_modules`
- `npm-debug.log`
- `/assets/compiled/`


### Further Reading
* [Github](https://github.com/)
* [Learn Git in 15 minutes](http://try.github.io/levels/1/challenges/1)


Start a Dev Server
-------------------------------------------------------------------------------------------

Notes:
- Grunt task `grunt dev` runs three tasks
    1. Compile - Assets preprocessed and concatenated
    1. Server - runs `solidus server` to start dev server
    1. Watch - Watches for changes in the filesystem and re-runs tasks if changes detected.

```
grunt dev
```