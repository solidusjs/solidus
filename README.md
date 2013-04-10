# Solidus

A simple server that generates sites from JSON and Templates.

## Installation

To install Solidus (*this will change later!*):

- Install [Node.js](http://nodejs.org)
- Clone this repository. Ideally somewhere semi-permanent.
- Navigate to the base folder of your clone and run `npm link` (you may need to use sudo: `sudo npm link`)

It should be installed! Go ahead and try `solidus -h` to see if it worked.

## Usage

Solidus is a command line interface (CLI), which means it's interface is entirely in the command line . Generally, you'll issue commands to solidus like so:

```
solidus [command]
```

Some commands (and solidus itself) have flags which can be used to pass parameters to commands. You can do that like so:

```
solidus [command] -[flag] [value]

OR

solidus [command] --[longflag] [value]
```

Most of the time you'll be using `solidus dev` to start a Soidus server in development mode. To see a full list of commands/options available to you, just use the "help" flag ( `-h`, `--help` ).

## Commands

### start ( -p|--port )
Starts a solidus server using the current folder. By default it runs on port 8080.

```
solidus start -p 9001
```

### dev ( -p|--port )
Starts a solidus server in development mode. Development mode automatically compiles assets, views, and preprocessors. This also runs a livereload server for automatically reloading CSS as its updated.

```
solidus dev --port 9001
```

## Building a Solidus Site

Solidus sites are comprised of a **views**, **preprocessors**, and **assets**. Views are [Handlebars.js](http://handlebarsjs.com/) templates, preprocessors are simple javascripts, and assets include SASS, javascript, fonts, and images.

### Views
The views directory contains every page, partial, and layout for a site. Layouts are any view that has the name `layout.hbs`. By default, pages will inherit the closest layout and use it, up to the root views directory. Partials and pages are identical and only differ in usage: you can use any view as a partial, and any view as a page.

Every view in the view folder is available as a page. The routes of these pages are generated from their filename and location in the views directory. Here's a quick example:

`views/index.hbs` becomes `http://solidus-site.com/`
`views/about.hbs` becomes `http://solidus-site.com/about`
`views/kitties/index.hbs` becomes `http://solidus-site.com/kitties`
`views/kitties/mr-welsey-kins.hbs` becomes `http://solidus-site.com/kitties/mr-wesley-kins`