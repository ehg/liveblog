// Currently requires liveblog plugin to be activated, and enabled on post

require('coffee-script');

var wd = require('wd'),
  Wd40 = require(__dirname + '/../wd40').wd40,
  should = require('chai').should();


var BASE_URL = process.env.BASE_URL || 'http://localhost:8080/wordpress/',
    WP_USER = process.env.WP_USER || 'admin',
    WP_PASS = process.env.WP_PASS || 'vagrant',
    WP_POST_ID = process.env.WP_POST_ID || '1';

var launchAndLogin = function(done) {
  var wd40 = new Wd40();

  // TODO: use promises to avoid nested callback hell
  // TODO: DRY
  wd40.init(function(err) {
    wd40.browser.get(BASE_URL + '/wp-login.php', function(){
      wd40.fill( '#user_login', WP_USER, function( err ){
        wd40.fill( '#user_pass', WP_PASS, function( err ){
          wd40.click( '#wp-submit', function( err ){
            wd40.browser.get(BASE_URL + '/?p=1', function( err ){
              return done( err, wd40 );
            });
          });
        });
      });
    });
  });
};

var sndWd40, rcvWd40;
describe('Actions between browsers', function() {
  before(function(done) {
    launchAndLogin(function(err, wd40) {
      sndWd40 = wd40;
      done(err);
    });
  });

  before(function(done) {
    launchAndLogin(function(err, wd40) {
      rcvWd40 = wd40;
      done(err);
    });
  });

  context('(sending browser) when I enter some text and press Publish', function() {
    var id, klass, entry,
        random = String(Math.random());

    before( function( done ) {
      sndWd40.fill( 'textarea.liveblog-form-entry', random, function( err ){
        sndWd40.click( '.liveblog-form-entry-submit', function( err ){
          return done( err );
        });
      });
    });

    it('shows a nag view in the receiving browser', function( done ) {
      rcvWd40.browser.waitForVisibleByCssSelector('#liveblog-fixed-nag', 10 * 1000, done);
    });

    context('when I click the nag bar in the receving browser', function( done ) {
      before(function(done) {
        rcvWd40.click('#liveblog-fixed-nag a', done);
      });

      it('shows my comment', function( done ) {
        rcvWd40.elementByCss( '#liveblog-entries', function( err, element ) {
          element.text( function( err, text ) {
            text.should.include(random);
            return done();
          });
        });
      });

    });

  });
});
