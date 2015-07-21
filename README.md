spiderable-longer-timeout
====

This is a branch of the standard meteor `spiderable` package, with some merged code from
`ongoworks:spiderable` package. Primarily, this lengthens the timeout to 30 seconds and
size limit to 10MB. All results will be cached to Mongo collection, by default for 3 hours (10800 seconds).

### Install using
```shell
meteor add jazeee:spiderable-longer-timeout
```

### Things you must do to make it work
#### Set `Meteor.isReadyForSpiderable` property
Code will wait for a flag to be `true`, which gives finer control while content is preparing to be published.

#### Optionally set `Spiderable.userAgentRegExps`
`Spiderable.userAgentRegExps` __{[*RegExp*]}__ - is array of Regular Expressions, of bot user agents that we want to serve statically, but do not obey the `_escaped_fragment_ protocol`.
```coffeescript
Spiderable.userAgentRegExps.push /^vkShare/i
```

#### Optionally set `Spiderable.cacheTTL`
__Note:__ 
 - Should be set before `Meteor.startup`
 - Value should be {*Number*} in seconds
 - Ton set new TTL you need to drop index on `createdAt_1`
```coffeescript
Spiderable.cacheTTL = 3600 # 1 hour in seconds
```
To drop TTL index run in Mongo console:
```coffeescript
db.SpiderableCacheCollection.dropIndex('createdAt_1');
# or
db.SpiderableCacheCollection.dropIndexes();
```

#####Default bots:
 - `/^facebookExternalHit/i`
 - `/^linkedinBot/i`
 - `/^twitterBot/i`
 - `/^googleBot/i`
 - `/^bingBot/i`
 - `/^yandex/i`
 - `/^google-structured-data-testing-tool/i`
 - `/^yahoo/i`
 - `/^MJ12Bot/i`
 - `/^tweetmemeBot/i`
 - `/^baiduSpider/i`
 - `/^Mail\.RU_Bot/i`
 - `/^ahrefsBot/i`
 - `/^SiteLockSpider/`

#### Optionally set `Spiderable.ignoredRoutes`
`Spiderable.ignoredRoutes` __{[*String*]}__ - is array of strings, routes that we want to serve statically, but do not obey the `_escaped_fragment_` protocol. For more info see this [thread](https://github.com/meteor/meteor/issues/3853).
```coffeescript
Spiderable.ignoredRoutes.push '/cdn/storage/Files/'
```

#### `Spiderable.query`
`Spiderable.query` __{*Boolean*|*String*}__ - additional `get` query appended to http request.
This option may help to build different client's logic for requests from phantomjs and normal users

 - If `true` - to request will be appended query with key `___isPhantomjs___`, and `true` as a value
 - If `String` - to request will be appended query with your custom key `String`, and `true` as a value
```coffeescript
Spiderable.query = true
Spiderable.query = '_fromPhantom_'

# Usage:
Router.onAfterAction ->
  if Meteor.isClient and _.has @params.query, '___isPhantomjs___'
    Session.set '___isPhantomjs___', true
```

#### If you're using Iron-Router
To avoid non-existent Iron-Router routes - create catch-all route, which renders `Router.options.notFoundTemplate` on client and returns `404` error on server. Find out more about Iron-router and `notFoundTemplate` in [official docs](http://iron-meteor.github.io/iron-router/#applying-plugins-to-specific-routes).
```coffeescript
Router.route '/(.*)', ->
  if Meteor.isServer
    @response.writeHead 404, 'Content-Type': 'text/html'
    return @response.end()
  else
    return @render Router.options.notFoundTemplate
```

#### Hide server's console messages, set `Spiderable.debug`
Set `Spiderable.debug` to `false` to avoid server's console messages
```coffeescript
Spiderable.debug = false
```


### **Important**
You will need to set `Meteor.isReadyForSpiderable` to `true` when your route is finished, in order to publish.
I am deprecating `Meteor.isRouteComplete=true`, but it will work until at least 2015-12-31 after which I'll remove it...
See [code for details](https://github.com/jazeee/jazeee-meteor-spiderable/blob/master/phantom_script.js)

If using IronRouter, I recommend that you create a base controller with `onAfterAction` function. Once checking for `@isReady()`, you can set `Meteor.isReadyForSpiderable = true` in that.
```coffeescript
BaseController = RouteController.extend
  onAfterAction: ->
    if @ready()
      # Waits for subscriptions to complete, which means we can render the page.
      Meteor.isReadyForSpiderable = true
  waitOn: ->
    [Meteor.subscribe 'someCollectionThatAffectsRenderingPerhaps']
```

### Install PhantomJS on your server
If you deploy your application with `meteor bundle`, you must install
phantomjs ([http://phantomjs.org](http://phantomjs.org/)) somewhere in your
`$PATH`. If you use Meteor Up, then `meteor deploy` will do this for you.

`Spiderable.originalRequest` is also set to the http request. See [issue 1](https://github.com/jazeee/jazeee-meteor-spiderable/issues/1).

### Testing
You can test your site by appending a query to your URLs: `URL?_escaped_fragment_=` as in `http://your.site.com/path_escaped_fragment_=`

#### curl
`curl` your `localhost` or host name, if you on production, like:
```shell
curl http://localhost:3000/?_escaped_fragment_=
curl http://localhost:3000/ -A googlebot
```


### From Meteor's original Spiderable documentation. See notes specific to this branch (above).

`spiderable` is part of [Webapp](https://www.meteor.com/webapp). It's
one possible way to allow web search engines to index a Meteor
application. It uses the [AJAX Crawling
specification](https://developers.google.com/webmasters/ajax-crawling/)
published by Google to serve HTML to compatible spiders (Google, Bing,
Yandex, and more).

When a spider requests an HTML snapshot of a page the Meteor server runs the
client half of the application inside [phantomjs](http://phantomjs.org/), a
headless browser, and returns the full HTML generated by the client code.

In order to have links between multiple pages on a site visible to spiders, apps
must use real links (eg `<a href="/about">`) rather than simply re-rendering
portions of the page when an element is clicked. Apps should render their
content based on the URL of the page and can use [HTML5
pushState](https://developer.mozilla.org/en-US/docs/DOM/Manipulating_the_browser_history)
to alter the URL on the client without triggering a page reload. See the [Todos
example](http://meteor.com/examples/todos) for a demonstration.

When running your page, `spiderable` will wait for all publications
to be ready. Make sure that all of your [`publish functions`](#meteor_publish)
either return a cursor (or an array of cursors), or eventually call
[`this.ready()`](#publish_ready). Otherwise, the `phantomjs` executions
will fail.

