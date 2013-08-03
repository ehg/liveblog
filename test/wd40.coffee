# Helper libary from https://github.com/scraperwiki/custard
# TODO: split into its own node module
wd = require 'wd'

class wd40
  init: (cb) ->
   @browser = wd.remote()
   options =
     browserName: process.env.BROWSER ? 'chrome'
     chromeOptions:
       args: ['--disable-extensions']

   @browser.init options, (err) ->
     if err
       console.warn err
       console.warn "Is your Selenium server running? (see custard/README.md for instructions)"
     cb err, @browser

  trueURL: (cb) ->
   @browser.eval "window.location.href", cb

  fill: (selector, text, cb) ->
   @browser.waitForElementByCss selector, 4000, =>
     @browser.elementByCss selector, (err, element) =>
       element.clear (err) =>
         @browser.type element, text, cb

  clear: (selector, cb) ->
   @browser.waitForElementByCss selector, 4000, =>
     @browser.elementByCss selector, (err, element) =>
       @browser.clear element, cb

  click: (selector, cb) ->
   @browser.waitForVisibleByCss selector, 4000, =>
     @browser.elementByCss selector, (err, element) =>
       element.click cb

  getText: (selector, cb) ->
   @browser.waitForElementByCss selector, 4000, =>
     @browser.elementByCss selector, (err, element) =>
       element.text cb

  # We always switch to the first frame here!
  switchToFrame: (selector, cb) ->
   @browser.waitForElementByCss selector, 4000, =>
     @browser.frame 0, cb

  switchToTopFrame: (cb) ->
   @browser.windowHandle (err, handle) =>
     @browser.window handle, cb

  switchToBottomFrame: (cb) ->
   @switchToFrame 'iframe', =>
     @switchToFrame 'iframe', cb

  waitForText: (text, arg1, arg2) ->
   if typeof(arg1) is 'number' and typeof(arg2) is 'function'
     cb = arg2
     timeout = arg1
   else if typeof(arg1) is 'function'
     cb = arg1
     timeout = 4000
   else
     return new Error("Invalid arguments supplied to waitForText()")
   endTime = Date.now() + timeout
   poll = =>
     @browser.text 'body', text, (err, result) ->
       if err
         return cb err
       if result.indexOf(text) > -1
         cb null
       else
         if Date.now() > endTime
           cb new Error("Text didn't appear")
         else
           setTimeout poll, 200
   poll()

  waitForMatchingURL: (regExp, cb) ->
   endTime = Date.now() + 4000
   poll = =>
     @trueURL (err, url) ->
       if err
         return cb err
       if regExp.test url
         cb null, url
       else
         if Date.now() > endTime
           cb new Error("No matching URL found")
         else
           setTimeout poll, 200
   poll()

  elementByPartialLinkText: (text, callback) ->
   @browser.waitForElementByPartialLinkText text, 4000, (err) =>
     callback(err) if err?
     @browser.elementByPartialLinkText text, callback

  elementByCss: (selector, callback) ->
   @browser.waitForElementByCss selector, 4000, (err) =>
     callback(err) if err?
     @browser.elementByCss selector, callback

  waitForInvisible: (element, callback) ->
   endTime = Date.now() + 4000
   poll = =>
     @browser.isVisible element, (err, visible) =>
       if err
         callback err
       else if not visible
         callback null
       else
         if Date.now() > endTime
           callback new Error("Element did not disappear")
         else
           setTimeout poll, 200
   poll()

  waitForInvisibleByCss: (selector, callback) ->
   endTime = Date.now() + 4000
   poll = =>
     @browser.isVisible 'css selector', selector, (err, visible) ->
       if err
         callback err
       else if not visible
         callback null
       else
         if Date.now() > endTime
           callback new Error("Element did not disappear")
         else
           setTimeout poll, 200
   poll()

exports.wd40 = wd40
