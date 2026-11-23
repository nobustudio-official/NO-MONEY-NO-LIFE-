const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync(require.resolve('../' + name), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function runtime(zoom = 1) {
    let now = 0, sequence = 0;
    const timers = new Map(), frames = new Map(), images = [], requests = [], cameraCalls = [];
    const clock = {
        setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { at: now + delay, callback }); return id; },
        clearTimeout: id => timers.delete(id),
        requestAnimationFrame(callback) { const id = ++sequence; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        async step() {
            now += 16;
            for (const [id, task] of [...timers]) if (task.at <= now) { timers.delete(id); task.callback(); }
            const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now));
            await flush();
        }
    };
    class Element {
        constructor(tag = 'div') {
            this.tag = tag; this.children = []; this.parentNode = null; this.dataset = {}; this.attributes = new Map(); this.events = new Map();
            const classes = new Set();
            this.classList = { add: (...keys) => keys.forEach(key => classes.add(key)), remove: (...keys) => keys.forEach(key => classes.delete(key)),
                contains: key => classes.has(key), toggle: (key, enabled) => { if (enabled) classes.add(key); else classes.delete(key); } };
            Object.defineProperty(this, 'className', { set(value) { classes.clear(); value.split(' ').filter(Boolean).forEach(key => classes.add(key)); } });
            const properties = new Map();
            this.style = { setProperty: (key, value) => properties.set(key, value), getPropertyValue: key => properties.get(key) || '', removeProperty: key => properties.delete(key) };
        }
        get isConnected() { return this.tag === 'body' || Boolean(this.parentNode?.isConnected); }
        append(...children) { for (const child of children) { child.remove(); child.parentNode = this; this.children.push(child); } }
        remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
        setAttribute(key, value) { this.attributes.set(key, value); }
        hasAttribute(key) { return this.attributes.has(key); }
        getAttribute(key) { return this.attributes.get(key) ?? null; }
        removeAttribute(key) { this.attributes.delete(key); if (key === 'src') { this.complete = false; this.naturalWidth = 0; } }
        matches(selector) {
            if (selector[0] === '#') return this.id === selector.slice(1);
            if (selector[0] === '.') return selector.slice(1).split('.').every(key => this.classList.contains(key));
            return false;
        }
        closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
        querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
        addEventListener(type, callback, options = {}) { if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push({ callback, once: options.once }); }
        removeEventListener(type, callback) { this.events.set(type, (this.events.get(type) || []).filter(listener => listener.callback !== callback)); }
        emit(type) {
            for (const listener of [...this.events.get(type) || []]) {
                if (listener.once) this.events.get(type).splice(this.events.get(type).indexOf(listener), 1);
                listener.callback();
            }
        }
    }
    class Image extends Element {
        constructor() { super('img'); this.complete = false; this.naturalWidth = 0; images.push(this); }
        set src(value) { this.setAttribute('src', value); this.complete = false; requests.push(value); }
        get src() { return this.getAttribute('src') || ''; }
        load() { this.complete = true; this.naturalWidth = 100; this.emit('load'); }
        fail() { this.complete = true; this.naturalWidth = 0; this.emit('error'); }
    }
    const body = new Element('body'), area = new Element(), board = new Element(), background = new Element(), svg = new Element();
    area.className = 'map-area'; board.id = 'mapBoard'; background.className = 'map-background';
    body.append(area); area.append(board); board.append(background); background.append(svg);
    area.scrollLeft = area.scrollTop = 0;
    area.scrollWidth = 5000 * zoom; area.scrollHeight = 200 * zoom; area.clientWidth = area.clientHeight = 100;
    area.scrollTo = ({ left, top }) => { area.scrollLeft = left; area.scrollTop = top; area.emit('scroll'); };
    area.getBoundingClientRect = () => ({ left: 0, right: 100, top: 0, bottom: 100, width: 100, height: 100 });
    board.getBoundingClientRect = () => ({ left: -area.scrollLeft, top: -area.scrollTop, width: 5000 * zoom, height: 100 * zoom });
    const tiles = ['old', 'middle', 'target', 'near'].map((name, i) => ({ x: [0, 1000, 3000, 3120][i], y: 0, width: 100, height: 200,
        image: name, mediumImage: name + '-medium' }));
    const context = { ...clock, Image, console, AbortController, avatarCameraFocus: undefined,
        performance: { now: () => now }, matchMedia: () => ({ matches: true }), mobileRuntimeTuning: true,
        ResizeObserver: class { observe() {} disconnect() {} }, getMapZoomUI: () => zoom, MapScene: { getMinZoom: () => .1 },
        MapBackgroundRasterData: { tiles }, document: { body, createElement: tag => new Element(tag), querySelector: () => area, getElementById: id => id === 'mapBoard' ? board : null },
        players: [{ x: 50 }, { x: 3050 }], currentPlayer: 1, nextPlayerCameraRequest: 0,
        renderTurn() {}, renderPlayers() {}, refreshShortestPathToBoss() {}, preloadPlayerDirectionSprites() {},
        centerPlayerOnMap(index, behavior, done) {
            cameraCalls.push({ index, behavior }); area.scrollLeft = context.players[index].x * zoom - 50; area.emit('scroll'); done?.();
        } };
    context.window = context;
    vm.createContext(context);
    const run = code => vm.runInContext(code, context);
    run(read('map-detail-level.js'));
    const detail = context.MapDetailLevel;
    const f = { ...clock, run, context, detail, board, area, background, images, requests, cameraCalls,
        scroll(left) { area.scrollLeft = left; area.emit('scroll'); },
        async until(predicate) { for (let i = 0; i < 300; i++) { if (predicate()) return; await clock.step(); } throw new Error('Test did not settle'); },
        async loadAll() { for (let i = 0; i < 20; i++) { await clock.step(); images.filter(image => image.src && !image.complete).forEach(image => image.load()); await flush(); } },
        async fallback() { run(read('map-background-cache.js')); await context.MapBackgroundCache.prepare(background, svg); },
        baked() {
            context.MapRoadRasterData = { signature: 'roads' }; context.MapRoadCache = { signature: () => 'roads', setSimpleMode() {}, setViewport() {} };
            context.MapOverviewRasterData = { image: 'base', mobileImage: 'base', width: 5000, height: 200, detailTiles: tiles };
            run(read('map-overview-cache.js'));
            context.MapOverviewRasterData.signature = context.MapOverviewCache.signature();
            assert.equal(context.MapOverviewCache.mountAsBase(background, []), true);
            images.find(image => image.src === 'base').load(); detail.setZoom(board, zoom);
        }
    };
    return f;
}

test('camera jumps skip intermediate loads and release the old region before loading the destination', async () => {
    const f = runtime(); await f.fallback(); await f.until(() => f.requests.includes('old'));
    const old = f.images.find(image => image.src === 'old');
    const jump = f.detail.beginCameraJump(f.board);
    f.scroll(1000);
    for (let i = 0; i < 20; i++) await f.step();
    assert.equal(f.requests.includes('middle'), false);
    f.scroll(3000);
    let finished = false; jump.finish().then(() => { finished = true; });
    await f.until(() => f.requests.includes('target'));
    assert.equal(old.hasAttribute('src'), false);
    assert.equal(f.requests.includes('near'), false);
    assert.equal(finished, false);
    f.images.find(image => image.src === 'target').load();
    await f.until(() => finished);
    await f.until(() => f.requests.includes('near'));
    assert.equal(f.requests.includes('middle'), false);
});

test('baked-map tiles also prioritize only the new visible region while black', async () => {
    const f = runtime(); f.baked(); await f.loadAll();
    const old = f.images.filter(image => image.src.startsWith('old'));
    assert.ok(old.length > 0);
    const start = f.requests.length, jump = f.detail.beginCameraJump(f.board);
    f.scroll(1000); await f.step(); f.scroll(3000);
    let finished = false; jump.finish().then(() => { finished = true; });
    await f.until(() => f.requests.includes('target') && f.requests.includes('target-medium'));
    assert.equal(old.every(image => !image.isConnected && !image.hasAttribute('src')), true);
    assert.equal(f.requests.slice(start).some(src => src.startsWith('middle') || src.startsWith('near')), false);
    f.images.find(image => image.src === 'target').load(); await flush();
    assert.equal(finished, false, 'wait for the other visible layer as well');
    f.images.find(image => image.src === 'target-medium').load();
    await f.until(() => finished);
});

test('repeated viewport requests reuse the same queued image promise', async () => {
    const f = runtime(), jump = f.detail.beginCameraJump(f.board), image = new f.context.Image();
    f.background.append(image);
    const first = f.detail.requestImage(image, 'queued', 1, 100);
    assert.equal(f.detail.requestImage(image, 'queued', 0, 0), first);
    f.detail.releaseImage(image);
    assert.equal(await first, null);
    await jump.finish();
    for (let i = 0; i < 4; i++) await f.step();
    assert.equal(f.requests.includes('queued'), false);
});

test('an overview handoff keeps the current zoom without requesting detail tiles', async () => {
    const f = runtime(.2); f.baked();
    f.board.classList.add('map-overview-active');
    const jump = f.detail.beginCameraJump(f.board);
    f.scroll(3000 * .2);
    const finished = jump.finish();
    assert.equal(jump.finish(), finished, 'finishing the jump twice must be harmless');
    await finished;
    for (let i = 0; i < 4; i++) await f.step();
    assert.equal(f.run('getMapZoomUI()'), .2);
    assert.deepEqual(f.requests, ['base']);
});

test('failed or stalled destination images cannot leave loading paused permanently', async () => {
    for (const fail of [true, false]) {
        const f = runtime(); await f.fallback(); await f.loadAll();
        const jump = f.detail.beginCameraJump(f.board); f.scroll(3000);
        let finished = false; jump.finish().then(() => { finished = true; });
        await f.until(() => f.requests.includes('target'));
        if (fail) f.images.find(image => image.src === 'target').fail();
        await f.until(() => finished);
        assert.equal(f.detail.isCameraJumping(f.board), false);
        assert.equal(f.run('getMapZoomUI()'), 1);
    }
});

test('real handoff stays black until the instant camera jump and visible background are ready', async () => {
    const f = runtime(.8); await f.fallback(); await f.loadAll();
    f.run(read('turn-handoff.js'));
    const game = read('game.js');
    f.run(game.slice(game.indexOf('function updateNextPlayerView()'), game.indexOf('window.updateNextPlayerView =')));
    f.context.TurnHandoff.run(() => f.run('updateNextPlayerView()'));
    await f.until(() => f.cameraCalls.length > 0 && f.requests.includes('target'));
    assert.deepEqual(f.cameraCalls, [{ index: 1, behavior: 'instant' }]);
    assert.equal(f.context.TurnHandoff.isBlack(), true);
    assert.equal(f.requests.includes('middle'), false);
    assert.equal(f.run('getMapZoomUI()'), .8);
    await f.loadAll();
    await f.until(() => !f.context.TurnHandoff.isActive());
    assert.equal(f.area.scrollLeft, 3050 * .8 - 50);
});

test('a handoff without a map board completes normally', async () => {
    const f = runtime(); f.context.document.getElementById = () => null;
    f.run(read('turn-handoff.js'));
    let applied = false;
    f.context.TurnHandoff.run(() => { applied = true; });
    await f.until(() => !f.context.TurnHandoff.isActive());
    assert.equal(applied, true);
});

test('cancelling the previous animated pan prevents it from overwriting the new camera position', async () => {
    const f = runtime(), game = read('game.js');
    f.run(read('map-movement-presentation.js'));
    f.run(game.slice(game.indexOf('const MAP_TAP_CAMERA_SPEED'), game.indexOf('function focusCurrentPlayerFromAvatar()')));
    const pan = f.run('animateMapCameraScroll(document.querySelector(".map-area"), 4000, 0, 1200)');
    await f.step();
    assert.ok(f.area.scrollLeft > 0);
    const jump = f.detail.beginCameraJump(f.board);
    f.context.cancelMapCameraScroll();
    assert.equal(await pan, false);
    f.scroll(3000);
    await jump.finish();
    for (let i = 0; i < 10; i++) await f.step();
    assert.equal(f.area.scrollLeft, 3000);
});
