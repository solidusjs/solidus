# Solidus

A simple [Node.js](http://nodejs.org/) server that generates sites from [Handlebars](http://handlebarsjs.com/) templates and JSON resources. Solidus helps you rapidly build sites by giving you a simple server you can run on both development machines and in production, along with customizable build scripts (via [Grunt](http://gruntjs.com)), and the ability to pull in content from any JSON API.

Awesome things you can do with Solidus:

- Generate site routes from view paths
- Fetch remote JSON for content
- Automatically use scoped layouts
- Create dynamic routes quickly and easily
- Easily deploy to services like [Appfog](https://www.appfog.com/), [Heroku](https://www.heroku.com/), [Nodejitsu](https://www.nodejitsu.com/), [AWS](http://aws.amazon.com/), etc.
- Generate new sites from site templates (via grunt-init)

Awesome things you can do with the [Solidus Site Template](https://github.com/SparkartGroupInc/solidus-site-template):

- Use your view templates client side (via Grunt)
- [Livereload](http://livereload.com/) as you update your SASS/CSS (via Grunt)
- Compile your styles/scripts into production bundles (via Grunt)

## Installation

To install Solidus (*this will change later!*):

- Install [Node.js](http://nodejs.org)
- Clone this repository. Ideally somewhere semi-permanent.
- Navigate to the base folder of your clone and run `npm link` (you may need to use sudo: `sudo npm link`)

It should be installed! Go ahead and try `solidus -h` to see if it worked. You'll also want to make sure you have [Grunt](http://gruntjs.com) and [grunt-init](https://github.com/gruntjs/grunt-init) installed if you plan on using the [Solidus Site Template](https://github.com/SparkartGroupInc/solidus-site-template).

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

Most of the time you'll be using `solidus start --dev` to start a Solidus server in development mode. To see a full list of commands/options available to you, just use the "help" flag ( `-h`, `--help` ).

### API

You can also run Solidus manually in code if you need to. In order to do this, just include Solidus locally and `require` it. The only method available at the moment is `solidus.start`, and it's essentially the same as the CLI command:

```js
var solidus = require('solidus');
solidus.start({
	port: 9001,
	dev: true
});
```

## Commands

### start ( -p,--port -d,--dev )
Starts a solidus server using the current folder. By default it runs on port 8080.

```
solidus start -p 9001
solidus start --port 9001
solidus start --dev
```

## Building a Solidus Site

Solidus sites are comprised of **views**, **resources**, and **assets**. **Views** are [Handlebars](http://handlebarsjs.com/) templates used for page, layout, and partial markup. **Resources** are JSON API responses from places like YouTube, Tumblr, etc and the javascript preprocessors that normalize them. **Assets** are the CSS/SASS, javascripts, fonts, and images in a solidus site.

-----

### Views
The `views` directory contains every *page*, *partial*, and *layout* in a site. Any view with the name `layout.hbs` will automatically become a *layout*. By default, *pages* will inherit the closest *layout* and use it, up to the root of the `views` directory. *Partials* and *pages* are identical and only differ in usage: you can use any view as a partial, and any view as a page.

Every view in the `views` directory is available as a page. The routes of these pages are generated from their filename and location in the views directory. Here's a quick example:

- `views/index.hbs` becomes `/`
- `views/about.hbs` becomes `/about`
- `views/kitties/index.hbs` becomes `/kitties`
- `views/kitties/mr-welsey-kins.hbs` becomes `/kitties/mr-wesley-kins`

**Dynamic segments** can be defined by using curly braces `{}` in the view's filename. A dynamic segment is a placeholder for something variable, like a page number or ID. Here are some examples of views with dynamic segments:

- `views/doggies/{dog}.hbs` becomes `/doggies/ein`, `/doggies/marmaduke`, `/doggies/pixel`
- `views/articles/{article_id}.hbs` becomes `/articles/582890`, `/articles/582811`, `/articles/600345`

**Page configuration** is done with a JSON object nested within a Handlebars comment at the top of a page view. This object can contain the following:

- **title** - The title of the page. This is generally used to populate the `<title>` tag.
- **resources** - An object of resources the page will use. The key is the name of the resource, and the value is the URL.
- **preprocessor** - The path to the preprocessor to use for this page. Relative to 

Here's a quick example of what a page configuration might look like:

`index.hbs`
```html
{{!
	{
		"title": "Home",
		"resources": {
			"kitties": "https://example.com/api/v1/resources/5632ac/tims-favorite-kitties",
			"doggies": "https://example.com/api/v1/resources/4657df/tims-favorite-doggies"
		},
		"preprocessor": "home.js"
	}
}}
```

-----

### Resources

Instead of keeping content in a database, solidus relies on external APIs. Solidus requests JSON data from third party APIs, preprocesses it, then combines it with a handlebars template to make a page.

**Important:** API responses are uncached, meaning API requests will be made for every pageview. This may cause any rate limits to be quickly exceeded in production when a site is exposed to traffic. An API proxy is therefore highly recommended.

Here's a quick outline of how resources work:

1) A resource is added to the configuration object of a page view:

`kitties/index.hbs`
```html
...
	"resources": {
		"kitties": "https://example.com/api/v1/resources/5632ac/tims-favorite-kitties"
	}
...
```

2) When the page is requested, the resources are fetched and their data is added to the `resources` object in the page's context. It looks something like this:

Context in `/kitties`
```json
{
	"resources": {
		"kitties": {
			"count": 3,
			"results": ['Wesley','Twizzler','Pixel']
		}
	}
}
```

3) The context can also be made available to client side JavaScript like so:

```html
<script>{{{context}}}</script>
<script>
	alert( 'Here are the kitties!', solidus.context.resources.kitties.results );
</script>
```

If the data returned in a resource isn't quite right for a template, a **preprocessor** can be used to make the data more palatable. Preprocessors are run after resources are requested, but before pages are rendered, so they can be used to transform data, add new data, merge two resources together, and more. All preprocessors are placed in the `preprocessors` directory, and are enabled by specifying them in the `preprocessors` option in the view configuration. Here's a quick example of a preprocessor that converts the name of the kitties to ALL CAPS:

`preprocessors/kitties.js`
```javascript
for( var i in context.resources.kitties.results ){
	context.resources.kitties.results[i] = context.resources.kitties.results[i].toUpperCase();
}
```

`views/kitties/index.hbs`
```html
...
	"resources": {
		"kitties": "https://example.com/api/v1/resources/5632ac/tims-favorite-kitties"
	},
	"preprocessor": "kitties.js"
...
```

Context in `/kitties`
```json
{
	"resources": {
		"kitties": {
			"count": 3,
			"results": ["WESLEY","TWIZZER","PIXEL"]
		}
	}
}
```

The context is automatically passed in as `context`, and any changes made to it will be reflected in the context used in the page.

-----

### Redirects

Redirects can easily be defined using the `redirects.json` file located in the base of the Solidus site's directory. This file simply contains an array of redirection objects with the parameters `from`, `to`, `start`, and `end`. `From` is the route you want to redirect from, and `to` is the target destination. `Start` and `end` are datetimes that correspond with when the redirection should be active and are in `YYYY-MM-DD HH:MM:SS` format. Redirects with a `start` or `end` attribute will be **302 Found** while redirects without will be **301 Moved Permanently**.

Here's an example `redirects.json`:

```json
[{
	"from": "/redirect1",
	"to": "/"
}, {
	"from": "/redirect2",
	"to": "/",
	"start": "2000-1-1 00:00:00"
}, {
	"from": "/redirect3",
	"to": "http://www.sparkart.com",
	"start": "3000-1-1 00:00:00"
}, {
	"from": "/redirect4",
	"to": "http://www.spakart.com",
	"end": "2000-1-1 00:00:00"
}, {
	"from": "/redirect5",
	"to": "http://www.spakart.com",
	"start": "2000-1-1 00:00:00",
	"end": "2020-1-1 00:00:00"
}]
```

-----

### Assets and Grunt

Solidus has the capability to serve any static resource you choose, be it stylesheets, javascripts, images, fonts, flash files, etc. Just place your assets in the `assets` directory, and solidus will serve them up.

For more information on asset compilation and management, see the [Solidus Site Template](https://github.com/SparkartGroupInc/solidus-site-template) documentation.

=======

### Tests

Solidus uses [mocha](https://github.com/visionmedia/mocha) to run its tests. Any new features should be tested, and resolved bugs should have tests to prevent regression. Tests can be run with the `mocha` command.
