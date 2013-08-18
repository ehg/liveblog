#!/bin/sh
set -e
export BASE_URL=https://wordpress.com
phpunit
cd test
./node_modules/.bin/karma start --single-run --browsers PhantomJS
