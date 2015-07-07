Package.describe({
  name: "jazeee:spiderable-longer-timeout",
  summary: "Makes the application crawlable to web spiders, longer timeout, no stdin issues, and a publish flag.",
  version: "1.1.5",
  git: "https://github.com/jazeee/jazeee-meteor-spiderable"
});

Package.onUse(function (api) {
  api.versionsFrom("METEOR@0.9.0");
  api.use('webapp', 'server');
  api.use(['templating'], 'client');
  api.use(['underscore'], ['client', 'server']);

  api.export('Spiderable');

  api.addFiles('spiderable.html', 'client');
  api.addFiles('spiderable.js', ['client', 'server']);
  api.addFiles('spiderable_server.js', 'server');
  api.addFiles('spiderable_client.js', 'client');

  api.addFiles('phantom_script.js', 'server', { isAsset: true });
});

Package.onTest(function (api) {
  api.use(['spiderable', 'tinytest']);
  api.addFiles('spiderable_tests.js', 'server');
});
