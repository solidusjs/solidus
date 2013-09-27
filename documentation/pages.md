### Interactive Example

 - Context
 - Handlebars template
 - Rendered HTML

Handlebars
-------------------------------------------------------------------------------------------

### What is Handlebars?

### Why Handlebars?


Context
-------------------------------------------------------------------------------------------

## What is the context?

## How do I see the context?


Templating
-------------------------------------------------------------------------------------------

    redirects.json
    templates
    └── blog
    │   ├── {post-id}.hbs
    │   ├── archive.hbs
    │   └── index.hbs
    ├── index.hbs
    └── layout.hbs

### Templates

#### Template Configuration

Pages are configured with a JSON object nested within a Handlebars comment at the top of each page view. The configuration object can contain the following:

* **title** - The title of the page. This is generally used to populate the `<title>` tag.
* **resources** - An object of resources the page will use. The key is the name of the resource, and the value is the URL.
* **preprocessor** - The path to the preprocessor to use for this page. Relative to the preprocessors directory.
* **layout** - The path to the layout to use for this page. Overrides automatically defined local layouts.
Here's a quick example of what a page configuration might look like:

`index.hbs`

` {{!
    {
        "title": "Home",
        "resources": {
            "kitties": "https://example.com/api/v1/resources/5632ac/tims-favorite-kitties",
            "doggies": "https://example.com/api/v1/resources/4657df/tims-favorite-doggies"
        },
        "preprocessor": "home.js"
    }
}} `


## Layouts

Notes:

    - Scoped Layouts


## Partials

Notes:

    - Snippets of code
    - Used to keep your code DRY
    - Can be Included via Handlebars


URLs
--------------------------------------------------------------------------------

## Old-school Filesystem Routing

The routes of all page views are generated from their filename and location within the views directory.

* `views/index.hbs` becomes `/`
* `views/about.hbs` becomes `/about`
* `views/kitties/index.hbs` becomes `/kitties`
* `views/kitties/mr-welsey-kins.hbs` becomes `/kitties/mr-wesley-kins`


## Dynamic Segments

Dynamic segments can be defined by using curly braces `{}` in the view's filename. A dynamic segment is a placeholder for something variable, like a page number or ID. Here are some examples of views with dynamic segments:

* `views/doggies/{dog}.hbs` becomes `/doggies/ein`, `/doggies/marmaduke`, `/doggies/pixel`
* `views/articles/{article_id}.hbs` becomes `/articles/582890`, `/articles/582811`,`/articles/600345`

Dynamic segments can also be specified with directory names:

* `views/doggies/{dog}/toys` becomes `/doggies/ein/toys`, `/doggies/marmaduke/toys`,`/doggies/pixel/toys`
* `views/articles/{article_id}/links/{link_id}` becomes `/articles/582890/links/2`


### Dynamic Segments + Resources


Dynamic Rendering
--------------------------------------------------------------------------------


Redirects
--------------------------------------------------------------------------------