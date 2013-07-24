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

describe('Publishing a liveblog update', function() {
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

    context('when I enter some text and press Publish', function() {
      var id, klass, entry,
          random = String(Math.random());

      before( function( done ) {
        wd40.browser.get(BASE_URL + '/?p=1', function( err ){
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

      before(function( done ) {
        setTimeout( function() {
          wd40.browser.elementsByCssSelector( '.liveblog-entry', function( err, elements ) {
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

      it('highlights my comment', function() {
        klass.should.include('highlight');
      });

      it('shows the time in a human readable form', function(done) {
        entry.text( function( err, text ) {
          text.should.include('FEW SECONDS');
          done(err);
        });
      });

      it('shows my name', function(done) {
        entry.text( function( err, text ) {
          text.should.include('admin');
          done(err);
        });
      });

      context('when I edit the entry', function() {
        before(function(done) {
          wd40.click('#' + id + ' .liveblog-entry-edit', function(err) {
            wd40.fill('#' + id + ' textarea', random + 'bar', function(err) {
              wd40.click('#' + id + ' .liveblog-form-entry-submit', function(err) {
                done(err);
              });
            });
          });
        });

        // Wait for it to update
        before(function(done) {
          setTimeout(done, 1000);
        });

        it('shows the updated text', function(done) {
          wd40.elementByCss('#liveblog-entries', function(err, element) {
            element.text( function(err, text){
              text.should.include(random + 'bar');
              done(err);
            });
          });
        });
      });
    }); // end publish context

    context('when I delete an entry', function() {
      before(function( done ) {
        wd40.browser.elementsByCssSelector( '.liveblog-entry', function( err, elements ) {
          elements[0].getAttribute('id', function( err, _id ) {
            id = _id;
            done(err);
          });
        });
      });

      before(function( done ) {
        wd40.click('#' + id + ' .liveblog-entry-delete', done);
      });

      before(function( done ) {
        wd40.browser.acceptAlert(done);
      });

      it('gets removed from the page', function(done) {
        wd40.waitForInvisibleByCss('#' + id, done);
      });

    });

  });
});
