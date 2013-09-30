# Getting Started

### What is Solidus?

The heart of Solidus is a node.js server used to fetch JSON and serve pages. It can be easily run on a Mac or PC for development. It’s also [easily deployed](#) for production and has been [battle tested](http://sparkart.com) running sites serving millions of monthly pageviews.

### Why Node.js?

[node.js](http://nodejs.org) is naturally the best way to work with JSON data on a server — everything is just JavaScript. This also makes it easy to share code and data with the browser. When the server and browser can work together in harmony, a superfast, seamless experience for visitors is the result. On top of this, the incredibly talented node community is hard at work on new ways to solve common challenges such as [working with assets](http://gruntjs.org) and [superfast page serving](http://expressjs.org).


Steps for setting up a Solidus site
-------------------------------------------------------------------------------------------

1. [Install Node and npm](#node)
1. [Install Solidus](#solidus) via npm
1. [Install Grunt](#grunt) via npm
1. [Install Sass](#sass) via Ruby
1. [Setup a new site](#setup) via Solidus (or [work an existing site](#existing) via Git)
1. Profit.


Installing node.js and npm
-------------------------------------------------------------------------------------------

### What's Node.js?

Node is server written in JavaScript that is comprised of multiple modules installed by npm. Modules are very granular, which is good. If one module doesn't work out, it can be replaced by another. Installing node.js also installs npm, a package manager for Node that is accessed via a CLI (command line interface and will automatically install any modules defined in the package.json file included when you create a Solidus site.

**[Download an Installer](http://nodejs.org/download)**


Installing Solidus
-------------------------------------------------------------------------------------------

### What is Solidus?

A node.js server that is used to fetch JSON and serve pages. It comes with a default file structure, Grunt tasks, and .gitignore files.

### Installing Solidus

_Windows/Mac tabs (switch OS-styled frame)_

```
npm install solidus --global
```

It should be installed! Go ahead and try `solidus --help` to see if it worked. If you get a permissions error, try:

```
sudo npm install solidus --global
```

Are you new to using the Terminal in OS X or the Command Line in Windows?
* [Introduction to OS X Terminal](http://blog.teamtreehouse.com/introduction-to-the-mac-os-x-command-line)
* [How to use the Windows Command Line](http://www.computerhope.com/issues/chusedos.htm)

### Common Issues (from GitHub API)

**[Report an Issue](http://github.com/sparkartgroupinc/solidus/issues/new)**


Installing Grunt CLI
-------------------------------------------------------------------------------------------

### What's Grunt?

[Grunt](http://gruntjs.com/) is a task runner that plays well with Node.js. It runs repetitive tasks so you don't have to. Each task comes in the form of a stand-alone plug-in, which makes Grunt easily extensible.

### Installing Grunt CLI

The Grunt CLI adds a command that runs the version of Grunt that's installed next to a Gruntfile.

```
npm install -g grunt-cli
```

### Further Reading
* [How does Solidus use Grunt](/installing-solidus#grunt)
* [What's a Gruntfile](#)


Installing Sass
-------------------------------------------------------------------------------------------

### What is Sass?

Sass is a quicker, easier, and more effective way of writing CSS.

### Installing Sass

To install Sass you'll need to have Ruby installed. If you're on OS X, you already have Ruby. If you're on Windows, you'll need to install Ruby via the [Windows installer](http://rubyinstaller.org/downloads/).

Once you have Ruby installed, you can install Sass with the following command:

```
gem install sass
```

### Further Reading
* [Official Sass Tutorial](http://sass-lang.com/tutorial.html)
* [Learn Sass at Codeschool](http://www.codeschool.com/courses/assembling-sass)
* [Sass Blog](http://thesassway.com/)



**New / Existing Site Tabs**

Setup a New Website
-------------------------------------------------------------------------------------------

Now you're ready to start a project. Solidus CLI makes this easy. To start, just navigate to wherever you keep all of your other projects, and run this command:

```
solidus setup site-domain.com
```

This command will create the following folders and files inside a new folder using the domain name you specified:

 - **/assets**
 - **/node_modules** — this contains the Solidus server and all of the other modules that it depends upon.
 - **/resources**
 - **/views**
 - **gruntfile.json**
 - **package.json**
 - **server.js** - this file tells services like Modulus and Nodejitsu how to start the Solidus server.


Working with an Existing Website
-------------------------------------------------------------------------------------------

If you're going to be working with a site that's already been created and is (hopefully) on Github, getting the site up and running locally is easy.

1. Create a clone of the Remote repository on your computer with your Github client
1. Navigate to the new local repository with your CLI and run `npm install` to install the required modules listed in package.json
1. Once all the modules are installed, run `grunt dev` to activate Grunt which will start Solidus
1. Visit `localhost:8080` in your browser to see the site


Solidus ♥ Git
-------------------------------------------------------------------------------------------

Whether working alone or as part of a team, we recommend creating a Git repository for every website. Together with GitHub you won’t find a better way to track and share changes or protect yourself from horrible mistakes!

Be sure to keep your website repos clear of files that you didn't create. A global `.gitignore` file is the best way to accomplish this. GitHub has [recommendations on what you should ignore](https://help.github.com/articles/ignoring-files#global-gitignore). Here’s a couple things we’d add to their list:

- `.sass-cache`
- `node_modules`
- `npm-debug.log`
- `/assets/compiled/`

### Further Reading
* [Learn Git in 15 minutes](http://try.github.io/levels/1/challenges/1)


Start the Dev Server
-------------------------------------------------------------------------------------------

Starting Solidus is simple, run the following command in your CLI:

```
grunt dev
```

Visit `localhost:8080` in your browser to access your Solidus site.

### Further Reading
[Details of Starting Solidus](/installing-solidus#start)


Further Reading
-------------------------------------------------------------------------------------------

* The [Installing Solidus](/installing-solidus) guide has more detailed information about Node, Grunt, Solidus, Sass, and the installation process.

