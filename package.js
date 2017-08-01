Package.describe({
  name: 'jazeee:spiderable-longer-timeout',
  summary: 'Extended spiderable package: SSL, caching, longer timeout, no stdin issues, publish flag',
  version: '1.3.5',
  git: 'https://github.com/jazeee/jazeee-meteor-spiderable'
});

Package.onUse(function (api) {
  api.versionsFrom('METEOR@1.4');
  api.use(['webapp', 'mongo', 'ostrio:meteor-root@1.0.6'], 'server');
  api.use(['templating'], 'client');
  api.use(['underscore', 'ecmascript'], ['client', 'server']);

  api.mainModule('lib/server.js', 'server');
  api.mainModule('lib/client.js', 'client');
  api.addFiles('lib/spiderable.html', 'client');
  api.addAssets('lib/phantom_script.js', 'server');

  api.export('Spiderable');
});

Package.onTest(function (api) {
  api.use(['jazeee:spiderable-longer-timeout', 'tinytest', 'underscore', 'ecmascript', 'http']);
  api.addFiles('tests/spiderable_tests.js', 'server');
});
