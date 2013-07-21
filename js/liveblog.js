/* global liveblog, liveblog_settings, _, alert, jQuery, moment, momentLang, Backbone */
window.liveblog = window.liveblog || {};

( function( $ ) {
	liveblog.EntriesView = Backbone.View.extend({
		el: '#liveblog-container',

		events: {
			'click .liveblog-entry-delete': 'deleteClick',
		  'click .liveblog-entry-edit': 'editClick'

		},

		initialize: function() {
			// There is a delay in your newly posted comment showing up because the HTML is generated server side
			// Could be an idea to render it in JS, but we'd need all the details for the template
			// Could the server generate a JST for us, as well as pre-rendering?
			liveblog.queue.on('reset sync', this.updateEntries, this); //reset should suffice here?!
			liveblog.queue.on('error', this.errorFetching, this);

			$(window).scroll($.throttle(250, this.flushQueueWhenOnTop));
		},

		updateEntries: function() {
			this.animationDuration = liveblog.queue.added().length * 1000 * liveblog_settings.fade_out_duration;
			liveblog.queue.added().each(this.addEntry, this);
			liveblog.queue.deleted().each(this.deleteEntry, this);
			liveblog.queue.updated().each(this.updateEntry, this);
			this.updateTimes();
			liveblog.reset_timer();
			liveblog.undelay_timer();
		},

		addEntry: function( new_entry ) {
			var $existingEntry = $('#liveblog-entry-' + new_entry.id);
		  if (0 >= $existingEntry.length) {
				var $new_entry = $( new_entry.get('html') );
				$new_entry.addClass('highlight')
					.prependTo( liveblog.$entry_container )
					.animate({backgroundColor: 'white'}, {duration: this.animationDuration});
			}
		},

		deleteEntry: function( entry ) {
			var $existingEntry = $('#liveblog-entry-' + entry.id);
			$existingEntry.remove();
		},

		updateEntry: function( entry ) {
			var $existingEntry = $('#liveblog-entry-' + entry.id);
			$existingEntry.html(entry.get('html'));
		},

		deleteClick: function (event) {
			event.preventDefault();

			if ( !confirm( liveblog_settings.delete_confirmation ) ) {
				return;
			}

			var entryDivID = $(event.target).parents('.liveblog-entry').attr('id');
			var id = entryDivID.match(/-([0-9]+)$/)[1];
		  var model = new liveblog.Entry();
			model.id = id;

			// TODO: attach events to renable button/stop spinner
			//liveblog.publisher.insert_form.disable();
			//liveblog.publisher.insert_form.show_spinner();

			model.destroy();
		},

		editClick: function (event) {
			event.preventDefault();
			var entry = $( event.target ).closest( '.liveblog-entry' ),
				id = entry.attr( 'id' ).replace( 'liveblog-entry-', '' ),
				model = new liveblog.Entry();
		  model.id = id;
			model.set('post_id', liveblog_settings.post_id);
			var form = new liveblog.EditEntryView({model: model, entry: entry});
			if ( !id ) {
				return;
			}
			form.render();
			entry.find( '.liveblog-entry-edit' ).hide();
			entry.find('.liveblog-entry-actions .liveblog-entry-delete').hide();
		},

		scrollToTop: function() {
			$(window).scrollTop(this.$el.offset().top);
		},
		flushQueueWhenOnTop: function() {
			if (liveblog.is_at_the_top()) {
				liveblog.queue.fetch({reset: true});
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

		errorFetching: function(collection, xhr, options) {
			liveblog.hide_spinner();

			// Have a max number of checks, which causes the auto-update to shut off
			// or slow down the auto-update
			if ( ! liveblog.consecutive_failures_count ) {
				liveblog.consecutive_failures_count = 0;
			}

			liveblog.consecutive_failures_count++;

			if ( 0 === liveblog.consecutive_failures_count % liveblog_settings.delay_threshold ) {
				liveblog.delay_timer();
			}

			if ( liveblog.consecutive_failures_count >= liveblog_settings.max_consecutive_retries ) {
				liveblog.kill_timer();
				return;
			}

			liveblog.reset_timer();
		}
	});

	liveblog.EntryPreview = Backbone.Model.extend({
		sync: function(method, model, options) {
			model.set(liveblog_settings.nonce_key, liveblog.publisher.nonce);
			options = options ? _.clone(options) : {};
			options.url = liveblog_settings.endpoint_url + 'preview';
			options.data = $.param(model.attributes);

			return Backbone.sync.apply(this, [method, model, options]);
		}
	});

	liveblog.Entry = Backbone.Model.extend({
		initialize: function() {
			this.on('sync', function(){ liveblog.queue.fetch({reset: true}) });
		},
		sync: function(method, model, options) {
			var methodMap = {
				"update" : "update",
				"create" : "insert",
				"delete" : "delete"
			};

			if (method === "update" || method === "create" || method === "delete") {
				model.set(liveblog_settings.nonce_key, liveblog.publisher.nonce);
				model.set('crud_action', methodMap[method]);
				model.set('post_id', liveblog_settings.post_id);
				model.set('entry_id', model.id); // change server side
				options = options ? _.clone(options) : {};
				options.url = liveblog_settings.endpoint_url + 'crud';
				options.data = $.param(model.attributes);
			}
			var args = [method, model, options];
			return Backbone.sync.apply(this, args);
		}
	});

	liveblog.EntriesQueue = Backbone.Collection.extend({
		model: liveblog.Entry,

		url: function() {
			var url = liveblog_settings.endpoint_url,
				from = liveblog.latest_entry_timestamp + 1,
				local_diff = liveblog.current_timestamp() - liveblog.latest_response_local_timestamp,
				to				 = liveblog.latest_response_server_timestamp + local_diff;

			url += from + '/' + to + '/';
			return url;
		},

		parse: function(response, options) {
			var timestamp_milliseconds = Date.parse( options.getResponseHeader( 'Date' ) );

			liveblog.latest_response_server_timestamp = Math.floor( timestamp_milliseconds / 1000 );
			liveblog.latest_response_local_timestamp	= liveblog.current_timestamp();
			console.log(timestamp_milliseconds);

			if ( response && response.latest_timestamp ) {
				liveblog.latest_entry_timestamp = response.latest_timestamp;
			}

			// If modifying or deleting, do something like delete from the collection
			return response.entries;
		},

		added: function() {
			var filtered = this.filter(function(entry) { return 'new' === entry.get('type'); } );
			return new Backbone.Collection(filtered);
		},

		updated: function() {
			var filtered = this.filter(function(entry) { return 'update' === entry.get('type'); } );
			return new Backbone.Collection(filtered);
		},

		deleted: function() {
			var filtered = this.filter(function(entry) { return 'delete' === entry.get('type'); } );
			return new Backbone.Collection(filtered);
		}
	});

	// This is the title bar that informs users of new comments
	liveblog.FixedNagView = Backbone.View.extend({
		el: '#liveblog-fixed-nag',
		events: {
			'click a': 'flush'
		},
		initialize: function() {
			liveblog.queue.on('all', this.render, this);
		},
		render: function() {
			var entries_in_queue = liveblog.queue.added().length;
			if ( entries_in_queue ) {
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
			liveblog.queue.fetch({reset: true});
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
			liveblog.queue.on('all', this.render, this);
			this.originalTitle = document.title;
		},
		render: function() {
			var entries_in_queue = liveblog.queue.length,
				count_string = entries_in_queue? '(' + entries_in_queue + ') ' : '';
			document.title = count_string + this.originalTitle;
		}
	});

	// A dummy proxy DOM element, which allows us to use arbitrary events
	// via the jQuery events system
	liveblog.$events = $( '<span />' );

	liveblog.init = function() {
		Backbone.emulateHTTP = true;
		liveblog.$entry_container = $( '#liveblog-entries'				);
		liveblog.$spinner				= $( '#liveblog-update-spinner' );

		liveblog.queue = new liveblog.EntriesQueue();
		liveblog.fixedNag = new liveblog.FixedNagView();
		liveblog.entriesContainer = new liveblog.EntriesView();
		liveblog.titleBarCount = new liveblog.TitleBarCountView();
		liveblog.$events.trigger( 'after-views-init' );

		liveblog.init_moment_js();

		liveblog.cast_settings_numbers();
		liveblog.reset_timer();
		liveblog.set_initial_timestamps();
		liveblog.start_human_time_diff_timer();

		liveblog.$events.trigger( 'after-init' );
	};

	liveblog.init_moment_js = function() {
		momentLang.relativeTime = _.extend(moment().lang().relativeTime, momentLang.relativeTime);
		moment.lang(momentLang.locale, momentLang);
	};

	liveblog.set_initial_timestamps = function() {
		var now = liveblog.current_timestamp();
		liveblog.latest_entry_timestamp					= liveblog_settings.latest_entry_timestamp || 0;
		liveblog.latest_response_local_timestamp	= now;
		liveblog.latest_response_server_timestamp = now;
	};

	// wp_localize_scripts makes all integers into strings, and in JS
	// we need them to be real integers, so that we can use them in
	// arithmetic operations
	liveblog.cast_settings_numbers = function() {
		liveblog_settings.refresh_interval				= parseInt( liveblog_settings.refresh_interval, 10 );
		liveblog_settings.max_consecutive_retries = parseInt( liveblog_settings.max_consecutive_retries, 10 );
		liveblog_settings.delay_threshold				= parseInt( liveblog_settings.delay_threshold, 10 );
		liveblog_settings.delay_multiplier				= parseFloat( liveblog_settings.delay_multiplier, 10 );
		liveblog_settings.latest_entry_timestamp	= parseInt( liveblog_settings.latest_entry_timestamp, 10 );
		liveblog_settings.fade_out_duration			= parseInt( liveblog_settings.fade_out_duration, 10 );
	};

	liveblog.kill_timer = function() {
		clearTimeout( liveblog.refresh_timeout );
	};

	liveblog.reset_timer = function() {
		liveblog.kill_timer();
		var fetch = function() {
			liveblog.queue.fetch({reset: true});
		};

		liveblog.refresh_timeout = setTimeout( fetch, ( liveblog_settings.refresh_interval * 1000 ) );
	};

	liveblog.undelay_timer = function() {
		if ( liveblog_settings.original_refresh_interval ) {
			liveblog_settings.refresh_interval = liveblog_settings.original_refresh_interval;
		}
	};

	liveblog.delay_timer = function() {
		if ( ! liveblog_settings.original_refresh_interval ) {
			liveblog_settings.original_refresh_interval = liveblog_settings.refresh_interval;
		}

		liveblog_settings.refresh_interval *= liveblog_settings.delay_multiplier;

	};

	liveblog.start_human_time_diff_timer = function() {
		var tick = function(){ liveblog.entriesContainer.updateTimes(); };
		tick();
		setInterval(tick, 60 * 1000);
	};

	// // MOVE
	// Maybe this should go in a custom collection fetcher error callback

	// Should probably be a view
	liveblog.add_error = function( response, status ) {
		var message;
		if (response.status && response.status > 200) {
			message = liveblog_settings.error_message_template.replace('{error-code}', response.status).replace('{error-message}', response.statusText);
		} else {
			message = liveblog_settings.short_error_message_template.replace('{error-message}', status);
		}
		alert(message);
	};

	liveblog.show_spinner = function() {
		liveblog.$spinner.spin( 'small' );
	};

	liveblog.hide_spinner = function() {
		liveblog.$spinner.spin( false );
	};

	liveblog.current_timestamp = function() {
		return Math.floor( new Date().getTime() / 1000 );
	};

	liveblog.is_at_the_top = function() {
		return $(document).scrollTop()	< liveblog.$entry_container.offset().top;
	};

	// Initialize everything!
	if ( 'archive' !== liveblog_settings.state ) {
		$( document ).ready( liveblog.init );
	}

} )( jQuery );
