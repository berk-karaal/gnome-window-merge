import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class WindowMergeExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        const modes = Shell.ActionMode.NORMAL;
        Main.wm.addKeybinding('merge-toggle', this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT, modes, () => this._mergeToggle());
        Main.wm.addKeybinding('detach', this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT, modes, () => this._detach());
    }

    disable() {
        Main.wm.removeKeybinding('merge-toggle');
        Main.wm.removeKeybinding('detach');
        this._settings = null;
    }

    _mergeToggle() {
        Main.notify('Window Merge', 'merge-toggle pressed');
    }

    _detach() {
        Main.notify('Window Merge', 'detach pressed');
    }
}
