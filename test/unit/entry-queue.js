var should = chai.should();

mocha.setup({ignoreLeaks: true});

describe('Collection: EntriesQueue', function() {
	var queue = null;

	before(function(){
		queue = new liveblog.EntriesQueue();
	});

	context('when the collection is populated', function() {
		before(function(){
			queue.add([
				new liveblog.PublishedEntry({id: 1, type: 'delete'}),
				new liveblog.PublishedEntry({id: 2, type: 'update', html: 'foo'}),
				new liveblog.PublishedEntry({id: 3, type: 'new', html: 'bar'})
			]);
		});

		it('can filter inserted entries', function() {
			queue.inserted().length.should.equal(1);
			queue.inserted().at(0).get('type').should.equal('new');
		});

		it('can filter updated entries', function() {
			queue.updated().length.should.equal(1);
			queue.updated().at(0).get('type').should.equal('update');
		});

		it('can filter added entries', function() {
			queue.deleted().length.should.equal(1);
			queue.deleted().at(0).get('type').should.equal('delete');
		});
	});

	context('when the EntryQueue is fetched', function() {
		var fakeServer,
			serverTimestamp,
			localTimestamp;

		before( function() {
			this.clock = sinon.useFakeTimers(Date.now());
			fakeServer = sinon.fakeServer.create();
			fakeServer.respondWith(
				[
					200,
					{
						"Content-Type": "application/json",
						"Date": "Tue, 23 Jul 2013 11:23:04 GMT"
					},
					JSON.stringify(window.entryQueueResponse)
				]
			);
		});

		after( function() {
			this.clock.restore();
			fakeServer.restore();
		});

		before( function(done) {
			queue.setInitialTimestamps();

			this.clock.tick(1000);
			serverTimestamp = liveblog.latest_response_server_timestamp;
			localTimestamp = liveblog.latest_response_local_timestamp;

			queue.fetch({
				success: function(a,b,c) {
					done();
				},
				error: function(a,b,c) {
					done(a);
				}
			});
			this.clock.tick(10);
			fakeServer.respond();
		});

		it('has an URL with the start and endpoint timestamps in', function() {
			queue.url().should.match(new RegExp(liveblog_settings.endpoint_url + '[0-9]{10}/[0-9]{10}'));
		});

		it('parses the entries', function() {
			var entry = queue.at(0);
			should.exist(entry);
			entry.id.should.equal('14');
			entry.get('type').should.equal('new');
			entry.get('html').should.equal('generated html');
		});

		it('updates the latest server response timestamp', function() {

			liveblog.latest_response_server_timestamp.should.not.equal(localTimestamp);
		});

		it('updates the latest local response timestamp', function() {

			liveblog.latest_response_local_timestamp.should.not.equal(serverTimestamp);
		});


	});
});
