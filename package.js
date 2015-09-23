Package.describe({
  name: "4scotty:spiderable-longer-timeout",
  summary: "Extended spiderable package: SSL, caching, longer timeout, no stdin issues, publish flag",
  version: "1.2.8",
  git: "https://github.com/4scotty/4scotty-meteor-spiderable"
});

Package.onUse(function (api) {
  api.versionsFrom("METEOR@0.9.0");
  api.use(['webapp', 'mongo', 'ostrio:meteor-root', 'sha', 'cmather:handlebars-server'], 'server');
  api.use(['templating'], 'client');
  api.use(['underscore', 'coffeescript'], ['client', 'server']);

  api.addFiles('lib/spiderable.coffee', ['client', 'server']);
  api.addFiles(['lib/spiderable.html', 'lib/client.coffee'], 'client');
  api.addFiles('lib/server.coffee', 'server');
  api.addAssets('lib/phantom_script.js', 'server');

  api.export('Spiderable');
});