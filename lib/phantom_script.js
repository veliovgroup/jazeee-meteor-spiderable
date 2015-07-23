// Unfortunately, since this is processed dynamically, it needs to be JavaScript and not CoffeeScript. https://github.com/ariya/phantomjs/issues/12410
var page = require('webpage').create();
// webpage package is documented at http://phantomjs.org/api/webpage/
var system = require('system');
var url = system.args[1];

var isReady = function () {
  return page.evaluate(function () {
    if (typeof Meteor === 'undefined'
        || Meteor.status === undefined
        || !Meteor.status().connected) {
      return false;
    }
    if (Meteor.errorResponseCode !== undefined) {
        throw Meteor.errorResponseCode;
    }
    if (typeof Package === 'undefined'
        || Package["jazeee:spiderable-longer-timeout"] === undefined
        || Package["jazeee:spiderable-longer-timeout"].Spiderable === undefined
        || !Package["jazeee:spiderable-longer-timeout"].Spiderable._initialSubscriptionsStarted ) {
      return false;
    }
    if( !(Meteor.isRouteComplete || Meteor.isReadyForSpiderable ) ) {
        // We only need one of these flags set in order to proceed. I may deprecate Meteor.isRouteComplete after 2015-12-31
        return false;
    }
    if (typeof Tracker === 'undefined' || typeof DDP === 'undefined'){
        return false;
    }
    Tracker.flush();
    return DDP._allSubscriptionsReady();
  });
};

var dumpPageContent = function () {
  var out = page.content;
  out = out.replace(/<script[^>]+>(.|\n|\r)*?<\/script\s*>/ig, '');
  out = out.replace('<meta name="fragment" content="!">', '');
  console.log(out);
};

page.open(url, function(status) {
  if (status === 'fail'){
    phantom.exit();
  }
});

setInterval(function() {
  if (isReady()) {
    dumpPageContent();
    phantom.exit();
  }
}, 100);

page.onError = function(error, trace) {
  console.log(error);
  // exit codes must be between -128 and 127 (short int)
  phantom.exit(40);
};