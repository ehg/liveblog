window.liveblog_settings = {
				'permalink'              : 'blah',
				'post_id'                : '2',
				'state'                  : 'archive', // to stop init
				'key'                    : 'somekey',
				'nonce_key'              : 'noncekey',
				'nonce'                  : 'nonce',
				'latest_entry_timestamp' : '137449688',
				'refresh_interval'       : '1',
				'max_consecutive_retries': '2',
				'delay_threshold'        : '1',
				'delay_multiplier'       : '1',
				'fade_out_duration'      : '1',
				'endpoint_url'           : '/endpoint/',
				// i18n
				'delete_confirmation'    : 'Do you really want do delete this entry? There is no way back.',
				'error_message_template' : 'Error {error-code}: {error-message}',
				'short_error_message_template' : 'Error: {error-message}',
				'new_update'             : 'Liveblog: {number} new update',
				'new_updates'            : 'Liveblog: {number} new updates',
};


window.liveblog_publisher_settings = {
			'loading_preview' : 'Loading preview…',
			'new_entry_tab_label' : 'New Entry',
			'new_entry_submit_label' : 'Publish Update',
			'edit_entry_tab_label' : 'Edit Entry',
			'edit_entry_submit_label' : 'Update'
};

window.wp = {Uploader: function(){}};
$('head').append(__html__['fixtures.html']);

window.momentLang = {};

window.entryQueueResponse = {
	"entries":	[
		{"id":"14","type":"new","html":"generated html"}
	],
	"latest_timestamp":null
};
