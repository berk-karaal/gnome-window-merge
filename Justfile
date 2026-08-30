uuid := "window-merge@berk-karaal"
dest := env("HOME") / ".local/share/gnome-shell/extensions" / uuid

# List recipes
default:
    @just --list

# Compile the GSettings schema
schemas:
    glib-compile-schemas --strict {{uuid}}/schemas

# Syntax-check every module
check:
    #!/usr/bin/env bash
    set -euo pipefail
    for f in {{uuid}}/*.js; do
        node --input-type=module --check < "$f" && echo "ok $f"
    done

# Run the unit tests
test:
    gjs -m tests/layout.test.js
    gjs -m tests/group.test.js

# Install into the local extensions directory
install: schemas check
    rm -rf "{{dest}}"
    mkdir -p "{{dest}}"
    cp -r {{uuid}}/. "{{dest}}/"

# Install and run a nested shell for trying changes
nested: install
    dbus-run-session -- gnome-shell --devkit

# Build the extensions.gnome.org upload bundle
zip: schemas
    cd {{uuid}} && zip -r ../{{uuid}}.zip . -x '*.compiled'
