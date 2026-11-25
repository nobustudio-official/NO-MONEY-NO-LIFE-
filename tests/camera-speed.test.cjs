const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = file => fs.readFileSync(require.resolve('../' + file), 'utf8');

function runtime() {
    let now = 0, sequence = 0;
    const frames = new Map(), animations = [];
    const classes = new Set();
    const area = new EventTarget();
    Object.assign(area, { isConnected: true, scrollLeft: 0, scrollTop: 0,
        scrollWidth: 20000, scrollHeight: 20000, clientWidth: 100, clientHeight: 100,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
        scrollTo(options) { this.scrollLeft = options.left; this.scrollTop = options.top; }
    });
    const node = { isConnected: true, offsetWidth: 100, offsetHeight: 100, x: 5000,
        getBoundingClientRect: () => ({ left: node.x - area.scrollLeft, top: -area.scrollTop, width: 100, height: 100 }) };
    const piece = { isConnected: true,
        classList: { add: key => classes.add(key), remove: key => classes.delete(key) },
        closest: () => node, getBoundingClientRect: node.getBoundingClientRect,
        animate(_, options) {
            let resolve, reject;
            const animation = { currentTime: 0, duration: options.duration, done: false,
                paused: false, pause() { this.paused = true; }, play() { this.paused = false; },
                finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
                cancel() { if (!this.done) { this.done = true; reject(Error('cancelled')); } },
                advance(delta) { if (this.done || this.paused) return; this.currentTime += delta; if (this.currentTime >= this.duration) { this.done = true; resolve(); } }
            };
            animations.push(animation); return animation;
        }
    };
    const board = { isConnected: true, querySelector: () => piece };
    area.querySelector = () => node;
    const context = { console, AbortController, performance: { now: () => now }, players: [{ position: 1 }], avatarCameraFocus: null,
        requestAnimationFrame(callback) { const id = ++sequence; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        document: { querySelector: () => area, getElementById: () => board },
        MapScene: { getCameraLimits: () => ({ minLeft: 0, maxLeft: 19900, minTop: 0, maxTop: 19900 }) }
    };
    context.window = context; vm.createContext(context);
    const run = source => vm.runInContext(source, context);
    run(read('map-movement-presentation.js'));
    const game = read('game.js');
    run(game.slice(game.indexOf('const MAP_TAP_CAMERA_SPEED'), game.indexOf('function focusCurrentPlayerFromAvatar()')));
    run(game.slice(game.indexOf('function centerPlayerOnMap('), game.indexOf('// 指定プレイヤー用のカメラ移動関数を公開')));
    run('window.centerPlayerOnMap = centerPlayerOnMap;');
    run(game.slice(game.indexOf('function centerOnWarpPlayer('), game.indexOf('async function playWarpMotion(')));
    return { context, area, board, node, piece, animations, run,
        get pendingFrames() { return frames.size; },
        get now() { return now; },
        async step(delta = 16, visible = true) {
            const before = [area.scrollLeft, area.scrollTop]; now += delta;
            animations.forEach(animation => animation.advance(delta));
            const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now));
            await new Promise(resolve => setImmediate(resolve));
            const distance = Math.hypot(area.scrollLeft - before[0], area.scrollTop - before[1]);
            if (visible) assert.ok(distance <= 1200 * Math.min(delta, 32) / 1000 + .001, 'camera exceeded boss-icon speed');
        },
        async until(predicate) { for (let i = 0; i < 1000; i++) { if (predicate()) return; await this.step(); } throw Error('camera did not finish'); }
    };
}

test('reachable-square movement is halfway between normal and the former 2x speed', () => {
    const { context } = runtime(), movement = context.MapMovementPresentation;
    const normal = movement.durationForDistance(200), fast = movement.durationForDistance(200, 2);
    assert.equal(normal, 280);
    assert.ok(Math.abs(200 / fast - (200 / normal + 200 / 140) / 2) < 1e-9);
    assert.equal(movement.durationForDistance(400, 2), fast * 2);
});

test('a paused camera parks its frame loop and resumes without a jump', async () => {
    const f = runtime(); let resizing = false, resume, done = false;
    f.context.MapScene.isViewportResizing = () => resizing;
    f.context.MapScene.whenViewportStable = () => new Promise(resolve => { resume = resolve; });
    f.context.panMapCameraTo(f.area, 1200, 0).then(() => { done = true; });
    await f.step(); resizing = true; await f.step();
    const left = f.area.scrollLeft;
    assert.equal(f.pendingFrames, 0);
    await f.step(1000); assert.equal(f.area.scrollLeft, left); assert.equal(done, false);
    resizing = false; resume(true); await Promise.resolve();
    await f.step(); assert.equal(f.area.scrollLeft, left);
    await f.until(() => done); assert.equal(f.area.scrollLeft, 1200);
});

test('cancelling a paused camera cannot restart its old animation on rotation back', async () => {
    const f = runtime(); let resume;
    f.context.MapScene.isViewportResizing = () => true;
    f.context.MapScene.whenViewportStable = () => new Promise(resolve => { resume = resolve; });
    const done = f.context.panMapCameraTo(f.area, 1200, 0);
    await f.step(); f.context.cancelMapCameraScroll(); resume(true); await Promise.resolve();
    assert.equal(await done, false); assert.equal(f.pendingFrames, 0);
});

test('player movement pauses its animation clock and camera until the viewport is ready', async () => {
    const f = runtime(); let resizing = false, resume, done = false;
    f.context.MapScene.isViewportResizing = () => resizing;
    f.context.MapScene.whenViewportStable = () => new Promise(resolve => { resume = resolve; });
    f.node.style = { left: '5000px', top: '0px' };
    f.context.MapMovementPresentation.play(f.board, 0, { left: 4800, top: 0, worldX: 4800, worldY: 0, squareId: 0 })
        .then(() => { done = true; });
    await f.step(); resizing = true; await f.step();
    const time = f.animations[0].currentTime, left = f.area.scrollLeft;
    assert.equal(f.animations[0].paused, true); assert.equal(f.pendingFrames, 0);
    await f.step(1000); assert.equal(f.animations[0].currentTime, time); assert.equal(f.area.scrollLeft, left);
    resizing = false; resume(true); await Promise.resolve();
    await f.until(() => done);
    assert.equal(f.context.MapMovementPresentation.isMoving(f.board), false);
});
test('automatic pans clamp faster requests to the boss-icon speed and retain slower requests', async () => {
    for (const [requested, expected] of [[9999, 1200], [600, 600]]) {
        const f = runtime();
        let done = false;
        f.context.panMapCameraTo(f.area, 1200, 0, requested).then(() => { done = true; });
        await f.step(); assert.ok(Math.abs(f.area.scrollLeft - expected * .016) < .001);
        while (f.now < 704) await f.step();
        assert.equal(done, false); assert.ok(f.area.scrollLeft < 1200);
        await f.until(() => done); assert.equal(f.area.scrollLeft, 1200);
        assert.ok(f.now >= 1200 / expected * 1000);
    }
});
test('resuming after a delayed frame does not jump through the missed camera distance', async () => {
    const f = runtime(); f.context.panMapCameraTo(f.area, 1200, 0);
    await f.step(1000); assert.ok(f.area.scrollLeft <= 38.401);
    f.context.cancelMapCameraScroll();
});
test('default player focus waits for the complete capped pan without the old 700ms snap', async () => {
    const f = runtime(); let calls = 0;
    f.context.centerPlayerOnMap(0, 'smooth', () => calls++);
    while (f.now < 912) await f.step();
    assert.equal(calls, 0); assert.ok(f.area.scrollLeft < f.node.x);
    await f.until(() => calls === 1); assert.equal(f.area.scrollLeft, f.node.x);
    assert.ok(f.now >= 5000 / 1200 * 1000);
});
test('warp choreography waits for arrival and settles when a pan is cancelled', async () => {
    const f = runtime(); let done = false;
    f.run('centerOnWarpPlayer(0)').then(() => { done = true; });
    while (f.now < 912) await f.step();
    assert.equal(done, false);
    await f.until(() => done); assert.equal(f.area.scrollLeft, f.node.x);
    f.node.x = 10000; done = false;
    f.run('centerOnWarpPlayer(0)').then(() => { done = true; });
    await f.step(); f.context.cancelMapCameraScroll();
    await f.until(() => done);
});
test('dark handoff positioning remains instant and stops a previous visible pan', async () => {
    const f = runtime(); let oldFinished, calls = 0;
    f.context.panMapCameraTo(f.area, 10000, 0).then(result => { oldFinished = result; });
    f.context.centerPlayerOnMap(0, 'instant', () => calls++);
    // This intentional hidden placement is exempt from the visible-pan assertion.
    await f.step(16, false);
    assert.equal(f.area.scrollLeft, f.node.x); assert.equal(calls, 1); assert.equal(oldFinished, false);
});
test('movement camera catches up at the cap instead of snapping when the sprite finishes', async () => {
    const f = runtime(); let done = false;
    const before = { left: 4800, top: 0, worldX: 4800, worldY: 0, squareId: 0 };
    f.node.style = { left: '5000px', top: '0px' };
    f.context.MapMovementPresentation.play(f.board, 0, before, 2).then(() => { done = true; });
    assert.ok(Math.abs(f.animations[0].duration - 280 / 1.5) < .001);
    while (f.now < 208) await f.step();
    assert.equal(done, false); assert.ok(f.area.scrollLeft < 5000);
    await f.until(() => done); assert.equal(f.area.scrollLeft, 5000);
    assert.equal(f.context.MapMovementPresentation.isMoving(f.board), false);
});
