import {Group} from '../window-merge@berk-karaal/group.js';
import {fillRect} from '../window-merge@berk-karaal/layout.js';
import {FakeWindow, WORK_AREA, flushAll} from './fakeMutter.js';

globalThis.global = {get_current_time: () => 0};

let failed = 0;
function check(name, ok, detail = '') {
    if (ok) print(`ok   ${name}`);
    else { failed++; print(`FAIL ${name} ${detail}`); }
}
const same = (a, b) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
const R = (x, y, width, height) => ({x, y, width, height});
const wm = {
    hide: w => w.minimize(),
    show: w => w.unminimize(),
    unmaximize: w => w.unmaximize(),
    unfullscreen: w => w.unmake_fullscreen(),
};
const makeGroup = (windows, focused = windows[0]) =>
    new Group('code.desktop', windows, focused, () => {}, wm);

// 1. Merging shows the focused window at its frame and hides the rest.
{
    const a = new FakeWindow('a', R(100, 100, 800, 600));
    const b = new FakeWindow('b', R(300, 300, 500, 400));
    const c = new FakeWindow('c', R(500, 500, 400, 300));
    const group = makeGroup([a, b, c]);
    flushAll([a, b, c]);
    check('merge: active stays visible and untouched', !a.minimized && a.requests.length === 0);
    check('merge: followers are hidden', b.minimized && c.minimized);
    check('merge: followers are not resized while hidden', b.requests.length === 0 && c.requests.length === 0);
    group.destroy();
}

// 2. Merging maximized windows un-maximizes the active one into the fill frame.
{
    const a = new FakeWindow('a', R(10, 60, 800, 600), {maximized: true});
    const b = new FakeWindow('b', R(30, 90, 700, 500), {maximized: true});
    const group = makeGroup([a, b]);
    flushAll([a, b]);
    const want = fillRect(WORK_AREA);
    check('maximized merge: active fills below the strip', !a.is_maximized() && same(a.rect, want),
        JSON.stringify(a.rect));
    check('maximized merge: frame is the fill rect', same(group.frame, want));
    group.destroy();
}

// 3. Dragging the active window never touches the hidden followers.
{
    const a = new FakeWindow('a', R(100, 100, 800, 600));
    const b = new FakeWindow('b', R(300, 300, 500, 400));
    const group = makeGroup([a, b]);
    a.userSetRect(R(100, 100, 820, 600));
    a.userSetRect(R(380, 300, 860, 600));
    check('drag: follower gets no requests', b.requests.length === 0);
    check('drag: frame follows the active window', same(group.frame, a.rect));
    group.destroy();
}

// 4. Activating a hidden tab shows it exactly once at the current frame and hides the old one.
{
    const a = new FakeWindow('a', R(100, 100, 800, 600));
    const b = new FakeWindow('b', R(0, 62, 1920, 1018), {maximized: true});
    const group = makeGroup([a, b]);
    a.userSetRect(R(380, 300, 860, 600));
    b.activate(0);
    flushAll([a, b]);
    check('switch: new tab shown and un-maximized', !b.minimized && !b.is_maximized());
    check('switch: new tab placed at the frame once', b.requests.length === 1 && same(b.rect, a.rect),
        JSON.stringify([b.requests, b.rect, a.rect]));
    check('switch: old tab hidden', a.minimized);
    check('switch: active updated', group.active === b);
    group.destroy();
}

// 5. Closing the active tab reveals its neighbour.
{
    const a = new FakeWindow('a', R(100, 100, 800, 600));
    const b = new FakeWindow('b', R(300, 300, 500, 400));
    const c = new FakeWindow('c', R(500, 500, 400, 300));
    const group = makeGroup([b, a, c], a);
    a.emit('unmanaged');
    flushAll([b, c]);
    check('close active: next tab becomes active and visible', group.active === c && !c.minimized && same(c.rect, group.frame),
        JSON.stringify([group.active?.name, c.rect, group.frame]));
    check('close active: other tab stays hidden', b.minimized);
    group.destroy();
}

// 6. Detaching and dissolving leave every window visible and disconnected.
{
    const a = new FakeWindow('a', R(100, 100, 800, 600));
    const b = new FakeWindow('b', R(300, 300, 500, 400));
    const c = new FakeWindow('c', R(500, 500, 400, 300));
    const group = makeGroup([a, b, c]);
    group.remove(b);
    check('detach: removed window is visible', !b.minimized && !group.contains(b));
    group.destroy();
    check('destroy: all visible', !a.minimized && !c.minimized);
    check('destroy: no handlers left', a.handlerCount() + b.handlerCount() + c.handlerCount() === 0);
}

if (failed) { print(`${failed} failed`); imports.system.exit(1); }
print('all passed');
