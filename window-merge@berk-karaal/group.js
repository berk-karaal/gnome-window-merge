import {fillRect, clampFrame} from './layout.js';

// Edge tiling maximizes only one axis; either axis pins the window.
function isMaximized(w) {
    return w.maximized_horizontally || w.maximized_vertically;
}

function sameRect(a, b) {
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export class Group {
    constructor(appId, windows, focused, onChange, display) {
        this.appId = appId;
        this.windows = [];
        this.active = focused;
        this.workspace = focused.get_workspace();
        this._onChange = onChange;
        this._signals = [];
        // Window -> rect we asked it to take. Until the window reports that
        // rect, its geometry signals are compositor echoes, not user input.
        this._requested = new Map();
        this._grabbed = null;

        this._connect(display, 'grab-op-begin', (_d, window) => this._onGrabBegin(window));
        this._connect(display, 'grab-op-end', (_d, window) => this._onGrabEnd(window));

        const wasFilling = isMaximized(focused) || focused.is_fullscreen();
        for (const w of windows)
            this._attach(w);
        this.frame = wasFilling
            ? fillRect(focused.get_work_area_current_monitor())
            : this._frameFor(focused);
        this._applyFrame();
        this._changed();
    }

    contains(window) {
        return this.windows.includes(window);
    }

    add(window) {
        this._attach(window);
        this._applyFrame();
        this.setActive(window);
    }

    remove(window) {
        this._detach(window);
        if (this.active === window)
            this.active = this.windows[0] ?? null;
        this._changed();
    }

    setActive(window) {
        this.active = window;
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
        this._requested.clear();
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
        this._normalize(w);
        this._connect(w, 'position-changed', () => this._onGeometry(w));
        this._connect(w, 'size-changed', () => this._onGeometry(w));
        this._connect(w, 'notify::maximized-horizontally', () => this._onMaximize(w));
        this._connect(w, 'notify::maximized-vertically', () => this._onMaximize(w));
        this._connect(w, 'notify::minimized', () => this._changed());
        this._connect(w, 'notify::fullscreen', () => this._onFullscreen(w));
        this._connect(w, 'notify::title', () => this._changed());
        this._connect(w, 'workspace-changed', () => this._onWorkspace(w));
        this._connect(w, 'focus', () => this.setActive(w));
        this._connect(w, 'unmanaged', () => this.remove(w));
    }

    _detach(w) {
        this.windows = this.windows.filter(x => x !== w);
        this._requested.delete(w);
        if (this._grabbed === w)
            this._grabbed = null;
        this._signals = this._signals.filter(([obj, id]) => {
            if (obj !== w)
                return true;
            obj.disconnect(id);
            return false;
        });
    }

    // Grouped windows are never maximized or fullscreen: Mutter would pin them
    // to the whole work area and ignore the frame, leaving no band for the strip.
    _normalize(w) {
        if (w.is_fullscreen())
            w.unmake_fullscreen();
        if (isMaximized(w))
            w.unmaximize();
    }

    _frameFor(w) {
        const r = w.get_frame_rect();
        return clampFrame({x: r.x, y: r.y, width: r.width, height: r.height},
            w.get_work_area_current_monitor());
    }

    _applyFrame(except = null) {
        const {x, y, width, height} = this.frame;
        for (const w of this.windows) {
            if (w === except)
                continue;
            this._requested.set(w, {x, y, width, height});
            w.move_resize_frame(false, x, y, width, height);
        }
    }

    _onGeometry(w) {
        const rect = w.get_frame_rect();
        const requested = this._requested.get(w);
        if (requested) {
            if (!sameRect(rect, requested) && w !== this._grabbed)
                return; // still settling into what we asked for
            this._requested.delete(w);
        }
        // Only the window the user is interacting with drives the group.
        if (w !== this._grabbed && w !== this.active)
            return;
        const frame = this._frameFor(w);
        if (sameRect(frame, this.frame))
            return;
        this.frame = frame;
        this._applyFrame(w);
        this._changed();
    }

    _onGrabBegin(window) {
        if (!this.contains(window))
            return;
        this._grabbed = window;
        this._requested.delete(window);
    }

    _onGrabEnd(window) {
        if (this._grabbed !== window)
            return;
        this._onGeometry(window);
        this._grabbed = null;
    }

    // "Maximize" inside a group means "fill the work area below the strip".
    _onMaximize(w) {
        if (!isMaximized(w))
            return;
        w.unmaximize();
        this._fill(w);
    }

    _onFullscreen(w) {
        if (w.is_fullscreen()) {
            w.unmake_fullscreen();
            this._fill(w);
        }
        this._changed();
    }

    _fill(w) {
        this.frame = fillRect(w.get_work_area_current_monitor());
        this._applyFrame();
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
