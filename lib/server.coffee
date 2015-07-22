child_process = Npm.require('child_process')
querystring = Npm.require('querystring')
urlParser = Npm.require('url')
crypto = Npm.require('crypto')

cacheCollection = new (Mongo.Collection)('SpiderableCacheCollection')

Meteor.startup ->
	Spiderable.cacheLifetimeInMinutes ?= 3 * 60 # 3 hours by default
	throw new Meteor.Error("Bad Spiderable.cacheLifetimeInMinutes") unless _.isNumber(Spiderable.cacheLifetimeInMinutes)
	
	cacheCollection._ensureIndex({ createdAt: 1 }, {expireAfterSeconds: Spiderable.cacheLifetimeInMinutes * 60})
	return

cacheCollection._ensureIndex
	hash: 1
	unique: true

bindEnvironment = Meteor.bindEnvironment((callback) ->
	callback()
)

# list of bot user agents that we want to serve statically, but do
# not obey the _escaped_fragment_ protocol. The page is served
# statically to any client whos user agent matches any of these
# regexps. Users may modify this array.
#
# An original goal with the spiderable package was to avoid doing
# user-agent based tests. But the reality is not enough bots support
# the _escaped_fragment_ protocol, so we need to hardcode a list
# here. I shed a silent tear.
Spiderable.userAgentRegExps = [
	/^facebookExternalHit/i
	/^linkedinBot/i
	/^twitterBot/i
	/^googleBot/i
	/^bingBot/i
	/^yandex/i
	/^google-structured-data-testing-tool/i
	/^yahoo/i
	/^MJ12Bot/i
	/^tweetmemeBot/i
	/^baiduSpider/i
	/^Mail\.RU_Bot/i
	/^ahrefsBot/i
	/^SiteLockSpider/i
]

# list of routes that we want to serve statically, but do not obey the _escaped_fragment_ protocol.
Spiderable.ignoredRoutes = []

# show debug messages in server's console
Spiderable.debug = true

# how long to let phantomjs run before we kill it
REQUEST_TIMEOUT_IN_MILLISECONDS = 30 * 1000 # 30 seconds

# maximum size of result HTML. node's default is 200k which is too small for our docs.
MAX_BUFFER = 10 * 1024 * 1024 # 10MB

Spiderable._urlForPhantom = (siteAbsoluteUrl, requestUrl) ->
	# reassemble url without escaped fragment if exists
	parsedUrl = urlParser.parse(requestUrl)
	parsedQuery = querystring.parse(parsedUrl.query)
	escapedFragment = parsedQuery._escaped_fragment_
	delete parsedQuery._escaped_fragment_
	
	if Spiderable.customQuery
		if _.isString(Spiderable.customQuery)
			parsedQuery[Spiderable.customQuery] = 'true'
		else if _.isBoolean(Spiderable.customQuery) && Spiderable.customQuery
			parsedQuery.___isRunningPhantomJS___ = 'true'
	
	parsedAbsoluteUrl = urlParser.parse(siteAbsoluteUrl)
	# If the ROOT_URL contains a path, Meteor strips that path off of the request's URL before we see it. So we concatenate the pathname from
	# the request's URL with the root URL's pathname to get the full pathname.
	if parsedUrl.pathname.charAt(0) == '/'
		parsedUrl.pathname = parsedUrl.pathname.substring(1)
	parsedAbsoluteUrl.pathname = urlParser.resolve(parsedAbsoluteUrl.pathname, parsedUrl.pathname)
	parsedAbsoluteUrl.query = parsedQuery
	
	# `url.format` will only use `query` if `search` is absent
	parsedAbsoluteUrl.search = null
	if escapedFragment? && escapedFragment.length > 0
		parsedAbsoluteUrl.hash = '!' + decodeURIComponent(escapedFragment)
	urlParser.format parsedAbsoluteUrl

PHANTOM_SCRIPT = Meteor.rootPath + '/assets/packages/jazeee_spiderable-longer-timeout/lib/phantom_script.js'

WebApp.connectHandlers.use (req, res, next) ->
	# _escaped_fragment_ comes from Google's AJAX crawling spec:
	# https://developers.google.com/webmasters/ajax-crawling/docs/specification
	if _.any(Spiderable.ignoredRoutes, ((route) ->req.url.indexOf(route) > -1))
		next()
	else if (/\?.*_escaped_fragment_=/.test(req.url) or _.any(Spiderable.userAgentRegExps, ((regEx) ->
			regEx.test req.headers['user-agent']
		)))
		Spiderable.originalRequest = req
		url = Spiderable._urlForPhantom(Meteor.absoluteUrl(), req.url)
		hash = SHA256(url)
		cached = cacheCollection.findOne({hash})
		if cached
			res.writeHead 200, 'Content-Type': 'text/html; charset=UTF-8'
			res.end cached.content
		else
			# Allow override of phantomjs args via environment variable
			# We use one environment variable to try to keep env-var explosion under control.
			# We're not going to document this unless it is actually needed;
			# (if you find yourself needing this please let us know the use case!)
			phantomJsArgs = process.env.METEOR_PKG_SPIDERABLE_PHANTOMJS_ARGS
			phantomJsArgs ?= ''
			# Default image loading to off (we don't need images)
			if phantomJsArgs.indexOf('--load-images=') == -1
				phantomJsArgs += ' --load-images=no'
			# POODLE means SSLv3 is being turned off everywhere.
			# phantomjs currently defaults to SSLv3, and won't use TLS.
			# Use --ssl-protocol to set the default to TLSv1
			# (another option would be 'any', but really, we want to say >= TLSv1)
			# More info: https://groups.google.com/forum/#!topic/meteor-core/uZhT3AHwpsI
			if phantomJsArgs.indexOf('--ssl-protocol=') == -1
				phantomJsArgs += ' --ssl-protocol=TLSv1'
			# Run phantomjs.
			child_process.exec 'phantomjs ' + phantomJsArgs + ' ' + PHANTOM_SCRIPT + ' ' + JSON.stringify(url), {
				timeout: REQUEST_TIMEOUT_IN_MILLISECONDS
				maxBuffer: MAX_BUFFER
			}, (error, stdout, stderr) ->
				bindEnvironment( ->
					if !error and /<html/i.test(stdout)
						res.writeHead 200, 'Content-Type': 'text/html; charset=UTF-8'
						if Spiderable.debug
							console.info 'Spiderable successfully completed for url: ', url
						cacheCollection.upsert { hash: hash },
							'$set':
								hash: hash
								url: url
								content: stdout
								createdAt: new Date
						res.end stdout
					else
						# If phantomjs is failed. Don't send the error, instead send the normal page.
						if Spiderable.debug
							console.warn 'Spiderable failed for url: ', url
						if error and error.code == 127
							console.warn 'spiderable: phantomjs not installed. Download and install from http://phantomjs.org/'
						else
							console.warn 'spiderable: phantomjs failed:', error, '\nstderr:', stderr
						next()
					return
				)
				return
	else
		next()
	return
