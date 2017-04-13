Package.describe({
  name: 'nabilfreeman:modern-spiderable',
  summary: 'Extended spiderable package: SSL, caching, longer timeout, no stdin issues, publish flag',
  version: '1.0.0',
  git: 'https://github.com/nabilfreeman/meteor-modern-spiderable'
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
  api.use(['nabilfreeman:modern-spiderable', 'tinytest', 'underscore', 'ecmascript']);
  api.addFiles('tests/spiderable_tests.js', 'server');
});
