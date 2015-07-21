Package.describe({
  name: "jazeee:spiderable-longer-timeout",
  summary: "Extended spiderable package with caching, longer timeout, no stdin issues, and a publish flag.",
  version: "1.2.0",
  git: "https://github.com/jazeee/jazeee-meteor-spiderable"
});

Package.onUse(function (api) {
  api.versionsFrom("METEOR@0.9.0");
  api.use(['webapp', 'mongo', 'ostrio:meteor-root@1.0.0', 'sha'], 'server');
  api.use(['templating'], 'client');
  api.use(['underscore'], ['client', 'server']);


  api.addFiles('spiderable.js', ['client', 'server']);
  api.addFiles(['spiderable.html', 'spiderable_client.js'], 'client');
  api.addFiles('spiderable_server.js', 'server');
  api.addFiles('phantom_script.js', 'server', { isAsset: true });

  api.export('Spiderable');
});

Package.onTest(function (api) {
  api.use(['spiderable', 'tinytest']);
  api.addFiles('spiderable_tests.js', 'server');
});
