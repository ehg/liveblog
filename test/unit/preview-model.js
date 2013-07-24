var should = chai.should();

describe('Model: PreviewEntry', function() {
	var entry = null;

	before(function(){
		entry = new liveblog.PreviewEntry();
	});

	it('has the correct URL', function() {
		entry.url.should.equal('/endpoint/preview');
	});

	context('when the entry is saved', function() {
		var ajaxStub = null;

		before( function() {
			ajaxStub = sinon.stub(jQuery, 'ajax');
			entry.save({entry_content: 'foo'});
		});

		after( function() {
			jQuery.ajax.restore();
		});

		it('sends the correct POST request to the server', function() {
      console.log(ajaxStub.args[0]);
			var correctArgs = ajaxStub.calledWithMatch({
				type: 'POST',
				data: sinon.match('entry_content=foo')
								.and(sinon.match(liveblog_settings.nonce_key +
											'=' + liveblog_settings.nonce))
      });

			ajaxStub.calledOnce.should.equal(true);
			return correctArgs.should.equal(true);
		});
	});
});
