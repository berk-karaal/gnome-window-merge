# Contributing

Thanks for your interest in Window Merge. This is a small extension with a
deliberately small codebase; contributions that keep it that way are the most
welcome.

## Reporting bugs

Open an issue with:

- GNOME Shell version (`gnome-shell --version`) and distribution
- Steps to reproduce, ideally with a stock app such as Text Editor
- The extension's log lines: `journalctl -f -o cat /usr/bin/gnome-shell`
  while reproducing; for a crash to the login screen, also
  `coredumpctl info gnome-shell`

Crashes to the login screen are almost always a Mutter assertion triggered by
changing window state at the wrong time; the coredump backtrace pinpoints it.

## Proposing changes

Open an issue before starting anything beyond a small fix, so the approach can
be agreed first. Features that add options, alter Alt+Tab or the overview, or
require patching GNOME Shell internals are unlikely to be accepted.

## Development setup

Requirements: GNOME Shell 50 or newer on Wayland, `gjs`, `node` (syntax checking),
[`just`](https://just.systems), and the `mutter-devkit` package for the nested
shell (`sudo dnf install mutter-devkit` on Fedora).

```
just            # list recipes
just check      # syntax-check every module
just test       # unit tests
just nested     # install and open a nested GNOME Shell with the extension
```

Wayland loads extension code once per login, so use `just nested` for
iteration: apps opened from inside the nested shell run there, and a crash only
takes the nested window down. VS Code is single-instance and will open in your
real session; test with Text Editor or Files, or run
`code --user-data-dir /tmp/code-test` from a terminal inside the nested shell.

## Code layout

| File | Responsibility |
|---|---|
| `extension.js` | Keybindings, group registry, merge/ungroup/detach, auto-join of new windows |
| `group.js` | Membership, tab order, the active window, hiding and showing members |
| `tabBar.js` | The tab strip actor: tabs, click/reorder, position and visibility |
| `layout.js` | Pure geometry helpers, unit-tested |
| `prefs.js` | Preferences window |

`group.js` has no GNOME Shell imports. Anything it needs from the Shell is
passed in by `extension.js`, so it can be tested with the fake Mutter in
`tests/fakeMutter.js`.

## Rules of the road

- **Everything set up in `enable()` is undone in `disable()`**: signals
  disconnected, sources removed, actors destroyed, keybindings removed.
  extensions.gnome.org reviewers check this line by line.
- **Never change window state inside a compositor signal.** `first-frame`,
  `shown` and paint hooks fire while a frame is in progress; minimizing,
  raising or resizing there aborts the Shell. Defer to an idle callback.
- **Window state changes made by the group go through the hooks in
  `extension.js`** (`hide`, `show`, `unmaximize`, `unfullscreen`) so the
  Shell's animations are skipped consistently.
- **GNOME Shell 50 and newer are supported; older versions are not.** No
  compatibility branches for anything before 50. Each new GNOME release is
  tested and then added to `shell-version` in `metadata.json` — the Shell
  refuses to load an extension that does not list the running version.
- Add or update a test in `tests/` for any change to `group.js` or
  `layout.js`. The fake window models Wayland's asynchronous geometry, Mutter's
  on-screen constraints and `activate()` semantics; extend it rather than
  working around it.

## Submitting a pull request

1. Keep the change focused; one topic per pull request.
2. `just check` and `just test` pass (CI runs both).
3. Describe what you verified manually and how.
4. Use plain, descriptive commit messages in the imperative mood.

## Releasing

Maintainers tag `vX.Y.Z`; CI builds the zip and attaches it to a GitHub
Release, which is then uploaded to extensions.gnome.org by hand.
