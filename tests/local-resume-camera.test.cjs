const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const game = fs.readFileSync(require.resolve('../game.js'), 'utf8');
const initialView = game.slice(game.indexOf('// Fresh games keep their opening.'),
    game.indexOf('renderPlayers();', game.indexOf('// Fresh games keep their opening.')));
const finishView = game.slice(game.indexOf('const finishInitialLocalView = async function () {'),
    game.indexOf('// Logical state is restored above.'));

function recovery(camera = { zoom: .6, left: 8000, top: 6000 }, phase = 'ready') {
    const events = [], container = { inert: true };
    let settle, failed, zoom = .8;
    const stable = new Promise(resolve => { settle = resolve; });
    const area = { scrollLeft: 0, scrollTop: 0, scrollTo(position) {
        this.scrollLeft = position.left; this.scrollTop = position.top;
        events.push('camera');
    } };
    const board = { closest: () => area };
    const context = { gameContainer: container, localResume: { camera, step: { phase } },
        players: [{}], currentPlayer: 0, document: { getElementById: () => board },
        renderMap(options) {
            events.push({ render: true, options, zoom, left: area.scrollLeft, top: area.scrollTop });
            assert.equal(options.preserveCamera, true, 'recovery must not queue the initial pan');
        },
        resumeLocalStep: () => events.push('step'), resumeResolve: () => events.push('resolved'),
        resumeReject: error => { failed = error; },
        centerCurrentPlayerOnMap: () => events.push('initial-center'),
        centerPlayerOnMap(index, behavior, done) { events.push('fallback-center:' + behavior); done(); }
    };
    context.window = { MapScene: { whenViewportStable: () => stable, clampScroll: () => events.push('clamp') },
        setMapZoomUI(value) { zoom = value; events.push('zoom'); },
        resetMapZoomUI() { zoom = .8; events.push('reset'); },
        cancelMapCameraScroll: () => events.push('cancel-pan'),
        MapAreaAudio: { updateForPlayer: () => events.push('audio') } };
    vm.createContext(context);
    vm.runInContext(initialView + finishView + '\nthis.finish = finishInitialLocalView;', context);
    return { context, events, container, area, settle, get failed() { return failed; } };
}

test('recovery renders once at the saved camera, after the viewport settles', async () => {
    const run = recovery();
    assert.deepEqual(run.events, ['zoom'], 'only zoom and size observers initialize before the stable viewport');
    const finished = run.context.finish();
    await Promise.resolve();
    assert.deepEqual(run.events, ['zoom']);
    run.settle(true);
    await finished;
    assert.deepEqual(run.events.filter(event => typeof event === 'string'),
        ['zoom', 'cancel-pan', 'zoom', 'camera', 'clamp', 'step', 'audio', 'resolved']);
    const rendered = run.events.find(event => event.render);
    assert.equal(rendered.zoom, .6);
    assert.equal(rendered.left, 8000);
    assert.equal(rendered.top, 6000);
    assert.ok(run.events.indexOf(rendered) < run.events.indexOf('step'));
    assert.equal(run.container.inert, false);
});

test('old saves without a camera center once without animation before restoring the screen', async () => {
    const run = recovery(null);
    const finished = run.context.finish(); run.settle(true); await finished;
    assert.equal(run.events.filter(event => event === 'fallback-center:auto').length, 1);
    assert.ok(run.events.indexOf('fallback-center:auto') < run.events.indexOf('step'));
    assert.ok(!run.events.includes('initial-center'));
    assert.equal(run.container.inert, false);
});

test('a replaced board cancels recovery without rendering or starting an old camera request', async () => {
    const run = recovery();
    const finished = run.context.finish(); run.settle(false); await finished;
    assert.deepEqual(run.events, ['zoom', 'resolved']);
    assert.equal(run.container.inert, false);
});

test('a rendering failure unlocks the screen and reaches the existing recovery error handler', async () => {
    const run = recovery(), error = new Error('render failed');
    run.context.renderMap = () => { throw error; };
    const finished = run.context.finish(); run.settle(true); await finished;
    assert.equal(run.failed, error);
    assert.equal(run.container.inert, false);
    assert.ok(!run.events.includes('resolved'));
});

test('ending recovery keeps its screen transition and does not restart map audio', async () => {
    const run = recovery(undefined, 'ending');
    const finished = run.context.finish(); run.settle(true); await finished;
    assert.ok(run.events.includes('step'));
    assert.ok(run.events.includes('resolved'));
    assert.ok(!run.events.includes('audio'));
});

test('fresh games keep their original zoom reset and camera centering', async () => {
    const run = recovery(); run.context.localResume = null;
    run.events.length = 0;
    run.context.renderMap = () => run.events.push('new-map');
    vm.runInContext(initialView, run.context);
    await run.context.finish();
    assert.deepEqual(run.events, ['reset', 'new-map', 'initial-center']);
});

test('camera autosave ignores the temporary board while recovery locks the container', () => {
    const container = { inert: true }, saved = [], timers = new Map(); let sequence = 0;
    const area = { scrollLeft: 8000, scrollTop: 6000, addEventListener() {} };
    const context = { console,
        LocalMatchSave: { indexedDBStore: () => ({}), controller: () => ({ start() {}, camera: value => saved.push(value) }) },
        document: { querySelector: selector => selector === '.game-container' ? container : area, addEventListener() {} },
        clearTimeout: id => timers.delete(id) };
    context.window = { getMapZoomUI: () => .6, addEventListener() {},
        setTimeout(callback) { const id = ++sequence; timers.set(id, callback); return id; } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../local-match-recovery.js'), 'utf8'), context);
    const session = context.window.LocalMatchRecovery.attach({ capture: () => ({}) });
    const flush = () => { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } };
    session.cameraChanged(); flush(); assert.equal(saved.length, 0);
    container.inert = false;
    session.cameraChanged(); flush();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].left, 8000); assert.equal(saved[0].top, 6000); assert.equal(saved[0].zoom, .6);
});

function viewportRuntime() {
    let clock = 0, sequence = 0, currentBoard, width = 852, height = 393, areaPresent = true;
    const timers = new Map(), frames = new Map(), applied = [];
    const area = { get clientWidth() { return width; }, get clientHeight() { return height; } };
    const board = { isConnected: true, closest: () => area }; currentBoard = board;
    const window = { MapContinentData: { grassTexture: 'grass.webp' }, MapRegionBackground: { assetUrls: [] },
        addEventListener() {}, getMapZoomUI: () => .8, setMapZoomUI: zoom => applied.push(zoom) };
    const context = { window, document: { documentElement: { style: { setProperty() {} } },
        getElementById: () => currentBoard, querySelector: () => areaPresent ? area : null, addEventListener() {} },
        setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, at: clock + delay }); return id; },
        clearTimeout: id => timers.delete(id),
        requestAnimationFrame(callback) { const id = ++sequence; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id) };
    vm.runInNewContext(fs.readFileSync(require.resolve('../map-scene.js'), 'utf8'), context);
    return { api: window.MapScene, board, applied,
        size(w, h) { width = w; height = h; },
        removeArea() { areaPresent = false; },
        replaceBoard() { board.isConnected = false; currentBoard = { isConnected: true }; },
        tick(ms = 17) {
            clock += ms;
            for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.callback(); }
            const scheduled = [...frames]; frames.clear();
            for (const [, callback] of scheduled) callback(clock);
        }
    };
}

test('rotation during the two-frame check restarts the wait and commits only the stable viewport', async () => {
    const run = viewportRuntime(); let settled = false;
    const ready = run.api.whenViewportStable(run.board).then(value => { settled = true; return value; });
    run.tick(120); // First landscape measurement.
    run.size(393, 852); run.tick(); // Portrait arrives before the second measurement.
    await Promise.resolve(); assert.equal(settled, false);
    run.size(852, 393); run.api.scheduleViewportResize();
    run.tick(120); run.tick();
    assert.equal(await ready, true);
    assert.deepEqual(run.applied, [.8]);
});

test('recovery remains pending while frames are suspended, then continues when frames return', async () => {
    const run = viewportRuntime(); let settled = false;
    const ready = run.api.whenViewportStable(run.board).then(value => { settled = true; return value; });
    await Promise.resolve(); assert.equal(settled, false);
    run.tick(120); run.tick(); assert.equal(await ready, true);
});

test('a zero-size viewport cannot start map restoration', async () => {
    const run = viewportRuntime(); run.size(0, 0); let settled = false;
    const ready = run.api.whenViewportStable(run.board).then(value => { settled = true; return value; });
    run.tick(120); run.tick(); await Promise.resolve(); assert.equal(settled, false);
    run.size(852, 393); run.tick(120); run.tick(); assert.equal(await ready, true);
});

test('viewport waits cancel when the board or its scroll area disappears', async () => {
    for (const cancel of ['replaceBoard', 'removeArea']) {
        const run = viewportRuntime(), ready = run.api.whenViewportStable(run.board);
        run[cancel](); run.tick(120); run.tick();
        assert.equal(await ready, false);
    }
});
