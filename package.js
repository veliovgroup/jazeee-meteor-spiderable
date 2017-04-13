Package.describe({
  name: 'jazeee:spiderable-longer-timeout',
  summary: 'Extended spiderable package: SSL, caching, longer timeout, no stdin issues, publish flag',
  version: '1.3.1',
  git: 'https://github.com/jazeee/jazeee-meteor-spiderable'
});

Package.onUse(function (api) {
  api.versionsFrom('METEOR@1.4');
  api.use(['webapp', 'mongo', 'ostrio:meteor-root@1.0.5'], 'server');
  api.use(['templating'], 'client');
  api.use(['underscore', 'ecmascript'], ['client', 'server']);

  api.mainModule('lib/spiderable.js', ['client', 'server']);
  api.addFiles(['lib/spiderable.html', 'lib/client.js'], 'client');
  api.addFiles('lib/server.js', 'server');
  api.addAssets('lib/phantom_script.js', 'server');

  api.export('Spiderable');
});

Package.onTest(function (api) {
  api.use(['jazeee:spiderable-longer-timeout', 'tinytest', 'underscore', 'ecmascript']);
  api.addFiles('tests/spiderable_tests.js', 'server');
});
