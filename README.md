# Solidus

A lightweight [Node.js][node] server that generates sites from [Handlebars](http://handlebarsjs.com/) templates and JSON resources pulled in from almost any API. For any high traffic applications it is best to use it as an origin for a CDN that can provide sufficient caching. It has run in production with [Fastly][fastly] and [Edgecast][edgecast], but has been especially tuned for use with Fastly.

Awesome things you can do with Solidus:

- [Define routes from the filesystem](#views) including dynamic segments
- [Fetch JSON resources for content](#resources)
- [Modify resource data](#preprocessors) with preprocessor functions
- [Setup redirects](#redirects) with router access and scheduling options
- Easily deploy to [Heroku](https://www.heroku.com/)

## Install

- Install [Node.js](http://nodejs.org)
- Run `npm install solidus --save`
- Use the CLI from [npm scripts][npm-scripts]

## Usage

```
solidus [command]
```

Some commands (and Solidus itself) have flags which can be used to pass parameters to commands. You can do that like so:

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
Starts a Solidus server using the current folder.

- **--port, -p** specifies which port the Solidus server will listen on. By default it runs on port **8080**.
- **--dev, -d** determines if the server runs in development mode or not. Development mode displays logging information and watches views/redirects/preprocessors for changes. This is set to **false** by default.
- **--livereloadport, -r** specifies which port the LiveReload server will listen on (development mode only). By default it runs on port **35729**.
- **--loglevel, -l** sets the level of logging the server should display. **0** - errors, **1** - warnings, **2** - status, **3** - debug

```
solidus start -p 9001
solidus start --port 9001
solidus start --dev
solidus start --loglevel 2
```

## Building a Solidus Site

Solidus sites are comprised of **views**, **resources**, and **assets**. **Views** are [Handlebars](http://handlebarsjs.com/) templates used for page, layout, and partial markup. **Resources** are JSON API responses from places like YouTube, Tumblr, etc and the JavaScript preprocessors that normalize them. **Assets** are the CSS, JavasCript, fonts, and images in a Solidus site.

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
- **resources** - An object of resources the page will use. The key is the name of the resource, and the value is the URL or resource options object.
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

Instead of keeping content in a database Solidus uses data from external APIs. Solidus requests JSON data from third party APIs, preprocesses it, then combines it with a Handlebars template to make a page.

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

> Resources can also be specified with an options object instead of a string. This object must include `url`, and may include `headers` and `auth`. `headers` is an object of request headers, and `auth` is a string that represents an HTTP Auth parameter.

`doges/index.hbs`

```html
...
  "resources": {
    "doges": {
      "url": "https://example.com/api/v2/resources/4521zb/such-doges",
      "headers": {
        "key": "123"
      },
      "auth": "user:pass"
    }
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

#### Global Resource Configuration

Certain resources will require an options, like a **query string** or **header**, in order to work. Since these resources can be used across many views, it can quickly get cumbersome to set these options every single time you include a resource. To fix this problem, you can set options for a resource (or group of resources) based on their url globally, using `auth.json`. This file is a set of resource configurations that will be mixed in to resources before they are fetched. Here's a simple example:

`auth.json`

```json
{
  "http://proxy.storyteller.io/*": {
    "headers": {
      "Api-Key": "0000aaaa-aa00-00aa-a00a-aaaa000000"
    }
  },
  "http://services.sparkart.net/*": {
    "query": {
      "key": "1111bbbb-bb11-11bb-b11b-bbbb111111"
    }
  }
}
```

Now any resource that starts with `http://proxy.storyteller.io/` will mix in the data under that parameter, and any resource that starts with `http://services.sparkart.net/` will mix in the data under that parameter.

#### Preprocessors

If the data returned in a resource isn't quite right for a template, a **preprocessor** can be used to make the data more palatable. Preprocessors are run after resources are requested, but before pages are rendered, so they can be used to transform data, add new data, merge two resources together, and more. All preprocessors are placed in a site's `preprocessors` directory, and are enabled by specifying them in the `preprocessor` option in the view configuration. Preprocessors are simply [CommonJS modules](http://dailyjs.com/2010/10/18/modules/) that export a function which modifies and returns the page's `context`. Here's a quick example of a preprocessor that converts the name of the kitties to ALL CAPS:

`preprocessors/kitties.js`

```JavaScript
module.exports = function( context ){
  for( var i in context.resources.kitties.results ){
    context.resources.kitties.results[i] = context.resources.kitties.results[i].toUpperCase();
  }
  return context;
};
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

Preprocessors are Node.js modules like any other. [Search npm][npm] to find libraries solving common problems in areas like time, data manipulation, text formatting, and many more. [Node.js built-in modules][node-api] are also available. 

Here's a quick example:

`preprocessors/kitties.js`

```js
var _ = require('underscore');
module.exports = function( context ){
  context.resources.kitties.results = _.shuffle( context.resources.kitties.results );
  return context;
};
```

Processed context in `/kitties`

```json
{
  ...
  "resources": {
    "kitties": {
      "count": 3,
      "results": ["Pixel","Twizzler","Wesley"]
    }
  }
}
```

-----

### Redirects

Redirects can easily be defined using the `redirects.js` file located in the base of the Solidus site's directory. This file simply exports an array of redirection objects with the parameters `from`, `to`, `start`, `end`, and `permanent`. `from` is the route you want to redirect from, and `to` is the target destination. `start` and `end` are datetimes that correspond with when the redirection should be active and are in `YYYY-MM-DD HH:MM:SS` format. By default all redirects will be **302 Found**, but if `permanent` is true they will be served as **301 Moved Permanently**.

Here's an example `redirects.js`:

```js
module.exports = [
{
  from: "/redirect1",
  to: "/"
}, {
  from: "/redirect2",
  to: "/",
  "start": "2000-1-1 00:00:00"
}, {
  from: "/redirect3",
  to: "/",
  "start": "3000-1-1 00:00:00"
}, {
  from: "/redirect4",
  to: "/",
  "end": "2000-1-1 00:00:00"
}, {
  from: "/redirect5",
  to: "/",
  "permanent": true
}, {
  from: "/redirect6/{dynamic}/{route}",
  to: "/new/{route}/{dynamic}"
}, {
  from: /\/redirect7\/(\d+)-\d+-(\d+)-(\d+)/,
  to: "/new/{1}/{0}/{2}"
}, {
  from: "/redirect8/{dynamic}/{route}",
  to: function(params) {
    return "/new/{route}/" + params.dynamic.toUpperCase();
  }
}, {
  from: /\/redirect9\/(\d+)-\d+-(\d+)-(\d+)/,
  to: function(params) {
    return "/new/{1}/{0}/" + (1000 + parseInt(params['2']));
  }
}];
```

-----

### Assets

Solidus has the capability to serve any static resource you choose, be it stylesheets, JavaScripts, images, fonts, flash files, etc. Just place your assets in the `assets` directory or setup the build output from tools like [Gulp][gulp] and [Grunt][grunt], and Solidus will serve them up.

=======

### Tests

Solidus uses [mocha](https://github.com/visionmedia/mocha) to run its tests. Any new features should be tested, and resolved bugs should have tests to prevent regression. Tests can be run with the `mocha` command.


[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[node]: http://nodejs.org/
[node-api]: https://nodejs.org/api/
[handlebars]: http://handlebarsjs.com/
[fastly]: https://www.fastly.com/
[edgecast]: https://www.verizondigitalmedia.com/platform/edgecast-cdn/
[npm-scripts]: https://docs.npmjs.com/misc/scripts
[gulp]: http://gulpjs.com/
[grunt]: http://gruntjs.com/