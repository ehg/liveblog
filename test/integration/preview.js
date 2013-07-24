// Currently requires liveblog plugin to be activated, and enabled on post

require('coffee-script');

var wd = require('wd'),
  Wd40 = require(__dirname + '/../wd40').wd40,
  should = require('chai').should();

var wd40 = new Wd40();

var BASE_URL = process.env.BASE_URL || 'http://localhost:8080/wordpress/',
    WP_USER = process.env.WP_USER || 'admin',
    WP_PASS = process.env.WP_PASS || 'vagrant',
    WP_POST_ID = process.env.WP_POST_ID || '1';

describe('Previewing an entry', function() {
  // TODO: DRY
  context("When I'm logged in as an admin", function() {
    before( function( done ) {
      wd40.init( function(err) {
        wd40.browser.get(BASE_URL + '/wp-login.php', function(){
          return done( err );
        });
      });
    });

    before( function( done ) {
      wd40.fill( '#user_login', WP_USER, function( err ){
        wd40.fill( '#user_pass', WP_PASS, function( err ){
          wd40.click( '#wp-submit', function( err ){
            done( err );
          });
        });
      });
    });

    context('when I enter some text and press Preview', function() {
      var id, klass, entry,
          random = String(Math.random()),
          html = '<b class="bold">' + random + '</b>';

      before( function( done ) {
        wd40.browser.get(BASE_URL + '/?p=1', function( err ){
          return done( err );
        });
      });

      before( function( done ) {
        wd40.fill( 'textarea.liveblog-form-entry', html, function( err ){
          wd40.click( '.preview a', function( err ){
            return done( err );
          });
        });
      });

      it('shows my comment', function( done ) {
        wd40.elementByCss('.liveblog-preview .bold', function(err, element) {
          element.text( function(err, text) {
            text.should.include(random);
            done(err);
          });
        });
      });
    });

  });
});
