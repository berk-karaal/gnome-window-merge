UUID = window-merge@berk-karaal
DEST = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: schemas check test install nested zip

schemas:
	glib-compile-schemas --strict $(UUID)/schemas

check:
	@for f in $(UUID)/*.js; do node --input-type=module --check < $$f && echo "ok $$f"; done

test:
	gjs -m tests/layout.test.js
	gjs -m tests/group.test.js

install: schemas check
	rm -rf $(DEST)
	mkdir -p $(DEST)
	cp -r $(UUID)/. $(DEST)/

nested: install
	dbus-run-session -- gnome-shell --devkit

zip: schemas
	cd $(UUID) && zip -r ../$(UUID).zip . -x "*.compiled"
