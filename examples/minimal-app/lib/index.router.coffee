Meteor.startup ->
  Router.route 'index',
    template: 'index'
    path: '/'

  Router.route '_500',
    template: '_500'
    path: '/_500'