// Minimal stand-ins for Meta.Window / Meta.Display with Wayland-like
// asynchronous geometry: requests are queued and applied by flush().

export const WORK_AREA = {x: 0, y: 32, width: 1920, height: 1048};

class Emitter {
    constructor() {
        this._handlers = new Map();
        this._nextId = 1;
    }

    connect(name, cb) {
        const id = this._nextId++;
        this._handlers.set(id, {name, cb});
        return id;
    }

    disconnect(id) {
        this._handlers.delete(id);
    }

    emit(name, ...args) {
        for (const {name: n, cb} of [...this._handlers.values()]) {
            if (n === name)
                cb(this, ...args);
        }
    }

    handlerCount() {
        return this._handlers.size;
    }
}

export class FakeDisplay extends Emitter {}

export class FakeWindow extends Emitter {
    constructor(name, rect, {maximized = false, fullscreen = false, workspace = 'ws0'} = {}) {
        super();
        this.name = name;
        this.rect = maximized || fullscreen ? {...WORK_AREA} : {...rect};
        this._saved = {...rect};
        this._maximized = maximized;
        this._fullscreen = fullscreen;
        this._workspace = workspace;
        this._queue = [];
        this.requests = []; // every move_resize_frame call, in order
        this.minimized = false;
    }

    get_frame_rect() { return {...this.rect}; }
    get_work_area_current_monitor() { return {...WORK_AREA}; }
    get_workspace() { return this._workspace; }
    get maximized_horizontally() { return this._maximized; }
    get maximized_vertically() { return this._maximized; }
    is_maximized() { return this._maximized; }
    is_fullscreen() { return this._fullscreen; }
    get_title() { return this.name; }

    move_resize_frame(userOp, x, y, width, height) {
        this.requests.push({x, y, width, height});
        if (this._maximized || this._fullscreen)
            return; // Mutter's constraints keep the window filling the work area
        if (!userOp) {
            // Mutter keeps non-user placements fully on screen.
            const right = WORK_AREA.x + WORK_AREA.width;
            const bottom = WORK_AREA.y + WORK_AREA.height;
            x = Math.max(WORK_AREA.x, Math.min(x, right - width));
            y = Math.max(WORK_AREA.y, Math.min(y, bottom - height));
        }
        this._queue.push({x, y, width, height});
    }

    unmaximize() {
        if (!this._maximized)
            return;
        this._maximized = false;
        this._queue.push({...this._saved});
        this.emit('notify::maximized-horizontally');
        this.emit('notify::maximized-vertically');
    }

    unmake_fullscreen() {
        if (!this._fullscreen)
            return;
        this._fullscreen = false;
        this._queue.push({...this._saved});
        this.emit('notify::fullscreen');
    }

    change_workspace(ws) {
        this._workspace = ws;
        this.emit('workspace-changed');
    }

    // The compositor acks one pending configure, oldest first.
    flush() {
        if (this._queue.length === 0)
            return false;
        this._setRect(this._queue.shift());
        return true;
    }

    // The user drags: geometry changes immediately, as during a grab op.
    userSetRect(rect) {
        this._setRect(rect);
    }

    _setRect(next) {
        const prev = this.rect;
        this.rect = {...next};
        if (prev.x !== next.x || prev.y !== next.y)
            this.emit('position-changed');
        if (prev.width !== next.width || prev.height !== next.height)
            this.emit('size-changed');
    }
}

export function flushAll(windows) {
    let any;
    do {
        any = false;
        for (const w of windows)
            any = w.flush() || any;
    } while (any);
}
