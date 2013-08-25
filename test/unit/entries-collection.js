var should = chai.should();

describe('Collection: EntriesCollection', function() {
  before(function() {
    this.newModel = new Backbone.Model({id: 1, html: 'foo', type: 'new'})
    liveblog.queue = new liveblog.EntriesQueue(this.newModel);
    liveblog.entriesContainer = {isAtTheTop: function() {return true;}}
    this.entries = new liveblog.EntriesCollection
  });

  context('When the EntriesQueue has been fetched', function() {
    before(function() {
      liveblog.queue.trigger('fetched');
    });

    it('adds the new entry to the collection', function(){
      should.exist(this.entries.at(0));
      this.entries.get(1).get('type').should.equal('new');
    });

    it('removes the new entry from the queue', function(){
      should.not.exist(liveblog.queue.get(1));
    });
  });

  context('When an updated entry is in the queue', function() {
    before(function(){
      this.eventSpy = sinon.spy();
      this.newModel.on('change', this.eventSpy);

      this.model = new Backbone.Model({id: 1, html: 'bar', type: 'update'})
      liveblog.queue.add(this.model);
      liveblog.queue.trigger('fetched');
    });

    it('updates the existing entry in the collection', function() {
      this.entries.get(1).get('html').should.equal('bar');
    });

    it('removes the updated entry from the queue', function() {
      should.not.exist(liveblog.queue.get(1));
    });

    it('triggers a change event on the model', function() {
      this.eventSpy.calledOnce.should.be.true
    });
  });

  context('When a deleted entry is in the queue', function() {
    before(function(){
      this.eventSpy = sinon.spy();
      this.newModel.on('destroy', this.eventSpy);

      this.model = new Backbone.Model({id: 1, html: '', type: 'delete'})
      liveblog.queue.add(this.model);
      liveblog.queue.trigger('fetched');
    });

    it('triggers a destroy event on the model', function() {
      this.eventSpy.calledOnce.should.be.true
    });

    it('removes the entry from the entries collection', function() {
      should.not.exist(this.entries.get(1));
    });

    it('removes the deleted entry from the queue', function() {
      should.not.exist(liveblog.queue.get(1));
    });
  });
});
