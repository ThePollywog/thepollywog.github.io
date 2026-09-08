.PHONY: start build check sabotage

PORT ?= 8629

# `npm run dev`, matching ../saltdog and ../webnavfit's `make start` — but
# only as a live-reloading static server. This site has no bundler step: see
# vite.config.js.
start: node_modules
	npm run dev -- --port $(PORT)

build:
	node tools/build-index.mjs

check:
	node tools/check.mjs

sabotage:
	node tools/sabotage.mjs

node_modules: package-lock.json package.json
	npm ci
	touch node_modules
