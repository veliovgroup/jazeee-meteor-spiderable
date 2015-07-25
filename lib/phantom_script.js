// Unfortunately, since this is processed dynamically, it needs to be JavaScript and not CoffeeScript. https://github.com/ariya/phantomjs/issues/12410
var page = require('webpage').create();
var system = require('system');
var url = system.args[1];
var status = 200;
var headers = [];

var renderPage = function(url) {
  var intervalId = false;
  var isReady = function () {
    return page.evaluate(function () {
      if (typeof Meteor === 'undefined'
          || Meteor.status === undefined
          || !Meteor.status().connected) {
        return false;
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
      if(!DDP._allSubscriptionsReady()){
        return false;
      }else if(Spiderable.redirect){
        return {redirectTo: Spiderable.redirect};
      }else{
        return true;
      }
    });
  };

  var dumpPageContent = function () {
    var output = page.content;
    output     = output.replace(/<script[^>]+>(.|\n|\r)*?<\/script\s*>/ig, '');
    output     = output.replace('<meta name="fragment" content="!">', '');
    console.log(JSON.stringify({
      status: status, 
      headers: headers,
      html: output
    }));
  };

  page.onResourceReceived = function(response) {
    if(response.url === url || response.redirectURL === url){
      status  = response.status;
      headers = response.headers;
    }
    if(response.status != 200){
      status  = response.status;
    }
  };

  page.open(url, function(status) {
    if (status === 'fail'){
      phantom.exit();
    }
  });

  intervalId = setInterval(function() {
    var renderStatus = isReady();
    if (renderStatus === true || status != 200) {
      dumpPageContent();
      phantom.exit();
    }else if(renderStatus.redirectTo){
      clearInterval(intervalId);
      renderPage(renderStatus.redirectTo);
    }
  }, 100);
};

renderPage(url);