import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {stripRect, slotIndex} from './layout.js';

const DRAG_THRESHOLD = 5;

export class TabBar {
    constructor(group) {
        this._group = group;
        this._actor = new St.BoxLayout({style_class: 'window-merge-strip', reactive: true});
        global.window_group.add_child(this._actor);

        this._signals = [
            [Main.overview, Main.overview.connect('showing', () => this._updateVisibility())],
            [Main.overview, Main.overview.connect('hidden', () => this._updateVisibility())],
            [global.workspace_manager, global.workspace_manager.connect('active-workspace-changed', () => this._updateVisibility())],
            [global.display, global.display.connect('restacked', () => this._restack())],
        ];
        this.sync();
    }

    sync() {
        this._actor.destroy_all_children();
        for (const w of this._group.windows)
            this._actor.add_child(this._makeTab(w));
        const r = stripRect(this._group.frame);
        this._actor.set_position(r.x, r.y);
        this._actor.set_size(r.width, r.height);
        this._restack();
        this._updateVisibility();
    }

    destroy() {
        for (const [obj, id] of this._signals)
            obj.disconnect(id);
        this._signals = [];
        this._actor.destroy();
        this._actor = null;
    }

    _restack() {
        const actor = this._group.active?.get_compositor_private();
        if (actor && this._actor && actor.get_parent() === global.window_group)
            global.window_group.set_child_above_sibling(this._actor, actor);
    }

    _updateVisibility() {
        const g = this._group;
        const active = g.active;
        const visible = active &&
            !Main.overview.visible &&
            g.workspace === global.workspace_manager.get_active_workspace() &&
            !active.is_fullscreen() &&
            !active.minimized;
        this._actor.visible = Boolean(visible);
    }

    _makeTab(window) {
        const tab = new St.BoxLayout({
            style_class: 'window-merge-tab',
            reactive: true,
            track_hover: true,
            x_expand: true,
            y_expand: true,
        });
        if (window === this._group.active)
            tab.add_style_pseudo_class('active');

        const app = Shell.WindowTracker.get_default().get_window_app(window);
        const icon = app ? app.create_icon_texture(14) : new St.Icon({icon_name: 'window-new-symbolic', icon_size: 14});
        icon.y_align = Clutter.ActorAlign.CENTER;

        const label = new St.Label({
            text: window.get_title() ?? '',
            style_class: 'window-merge-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        label.clutter_text.ellipsize = Pango.EllipsizeMode.END;

        const center = new St.BoxLayout({
            style_class: 'window-merge-center',
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        center.add_child(icon);
        center.add_child(label);
        tab.add_child(center);

        tab.connect('button-press-event', (_a, event) => this._onPress(window, event));
        return tab;
    }

    _onPress(window, event) {
        const button = event.get_button();
        if (button === Clutter.BUTTON_MIDDLE) {
            window.delete(event.get_time());
            return Clutter.EVENT_STOP;
        }
        if (button !== Clutter.BUTTON_PRIMARY)
            return Clutter.EVENT_PROPAGATE;

        const [startX] = event.get_coords();
        let dragging = false;
        const grab = global.stage.grab(this._actor);
        const motionId = this._actor.connect('motion-event', (_a, ev) => {
            const [x] = ev.get_coords();
            if (!dragging && Math.abs(x - startX) < DRAG_THRESHOLD)
                return Clutter.EVENT_STOP;
            dragging = true;
            const [ax] = this._actor.get_transformed_position();
            const index = slotIndex(x, ax, this._actor.width, this._group.windows.length);
            this._group.move(window, index);
            return Clutter.EVENT_STOP;
        });
        const releaseId = this._actor.connect('button-release-event', () => {
            this._actor.disconnect(motionId);
            this._actor.disconnect(releaseId);
            grab.dismiss();
            if (!dragging)
                this._group.activate(window);
            return Clutter.EVENT_STOP;
        });
        return Clutter.EVENT_STOP;
    }
}
