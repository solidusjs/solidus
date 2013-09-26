# Getting Started

## What is Solidus?

The heart of Solidus is a node.js server used to fetch JSON and serve pages. It can be easily run on a Mac or PC for development. It’s also [easily deployed](#) for production and has been [battle tested](http://sparkart.com) running sites serving millions of monthly pageviews.

## Why node?

[node.js](http://nodejs.org) is naturally the best way to work with JSON data on a server — everything is just JavaScript. This also makes it easy to share code and data with the browser. When the server and browser can work together in harmony, a superfast, seamless experience for visitors is the result. On top of this, the incredibly talented node community is hard at work on new ways to solve common challenges such as [working with assets](http://gruntjs.org) and [superfast page serving](http://expressjs.org).


Installing node.js and npm
--------------------------------------------------------------------------------

## What's Node.js?

- A server that is comprised of multiple modules installed by npm.
- Modules are very granular, which is good. If one module doesn't work out, it can be replaced by another.

**[Download an Installer](http://nodejs.org/download)**


## What’s npm?

- Package manager
- Installs modules that are outlined in package.json when `npm install` is run in the same directory as package.json



Installing Solidus CLI
-------------------------------------------------------------------------------------------

## What is a CLI

- Command Line Interface
- Type commands into your Terminal or Command Prompt


## Windows/Mac tabs (switch OS-styled frame)

```
npm install solidus --global
```

It should be installed! Go ahead and try `solidus --help` to see if it worked. If you get a permissions error, try:

```
sudo npm install solidus --global
```


## Common Issues (from GitHub API)

**[Report an Issue](http://github.com/sparkartgroupinc/solidus/issues/new)**



Installing Grunt
-------------------------------------------------------------------------------------------

## What's Grunt?

- Preferred in Node.js environments to handle tasks that run shell commands and code (like what?)
- Our setup processes assets (compiles Sass) by default
- Gruntfile available to developers so it can be modified to fulfill any task (CoffeeScript, LESS, Stylus)



Installing Sass
-------------------------------------------------------------------------------------------

## What's Sass?

- A quicker way to write CSS
- Access to variables, nesting, mixins


**New / Existing Site Tabs**

Setup a New Website
-------------------------------------------------------------------------------------------

Now you're ready to start a project. Solidus CLI makes this easy. To start, just navigate to wherever you keep all of your other projects, and run this command:

    solidus setup site-domain.com

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

 - Pull down from Git
 - Run `npm install` to install required modules
 - Do you have Solidus installed already?


## Solidus ♥ Git

Whether working alone or as part of a team, we recommend creating a Git repository for every website. Together with GitHub you won’t find a better way to track and share changes or protect yourself from horrible mistakes!

Be sure to keep your website repos clear of files that you didn't create. A global `.gitignore` file is the best way to accomplish this. GitHub has [recommendations on what you should ignore](https://help.github.com/articles/ignoring-files#global-gitignore). Here’s a couple things we’d add to their list:

- `.sass-cache`
- `node_modules`
- `npm-debug.log`
- `/assets/compiled/`


Start a Dev Server
-------------------------------------------------------------------------------------------

    solidus dev