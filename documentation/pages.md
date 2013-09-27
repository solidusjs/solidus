### Interactive Example

 - Context
 - Handlebars template
 - Rendered HTML

### Why Handlebars?


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
### Layouts
### Partials

    - Used to keep your code DRY
    - Can be Included via Handlebars


URLs
--------------------------------------------------------------------------------

### Old-school Filesystem Routing

The routes of all page views are generated from their filename and location within the views directory.

* `views/index.hbs` becomes `/`
* `views/about.hbs` becomes `/about`
* `views/kitties/index.hbs` becomes `/kitties`
* `views/kitties/mr-welsey-kins.hbs` becomes `/kitties/mr-wesley-kins`

### Dynamic Segments

Dynamic segments can be defined by using curly braces `{}` in the view's filename. A dynamic segment is a placeholder for something variable, like a page number or ID. Here are some examples of views with dynamic segments:

* `views/doggies/{dog}.hbs` becomes `/doggies/ein`, `/doggies/marmaduke`, `/doggies/pixel`
* `views/articles/{article_id}.hbs` becomes `/articles/582890`, `/articles/582811`,`/articles/600345`

Dynamic segments can also be specified with directory names:

* `views/doggies/{dog}/toys` becomes `/doggies/ein/toys`, `/doggies/marmaduke/toys`,`/doggies/pixel/toys`
* `views/articles/{article_id}/links/{link_id}` becomes `/articles/582890/links/2`


Dynamic Rendering
--------------------------------------------------------------------------------


Redirects
--------------------------------------------------------------------------------