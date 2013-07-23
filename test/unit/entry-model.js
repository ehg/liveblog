var should = chai.should();

describe('Model: NewEntry', function() {
	var entry = null;

	before(function(){
		entry = new liveblog.NewEntry();
	});

	it('has the correct URL', function() {
		entry.url.should.equal('/endpoint/crud');
	});

	context('when the entry is saved', function() {
		var ajaxStub = null;

		before( function() {
			ajaxStub = sinon.stub(jQuery, 'ajax');
			entry.save({content: 'foo'});
		});

		after( function() {
			jQuery.ajax.restore();
		});

		it('sends the correct POST request to the server', function() {
			var correctArgs = ajaxStub.calledWithMatch({
				type: 'POST',
				data: sinon.match('content=foo')
								.and(sinon.match('crud_action=insert'))
								.and(sinon.match(liveblog_settings.nonce_key +
											'=' + liveblog_settings.nonce))
								.and(sinon.match('post_id', liveblog_settings.post_id))
								.and(sinon.match('type', 'new'))
			});

			ajaxStub.calledOnce.should.equal(true);
			return correctArgs.should.equal(true);
		});
	});
});

describe('Model: PublishedEntry', function() {
	var entry = null;

	before(function(){
		entry = new liveblog.PublishedEntry();
	});

	it('has the correct URL', function() {
		entry.url.should.equal('/endpoint/crud');
	});

	context('when the entry is saved', function() {
		var ajaxStub = null;

		before( function() {
			ajaxStub = sinon.stub(jQuery, 'ajax');
			entry.id = 10;
			entry.save({content: 'bar'});
		});

		after( function() {
			jQuery.ajax.restore();
		});

		it('sends the correct POST request to the server', function() {
			var correctArgs = ajaxStub.calledWithMatch({
				type: 'POST',
				data: sinon.match('content=bar')
								.and(sinon.match('crud_action=update'))
								.and(sinon.match(liveblog_settings.nonce_key +
											'=' + liveblog_settings.nonce))
								.and(sinon.match('post_id=' + liveblog_settings.post_id))
								.and(sinon.match('entry_id=' + 10))
			});

			ajaxStub.calledOnce.should.equal(true);
			return correctArgs.should.equal(true);
		});
	});

	context('when the entry is destroyed', function() {
		var ajaxStub = null;

		before( function() {
			ajaxStub = sinon.stub(jQuery, 'ajax');
			entry.destroy();
		});

		after( function() {
			jQuery.ajax.restore();
		});

		it('sends the correct POST request to the server', function() {
			var correctArgs = ajaxStub.calledWithMatch({
				type: 'POST',
				data: sinon.match('content=bar')
								.and(sinon.match('crud_action=delete'))
								.and(sinon.match(liveblog_settings.nonce_key +
											'=' + liveblog_settings.nonce))
								.and(sinon.match('post_id=' + liveblog_settings.post_id))
								.and(sinon.match('entry_id=' + 10))
			});

			ajaxStub.calledOnce.should.equal(true);
			return correctArgs.should.equal(true);
		});
	});
});
