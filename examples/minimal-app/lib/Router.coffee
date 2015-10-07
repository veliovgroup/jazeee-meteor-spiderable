Router.onAfterAction ->
  if @ready()
    Meteor.isReadyForSpiderable = true

Router.configure
  notFoundTemplate: '_404'

Router.plugin 'dataNotFound',
  notFoundTemplate: Router.options.notFoundTemplate

if Meteor.isServer
  #Technically, not minimal requirement, but helps debugging
  Spiderable.debug = true
