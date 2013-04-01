# Solidus

A simple server that generates sites from JSON and Templates.

## Installation

To install Solidus (*this will change later!*):

- Install [Node.js](http://nodejs.org)
- Clone this repository. Ideally somewhere semi-permanent.
- Navigate to the base folder of your clone and run `npm link` (you may need to use sudo: `sudo npm link`)

It should be installed! Go ahead and try `solidus -h` to see if it worked.

## Usage

Solidus is a command line interface (CLI), and thus every command will need to be done through a terminal window. Generally, you'll issue commands to solidus like so:

```
solidus [command]
```

Some commands (and solidus itself) have flags which can be used to pass parameters to commands. You can do that like so:

```
solidus [command] -[flag] [value]

OR

solidus [command] --[longflag] [value]
```

To see a list of commands/options available to you, just use the "help" flag ( `-h`, `--help` ).