// Currently requires liveblog plugin to be activated, and enabled on post

require('coffee-script');

var wd = require('wd'),
  Wd40 = require(__dirname + '/../wd40').wd40,
  should = require('chai').should();


var BASE_URL = process.env.BASE_URL || 'http://local.wordpress.dev',
    WP_USER = process.env.WP_USER || 'admin',
    WP_PASS = process.env.WP_PASS || 'password',
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
  var id, klass, entry,
      random = String(Math.random());

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

    before( function( done ) {
      sndWd40.fill( 'textarea.liveblog-form-entry', random, function( err ){
        sndWd40.click( '.liveblog-form-entry-submit', function( err ){
          return done( err );
        });
      });
    });

    before(function(done) {
      rcvWd40.browser.safeEval('jQuery(window).scrollTop(jQuery(document).height());', done);
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

  //TODO: DRY
  before(function( done ) {
    setTimeout( function() {
      sndWd40.browser.elementsByCssSelector( '.liveblog-entry', function( err, elements ) {
        entry = elements[0];
        elements[0].getAttribute('id', function( err, _id ) {
          id = _id;
          elements[0].getAttribute('class', function( err, _klass ) {
            klass = _klass;
            done(err);
          });
        });
      });
    }, 2000); // need to wait as it doesn't appear immediately
  });

  context('when I edit the entry in the sending browser', function() {
    before(function(done) {
      sndWd40.click('#' + id + ' .liveblog-entry-edit', function(err) {
        sndWd40.fill('#' + id + ' textarea', random + 'bar', function(err) {
          sndWd40.click('#' + id + ' .liveblog-form-entry-submit', function(err) {
            done(err);
          });
        });
      });
    });

    before(function(done) {
      setTimeout(done, 3000);
    });

    it('shows the updated text', function(done) {
      rcvWd40.elementByCss('#liveblog-entries', function(err, element) {
        element.text( function(err, text){
          text.should.include(random + 'bar');
          done(err);
        });
      });
    });
  });

  context('when I delete the entry in the sending browser', function() {
    before(function( done ) {
      sndWd40.browser.elementsByCssSelector( '.liveblog-entry', function( err, elements ) {
        elements[0].getAttribute('id', function( err, _id ) {
          id = _id;
          done(err);
        });
      });
    });

    before(function( done ) {
      sndWd40.click('#' + id + ' .liveblog-entry-delete', done);
    });

    before(function( done ) {
      sndWd40.browser.acceptAlert(done);
    });

    it('gets removed from the page', function(done) {
      sndWd40.waitForInvisibleByCss('#' + id, done);
    });

  });
});
