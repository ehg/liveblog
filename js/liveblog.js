/* global liveblog, liveblog_settings, _, confirm, jQuery, moment, momentLang, Backbone */
window.liveblog = window.liveblog || {};

( function( $ ) {
	Backbone.emulateHTTP = true;

	liveblog.EntryView = Backbone.View.extend({

		events: {
			'click .liveblog-entry-edit': 'editClick',
			'click .liveblog-entry-delete': 'deleteClick'
		},

		initialize: function() {
		_.bindAll(this, 'update', 'render', 'delete', 'deleteClick', 'editClick');
			this.model.on('destroy', this.delete, this);
			this.model.on('change:html', this.update, this);
			this.model.on('updateTime', this.updateTime, this);
		},

		render: function() {
			var $entry = $(this.model.get('html'));
			this.setElement($entry);
			this.updateTime();
			return this;
		},

		update: function() {
			var $entry = $(this.model.get('html'));
			this.$el.replaceWith($entry);
			this.setElement($entry);
			this.updateTime();
		},
		delete: function() {
			this.remove();
		},

		editClick: function() {
			var form = new liveblog.EditEntryView({model: this.model, entry: this.$el});
			form.render();
			this.$el.find( '.liveblog-entry-edit' ).hide();
			this.$el.find('.liveblog-entry-actions .liveblog-entry-delete').hide();
		},

		deleteClick: function(event) {
			event.preventDefault();
			if ( !confirm( liveblog_settings.delete_confirmation ) ) {
				return;
			}
			this.model.set('type', 'delete');
			this.model.destroy({wait: true, error: this.deleteError});
		},

		deleteError: function(model, response) {
			liveblog.fixedError.show(response);
		},
		updateTime: function() {
			var timestamp = this.$el.data('timestamp'),
					human = this.formatTimestamp(timestamp);
				$('.liveblog-meta-time a', this.$el).text(human);
		},
		formatTimestamp: function(timestamp) {
			return moment.unix(timestamp).fromNow();
		}
	});

	liveblog.EntriesView = Backbone.View.extend({
		el: '#liveblog-container',

		initialize: function() {
			_.bindAll(this, 'flushQueueWhenOnTop');
			this.attachEntries();

			liveblog.entries.on('add', this.addEntry, this);
			liveblog.queue.on('sync', function(){
				liveblog.hide_spinner();
				// TODO: are 3rd parties dependent on this? Or can we fire it on the Backbone event bus?
				$( document.body ).trigger( 'post-load' );
			}, this);
			$(window).scroll(_.throttle(this.flushQueueWhenOnTop, 250));

			liveblog.queue.on('stoppedPolling', function() {
				// TODO: i18n
				liveblog.fixedError.show("Oh no. Something's gone wrong, and we've stopped updating the live blog, please try and refresh!", true);
			});

			this.attachEntries();
		},
		attachEntries: function() {
			var $entries = $('.liveblog-entry');
			_.each($entries, function(entry) {
				var $entry = $(entry),
					id = $entry.attr('id').replace('liveblog-entry-', ''),
					model = new liveblog.Entry({id: id, html: $entry.html()});
				new liveblog.EntryView({model: model, el: $entry});
				liveblog.entries.add(model, {silent: true});
			}, this);
		},
		addEntry: function(entry) {
			var animationDuration = (liveblog.queue.length + 1) * 1000 *
																liveblog_settings.fade_out_duration,

				view = new liveblog.EntryView({model: entry}),
				$entry = view.render().$el;

			$entry.prependTo(liveblog.$entry_container)
				.addClass('highlight')
				.animate({backgroundColor: 'white'},
								 {duration: animationDuration});
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
			this.$el.find('.liveblog-entry').each(function() {
				var $entry = $(this),
					timestamp = $entry.data('timestamp'),
					human = self.formatTimestamp(timestamp);
				$('.liveblog-meta-time a', $entry).text(human);
			});
		},
		formatTimestamp: function(timestamp) {
			return moment.unix(timestamp).fromNow();
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

	liveblog.EntriesCollection = Backbone.Collection.extend({
		model: liveblog.Entry,

		initialize: function() {
			var queue = liveblog.queue;
			queue.on('sync', function() {
				queue.inserted().each(function(entry) {
					if (liveblog.entriesContainer.isAtTheTop() ){
						this.add(entry);
						queue.remove(entry);
					}
				}, this);
				queue.updated().each(function(entry) {
					var existingEntry = this.get(entry.id);
					if (existingEntry) {
						existingEntry.set('html', entry.get('html'));
						existingEntry.trigger('change:html');
						queue.remove(entry);
					}
				}, this);

				queue.deleted().each(function(entry) {
					var model = this.get(entry.id);
					if (model) {
						model.trigger('destroy');
						this.remove(model);
					}
					queue.remove(entry);
				}, this);
			}, this);

		},
	});

	liveblog.Entry = Backbone.Model.extend({
		url: liveblog_settings.endpoint_url + 'crud',

		sync: function(method, model, options) {
		  var methodMap = {
				'create': 'insert',
				'update': 'update',
				'delete': 'delete'
			},
				data = _.extend(model.attributes, {
				'crud_action': methodMap[method],
				'post_id': liveblog_settings.post_id,
				'entry_id': model.id
				});

			if ( 'delete' === method )
			{
				delete data.html;
			}

			data[liveblog_settings.nonce_key] = liveblog_settings.nonce;
			options.data = $.param(data);

			return Backbone.sync.apply(this, [method, model, options]);
		},
		parse: function(response) {
			var parsed;

			if (response.entries) {
				parsed = _.extend(this.attributes, response.entries[0]);
			} else {
				parsed = response;
			}
			return parsed;
		}
	});

liveblog.EntriesQueue = Backbone.Collection.extend({
		model: liveblog.Entry,
		consecutiveFailuresCount: 0,

		initialize: function() {
			_.bindAll(this, 'fetch', 'onFetchError', 'resetTimer');

			this.setInitialTimestamps();
			this.resetTimer();
			this.on('reset', function() {
				this.consecutiveFailuresCount = 0;
				this.undelayTimer();
				this.resetTimer();
				liveblog.hide_spinner();
			}, this);

		},

		url: function() {
			var url  = liveblog_settings.endpoint_url,
				from = liveblog.latest_entry_timestamp + 1,
				local_diff = this.currentTimestamp() - liveblog.latest_response_local_timestamp,
				to         = liveblog.latest_response_server_timestamp + local_diff;

			url += from + '/' + to + '/';
			return url;
		},

		parse: function(response, options) {
			var timestamp_milliseconds = Date.parse( options.getResponseHeader( 'Date' ) );
		  liveblog.latest_response_server_timestamp = Math.floor( timestamp_milliseconds / 1000 );
			liveblog.latest_response_local_timestamp  = this.currentTimestamp();

		  if ( response && response.latest_timestamp ) {
				liveblog.latest_entry_timestamp = response.latest_timestamp;
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

		onFetchError: function() {
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
			var entries_in_queue = liveblog.queue.length;
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
			liveblog.queue.on('all', this.render, this);
			this.originalTitle = document.title;
		},
		render: function() {
			var entries_in_queue = liveblog.queue.length,
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
		liveblog.entries = new liveblog.EntriesCollection();
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
