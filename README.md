# Window Merge

GNOME Shell 50 extension that brings macOS "Merge All Windows" to GNOME.
Press `Super+M` and every window of the focused app, from every workspace,
becomes a tab in one shared frame on the current workspace, with a tab strip
above the window.

## Shortcuts

| Shortcut | Action |
|---|---|
| `Super+M` | Merge all windows of the focused app, or ungroup if it is already grouped |
| `Super+Shift+M` | Detach the focused tab into a normal window |

Both are editable in the extension preferences.

## Behaviour

- Tabs are equal width and fill the strip; drag a tab sideways to reorder it.
- Click a tab to switch, middle-click a tab to close that window.
- Only the active tab is visible; the others are minimized until selected, so moving and resizing costs nothing extra. Maximizing fills the work area below the strip.
- Merge pulls the app's windows in from every workspace; new windows of the app join the group automatically.
- Alt+Tab and the overview keep showing every window.

## Limitations

- Activating a hidden tab from Alt+Tab, the overview or a notification plays
  GNOME's normal unminimize animation; switching from the tab strip does not.
- Inactive tabs show up as minimized windows in Alt+Tab, the overview and docks.
- One group per app; groups do not survive logging out.

## Install

    make install

Then log out and back in (Wayland) and run `gnome-extensions enable window-merge@berk-karaal`.

## Develop

    make test     # unit tests (gjs)
    make check    # syntax-check all modules
    make nested   # install and run a nested shell for trying changes
    make zip      # build the extensions.gnome.org upload bundle

## Release

CI runs the checks and tests on every push. Pushing a tag
such as `v1.0` runs them again, builds the zip and creates a GitHub Release
with it attached; upload
that zip to https://extensions.gnome.org/upload/ by hand.

## License

GPL-2.0-or-later. See `LICENSE`.
