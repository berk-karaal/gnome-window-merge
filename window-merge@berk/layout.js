export const STRIP_HEIGHT = 30;

export function stripRect(frame) {
    return {x: frame.x, y: frame.y - STRIP_HEIGHT, width: frame.width, height: STRIP_HEIGHT};
}

export function slotIndex(pointerX, stripX, stripWidth, count) {
    const raw = Math.floor((pointerX - stripX) / (stripWidth / count));
    return Math.max(0, Math.min(count - 1, raw));
}

export function fillRect(workArea) {
    return {
        x: workArea.x,
        y: workArea.y + STRIP_HEIGHT,
        width: workArea.width,
        height: workArea.height - STRIP_HEIGHT,
    };
}

export function clampFrame(frame, workArea) {
    const minY = workArea.y + STRIP_HEIGHT;
    return {...frame, y: Math.max(frame.y, minY)};
}
