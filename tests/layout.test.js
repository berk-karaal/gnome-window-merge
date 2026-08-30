import {STRIP_HEIGHT, stripRect, slotIndex, fillRect, clampFrame} from '../window-merge@berk/layout.js';

let failed = 0;
function eq(name, got, want) {
    const g = JSON.stringify(got), w = JSON.stringify(want);
    if (g === w) print(`ok   ${name}`);
    else { failed++; print(`FAIL ${name}: got ${g}, want ${w}`); }
}

eq('stripRect sits above frame', stripRect({x: 100, y: 200, width: 640, height: 480}),
    {x: 100, y: 200 - STRIP_HEIGHT, width: 640, height: STRIP_HEIGHT});

eq('slotIndex first', slotIndex(105, 100, 400, 4), 0);
eq('slotIndex middle', slotIndex(250, 100, 400, 4), 1);
eq('slotIndex last', slotIndex(499, 100, 400, 4), 3);
eq('slotIndex clamps left', slotIndex(10, 100, 400, 4), 0);
eq('slotIndex clamps right', slotIndex(900, 100, 400, 4), 3);

eq('fillRect reserves strip', fillRect({x: 0, y: 32, width: 1920, height: 1048}),
    {x: 0, y: 32 + STRIP_HEIGHT, width: 1920, height: 1048 - STRIP_HEIGHT});

eq('clampFrame leaves room', clampFrame({x: 10, y: 500, width: 600, height: 400}, {x: 0, y: 32, width: 1920, height: 1048}),
    {x: 10, y: 500, width: 600, height: 400});
eq('clampFrame pushes down', clampFrame({x: 10, y: 40, width: 600, height: 400}, {x: 0, y: 32, width: 1920, height: 1048}),
    {x: 10, y: 32 + STRIP_HEIGHT, width: 600, height: 400});

if (failed) { print(`${failed} failed`); imports.system.exit(1); }
print('all passed');
