all: test/build.js

clean_js:
	rm -f test/build.js

test/build.js: clean_js
	./node_modules/.bin/browserify test/browser-index.js -t reactify > $@