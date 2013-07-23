var should = chai.should();

describe('Collection: EntriesQueue', function() {
	var queue = null;

	before(function(){
		queue = new liveblog.EntriesQueue();
	});

	context('when the EntryQueue is fetched', function() {
		var fakeServer = null;

		before( function() {
			fakeServer = sinon.fakeServer.create();
			fakeServer.respondWith(
				[
					200,
					{"Content-Type": "application/json"},
					JSON.stringify(window.entryQueueResponse)
				]
			);
		});

		after( function() {
			fakeServer.restore();
		});

		before( function(done) {
			liveblog.set_initial_timestamps();
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

	});
});
