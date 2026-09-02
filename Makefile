.PHONY: start check sabotage

PORT ?= 8629

start:
	python3 -m http.server $(PORT)

check:
	node tools/check.mjs

sabotage:
	node tools/sabotage.mjs
