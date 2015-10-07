child_process = Npm.require 'child_process'
querystring = Npm.require 'querystring'
urlParser = Npm.require 'url'
crypto = Npm.require 'crypto'

cacheCollection = new Mongo.Collection 'SpiderableCacheCollection'

Meteor.startup ->
	Spiderable.cacheLifetimeInMinutes ?= 3 * 60 # 3 hours by default
	throw new Meteor.Error "Bad Spiderable.cacheLifetimeInMinutes" unless _.isNumber(Spiderable.cacheLifetimeInMinutes)
	cacheCollection._ensureIndex {createdAt: 1}, {expireAfterSeconds: Spiderable.cacheLifetimeInMinutes * 60, background: true}

cacheCollection._ensureIndex {hash: 1}, {unique: true, background: true}

bindEnvironment = Meteor.bindEnvironment (callback) -> callback()

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

# allow/deny JavaScript redirects
Spiderable.allowRedirects = true

# list of routes that we want to serve statically, but do not obey the _escaped_fragment_ protocol.
Spiderable.ignoredRoutes = []

# show debug messages in server's console
Spiderable.debug = false

# how long to let phantomjs run before we kill it
REQUEST_TIMEOUT_IN_MILLISECONDS = 30 * 1000 # 30 seconds

# maximum size of result HTML. node's default is 200k which is too small for our docs.
MAX_BUFFER = 10 * 1024 * 1024 # 10MB

Spiderable._urlForPhantom = (siteAbsoluteUrl, requestUrl) ->
	# reassemble url without escaped fragment if exists
	parsedUrl = urlParser.parse requestUrl
	parsedQuery = querystring.parse(parsedUrl.query)
	escapedFragment = parsedQuery._escaped_fragment_
	delete parsedQuery._escaped_fragment_
	
	if Spiderable.customQuery
		if _.isString Spiderable.customQuery
			parsedQuery[Spiderable.customQuery] = 'true'
		else if _.isBoolean(Spiderable.customQuery) && Spiderable.customQuery
			parsedQuery.___isRunningPhantomJS___ = 'true'
	
	parsedAbsoluteUrl = urlParser.parse siteAbsoluteUrl
	# If the ROOT_URL contains a path, Meteor strips that path off of the request's URL before we see it. So we concatenate the pathname from
	# the request's URL with the root URL's pathname to get the full pathname.
	if parsedUrl.pathname.charAt(0) == '/'
		parsedUrl.pathname = parsedUrl.pathname.substring 1
	parsedAbsoluteUrl.pathname = urlParser.resolve parsedAbsoluteUrl.pathname, parsedUrl.pathname
	parsedAbsoluteUrl.query = parsedQuery
	
	# `url.format` will only use `query` if `search` is absent
	parsedAbsoluteUrl.search = null
	if escapedFragment? && escapedFragment.length > 0
		parsedAbsoluteUrl.hash = '!' + decodeURIComponent escapedFragment
	urlParser.format parsedAbsoluteUrl

PHANTOM_SCRIPT =  "#{Meteor.rootPath}/assets/packages/jazeee_spiderable-longer-timeout/lib/phantom_script.js"

responseHandler = (res, result) ->
	result = {} if _.isEmpty result
	result.status = 404 if result.status is null or result.status is 'null'
	result.status = if isNaN result.status then 200 else parseInt result.status

	if result.headers?.length > 0
		for header in result.headers
			res.setHeader header.name, header.value
	else
		res.setHeader 'Content-Type', 'text/html'
	res.writeHead result.status
	res.end result.content

WebApp.connectHandlers.use (req, res, next) ->
	# _escaped_fragment_ comes from Google's AJAX crawling spec:
	# https://developers.google.com/webmasters/ajax-crawling/docs/specification
	if (/\?.*_escaped_fragment_=/.test(req.url) or _.any(Spiderable.userAgentRegExps, (re) ->
			re.test req.headers['user-agent']
		)) and !_.any(Spiderable.ignoredRoutes, (route) ->
			req.url.indexOf(route) > -1
		)

		Spiderable.originalRequest = req
		url 		= Spiderable._urlForPhantom Meteor.absoluteUrl(), req.url
		hash 		= new Buffer(url).toString 'base64'
		cached 	= cacheCollection.findOne {hash}

		if cached
			responseHandler res, cached
			console.info "Spiderable successfully completed [from cache] for url: [#{cached.status}] #{url}" if Spiderable.debug
			return
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
			# Support all kind of SSLs
			if phantomJsArgs.indexOf('--ignore-ssl-errors=') == -1
				phantomJsArgs += ' --ignore-ssl-errors=true'
			# to allow redirects on some systems we need set --web-security to false
			if Spiderable.allowRedirects and phantomJsArgs.indexOf('--web-security=false') == -1
				phantomJsArgs += ' --web-security=false'
			# Run phantomjs.
			fullCommand = "phantomjs #{phantomJsArgs} #{PHANTOM_SCRIPT} #{JSON.stringify(url)}"
			child_process.exec fullCommand
			,
				timeout: REQUEST_TIMEOUT_IN_MILLISECONDS
				maxBuffer: MAX_BUFFER
			, 
				(error, stdout, stderr) ->
					bindEnvironment ->
						if !error
							# Extract JSON stringified phantomJS response after removing other potential Phantom logging messages. This regex extracts just the JSON.
							try
								output = JSON.parse stdout.replace /^(?!(\{.*\})$)(.*)|\r\n/gim, ''
								responseHandler res, output
								console.info "Spiderable successfully completed for url: [#{output.status}] #{url}" if Spiderable.debug
								cacheCollection.upsert { hash },
									'$set':
										hash: hash
										url: url
										headers: output.headers
										content: output.content
										status: output.status
										createdAt: new Date
								return
							catch error
								console.error error, "Probably failed to parse PhantomJS output from: ", stdout
						# If phantomjs failed. Don't send the error, instead send the normal page.
						if Spiderable.debug
							console.error 'Spiderable failed for url: ', url, error, stdout, stderr
						if error?.code == 127
							console.warn 'spiderable: phantomjs not installed. Download and install from http://phantomjs.org/'
						else
							console.error 'spiderable: phantomjs failed:', error, '\nstderr:', stderr
						next()
	else
		next()
