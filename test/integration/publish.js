// Currently requires liveblog plugin to be activated, and enabled on post

require('coffee-script');

var wd = require('wd'),
  helper = require(__dirname + '/../wd40'),
  should = require('chai').should();

var browser = helper.browser,
  wd40 = helper.wd40;
// TODO: allow specification of base URL, credentials and post id
describe('Publishing a liveblog update', function() {
  context("When I'm logged in as an admin", function() {
    before( function( done ) {
      wd40.init( function(err) {
        browser.get('http://localhost:8080/wordpress/wp-login.php', function(){
          return done( err );
        });
      });
    });

    before( function( done ) {
      wd40.fill( '#user_login', 'admin', function( err ){
        wd40.fill( '#user_pass', 'vagrant', function( err ){
          wd40.click( '#wp-submit', function( err ){
            done( err );
          });
        });
      });
    });

    context('when I enter some text and press Publish', function() {
      var random = String(Math.random());

      before( function( done ) {
        browser.get('http://localhost:8080/wordpress/?p=1', function( err ){
          return done( err );
        });
      });

      before( function( done ) {
        wd40.fill( 'textarea.liveblog-form-entry', random, function( err ){
          wd40.click( '.liveblog-form-entry-submit', function( err ){
            return done( err );
          });
        });
      });

      it('shows my comment', function( done ) {
        wd40.elementByCss( '#liveblog-entries', function( err, element ) {
          setTimeout( function() {
            element.text( function( err, text ) {
              text.should.include(random);
              return done();
            });
          }, 2000); // TODO: should poll rather than wait arbitrary time
        });
      });

      it('highlights my comment');
      it('shows the time in a human readable form');
      it('shows my name and avatar');
    });

  });
});
