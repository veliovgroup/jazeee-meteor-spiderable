Session.setDefault '___isPhantomjs___', false if Meteor.isClient

Router.onAfterAction ->
  Meteor.isReadyForSpiderable = true if @ready()

Router.configure
  notFoundTemplate: '_404'

Router.plugin 'dataNotFound', 
  notFoundTemplate: Router.options.notFoundTemplate

if Meteor.isClient
  Router.onBeforeAction -> 
    if _.has @params.query, '___isRunningPhantomJS___'
      Session.set '___isPhantomjs___', true
    else
      Session.set '___isPhantomjs___', false
    @next()

if Meteor.isServer
  Spiderable.debug = true
  Spiderable.customQuery = true