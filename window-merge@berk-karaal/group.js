import {fillRect, clampFrame} from './layout.js';

// Edge tiling maximizes only one axis; either axis pins the window.
function isMaximized(w) {
    return w.maximized_horizontally || w.maximized_vertically;
}

function sameRect(a, b) {
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

// Only the active member is visible; the others stay minimized until their
// tab is activated, so nothing has to follow the active window's geometry.
export class Group {
    constructor(appId, windows, focused, onChange, wm) {
        this.appId = appId;
        this.windows = [];
        this.active = focused;
        this.workspace = focused.get_workspace();
        this._onChange = onChange;
        this._wm = wm;
        this._signals = [];

        this.frame = isMaximized(focused) || focused.is_fullscreen()
            ? fillRect(focused.get_work_area_current_monitor())
            : this._frameFor(focused);
        for (const w of windows)
            this._attach(w);
        this._show(focused);
        for (const w of this.windows) {
            if (w !== focused)
                this._wm.hide(w);
        }
        this._changed();
    }

    contains(window) {
        return this.windows.includes(window);
    }

    add(window) {
        this._attach(window);
        this._activate(window);
        window.activate(global.get_current_time());
    }

    // Take a window out of the group, leaving it visible where the group was.
    remove(window) {
        this._detach(window);
        this._show(window);
        if (this.active === window)
            this._activateNext(0);
        this._changed();
    }

    move(window, index) {
        const from = this.windows.indexOf(window);
        if (from < 0 || from === index)
            return;
        this.windows.splice(from, 1);
        this.windows.splice(index, 0, window);
        this._changed();
    }

    destroy() {
        for (const [obj, id] of this._signals)
            obj.disconnect(id);
        this._signals = [];
        for (const w of this.windows)
            this._wm.show(w);
        this.windows = [];
        this._onChange = null;
    }

    _changed() {
        this._onChange?.();
    }

    _connect(obj, name, cb) {
        this._signals.push([obj, obj.connect(name, cb)]);
    }

    _attach(w) {
        this.windows.push(w);
        this._connect(w, 'position-changed', () => this._onGeometry(w));
        this._connect(w, 'size-changed', () => this._onGeometry(w));
        this._connect(w, 'notify::maximized-horizontally', () => this._onMaximize(w));
        this._connect(w, 'notify::maximized-vertically', () => this._onMaximize(w));
        this._connect(w, 'notify::minimized', () => this._changed());
        this._connect(w, 'notify::fullscreen', () => this._onFullscreen(w));
        this._connect(w, 'notify::title', () => this._changed());
        this._connect(w, 'workspace-changed', () => this._onWorkspace(w));
        this._connect(w, 'focus', () => this._activate(w));
        this._connect(w, 'unmanaged', () => this._onUnmanaged(w));
    }

    _detach(w) {
        this.windows = this.windows.filter(x => x !== w);
        this._signals = this._signals.filter(([obj, id]) => {
            if (obj !== w)
                return true;
            obj.disconnect(id);
            return false;
        });
    }

    _frameFor(w) {
        const r = w.get_frame_rect();
        return clampFrame({x: r.x, y: r.y, width: r.width, height: r.height},
            w.get_work_area_current_monitor());
    }

    // Make a window visible at the group frame. Grouped windows are never
    // maximized or fullscreen: Mutter would pin them to the whole work area
    // and leave no band for the strip.
    _show(w) {
        if (w.is_fullscreen())
            this._wm.unfullscreen(w);
        if (isMaximized(w))
            this._wm.unmaximize(w);
        this._wm.show(w);
        const {x, y, width, height} = this.frame;
        if (!sameRect(w.get_frame_rect(), this.frame))
            w.move_resize_frame(true, x, y, width, height);
    }

    _activate(w) {
        if (w === this.active)
            return;
        const previous = this.active;
        this.active = w;
        this._show(w);
        if (previous && this.contains(previous))
            this._wm.hide(previous);
        this._changed();
    }

    _activateNext(index) {
        const next = this.windows[Math.min(index, this.windows.length - 1)];
        this.active = null;
        if (!next)
            return;
        this._activate(next);
        next.activate(global.get_current_time());
    }

    _onUnmanaged(w) {
        const index = this.windows.indexOf(w);
        this._detach(w);
        if (this.active === w)
            this._activateNext(index);
        this._changed();
    }

    _onGeometry(w) {
        if (w !== this.active)
            return;
        const frame = this._frameFor(w);
        if (sameRect(frame, this.frame))
            return;
        this.frame = frame;
        this._changed();
    }

    // "Maximize" inside a group means "fill the work area below the strip".
    _onMaximize(w) {
        if (w !== this.active || !isMaximized(w))
            return;
        w.unmaximize();
        this._fill(w);
    }

    _onFullscreen(w) {
        if (w === this.active && w.is_fullscreen()) {
            w.unmake_fullscreen();
            this._fill(w);
        }
        this._changed();
    }

    _fill(w) {
        this.frame = fillRect(w.get_work_area_current_monitor());
        const {x, y, width, height} = this.frame;
        w.move_resize_frame(true, x, y, width, height);
        this._changed();
    }

    _onWorkspace(w) {
        const ws = w.get_workspace();
        if (!ws || ws === this.workspace)
            return;
        this.workspace = ws;
        for (const other of this.windows) {
            if (other !== w)
                other.change_workspace(ws);
        }
        this._changed();
    }
}
