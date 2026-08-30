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
- Click a tab to switch, middle-click or use the × to close that window.
- Moving, resizing or maximizing one member applies to the whole group.
- Merge pulls the app's windows in from every workspace; new windows of the app join the group automatically.
- Alt+Tab and the overview keep showing every window.

## Install

    make install

Then log out and back in (Wayland) and run `gnome-extensions enable window-merge@berk-karaal`.

## Develop

    make test     # unit tests for layout.js
    make check    # syntax-check all modules
    make nested   # install and run a nested shell for trying changes
