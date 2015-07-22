spiderable-longer-timeout
====

This is a branch of the standard meteor `spiderable` package, with some merged code from
`ongoworks:spiderable` package. Primarily, this lengthens the timeout to 30 seconds and
size limit to 10MB. All results will be cached to Mongo collection, by default for 3 hours (180 minutes).

### Install using
```shell
meteor add jazeee:spiderable-longer-timeout
```

### Required: Do the following to make it work
#### Set `Meteor.isReadyForSpiderable` property
Spiderable will wait for a flag to be `true`, which gives finer control while content is preparing to be published.

Set `Meteor.isReadyForSpiderable=true` when Meteor finishes publishing and rendering the UI. See [Guidelines](#guidelines)

#### Optionally set `Spiderable.userAgentRegExps`
`Spiderable.userAgentRegExps` __{[*RegExp*]}__ - is array of Regular Expressions, of bot user agents that we want to serve statically, but do not obey the `_escaped_fragment_ protocol`.
```coffeescript
Spiderable.userAgentRegExps.push /^vkShare/i
```

#### Optionally set `Spiderable.cacheLifetimeInMinutes`
__Note:__ 
 - Should be set before `Meteor.startup`
 - Value should be {*Number*} in minutes
 - To reset a new cache lifetime you need to drop index on `createdAt_1` or wait for the previous cache to expire.
```coffeescript
Spiderable.cacheLifetimeInMinutes = 60 # 1 hour in minutes
```
If you want to rebuild your cache, drop the cache index. To drop the cache index, run in Mongo console:
```javascript
db.SpiderableCacheCollection.dropIndex('createdAt_1');
/* or */
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

#### `Spiderable.customQuery`
`Spiderable.customQuery` __{*Boolean*|*String*}__ - additional `get` query appended to http request.
This option may help to build different client's logic for requests from phantomjs and normal users

 - If `true` - Spiderable will append `___isRunningPhantomJS___=true` to the query
 - If `String` - Spiderable will append `String=true` to the query
```coffeescript
Spiderable.customQuery = true
Spiderable.customQuery = '_fromPhantom_'

# Usage:
Router.onAfterAction ->
  if Meteor.isClient and _.has @params.query, '___isRunningPhantomJS___'
    Session.set '___isRunningPhantomJS___', true
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

####Guidelines
* Make sure all subscriptions are completed.
   * If you don't, Meteor may render correctly in local tests, but fail to render correctly on Google, resulting in bad spidering. Unfortunately, this may be intermittent, and hard to discover.
   * If using IronRouter, create a base controller with `onAfterAction` function. Once checking for `@ready()`, set `Meteor.isReadyForSpiderable = true` in that.
```coffeescript
BaseController = RouteController.extend
  onAfterAction: ->
    if @ready()
      # Waits for subscriptions to complete, which means we can render the page.
      Meteor.isReadyForSpiderable = true
  waitOn: ->
    [Meteor.subscribe 'someCollectionThatAffectsRenderingPerhaps']
```
* Google tools such as `Fetch as Google` may show that your page doesn't render correctly. See [testing](#testing) below.

### Install PhantomJS on your server
If you deploy your application with `meteor bundle`, you must install
phantomjs ([http://phantomjs.org](http://phantomjs.org/)) somewhere in your
`$PATH`. If you use Meteor Up, then `meteor deploy` will do this for you.

`Spiderable.originalRequest` is also set to the http request. See [issue 1](https://github.com/jazeee/jazeee-meteor-spiderable/issues/1).

### Testing
Test your site by appending a query to your URLs: `URL?_escaped_fragment_=` as in `http://your.site.com/path_escaped_fragment_=`

#### curl
`curl` your `localhost` or host name, if you on production, like:
```shell
curl http://localhost:3000/?_escaped_fragment_=
curl http://localhost:3000/ -A googlebot
```

#### Google Tools: Fetch as Google
Use `Fetch as Google` tools to scan your site. Tips:
* Observe your server logs using tail -f or mup logs -f
* `Fetch as Google` and observe that it takes 3-5 minutes before displaying results.
   * Use an uncommon URL to help you identify your request in the logs. Consider adding an extra URL query parameter. For example:
```shell
# Simple test with test=1 query
curl "http://localhost:3002/blogs?_escaped_fragment_=&test=1"
# Set the date in the query, which will show up in Meteor logs, with a unique date.
TEST=`date "+%Y%m%d-%H%M%S"`;echo $TEST;curl "http://localhost:3002/blogs?_escaped_fragment_=&test=${TEST}"
```
* Interpreting `Fetch as Google` results:
   * The tool will not actually hit your server right away.
   * It appears to provide a simple scan result without the extra `?_escaped_fragment_=` component.
   * Wait several minutes more. Google appears to request the page, which will show up in your logs as `Spiderable successfully succeeded`.
   * Search on Google using `site:your.site.com`
   * Make sure Google lists all relevant pages.
   * Look at Google's cached version of the pages, to make sure it is fully rendered.
   * Make sure that Google sees the pages with all data subscriptions complete.

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

