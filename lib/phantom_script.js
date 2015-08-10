// Unfortunately, since this is processed dynamically, it needs to be JavaScript and not CoffeeScript. https://github.com/ariya/phantomjs/issues/12410
var page = require('webpage').create();
// webpage package is documented at http://phantomjs.org/api/webpage/
var system = require('system');
var url = system.args[1];
var totalIterations = 0;

var renderPage = function(url) {
  var intervalId = false;
  var isReadyForSpiderable = false;
  var status = 200;
  var headers = [];
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
      isReadyForSpiderable = Meteor.isRouteComplete || Meteor.isReadyForSpiderable;
      // We only need one of these flags set in order to proceed. I will deprecate Meteor.isRouteComplete after 2015-12-31
      if( !(isReadyForSpiderable ) ) {
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
      content: output
    }));
  };

  page.onResourceReceived = function(response) {
    if(response.url === url || response.redirectURL === url){
      status  = response.status;
      headers = response.headers;
    }
  };

  page.open(url, function(status) {
    if (status === 'fail'){
      phantom.exit();
    }
    var renderIterations = 0;
    intervalId = setInterval(function() {
      var renderStatus = isReady();
      if(renderIterations < 40 && (!renderStatus || status === null || status == 'null')){
        // Under heavy server load, we may not get an immediate response. We will wait for up to 4 seconds before allowing a response. See #13
        renderIterations++;
        return;
      } else if (renderStatus === true || status != 200) {
        clearInterval(intervalId);
        dumpPageContent();
        phantom.exit();
      } else if(renderStatus.redirectTo){
        clearInterval(intervalId);
        renderPage(renderStatus.redirectTo);
      }
      if(totalIterations > 200){
        // We have waited too long. Don't leave this process running in the background...
        phantom.exit(-1);
      }
      totalIterations++;
    }, 100);
};

renderPage(url);
