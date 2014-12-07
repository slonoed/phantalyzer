var U = require('./libs/underscore/index'),
    wl = require('./wappalyzer/wappalyzer').wappalyzer,
    apps = require('./wappalyzer/apps');

wl.apps = apps.apps;
wl.categories = apps.categories;
wl.driver = {
    log: function () {

    },
    displayApps: function () {

    },
    goToURL: function () {

    }
};

function PW(url) {
    this.url = url;
    this.pageTimeout = 30 * 1000; // если страница не грузится столько времени -> ошибка
    this.headers = {};
    this.basePageReached = false;
    this.destinationError = false;

    U.bindAll(this,
        'onPageTimeoutEnd',
        'onPageOpen',
        'onPageResourceReceived',
        'onPageError'
    );
}

PW.prototype.getInfo = function (callback) {
    this.callback = callback;11
    this.page = require('webpage').create();

    // настраиваем страницу в фантоме
    this.page.settings.webSecurityEnabled = true;
    this.page.settings.loadImages = false;

    this.pageTimeoutId = setTimeout(this.onPageTimeoutEnd, this.pageTimeout);

    this.page.onError = this.onPageError;
    this.page.onResourceReceived = this.onPageResourceReceived;

    this.page.open(this.url, this.onPageOpen);
};

PW.prototype.onPageOpen = function () {
    // сбрасываем таймаут
    clearTimeout(this.pageTimeoutId);

    this.page.onResourceReceived = this.onPageResourceReceived;

    var pageData = this.getPageData();


    wl.analyze(pageData.hostname, pageData.href, {
        headers: this.headers,
        env: pageData.env,
        html: pageData.html
    });

    this.callback(null, wl.detected[pageData.href]);

    this.page.close();

    phantom.exit();
};

PW.prototype.onPageError = function (msg, trace) {
    //console.log('pageError: ' + msg + ' trace=' + JSON.stringify(trace));
};

PW.prototype.onPageTimeoutEnd = function () {
    this.page.close();
};


PW.prototype.getPageData = function () {
    return this.page.evaluate(function () {
        return {
            html: document.getElementsByTagName('html')[0].innerHTML,
            env: Object.keys(window),
            hostname: location.hostname,
            href: location.href
        };
    }, this.url, this.headers);
};


PW.prototype.onPageResourceReceived = function (resource) {
    // we are trying to find the base page and determine
    // if the status code was successful
    if (!this.basePageReached) {
        var isRedirect = U.indexOf([301, 302, 303, 307, 308], resource.status) >= 0;
        if (!isRedirect) {
            this.basePageReached = true;
            if (resource.status < 200 || resource.status > 226) {
                //console.log("pageError: " + resource.status);
                this.destinationError = true;
            } else {
                for (var i = 0; i < resource.headers.length; i++) {
                    this.headers[resource.headers[i].name] = resource.headers[i].value;
                }
            }
        } else {
            //console.log("page.redirect.code: " + resource.status);
        }
    }
};


(function () {
    var system = require('system');

    var url = system.args[system.args.length - 1];

    var pw = new PW(url);

    pw.getInfo(function (err, data) {
        console.log(JSON.stringify(data, null, 4));
    });
})();
