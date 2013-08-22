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

To install Solidus:

- Install [Node.js](http://nodejs.org)
- Run `npm install solidus -g`

It should be installed! Go ahead and try `solidus -h` to see if it worked. You'll also want to make sure you have [Grunt](http://gruntjs.com) and [grunt-init](https://github.com/gruntjs/grunt-init) installed if you plan on using the [Solidus Site Template](https://github.com/SparkartGroupInc/solidus-site-template).

## Usage

Solidus has a command line interface (CLI), which means it's interface is entirely in the command line . Generally, you'll issue commands to solidus like so:

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

### start
Starts a solidus server using the current folder.

- **--port, -p** specifies which port the Solidus server will listen on. By default it runs on port **8080**.
- **--dev, -d** determines if the server runs in development mode or not. Development mode displays logging information and watches views/redirects/preprocessors for changes. This is set to **false** by default.
- **--loglevel, -l** sets the level of logging the server should display. **0** - errors, **1** - warnings, **2** - status, **3** - debug

```
solidus start -p 9001
solidus start --port 9001
solidus start --dev
solidus start --loglevel 2
```

## Building a Solidus Site

Solidus sites are comprised of **views**, **resources**, and **assets**. **Views** are [Handlebars](http://handlebarsjs.com/) templates used for page, layout, and partial markup. **Resources** are JSON API responses from places like YouTube, Tumblr, etc and the javascript preprocessors that normalize them. **Assets** are the CSS/SASS, javascripts, fonts, and images in a solidus site.

-----

### Views
The `views` directory contains every *page*, *partial*, and *layout* in a site. Any view with the name `layout.hbs` will automatically become a *layout*. By default, *pages* will inherit the closest *layout* and use it, up to the root of the `views` directory. *Partials* and *pages* are identical and only differ in usage: you can use any view as a partial or a page.

Every view in the `views` directory is available as a page. The routes of these pages are generated from their filename and location in the views directory. Here's a quick example:

- `views/index.hbs` becomes `/`
- `views/about.hbs` becomes `/about`
- `views/kitties/index.hbs` becomes `/kitties`
- `views/kitties/mr-welsey-kins.hbs` becomes `/kitties/mr-wesley-kins`

**Dynamic segments** can be defined by using curly braces `{}` in the view's filename. A dynamic segment is a placeholder for something variable, like a page number or ID. Here are some examples of views with dynamic segments:

- `views/doggies/{dog}.hbs` becomes `/doggies/ein`, `/doggies/marmaduke`, `/doggies/pixel`
- `views/articles/{article_id}.hbs` becomes `/articles/582890`, `/articles/582811`, `/articles/600345`

Dynamic segments can also be specified with directory names:

- `views/doggies/{dog}/toys` becomes `/doggies/ein/toys`, `/doggies/marmaduke/toys`, `/doggies/pixel/toys`
- `views/articles/{article_id}/links/{link_id}` becomes `/articles/582890/links/2`

**Page configuration** is done with a JSON object nested within a Handlebars comment at the top of a page view. This object can contain the following:

- **title** - The title of the page. This is generally used to populate the `<title>` tag.
- **resources** - An object of resources the page will use. The key is the name of the resource, and the value is the URL.
- **preprocessor** - The path to the preprocessor to use for this page. Relative to the preprocessors directory.
- **layout** - The path to the layout to use for this page. Overrides automatically defined local layouts.

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

### The Context

Every page in a Solidus site has a **context**, which holds all of the data that's being fed to a view. The context contains things such as page metadata, data fetched from remote resources, query parameters, and dynamic segment values. Contexts can also be modified before they are used in the view by [preprocessors](#Preprocessors). Here's a quick run down of what you'll find in the page context:

- **page** - General page metadata. Contains things like the current page's title and description (if defined).
- **assets** - Contains automatically generated HTML tags for things like compiled JS/CSS and favicons.
- **parameters** - Contains the names and values of any dynamic segments active in the current page.
- **query** - Any data passed as a query parameter, like `?page=5`.
- **resources** - The data returned by the page's resources.
- **layout** - The current page's layout.

Here's an example context:

```json
{
	"page": {
		"title": "Character Page",
		"path": "/Users/Sparkart/solidus-test-site/views/characters/{hero_id}.hbs"
	},
	"parameters": {
		"hero_id": "92352"
	},
	"query": {
		"debug": "true"
	},
	"resources": {
		"character": {
			"id": 92352,
			"name": "UUUGUUUUUUUU",
			"class": "demon-hunter",
			"gender": "0"
			...
		}
	},
	"assets": {
		"scripts": "<script src=\"/compiled/scripts.js\"></script>",
		"styles": "<link rel=\"stylesheet\" href=\"/compiled/styles.css\" />"
	},
	"layout": "layout.hbs"
}
```

### Resources

Instead of keeping content in a database Solidus uses data from external APIs. Solidus requests JSON data from third party APIs, preprocesses it, then combines it with a handlebars template to make a page.

**Important:** API responses are cached, but expire in only a minute, meaning API requests very often. This may cause any rate limits to be quickly exceeded in production when a site is exposed to traffic. An API proxy is therefore highly recommended.

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
	...
	"resources": {
		"kitties": {
			"count": 3,
			"results": ["Wesley", "Twizzler", "Pixel"]
		}
	}
	...
}
```

3) The context can also be made available to client side JavaScript like so:

```html
<script>{{{context}}}</script>
<script>
	alert( 'Here are the kitties!', solidus.context.resources.kitties.results );
</script>
```

#### Dynamic Resources

Sometimes resources will need to be requested with parameters that change dynamically. This can be done by using **dynamic segments** or **query parameters**. To create a dynamic resource, all you need to do is replace the dynamic part of your resource URL with a placeholder in curly braces (just like setting up dynamic routes). The name of the placeholder should match up with the name of the dynamic segment or query parameter you want to use to fill it in. In the event that a dynamic segment and query parameter have the same name, the query parameter will be used.

`kitties/{resource_id}.hbs`
```json
...
    "resources": {
    	"kitties": "https://example.come/api/v1/resources/{resource_id}/kitties?order={order}"
	}
...
```

Context in `/kitties/635bc?order=alpha`
(result from the resource: `https://example.come/api/v1/resources/635bc/kitties?order=alpha`)
```json
{
	...
	"resources": {
		"kitties": {
			"count": 3,
			"results": ["Pixel", "Twizzler", "Wesley"]
		}
	}
	...
}
```

#### Preprocessors

If the data returned in a resource isn't quite right for a template, a **preprocessor** can be used to make the data more palatable. Preprocessors are run after resources are requested, but before pages are rendered, so they can be used to transform data, add new data, merge two resources together, and more. All preprocessors are placed in the `preprocessors` directory, and are enabled by specifying them in the `preprocessor` option in the view configuration. The context is automatically passed in as `context`, and any changes made to it will be reflected in the context used in the page. Here's a quick example of a preprocessor that converts the name of the kitties to ALL CAPS:

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

Original context in `/kitties`
```json
{
	...
	"resources": {
		"kitties": {
			"count": 3,
			"results": ["Wesley","Twizzler","Pixel"]
		}
	}
}
```

Processed context in `/kitties`
```json
{
	...
	"resources": {
		"kitties": {
			"count": 3,
			"results": ["WESLEY","TWIZZER","PIXEL"]
		}
	}
}
```

Preprocessors also come preloaded with some popular js libraries by default. [Underscore](http://underscorejs.org/), [Moment](http://momentjs.com/), [XDate](http://arshaw.com/xdate/), and [Sugar](http://sugarjs.com/) are all automatically accessible within preprocessor files. Here's a quick example:


`preprocessors/kitties.js`
```js
context.resources.kitties.results = _( context.resources.kitties.results ).map( function( cat ){
	return cat +' the cat';
});
```

Processed context in `/kitties`
```json
{
	...
	"resources": {
		"kitties": {
			"count": 3,
			"results": ["Wesley the cat","Twizzler the cat","Pixel the cat"]
		}
	}
}
```

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

Solidus has the capability to serve any static resource you choose, be it stylesheets, javascripts, images, fonts, flash files, etc. Just place your assets in the `assets` directory, and Solidus will serve them up.

Solidus uses Grunt to compile SASS, client side templates, and run other client-side tasks. An ideal `Gruntfile` is included with the [Solidus Site Template](https://github.com/SparkartGroupInc/solidus-site-template), but any gruntfile or build system can be used. For more information on using Grunt for asset compilation and management in a Solidus site, see the [Solidus Site Template](https://github.com/SparkartGroupInc/solidus-site-template) documentation.

=======

### Tests

Solidus uses [mocha](https://github.com/visionmedia/mocha) to run its tests. Any new features should be tested, and resolved bugs should have tests to prevent regression. Tests can be run with the `mocha` command.
