var child_process = Npm.require('child_process');
var querystring = Npm.require('querystring');
var urlParser = Npm.require('url');
var crypto = Npm.require('crypto');
var cacheCollection = new Mongo.Collection('SpiderableCacheCollection');

Meteor.startup(function(){
  if(!Spiderable.cacheTTL || !_.isNumber(Spiderable.cacheTTL)){
    Spiderable.cacheTTL = 60 * 60 * 3; // 3 hours by default
  }

  cacheCollection._ensureIndex({
    createdAt: 1
  },{ 
    expireAfterSeconds: Spiderable.cacheTTL
  });
});

cacheCollection._ensureIndex({
  hash: 1,
  unique: true
});


var bindEnvironment = Meteor.bindEnvironment(function(callback) { return callback(); });

// list of bot user agents that we want to serve statically, but do
// not obey the _escaped_fragment_ protocol. The page is served
// statically to any client whos user agent matches any of these
// regexps. Users may modify this array.
//
// An original goal with the spiderable package was to avoid doing
// user-agent based tests. But the reality is not enough bots support
// the _escaped_fragment_ protocol, so we need to hardcode a list
// here. I shed a silent tear.
Spiderable.userAgentRegExps = [
    /^facebookExternalHit/i,
    /^linkedinBot/i,
    /^twitterBot/i,
    /^googleBot/i,
    /^bingBot/i,
    /^yandex/i,
    /^google-structured-data-testing-tool/i,
    /^yahoo/i,
    /^MJ12Bot/i,
    /^tweetmemeBot/i,
    /^baiduSpider/i,
    /^Mail\.RU_Bot/i,
    /^ahrefsBot/i,
    /^SiteLockSpider/i
  ];

// list of routes that we want to serve statically, but do
// not obey the _escaped_fragment_ protocol.
Spiderable.ignoredRoutes = [];

// show debug messages in server's console
Spiderable.debug = true;

// how long to let phantomjs run before we kill it
var REQUEST_TIMEOUT = 30 * 1000;
// maximum size of result HTML. node's default is 200k which is too
// small for our docs.
var MAX_BUFFER = 10 * 1024 * 1024; // 10MB

// Exported for tests.
Spiderable._urlForPhantom = function (siteAbsoluteUrl, requestUrl) {
  // reassembling url without escaped fragment if exists
  var parsedUrl = urlParser.parse(requestUrl);
  var parsedQuery = querystring.parse(parsedUrl.query);
  var escapedFragment = parsedQuery._escaped_fragment_;
  delete parsedQuery._escaped_fragment_;

  if(Spiderable.query){
    if(_.isString(Spiderable.query)){
      parsedQuery[Spiderable.query] = 'true';
    }else if(_.isBoolean(Spiderable.query) && Spiderable.query === true){
      parsedQuery.___isPhantomjs___ = 'true';
    }
  }

  var parsedAbsoluteUrl = urlParser.parse(siteAbsoluteUrl);
  // If the ROOT_URL contains a path, Meteor strips that path off of the
  // request's URL before we see it. So we concatenate the pathname from
  // the request's URL with the root URL's pathname to get the full
  // pathname.
  if (parsedUrl.pathname.charAt(0) === "/") {
    parsedUrl.pathname = parsedUrl.pathname.substring(1);
  }
  parsedAbsoluteUrl.pathname = urlParser.resolve(parsedAbsoluteUrl.pathname, parsedUrl.pathname);
  parsedAbsoluteUrl.query = parsedQuery;
  // `url.format` will only use `query` if `search` is absent
  parsedAbsoluteUrl.search = null;

  if (escapedFragment !== undefined && escapedFragment !== null && escapedFragment.length > 0) {
    parsedAbsoluteUrl.hash = '!' + decodeURIComponent(escapedFragment);
  }

  return urlParser.format(parsedAbsoluteUrl);
};

var PHANTOM_SCRIPT = Meteor.rootPath + "/assets/packages/jazeee_spiderable-longer-timeout/phantom_script.js";

WebApp.connectHandlers.use(function (req, res, next) {
  // _escaped_fragment_ comes from Google's AJAX crawling spec:
  // https://developers.google.com/webmasters/ajax-crawling/docs/specification
  if ((/\?.*_escaped_fragment_=/.test(req.url) || 
      _.any(Spiderable.userAgentRegExps, function (re) {
        return re.test(req.headers['user-agent']); })) &&
      !_.any(Spiderable.ignoredRoutes, function (route) {
        return (req.url.indexOf(route)>-1);
      })
  ){

    Spiderable.originalRequest = req;

    var url = Spiderable._urlForPhantom(Meteor.absoluteUrl(), req.url);
    var hash = SHA256(url);

    var cached = cacheCollection.findOne({hash: hash});
    if(cached){
      res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
      res.end(cached.content);
    }else{
      // Allow override of phantomjs args via env var
      // We use one env var to try to keep env-var explosion under control.
      // We're not going to document this unless it is actually needed;
      // (if you find yourself needing this please let us know the use case!)
      var phantomJsArgs = process.env.METEOR_PKG_SPIDERABLE_PHANTOMJS_ARGS || '';

      // Default image loading to off (we don't need images)
      if (phantomJsArgs.indexOf("--load-images=") === -1) {
        phantomJsArgs += " --load-images=no";
      }

      // POODLE means SSLv3 is being turned off everywhere.
      // phantomjs currently defaults to SSLv3, and won't use TLS.
      // Use --ssl-protocol to set the default to TLSv1
      // (another option would be 'any', but really, we want to say >= TLSv1)
      // More info: https://groups.google.com/forum/#!topic/meteor-core/uZhT3AHwpsI
      if (phantomJsArgs.indexOf("--ssl-protocol=") === -1) {
        phantomJsArgs += " --ssl-protocol=TLSv1";
      }
      // Run phantomjs.
      child_process.exec(
        "phantomjs " + phantomJsArgs + " " + PHANTOM_SCRIPT + " " + JSON.stringify(url),
        {timeout: REQUEST_TIMEOUT, maxBuffer: MAX_BUFFER},
        function (error, stdout, stderr) {
          bindEnvironment(function(){
            if (!error && /<html/i.test(stdout)) {
              res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
              if(Spiderable.debug) {
                console.info("Spiderable successfully completed for url: ", url);
              }
              cacheCollection.upsert({hash: hash}, {'$set':{
                hash: hash,
                url: url,
                content: stdout,
                createdAt: new Date()
              }});
              res.end(stdout);
            } else {
              // If phantomjs is failed. Don't send the error, 
              // instead send the normal page.
              if(Spiderable.debug) {
                console.warn("Spiderable failed for url: ", url);
              }
              if (error && error.code === 127) {
                console.warn("spiderable: phantomjs not installed. Download and install from http://phantomjs.org/");
              } else {
                console.warn("spiderable: phantomjs failed:", error, "\nstderr:", stderr);
              }
              next();
            }
          });
        }
      );
    }
  } else {
    next();
  }
});
