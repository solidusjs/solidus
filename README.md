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

Most of the time you'll be using `solidus dev` to start a Solidus server in development mode. To see a full list of commands/options available to you, just use the "help" flag ( `-h`, `--help` ).

## Commands

### start ( -p,--port -d,--dev )
Starts a solidus server using the current folder. By default it runs on port 8080.

```
solidus start -p 9001
solidus start --port 9001
solidus start --dev
```

## Building a Solidus Site

Solidus sites are comprised of a **views**, **resources**, and **assets**. **Views** are [Handlebars.js](http://handlebarsjs.com/) templates used for page, layout, and partial markup. **Resources** are JSON API responses from places like YouTube, Tumblr, Hipster, etc and the javascript preprocessors that normalize them. **Assets** are the CSS/SASS, javascripts, fonts, and images in a solidus site.

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
			"kitties": "https://hipster-tools.herokuapp.com/hipster/v1/resources/5632ac/tims-favorite-kitties",
			"doggies": "https://hipster-tools.herokuapp.com/hipster/v1/resources/4657df/tims-favorite-doggies"
		},
		"preprocessor": "home.js"
	}
}}
```

-----

### Resources

Instead of keeping content in a database, solidus relies on external APIs for information. Solidus takes JSON data from third party APIs, preprocesses it, then combines it with a handlebars template to make a page. While API responses can be used directly, it is **highly recommended** that [Hipster](http://hipster-tools.sparkart.net) is used to proxy the requests first.

Here's a quick outline of how resources work:

1) A resource is added to the configuration object of a page view:

`kitties/index.hbs`
```html
...
	"resources": {
		"kitties": "https://hipster-tools.herokuapp.com/hipster/v1/resources/5632ac/tims-favorite-kitties"
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
for( var i in data.resources.kitties.results ){
	data.resources.kitties.results[i] = data.resources.kitties.results[i].toUpperCase();
}
```

`views/kitties/index.hbs`
```html
...
	"resources": {
		"kitties": "https://hipster-tools.herokuapp.com/hipster/v1/resources/5632ac/tims-favorite-kitties"
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
			"results": ['WESLEY','TWIZZER','PIXEL']
		}
	}
}
```

The context is automatically passed in as `data`, and any changes made to it will be reflected in the context used in the page.

-----

### Assets and Grunt

Solidus has the capability to serve any static resource you choose, be it stylesheets, javascripts, images, fonts, flash files, or more. Just place your assets in the `assets` directory, and solidus will serve them up.

When creating a Solidus site, you should always start off using the [Solidus Site Template](https://github.com/SparkartGroupInc/solidus-site-template). This site template provides a set of [Grunt](http://gruntjs.com) instructions for asset compilation. These scripts will do the following:

- Compile all js in `/scripts/` to `/compiled/scripts.js`
- Compile all CSS/SASS in `/styles/` to `/compiled/styles.css`
- Compile all views in `/views/` to `/compiled/templates.js` and `/compiled/partials.js`

Here's a quick example of a Solidus site's asset structure:

```
assets
|-images
  |-kitties.png
|-scripts
  |-vendors
    |-jquery.js
  |--index.js
  |--kitties.js
|-styles
  |-index.sass
  |-kitties.sass
```

After `grunt compile` or `grunt dev` are run, a new folder is created with the compiled scripts, styles, and templates of the site.

```
assets
|-compiled
  |-partials.js
  |-scripts.js
  |-styles.css
  |-templates.js
...
```

All of a site's views can be accessed client-side as **JavaScript Templates**. Since views are just [Handlebars.js](http://handlebarsjs.com/) templates, all you need to do is include Handlebars, include your templates, and use them. Javascript templates, along with anything else solidus makes available client-side, is on the `solidus` namespace. Here's a quick example of how it works:

`index.hbs`
```html
<html>
	<head>
		<script src="/scripts/vendor/handlebars.js"></script>
		<script src="/compiled/templates.js"></script>
		<script src="/compiled/partials.js"></script>
		<script>
			var markup = solidus.templates['kitties/index']( data );
			$( function(){
				$('body').append( markup );
			});
		</script>
	</head>
</html>
```

At the moment, assets will be compiled in the order they appear in the filesystem. When building a site, you should always try to use the compiled assets, as they will be optimized for distribution. Other assets, such as fonts and images, have no compilation step and can be used as is.

=======

### Tests

Solidus uses [mocha](https://github.com/visionmedia/mocha) to run its tests. Any new features should be tested, and resolved bugs should have tests to prevent regression. Tests can be run with the `mocha` command.
