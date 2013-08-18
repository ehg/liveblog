#!/bin/sh
set -e
phpunit
cd test
./node_modules/.bin/karma start --single-run --browsers PhantomJS
