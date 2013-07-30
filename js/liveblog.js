/* global liveblog, liveblog_settings, _, alert, jQuery, moment, momentLang, Backbone */
window.liveblog = window.liveblog || {};

( function( $ ) {
	Backbone.emulateHTTP = true;

	liveblog.EntriesView = Backbone.View.extend({
		el: '#liveblog-container',
		events: {
			'click .liveblog-entry-edit': 'editClick',
			'click .liveblog-entry-delete': 'deleteClick'
		},

		initialize: function() {
			_.bindAll(this, 'deleteError', 'deleteEntry');

			liveblog.queue.on('reset', function(){
				this.updateEntries();
				liveblog.hide_spinner();
				// TODO: are 3rd parties dependent on this? Or can we fire it on the Backbone event bus?
				$( document.body ).trigger( 'post-load' );
			}, this);

			$(window).scroll(_.throttle(this.flushQueueWhenOnTop, 250));

			liveblog.queue.on('stoppedPolling', function() {
				// TODO: i18n
				liveblog.fixedError.show("Oh no. Something's gone wrong, and we've stopped updating the live blog, please try and refresh!", true);
			});
		},

		updateEntries: function() {
			this.addEntries();
			liveblog.queue.updated().each(this.updateEntry, this);
			liveblog.queue.deleted().each(this.deleteEntry, this);
			this.updateTimes(); // TODO: factor into EntryView
		},

		addEntries: function() {
			liveblog.queue.inserted().each(this.addEntry, this);
		},

		addEntry: function( new_entry ) {
			var $existingEntry = $('#liveblog-entry-' + new_entry.id),
					animationDuration = liveblog.queue.length * 1000
																* liveblog_settings.fade_out_duration;

			if (0 >= $existingEntry.length) {
				var $new_entry = $( new_entry.get('html') );
				$new_entry.addClass('highlight')
					.prependTo( liveblog.$entry_container )
					.animate({backgroundColor: 'white'},
									 {duration: this.animationDuration});
			}
			this.updateTimes(); // TODO: factor into EntryView
		},

		deleteEntry: function( entry ) {
			var $existingEntry = $('#liveblog-entry-' + entry.id);
			$existingEntry.remove();
			this.updateTimes(); // TODO: factor into EntryView
		},

		updateEntry: function( entry ) {
			var $existingEntry = $('#liveblog-entry-' + entry.id);
			$existingEntry.replaceWith(entry.get('html'));
			this.updateTimes(); // TODO: factor into EntryView
		},

		scrollToTop: function() {
			$(window).scrollTop(this.$el.offset().top);
		},
		flushQueueWhenOnTop: function() {
			if (liveblog.is_at_the_top()) {
				liveblog.queue.flush();
			}
		},
		updateTimes: function() {
			var self = this;
			this.$('.liveblog-entry').each(function() {
				var $entry = $(this),
					timestamp = $entry.data('timestamp'),
					human = self.formatTimestamp(timestamp);
				$('.liveblog-meta-time a', $entry).text(human);
			});
		},
		formatTimestamp: function(timestamp) {
			return moment.unix(timestamp).fromNow();
		},

		editClick: function(event) {
			var entry = $( event.target ).closest( '.liveblog-entry' ),
			id = entry.attr( 'id' ).replace( 'liveblog-entry-', '' ),
			model = new liveblog.PublishedEntry();
			model.id = id;
			var form = new liveblog.EditEntryView({model: model, entry: entry});
			if ( !id ) {
				return;
			}
			form.render();
			entry.find( '.liveblog-entry-edit' ).hide();
			entry.find('.liveblog-entry-actions .liveblog-entry-delete').hide();
		},

		deleteClick: function(event) {
			event.preventDefault();
			if ( !confirm( liveblog_settings.delete_confirmation ) ) {
				return;
			}

			var entry = $( event.target ).closest( '.liveblog-entry' ),
			id = entry.attr( 'id' ).replace( 'liveblog-entry-', '' ),
			model = new liveblog.PublishedEntry({id: id, type: 'delete'});
			model.destroy({
				wait: true,
				error: this.deleteError,
				success: this.deleteEntry
			});
		},

		deleteError: function(model, response, options) {
			liveblog.fixedError.show(response);
		}
	});

	liveblog.PreviewEntry = Backbone.Model.extend({
		url: liveblog_settings.endpoint_url + 'preview',

		sync: function(method, model, options) {
			model.attributes[liveblog_settings.nonce_key] = liveblog_settings.nonce;
			options.data = $.param(model.attributes);

			return Backbone.sync.apply(this, [method, model, options]);
		}
	});

	liveblog.Entry = Backbone.Model.extend({
		url: liveblog_settings.endpoint_url + 'crud',

		sync: function(method, model, options) {
		  var methodMap = {
				'create': 'insert',
				'update': 'update',
				'delete': 'delete'
			};

			var data = _.extend(model.attributes, {
				'crud_action': methodMap[method],
				'post_id': liveblog_settings.post_id
			});

			data[liveblog_settings.nonce_key] = liveblog_settings.nonce;
			options.data = $.param(data);

			return Backbone.sync.apply(this, [method, model, options]);
		},
		parse: function(response, options) {
			var parsed;

			if (response.entries) {
				parsed = _.extend(this.attributes, response.entries[0]);
			} else {
				parsed = response;
			}
			return parsed;
		}
	});

	liveblog.NewEntry = liveblog.Entry.extend({
		sync: function(method, model, options) {
			model.attributes = _.extend(model.attributes, {
				'type': 'new'
			});

			return liveblog.NewEntry.__super__.sync(method, model, options);
		},

		parse: function(response, options) {
			return _.extend(this.attributes, response.entries[0]);
		}
	});

	liveblog.PublishedEntry = liveblog.Entry.extend({
		sync: function(method, model, options) {
			model.attributes = _.extend(model.attributes, {
				'entry_id': model.id,
				'type': method // TODO: is this necessary?
			});

			return liveblog.PublishedEntry.__super__.sync(method, model, options);
		}

	});

	liveblog.EntriesQueue = Backbone.Collection.extend({
		model: liveblog.PublishedEntry,
		consecutiveFailuresCount: 0,

		initialize: function() {
			_.bindAll(this, 'fetch', 'onFetchError', 'resetTimer');

			this.setInitialTimestamps();
			this.resetTimer();
			this.on('reset', function() {
				this.consecutiveFailuresCount = 0;
				this.undelayTimer();
				this.resetTimer();
			}, this);

		},

		url: function() {
			var url  = liveblog_settings.endpoint_url,
				from = parseInt(liveblog.latest_entry_timestamp, 10) + 1,
				local_diff = this.currentTimestamp() - liveblog.latest_response_local_timestamp,
				to         = liveblog.latest_response_server_timestamp + local_diff;

			url += from + '/' + to + '/';
			return url;
		},

		parse: function(response, options) {
			var i,
				timestamp_milliseconds = Date.parse( options.getResponseHeader( 'Date' ) );
		  liveblog.latest_response_server_timestamp = Math.floor( timestamp_milliseconds / 1000 );
			liveblog.latest_response_local_timestamp  = this.currentTimestamp();

		  if ( response && response.latest_timestamp ) {
				liveblog.latest_entry_timestamp = response.latest_timestamp;
			}

			for ( i = 0; i < response.entries.length; i++ )
			{
				var entryType = response.entries[i].type;
						isThere = $('#liveblog-entry-' + response.entries[i].id).length;

				if ('new' === entryType  && isThere)
				{
					response.entries.splice(i, 1);
				}
			}
			return response.entries;
		},
		updated: function() {
			var filtered = this.filter(function(entry) {
				return 'update' === entry.get('type');
			});
			return new Backbone.Collection(filtered);
		},
		deleted: function() {
			var filtered = this.filter(function(entry) {
				return 'delete' === entry.get('type');
			});
			return new Backbone.Collection(filtered);
		},
		inserted: function() {
			var filtered = this.filter(function(entry) {
				return 'new' === entry.get('type');
			});
			return new Backbone.Collection(filtered);
		},

		flush: function() {
			if (this.isEmpty()) {
				return;
			}
			this.reset([]);
		},

		fetch: function(options) {
			liveblog.show_spinner();
			options = options || {};
			options.error = this.onFetchError;
			liveblog.EntriesQueue.__super__.fetch.call(this, options);
		},

		onFetchError: function(collection, response, options) {
			liveblog.hide_spinner();

			// Have a max number of checks, which causes the auto-update to shut off or slow down the auto-update
			this.consecutiveFailuresCount++;

			if ( 0 === this.consecutiveFailuresCount % liveblog_settings.delay_threshold ) {
				this.delayTimer();
			}

			if ( this.consecutiveFailuresCount >= liveblog_settings.max_consecutive_retries ) {
				this.killTimer();
				this.trigger('stoppedPolling');
				return;
		}
			liveblog.queue.resetTimer();
		},

		setInitialTimestamps: function() {
			var now = this.currentTimestamp();
			liveblog.latest_entry_timestamp           = liveblog_settings.latest_entry_timestamp || 0;
			liveblog.latest_response_local_timestamp  = now;
			liveblog.latest_response_server_timestamp = now;
		},

		killTimer:  function() {
			clearTimeout( liveblog.refresh_timeout );
		},

		resetTimer: function() {
			this.killTimer();
			liveblog.refresh_timeout = setTimeout( this.fetch, ( liveblog_settings.refresh_interval * 1000 ) );
		},

		undelayTimer: function() {
			if ( liveblog_settings.original_refresh_interval ) {
				liveblog_settings.refresh_interval = liveblog_settings.original_refresh_interval;
			}
		},

		delayTimer: function() {
			if ( ! liveblog_settings.original_refresh_interval ) {
				liveblog_settings.original_refresh_interval = liveblog_settings.refresh_interval;
			}
			liveblog_settings.refresh_interval *= liveblog_settings.delay_multiplier;
		},

		currentTimestamp: function() {
			return Math.floor( new Date().getTime() / 1000 );
		}
	});

	liveblog.FixedNagView = Backbone.View.extend({
		el: '#liveblog-fixed-nag',
		events: {
			'click a': 'flush'
		},
		initialize: function() {
			liveblog.queue.on('reset', this.render, this);
		},
		render: function() {
			var entries_in_queue = liveblog.queue.inserted().length;

			if ( entries_in_queue && !liveblog.is_at_the_top() ) {
				this.show();
				this.updateNumber(liveblog.queue.length);
			} else {
				this.hide();
			}
		},
		show: function() {
			this.$el.show();
			this._moveBelowAdminBar();
		},
		hide: function() {
			this.$el.hide();
		},
		flush: function(e) {
			e.preventDefault();
			liveblog.entriesContainer.addEntries();
			liveblog.queue.flush();
		},
		updateNumber: function(number) {
			var template = number === 1? liveblog_settings.new_update : liveblog_settings.new_updates,
				html = template.replace('{number}', '<span class="num">' + number + '</span>');
			this.$('a').html(html);
		},
		_moveBelowAdminBar: function() {
			var $adminbar = $('#wpadminbar');
			if ($adminbar.length) {
				this.$el.css('top', $adminbar.height());
			}
		}
	});

	liveblog.TitleBarCountView = Backbone.View.extend({
		initialize: function() {
			liveblog.queue.on('reset', this.render, this);
			this.originalTitle = document.title;
		},
		render: function() {
			var entries_in_queue = liveblog.queue.inserted().length;
				count_string = entries_in_queue? '(' + entries_in_queue + ') ' : '';
			document.title = count_string + this.originalTitle;
		}
	});

	liveblog.FixedErrorView = Backbone.View.extend({
		el: '#liveblog-fixed-error',

		show: function(error, sticky) {
			var message;
			if('object' === typeof error) {
				message = this._getErrorFromResponse(error);
		  } else {
				message = error;
			}

			this.$el.html(message);
			this._moveBelowAdminBar();
			this.$el.show();

		  if (!sticky) {
				this.$el.delay(5000).fadeOut();
			}
		},

		_getErrorFromResponse: function(response) {
			var message;
			if (response.status && response.status > 200 ) {
				message = liveblog_settings.error_message_template.replace('{error-code}', response.status).replace('{error-message}', response.statusText);
			} else {
				message = liveblog_settings.short_error_message_template.replace('{error-message}', response.status);
			}
			return message;
		},

		//TODO: factor out
		_moveBelowAdminBar: function() {
			var $adminbar = $('#wpadminbar');
			if ($adminbar.length) {
				this.$el.css('top', $adminbar.height());
			}
		}
	});

	// Global event bus
	_.extend(Backbone, Backbone.Events);

	liveblog.init = function() {
		liveblog.$entry_container = $( '#liveblog-entries'        );
		liveblog.$spinner         = $( '#liveblog-update-spinner' );

		liveblog.queue = new liveblog.EntriesQueue();
		liveblog.fixedNag = new liveblog.FixedNagView();
		liveblog.fixedError = new liveblog.FixedErrorView();
		liveblog.entriesContainer = new liveblog.EntriesView();
		liveblog.titleBarCount = new liveblog.TitleBarCountView();
		Backbone.trigger( 'after-views-init' );

		liveblog.init_moment_js();

		liveblog.cast_settings_numbers();
		liveblog.start_human_time_diff_timer();

		Backbone.trigger( 'after-init' );
	};

	liveblog.init_moment_js = function() {
		momentLang.relativeTime = _.extend(moment().lang().relativeTime, momentLang.relativeTime);
		moment.lang(momentLang.locale, momentLang);
	};


	// wp_localize_scripts makes all integers into strings, and in JS
	// we need them to be real integers, so that we can use them in
	// arithmetic operations
	liveblog.cast_settings_numbers = function() {
		liveblog_settings.refresh_interval        = parseInt( liveblog_settings.refresh_interval, 10 );
		liveblog_settings.max_consecutive_retries = parseInt( liveblog_settings.max_consecutive_retries, 10 );
		liveblog_settings.delay_threshold         = parseInt( liveblog_settings.delay_threshold, 10 );
		liveblog_settings.delay_multiplier        = parseFloat( liveblog_settings.delay_multiplier, 10 );
		liveblog_settings.latest_entry_timestamp  = parseInt( liveblog_settings.latest_entry_timestamp, 10 );
		liveblog_settings.fade_out_duration       = parseInt( liveblog_settings.fade_out_duration, 10 );
	};


	// Move to EntriesView
	liveblog.start_human_time_diff_timer = function() {
		var tick = function(){ liveblog.entriesContainer.updateTimes(); };
		tick();
		setInterval(tick, 60 * 1000);
	};



	liveblog.show_spinner = function() {
		liveblog.$spinner.spin( 'small' );
	};

	liveblog.hide_spinner = function() {
		liveblog.$spinner.spin( false );
	};


	liveblog.is_at_the_top = function() {
		return $(document).scrollTop()  < liveblog.$entry_container.offset().top;
	};

	// Initialize everything!
	if ( 'archive' !== liveblog_settings.state ) {
		$( document ).ready( liveblog.init );
	}

} )( jQuery );
