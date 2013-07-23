var should = chai.should();

mocha.setup({ignoreLeaks: true});

describe('Collection: EntriesQueue', function() {
	var queue = null;

	before(function(){
		queue = new liveblog.EntriesQueue();
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
			liveblog.set_initial_timestamps();

			this.clock.tick(1000);
			serverTimestamp = liveblog.latest_response_server_timestamp;
			localTimestamp = liveblog.latest_response_local_timestamp;

			queue.fetch({
				success: function(a,b,c) {
					done();
				},
				error: function(a,b,c) {
					done();
				}
			});
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
