all: test/article-build.js

clean_js:
	rm -f test/article-build.js

test/article-build.js: clean_js
	./node_modules/.bin/browserify test/browser-index.js -t reactify > $@