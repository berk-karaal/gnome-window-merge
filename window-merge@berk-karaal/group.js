import {fillRect, clampFrame} from './layout.js';

function sameRect(a, b) {
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export class Group {
    constructor(appId, windows, focused, onChange) {
        this.appId = appId;
        this.windows = [];
        this.active = focused;
        this.workspace = focused.get_workspace();
        this._onChange = onChange;
        this._signals = [];
        this._syncing = false;

        this.frame = this._frameFor(focused);
        for (const w of windows)
            this._attach(w);
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
        this._connect(w, 'notify::fullscreen', () => this._changed());
        this._connect(w, 'notify::title', () => this._changed());
        this._connect(w, 'workspace-changed', () => this._onWorkspace(w));
        this._connect(w, 'focus', () => this.setActive(w));
        this._connect(w, 'unmanaged', () => this.remove(w));
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

    _applyFrame(except = null) {
        const {x, y, width, height} = this.frame;
        this._syncing = true;
        for (const w of this.windows) {
            if (w !== except)
                w.move_resize_frame(false, x, y, width, height);
        }
        this._syncing = false;
    }

    _onGeometry(w) {
        if (this._syncing)
            return;
        const frame = this._frameFor(w);
        if (sameRect(frame, this.frame))
            return;
        this.frame = frame;
        this._applyFrame(w);
        this._changed();
    }

    // A grouped window never stays maximized: the strip needs the band above
    // the frame, so "maximize" becomes "fill the work area below the strip".
    _onMaximize(w) {
        if (this._syncing || !w.is_maximized())
            return;
        this._syncing = true;
        w.unmaximize();
        this._syncing = false;
        this.frame = fillRect(w.get_work_area_current_monitor());
        this._applyFrame();
        this._changed();
    }

    _onWorkspace(w) {
        if (this._syncing)
            return;
        const ws = w.get_workspace();
        if (!ws || ws === this.workspace)
            return;
        this.workspace = ws;
        this._syncing = true;
        for (const other of this.windows) {
            if (other !== w)
                other.change_workspace(ws);
        }
        this._syncing = false;
        this._changed();
    }
}
