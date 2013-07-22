// Karma configuration
// Generated on Mon Jul 22 2013 14:31:02 GMT+0100 (BST)

module.exports = function(config) {
  config.set({

    // base path, that will be used to resolve files and exclude
    basePath: '',


    // frameworks to use
    frameworks: ['mocha'],


    // list of files / patterns to load in the browser
    files: [
     {pattern: 'lib/*.js', included: false},
     {pattern: 'bundle/lib.js', included: true},
     {pattern: 'fixtures.html', included: true},
     {pattern: 'fixtures.js', included: true},
     {pattern: '../js/*.js', included: false},
     {pattern: 'bundle/app.js', included: true},
     { pattern: 'node_modules/chai/chai.js', watched: false, included: true },
     { pattern: 'node_modules/sinon/pkg/sinon.js', watched: false, included: true },
     {pattern: 'unit/*.js', included: true}
    ],


    // list of files to exclude
    exclude: [

    ],


    // test results reporter to use
    // possible values: 'dots', 'progress', 'junit', 'growl', 'coverage'
    reporters: ['progress'],


    // web server port
    port: 9876,


    // cli runner port
    runnerPort: 9100,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // Start these browsers, currently available:
    // - Chrome
    // - ChromeCanary
    // - Firefox
    // - Opera
    // - Safari (only Mac)
    // - PhantomJS
    // - IE (only Windows)
    browsers: ['Chrome'],


    // If browser does not capture in given timeout [ms], kill it
    captureTimeout: 60000,


    // Continuous Integration mode
    // if true, it capture browsers, run tests and exit
    singleRun: false
  });
};
