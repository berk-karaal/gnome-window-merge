import {Group} from '../window-merge@berk-karaal/group.js';
import {fillRect} from '../window-merge@berk-karaal/layout.js';
import {FakeWindow, FakeDisplay, WORK_AREA, flushAll} from './fakeMutter.js';

let failed = 0;
function check(name, ok, detail = '') {
    if (ok) print(`ok   ${name}`);
    else { failed++; print(`FAIL ${name} ${detail}`); }
}
const same = (a, b) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
const R = (x, y, width, height) => ({x, y, width, height});

function makeGroup(windows, focused = windows[0]) {
    const display = new FakeDisplay();
    const group = new Group('code.desktop', windows, focused, () => {}, display);
    return {group, display};
}

// 1. Merging maximized windows un-maximizes them and fills the work area below the strip.
{
    const a = new FakeWindow('a', R(10, 60, 800, 600), {maximized: true});
    const b = new FakeWindow('b', R(30, 90, 700, 500), {maximized: true});
    const {group} = makeGroup([a, b]);
    flushAll([a, b]);
    const want = fillRect(WORK_AREA);
    check('merge: no member stays maximized', !a.is_maximized() && !b.is_maximized());
    check('merge: members fill below strip', same(a.rect, want) && same(b.rect, want),
        JSON.stringify([a.rect, b.rect]));
    check('merge: group frame is fill rect', same(group.frame, want));
    group.destroy();
}

// 2. Async echoes from other members never push geometry back onto the window being resized.
{
    const a = new FakeWindow('a', R(100, 100, 800, 600));
    const b = new FakeWindow('b', R(300, 300, 500, 400));
    const c = new FakeWindow('c', R(500, 500, 400, 300));
    const {group, display} = makeGroup([a, b, c]);
    flushAll([a, b, c]);
    a.requests.length = 0;

    display.emit('grab-op-begin', a, 'resize');
    a.userSetRect(R(100, 100, 820, 600));   // frame 1 of the drag
    a.userSetRect(R(100, 100, 860, 600));   // frame 2: the user keeps dragging...
    b.flush();                              // ...and only now does b ack frame 1
    flushAll([a, b, c]);
    display.emit('grab-op-end', a, 'resize');
    flushAll([a, b, c]);

    check('resize: dragged window is never resized by the group', a.requests.length === 0,
        JSON.stringify(a.requests));
    check('resize: followers end at the final size',
        same(b.rect, a.rect) && same(c.rect, a.rect), JSON.stringify([a.rect, b.rect, c.rect]));
    group.destroy();
}

// 3. After "maximize" inside a group, dragging the active window moves the whole group.
{
    const a = new FakeWindow('a', R(100, 100, 800, 600));
    const b = new FakeWindow('b', R(300, 300, 500, 400));
    const {group, display} = makeGroup([a, b]);
    flushAll([a, b]);

    a._maximized = true; a.rect = {...WORK_AREA}; // user double-clicks the title bar
    a.emit('notify::maximized-horizontally');
    flushAll([a, b]);
    check('maximize: no member is maximized afterwards', !a.is_maximized() && !b.is_maximized());

    display.emit('grab-op-begin', a, 'move');
    a.userSetRect({...a.rect, x: a.rect.x + 200, y: a.rect.y + 100});
    display.emit('grab-op-end', a, 'move');
    flushAll([a, b]);
    check('move: follower moved with the dragged window', same(a.rect, b.rect),
        JSON.stringify([a.rect, b.rect]));
    group.destroy();
}

// 4. A full-width group dragged partly off screen keeps its followers with it.
{
    const a = new FakeWindow('a', R(0, 62, 1920, 1018));
    const b = new FakeWindow('b', R(0, 62, 1920, 1018));
    const {group, display} = makeGroup([a, b]);
    flushAll([a, b]);
    display.emit('grab-op-begin', a, 'move');
    a.userSetRect(R(380, 300, 1920, 1018));
    display.emit('grab-op-end', a, 'move');
    flushAll([a, b]);
    check('offscreen move: follower is not clamped back', same(a.rect, b.rect),
        JSON.stringify([a.rect, b.rect]));
    group.destroy();
}

// 5. Cleanup disconnects everything.
{
    const a = new FakeWindow('a', R(0, 100, 10, 10));
    const b = new FakeWindow('b', R(0, 100, 10, 10));
    const {group, display} = makeGroup([a, b]);
    group.destroy();
    check('destroy: no handlers left', a.handlerCount() + b.handlerCount() + display.handlerCount() === 0);
}

if (failed) { print(`${failed} failed`); imports.system.exit(1); }
print('all passed');
