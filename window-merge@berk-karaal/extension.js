import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Group} from './group.js';
import {TabBar} from './tabBar.js';

const DETACH_OFFSET = 48;

// Hide and show members without the minimize animation, so switching tabs
// looks like a tab switch rather than a window animation.
const windowEffects = {
    hide(window) {
        if (window.minimized)
            return;
        Main.wm.skipNextEffect(window.get_compositor_private());
        window.minimize();
    },
    show(window) {
        if (!window.minimized)
            return;
        Main.wm.skipNextEffect(window.get_compositor_private());
        window.unminimize();
    },
};

export default class WindowMergeExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._groups = new Map(); // Group -> TabBar
        this._tracker = Shell.WindowTracker.get_default();

        const modes = Shell.ActionMode.NORMAL;
        Main.wm.addKeybinding('merge-toggle', this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT, modes, () => this._mergeToggle());
        Main.wm.addKeybinding('detach', this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT, modes, () => this._detach());

        this._windowCreatedId = global.display.connect('window-created',
            (_d, window) => this._onWindowCreated(window));
    }

    disable() {
        global.display.disconnect(this._windowCreatedId);
        Main.wm.removeKeybinding('merge-toggle');
        Main.wm.removeKeybinding('detach');
        for (const group of [...this._groups.keys()])
            this._dissolve(group);
        this._groups = null;
        this._tracker = null;
        this._settings = null;
    }

    _appId(window) {
        return this._tracker.get_window_app(window)?.get_id() ?? null;
    }

    _eligible(window) {
        return window.get_window_type() === Meta.WindowType.NORMAL &&
            !window.is_skip_taskbar() &&
            !window.is_attached_dialog();
    }

    _groupOf(window) {
        for (const group of this._groups.keys()) {
            if (group.contains(window))
                return group;
        }
        return null;
    }

    _groupFor(appId) {
        for (const group of this._groups.keys()) {
            if (group.appId === appId)
                return group;
        }
        return null;
    }

    _mergeToggle() {
        const focused = global.display.focus_window;
        if (!focused || !this._eligible(focused))
            return;

        const existing = this._groupOf(focused);
        if (existing) {
            this._dissolve(existing);
            return;
        }

        const appId = this._appId(focused);
        const workspace = focused.get_workspace();
        const windows = global.display.list_all_windows().filter(w =>
            this._eligible(w) && this._appId(w) === appId);
        if (windows.length < 2) {
            Main.notify('Window Merge', 'Only one window of this app is open');
            return;
        }
        for (const w of windows) {
            if (w.get_workspace() !== workspace)
                w.change_workspace(workspace);
        }
        // Focused window first so it is the leftmost tab.
        const ordered = [focused, ...windows.filter(w => w !== focused)];
        this._create(appId, ordered, focused);
        focused.activate(global.get_current_time());
    }

    _detach() {
        const focused = global.display.focus_window;
        const group = focused && this._groupOf(focused);
        if (!group) {
            Main.notify('Window Merge', 'The focused window is not in a group');
            return;
        }
        group.remove(focused);
        const {x, y, width, height} = group.frame;
        focused.move_resize_frame(false, x + DETACH_OFFSET, y + DETACH_OFFSET, width, height);
        if (group.windows.length < 2)
            this._dissolve(group);
        focused.activate(global.get_current_time());
    }

    _onWindowCreated(window) {
        const actor = window.get_compositor_private();
        if (!actor)
            return;
        const id = actor.connect('first-frame', () => {
            actor.disconnect(id);
            if (!this._groups || !this._eligible(window))
                return;
            const group = this._groupFor(this._appId(window));
            if (!group)
                return;
            if (window.get_workspace() !== group.workspace)
                window.change_workspace(group.workspace);
            group.add(window);
        });
    }

    _create(appId, windows, focused) {
        let bar = null;
        const group = new Group(appId, windows, focused, () => {
            if (!bar)
                return;
            if (group.windows.length < 2)
                this._dissolve(group);
            else
                bar.sync();
        }, windowEffects);
        bar = new TabBar(group);
        this._groups.set(group, bar);
    }

    _dissolve(group) {
        const bar = this._groups.get(group);
        if (!bar)
            return;
        this._groups.delete(group);
        bar.destroy();
        group.destroy();
    }
}
