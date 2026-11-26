const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync(require.resolve('../' + name), 'utf8');

function runtime() {
    let clock = 0, sequence = 0;
    const timers = new Map(), frames = new Map(), images = [], drawn = [], fallback = [], observers = [], transforms = [];
    let styleReads = 0;
    class Element extends EventTarget {
        constructor(tag = 'div') {
            super(); this.tagName = tag; this.style = { getPropertyValue: () => '', setProperty() {}, removeProperty() {} };
            this.children = []; this.parentElement = null; this.dataset = {}; this.attrs = new Map(); this.classes = new Set();
            this.isConnected = true; this.complete = false; this.naturalWidth = this.naturalHeight = 0;
            this.width = this.height = 0;
            this.classList = { contains: k => this.classes.has(k), add: (...keys) => keys.forEach(k => this.classes.add(k)),
                remove: k => this.classes.delete(k), toggle: (k, value) => value ? this.classes.add(k) : this.classes.delete(k) };
        }
        set className(value) { this.classes = new Set(value.split(/\s+/)); }
        append(child) { child.parentElement = this; this.children.push(child); }
        replaceChildren() { this.children = []; }
        remove() { this.isConnected = false; }
        setAttribute(key, value) { this.attrs.set(key, String(value)); if (key === 'class') this.className = value; }
        getAttribute(key) { return this.attrs.get(key) ?? null; }
        hasAttribute(key) { return this.attrs.has(key); }
        removeAttribute(key) { this.attrs.delete(key); }
        closest(selector) {
            if (selector === '#mapBoard' && this === board || selector === '.map-area' && this === area) return this;
            return this.parentElement?.closest(selector) || null;
        }
        matches(selector) {
            const not = [...selector.matchAll(/:not\(([^)]+)\)/g)];
            if (not.some(([, s]) => this.matches(s))) return false;
            selector = selector.replace(/:not\([^)]+\)/g, '');
            if (selector.includes(':')) return false;
            const id = selector.match(/#([\w-]+)/)?.[1]; if (id && this.id !== id) return false;
            const attr = selector.match(/\[data-([\w-]+)(?:="([^"]*)")?\]/);
            if (attr) { const key = attr[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()); if (!(key in this.dataset) || attr[2] !== undefined && this.dataset[key] !== attr[2]) return false; }
            if ([...selector.matchAll(/\.([\w-]+)/g)].some(([, name]) => !this.classes.has(name))) return false;
            const tag = selector.match(/^[a-z][\w-]*/)?.[0]; return !tag || this.tagName === tag;
        }
        querySelectorAll(selector) {
            const all = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
            return selector === '*' ? all : all.filter(child => selector.split(',').some(s => child.matches(s.trim())));
        }
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
        getContext() { return new Proxy({ createPattern: () => ({}) }, { get: (o, k) => k in o ? o[k] : (...args) => {
            if (k === 'drawImage') drawn.push(args[0]);
            if (k === 'setTransform') transforms.push({ canvas: this, args });
        } }); }
    }
    class Image extends Element {
        constructor() { super('img'); images.push(this); }
        set src(value) { this.attrs.set('src', value); this.complete = true; this.naturalWidth = this.naturalHeight = 100; }
        get src() { return this.attrs.get('src') || ''; }
        get currentSrc() { return this.src; }
        decode() { return Promise.resolve(); }
    }
    const area = new Element(), board = new Element(), background = new Element(), svg = new Element('svg');
    board.id = 'mapBoard'; background.className = 'map-background'; area.append(board); board.append(background); board.append(svg);
    const viewport = { width: 852, height: 393, zoom: 1, originX: 0, originY: 0, left: 0, top: 0, right: 852, bottom: 393 };
    Object.defineProperties(area, { clientWidth: { get: () => viewport.width }, clientHeight: { get: () => viewport.height } });
    const window = { matchMedia: () => ({ matches: true }), mapViewportRendering: true, devicePixelRatio: 1,
        MapScene: { config: { width: 9216, height: 7424 }, getViewport: () => viewport,
            isViewportResizing: () => false, invalidateCameraLimits() {}, invalidateViewportSize() {} },
        MapOverviewRasterData: { mobileImage: 'overview.webp' },
        MapRoadRasterData: { bridges: [{ key: '144:145', from: 144, to: 145, image: 'bridge.webp', x: 80, y: 60, width: 240, height: 80 }] },
        BridgeCollapseRules: require('../bridge-collapse-rules.js'),
        MapBridgeRoads: { isBridge: style => style === 'bridge-wood' },
        MapWorkshopScene: { setViewport() {}, roadPoints: () => null, roadStyle: () => 'bridge-wood', prepareRoads: () => Promise.resolve(), drawRoad: (_, points, style) => fallback.push(style) } };
    const document = { baseURI: 'https://game.test/', hidden: false, addEventListener() {}, removeEventListener() {},
        createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag), getElementById: () => board };
    const context = { window, document, Image, URL, console, queueMicrotask, getMapZoomUI: () => 1,
        requestAnimationFrame(callback) { const id = ++sequence; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, at: clock + delay }); return id; },
        clearTimeout: id => timers.delete(id), ResizeObserver: class { constructor(fn) { observers.push(fn); } observe() {} disconnect() {} },
        getComputedStyle: element => { styleReads++; return { width: element.style.width || '66px', height: element.style.height || '66px' }; } };
    vm.createContext(context);
    const load = file => vm.runInContext(read(file), context, { filename: file });
    return { context, area, board, background, svg, viewport, images, drawn, fallback, transforms, window, Element, Image, load, observers,
        get styleReads() { return styleReads; },
        tick(ms = 32) {
            clock += ms;
            for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.callback(); }
            const scheduled = [...frames]; frames.clear(); for (const [, callback] of scheduled) callback(clock);
        } };
}

test('bridge loading and presentation continue during camera motion while terrain waits', async () => {
    const run = runtime(); run.load('map-detail-level.js');
    const api = run.window.MapDetailLevel;
    api.setZoom(run.board, 1); run.tick(200);
    const stop = api.beginCameraMotion(run.board), bridge = new run.Image(), terrain = new run.Image();
    bridge.classList.add('map-bridge-image'); run.background.append(bridge); run.background.append(terrain);
    const bridgeReady = api.requestImage(bridge, 'bridge.webp', 0);
    api.requestImage(terrain, 'terrain.webp', 0);
    run.tick();
    const owner = run.images.find(image => image !== bridge && image.src.endsWith('/bridge.webp'));
    assert.ok(owner, 'bridge decode starts during motion');
    assert.ok(!terrain.src, 'terrain remains deferred');
    await owner.onload(); run.tick();
    assert.equal(await bridgeReady, bridge);
    assert.ok(bridge.src, 'bridge presentation finishes before the camera stops');
    assert.ok(!terrain.src); stop();
});

function squareCanvases(count = 1, size = 66) {
    const run = runtime();
    run.viewport.width = run.viewport.right = run.viewport.height = run.viewport.bottom = 200;
    run.window.MapDetailLevel = { isLowDetail: () => false, releaseImage() {},
        requestImage: () => Promise.resolve(), updateImagePriority() {} };
    run.load('map-viewport-renderer.js');
    const api = run.window.MapViewportRenderer; api.mount(run.background, run.svg);
    const rows = Array.from({ length: count }, (_, i) => {
        const node = new run.Element(), icon = new run.Image();
        node.className = 'map-node'; icon.className = 'map-space-icon'; icon.src = 'square.webp';
        icon.style.width = icon.style.height = size + 'px';
        node.append(icon); run.board.append(node);
        return { node, icon, x: 100 + i * 1024, y: 100 };
    });
    return { ...run, rows, api, visit(index) {
        run.viewport.left = index * 1024; run.viewport.right = run.viewport.left + run.viewport.width;
        api.setViewport(run.board, run.viewport, run.viewport, rows); run.tick();
    }, get styleReads() { return run.styleReads; } };
}

test('returning to a recently visible square reuses its raster without drawing it again', () => {
    const run = squareCanvases(); run.visit(0);
    const canvas = run.rows[0].node.querySelector('canvas');
    const draws = run.drawn.filter(image => image === run.rows[0].icon).length;
    run.visit(2);
    assert.equal(canvas.hidden, true); assert.ok(canvas.width > 0);
    run.visit(0);
    assert.equal(run.rows[0].node.querySelector('canvas'), canvas);
    assert.equal(canvas.hidden, false);
    assert.equal(run.drawn.filter(image => image === run.rows[0].icon).length, draws);
    assert.equal(run.styleReads, 1, 'scrolling alone retains icon dimension measurements');
});

test('offscreen and lightweight square rasters stay inside the same count and pixel limits', () => {
    for (const [size, retained] of [[66, 16], [200, 6]]) {
        const run = squareCanvases(20, size);
        for (let i = 0; i < 20; i++) run.visit(i);
        const canvases = run.rows.map(row => row.node.querySelector('canvas'));
        const hidden = canvases.filter(canvas => canvas.hidden && canvas.width);
        assert.equal(hidden.length, retained);
        assert.ok(hidden.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0) <= 256 * 1024);
        assert.equal(canvases[0].width, 0, 'evict the oldest offscreen square');
        run.window.MapDetailLevel.isLowDetail = () => true;
        run.api.schedule(run.board); run.tick();
        assert.ok(canvases.every(canvas => canvas.hidden));
        assert.ok(canvases.filter(canvas => canvas.width).length <= 16);
        assert.ok(canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0) <= 256 * 1024);
    }
});

test('normal restoration retains Canvas ownership and reveals at most two cached squares per frame', () => {
    const run = squareCanvases(6), css = read('map-scene.css');
    run.rows.forEach((row, i) => { row.x = 40 + i * 20; });
    run.api.setViewport(run.board, run.viewport, run.viewport, run.rows);
    for (let i = 0; i < 3; i++) run.tick();
    const canvases = run.rows.map(row => row.node.querySelector('canvas'));
    const background = run.board.querySelector('.map-viewport-surface');
    const changes = watchCanvasSize(background), initialDraws = run.drawn.length;
    const terrain = new run.Element('svg'); terrain.className = 'map-continent'; run.background.append(terrain);
    run.svg.className = 'map-lines';
    let low = true;
    run.window.MapDetailLevel.isLowDetail = () => low;
    run.api.schedule(run.board); run.tick();
    assert.ok(run.board.classList.contains('map-viewport-active'));
    assert.ok(canvases.every(canvas => canvas.hidden && canvas.width));

    // The detail controller removes lightweight CSS before the next paint.
    low = false;
    assert.equal(displayFromCss(terrain, css), 'none');
    assert.equal(displayFromCss(run.svg, css), 'none');
    assert.ok(run.rows.every(row => displayFromCss(row.icon, css) === 'none'));
    run.api.schedule(run.board, false, false);
    for (const count of [2, 4, 6]) {
        run.tick();
        assert.equal(canvases.filter(canvas => !canvas.hidden).length, count);
    }
    assert.deepEqual(changes, [], 'restoration never reallocates the background buffer');
    assert.equal(run.drawn.length, initialDraws, 'cached squares return without drawing their images again');
});

test('normal original square images remain hidden until their paced Canvas presentation', () => {
    const run = squareCanvases(5), css = read('map-scene.css');
    run.rows.forEach((row, i) => { row.x = 40 + i * 20; });
    run.api.setViewport(run.board, run.viewport, run.viewport, run.rows); run.tick();
    assert.equal(run.rows.filter(row => row.node.classList.contains('map-viewport-icon-ready')).length, 2);
    assert.ok(run.rows.every(row => displayFromCss(row.icon, css) === 'none'));
    const boss = new run.Element(), bossIcon = new run.Image();
    boss.className = 'map-node boss-node'; bossIcon.className = 'map-space-icon'; boss.append(bossIcon); run.board.append(boss);
    assert.notEqual(displayFromCss(bossIcon, css), 'none', 'boss presentation is independent of normal square pacing');
    run.tick(); run.tick();
    assert.ok(run.rows.every(row => row.node.classList.contains('map-viewport-icon-ready')));
    run.api.dispose(run.board);
    assert.ok(run.rows.every(row => displayFromCss(row.icon, css) !== 'none'), 'legacy mode can use original images');
});

test('an unavailable square Canvas retains its original illustration as a local fallback', () => {
    const run = squareCanvases(), css = read('map-scene.css');
    const getContext = run.Element.prototype.getContext;
    run.Element.prototype.getContext = function () {
        return this.classList.contains('map-viewport-square-icon') ? null : getContext.call(this);
    };
    run.visit(0);
    assert.ok(run.rows[0].node.classList.contains('map-viewport-icon-fallback'));
    assert.notEqual(displayFromCss(run.rows[0].icon, css), 'none');
    run.api.dispose(run.board);
    assert.ok(!run.rows[0].node.classList.contains('map-viewport-icon-fallback'));
});

test('removed squares and disposed maps release cached raster surfaces', () => {
    const run = squareCanvases(2); run.visit(0); run.visit(1);
    const canvases = run.rows.map(row => row.node.querySelector('canvas'));
    run.api.setViewport(run.board, run.viewport, run.viewport, [run.rows[1]]); run.tick();
    assert.equal(canvases[0].width, 0);
    run.api.dispose(run.board);
    assert.ok(canvases.every(canvas => canvas.width === 0));
});

test('unchanged resize notifications retain icon measurements while real resizing refreshes them', () => {
    const run = squareCanvases(); run.visit(0);
    const canvas = run.rows[0].node.querySelector('canvas');
    for (let i = 0; i < 60; i++) run.observers[0]();
    run.tick(); assert.equal(run.styleReads, 1);
    run.visit(2); run.rows[0].icon.style.width = '58px';
    run.viewport.width = 220; run.observers[0](); run.visit(0);
    assert.equal(canvas.width, 58);
    assert.equal(run.styleReads, 2);
});

function watchCanvasSize(canvas) {
    const changes = [];
    for (const name of ['width', 'height']) {
        let value = canvas[name];
        Object.defineProperty(canvas, name, { get: () => value, set(next) { value = next; changes.push([name, next]); } });
    }
    return changes;
}

test('toolbar collapse and rotation keep the first background buffer and map the full expanded viewport', () => {
    const run = squareCanvases(); run.window.devicePixelRatio = 3;
    run.viewport.width = 852; run.viewport.height = run.viewport.bottom = 273; run.visit(0);
    const canvas = run.board.querySelector('.map-viewport-surface');
    const initial = [canvas.width, canvas.height], changes = watchCanvasSize(canvas);
    assert.ok(initial[0] * initial[1] <= 1920 * 1080);
    assert.ok(initial.every(size => size <= 2048));
    for (const [width, height] of [[852, 393], [393, 852], [852, 273], [852, 393]]) {
        run.viewport.width = width; run.viewport.height = run.viewport.bottom = height;
        run.observers[0](); run.visit(0);
        assert.deepEqual([canvas.width, canvas.height], initial);
        assert.equal(canvas.style.width, width + 320 + 'px');
        assert.equal(canvas.style.height, height + 320 + 'px');
        const transform = run.transforms.filter(item => item.canvas === canvas).at(-1).args;
        assert.equal(transform[0], initial[0] / (width + 320));
        assert.equal(transform[3], initial[1] / (height + 320));
    }
    assert.deepEqual(changes, [], 'no backing-store resets during size changes');
});

test('dynamic comparison mode retains the original viewport-dependent background allocation', () => {
    const run = squareCanvases(); run.window.mapFixedCanvasSize = false;
    run.viewport.width = 852; run.viewport.height = run.viewport.bottom = 273; run.visit(0);
    const canvas = run.board.querySelector('.map-viewport-surface');
    const initialHeight = canvas.height, changes = watchCanvasSize(canvas);
    run.viewport.height = run.viewport.bottom = 393; run.observers[0](); run.visit(0);
    assert.ok(canvas.height > initialHeight);
    assert.ok(changes.length > 0);
});

test('a zero-size viewport cannot lock in an invalid first background buffer', () => {
    const run = squareCanvases(); run.viewport.width = run.viewport.height = 0; run.visit(0);
    const canvas = run.board.querySelector('.map-viewport-surface');
    assert.equal(canvas.width, 0);
    run.viewport.width = 852; run.viewport.height = run.viewport.bottom = 393; run.visit(0);
    assert.equal(canvas.width, 1172); assert.equal(canvas.height, 713);
});

test('cached square illustrations render during travel before per-square image binding finishes', async () => {
    const run = runtime(); run.load('map-detail-level.js');
    const detail = run.window.MapDetailLevel;
    detail.setZoom(run.board, 1); run.tick(200);
    const seed = new run.Image(), ready = detail.loadImage(seed, 'square.webp', 0);
    run.tick();
    const owner = run.images.find(image => image !== seed && image.src.endsWith('/square.webp'));
    await owner.onload(); await ready;
    run.load('map-viewport-renderer.js');
    const renderer = run.window.MapViewportRenderer;
    renderer.mount(run.background, run.svg);
    const rows = Array.from({ length: 4 }, (_, i) => {
        const node = new run.Element(), icon = new run.Image();
        node.className = 'map-node'; icon.className = 'map-space-icon';
        icon.dataset.highQualitySrc = 'square.webp'; node.append(icon); run.board.append(node);
        return { node, icon, x: 100 + i * 100, y: 100 };
    });
    const stop = detail.beginCameraMotion(run.board);
    renderer.setViewport(run.board, run.viewport, run.viewport, rows); run.tick();
    assert.equal(rows.filter(row => row.node.classList.contains('map-viewport-icon-ready')).length, 2,
        'keep the two-canvas-per-frame budget');
    run.tick();
    assert.ok(rows.every(row => row.node.classList.contains('map-viewport-icon-ready')));
    assert.ok(run.drawn.includes(owner), 'draw the already-decoded shared illustration');
    assert.ok(rows.every(row => !row.icon.src), 'no additional display image loads are required');
    detail.setZoom(run.board, .4); run.tick();
    assert.ok(rows.every(row => !row.node.classList.contains('map-viewport-icon-ready')), 'preserve lightweight mode');
    stop();
});

test('visible square bindings take priority over earlier offscreen requests during travel', async () => {
    const run = runtime(); run.load('map-detail-level.js');
    const api = run.window.MapDetailLevel;
    api.setZoom(run.board, 1); run.tick(200);
    const seed = new run.Image(), ready = api.loadImage(seed, 'square.webp', 0);
    run.tick();
    await run.images.find(image => image !== seed && image.src.endsWith('/square.webp')).onload(); await ready;
    const stop = api.beginCameraMotion(run.board), near = new run.Image(), visible = new run.Image();
    for (const image of [near, visible]) { image.className = 'map-space-icon'; run.board.append(image); }
    const nearReady = api.requestImage(near, 'square.webp', 1, 0);
    const visibleReady = api.requestImage(visible, 'square.webp', 0, 1000);
    run.tick();
    assert.ok(visible.src, 'visible square appears first even when queued later');
    assert.ok(!near.src, 'retain the one-binding-per-frame budget');
    run.tick(); await Promise.all([nearReady, visibleReady]); stop();
});

test('bridge placeholder persists until its illustration is ready, and collapsed bridges remain absent', () => {
    const run = runtime();
    run.window.MapDetailLevel = { isLowDetail: () => false, releaseImage() {}, requestImage: () => Promise.resolve(), updateImagePriority() {} };
    run.load('map-viewport-renderer.js');
    const api = run.window.MapViewportRenderer;
    assert.equal(api.mount(run.background, run.svg), true);
    api.setRoads(run.svg, [{ id: 144, x: 100, y: 100, next: [145] }, { id: 145, x: 300, y: 100, next: [144] }]);
    run.tick(); assert.deepEqual(run.fallback, ['bridge-wood']);
    const art = run.images.find(image => image.classList.contains('map-bridge-image'));
    assert.ok(art); art.complete = true; art.naturalWidth = 240; art.naturalHeight = 80;
    run.fallback.length = run.drawn.length = 0;
    api.schedule(run.board); run.tick();
    assert.equal(run.fallback.length, 0); assert.ok(run.drawn.includes(art));
    art.complete = false; art.naturalWidth = 0;
    run.fallback.length = run.drawn.length = 0;
    api.setBridgeCollapse(run.svg, { remainingActions: 1 }); run.tick();
    assert.equal(run.fallback.length, 0); assert.ok(!run.drawn.includes(art));
});

test('legacy bridge roads remain visible while art is pending and obey simple-mode and collapse switches', () => {
    const run = runtime(); run.load('map-road-renderer.js');
    const api = run.window.MapRoadRenderer, squares = [{ id: 144, x: 100, y: 100, next: [145] }, { id: 145, x: 300, y: 100, next: [144] }];
    api.draw(run.svg, squares);
    const edge = run.svg.querySelector('.map-road-bridge-edge');
    assert.ok(edge); assert.notEqual(edge.style.display, 'none');
    edge.classList.add('map-road-material-replaced'); api.setBridgeCollapse(run.svg, squares, null);
    assert.equal(edge.style.display, 'none');
    api.setSimpleMode(run.svg, true); assert.notEqual(edge.style.display, 'none');
    api.setBridgeCollapse(run.svg, squares, { remainingActions: 1 }); assert.equal(edge.style.display, 'none');
});

function displayFromCss(element, css) {
    function matches(node, selector) {
        const parts = selector.trim().split(/\s+/);
        function matchAt(current, index) {
            if (!current || !current.matches(parts[index])) return false;
            if (!index) return true;
            if (parts[index - 1] === '>') return matchAt(current.parentElement, index - 2);
            for (let p = current.parentElement; p; p = p.parentElement) if (matchAt(p, index - 1)) return true;
            return false;
        }
        return matchAt(node, parts.length - 1);
    }
    let value = 'inline', rank = -1;
    for (const [, selectors, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
        const display = body.match(/\bdisplay\s*:\s*([^;]+)/)?.[1]; if (!display) continue;
        for (const selector of selectors.split(',')) if (matches(element, selector)) {
            const specificity = (selector.match(/#/g) || []).length * 100 + (selector.match(/\./g) || []).length * 10;
            if (specificity >= rank) { rank = specificity; value = display.trim(); }
        }
    }
    return value;
}

test('actual low-detail switch hides the overview SVG, including scenery outside the flat land mask', () => {
    const run = runtime(); let low = false;
    const terrain = new run.Element('svg'), flat = new run.Element('svg');
    terrain.className = 'map-continent'; flat.className = 'map-flat-region-layer is-ready';
    run.background.append(terrain); run.background.append(flat);
    run.window.MapDetailLevel = { touchDevice: true, isLowDetail: () => low };
    run.load('map-overview-cache.js'); const css = read('map-scene.css');
    assert.equal(displayFromCss(terrain, css), 'block');
    low = true; run.window.MapOverviewCache.setZoom(run.board, .49);
    assert.equal(displayFromCss(terrain, css), 'none');
    assert.equal(displayFromCss(flat, css), 'block');
    low = false; run.window.MapOverviewCache.setZoom(run.board, .8);
    assert.equal(displayFromCss(terrain, css), 'block');
});

// Exercise the real size coordinator, detail controller and renderer together.
// Resizes below deliberately do not deliver observer notifications first.
function sizeSwitchRuntime(canvasEnabled = true) {
    const run = runtime(), { window, context, area, board, viewport } = run;
    let zoom = .8;
    const applied = [], swaps = [];
    context.document.querySelector = () => area;
    context.document.documentElement = { style: { setProperty() {} } };
    window.addEventListener = () => {};
    window.innerWidth = viewport.width; window.innerHeight = viewport.height;
    window.MapContinentData = { grassTexture: 'grass.webp', coast: [
        { x: 0, y: 0 }, { x: 9216, y: 0 }, { x: 9216, y: 7424 }, { x: 0, y: 7424 }
    ] };
    window.MapRegionBackground = { assetUrls: [] };
    window.mapViewportRendering = canvasEnabled;
    area.scrollLeft = area.scrollTop = board.offsetLeft = board.offsetTop = 0;
    area.scrollWidth = area.scrollHeight = 30000;
    area.getBoundingClientRect = () => ({ left: 0, top: 0, width: viewport.width, height: viewport.height });
    board.getBoundingClientRect = () => ({ left: 0, top: 0, width: 9216 * zoom, height: 7424 * zoom });
    context.getMapZoomUI = window.getMapZoomUI = () => zoom;
    const requestZoom = (value, preview = false) => {
        zoom = value;
        board.classList.toggle('map-zoom-interacting', preview);
        if (!preview) window.MapScene.setZoom(value);
        window.MapDetailLevel.setZoom(board, value, { preview });
    };
    window.setMapZoomUI = value => { applied.push(value); requestZoom(value); };
    for (const file of ['map-scene.js', 'map-detail-level.js', 'map-overview-cache.js', 'map-viewport-renderer.js']) run.load(file);
    const flat = new run.Element('svg'); flat.className = 'map-flat-region-layer is-ready'; run.background.append(flat);
    window.MapViewportRenderer.mount(run.background, run.svg);
    const canvas = board.querySelector('.map-viewport-surface'), toggle = board.classList.toggle;
    board.classList.toggle = (name, enabled) => {
        if (name === 'map-low-detail-active' && board.classList.contains(name) !== enabled) {
            swaps.push({ low: enabled, hidden: canvas?.hidden, width: area.clientWidth, height: area.clientHeight,
                surfaceWidth: canvas?.style.width, surfaceHeight: canvas?.style.height });
        }
        return toggle(name, enabled);
    };
    const settle = () => { run.tick(120); run.tick(17); run.tick(180); run.tick(17); };
    requestZoom(.8); settle();
    return { ...run, applied, swaps, canvas, requestZoom, settle,
        get low() { return board.classList.contains('map-low-detail-active'); },
        get view() { return window.MapScene.getViewport(board); },
        resize(width, height) { viewport.width = width; viewport.height = height; }
    };
}

test('both detail modes reuse the initial buffer and stable switches never reapply camera zoom', () => {
    const run = sizeSwitchRuntime(), initial = [run.canvas.width, run.canvas.height];
    assert.equal(run.low, false); assert.equal(run.canvas.hidden, false);
    const changes = watchCanvasSize(run.canvas), applied = run.applied.length;
    for (let i = 0; i < 8; i++) {
        run.requestZoom(.4); run.tick();
        assert.equal(run.low, true); assert.equal(run.canvas.hidden, true);
        run.requestZoom(.8); run.tick(180);
        assert.equal(run.low, false); assert.equal(run.canvas.hidden, false);
        assert.deepEqual([run.canvas.width, run.canvas.height], initial);
    }
    assert.deepEqual(changes, []);
    assert.equal(run.applied.length, applied, 'size validation alone cannot cancel or restart a gesture');
    assert.ok(run.swaps.every(swap => swap.hidden === swap.low), 'Canvas and mode CSS change in the same commit');
});

test('normal to simple waits for actual dimensions even before resize notification', () => {
    const run = sizeSwitchRuntime(), initial = [run.canvas.width, run.canvas.height];
    run.resize(800, 320); run.requestZoom(.4, true); run.tick(16);
    assert.equal(run.window.MapScene.isViewportResizing(), true);
    assert.equal(run.low, false); assert.equal(run.canvas.hidden, false, 'keep the current valid mode while sizing');
    run.settle();
    assert.equal(run.low, true); assert.equal(run.canvas.hidden, true);
    assert.equal(run.view.width, 800); assert.equal(run.view.height, 320); assert.equal(run.view.zoom, .4);
    assert.deepEqual([run.canvas.width, run.canvas.height], initial);
});

test('simple to normal paints the current-size buffer before removing simple-mode CSS', () => {
    const run = sizeSwitchRuntime(); run.requestZoom(.4); run.tick();
    const changes = watchCanvasSize(run.canvas);
    run.resize(800, 340); run.requestZoom(.8); run.tick(16);
    assert.equal(run.low, true); assert.equal(run.canvas.hidden, true);
    run.settle();
    assert.equal(run.low, false); assert.equal(run.canvas.hidden, false);
    assert.equal(run.view.width, 800); assert.equal(run.view.zoom, .8);
    const swap = run.swaps.at(-1);
    assert.equal(swap.surfaceWidth, (800 + 320) / .8 + 'px');
    assert.equal(swap.surfaceHeight, (340 + 320) / .8 + 'px');
    assert.deepEqual(changes, []);
});

test('a second size change during validation replaces dimensions cached by a zoom preview', () => {
    const run = sizeSwitchRuntime(); run.requestZoom(.4); run.tick();
    run.resize(800, 340); run.requestZoom(.8); run.tick(120);
    run.window.MapScene.getMinZoom(); // Refill the cache between the two measurements.
    run.resize(760, 300); run.tick(17);
    assert.equal(run.low, true); assert.equal(run.window.MapScene.isViewportResizing(), true);
    run.settle();
    assert.equal(run.low, false);
    assert.equal(run.view.width, 760); assert.equal(run.view.height, 300); assert.equal(run.view.zoom, .8);
});

test('CSS viewport and pixel-density changes during the two-frame check restart validation', () => {
    for (const field of ['innerHeight', 'devicePixelRatio']) {
        const run = sizeSwitchRuntime(); run.requestZoom(.4); run.tick();
        run.resize(800, 340); run.requestZoom(.8); run.tick(120);
        run.window[field] += 1; run.tick(17);
        assert.equal(run.low, true); assert.equal(run.window.MapScene.isViewportResizing(), true);
        run.settle(); assert.equal(run.low, false); assert.equal(run.view.zoom, .8);
    }
});

test('the latest zoom request wins over a mode switch waiting for viewport stability', () => {
    const run = sizeSwitchRuntime(), start = run.swaps.length;
    run.resize(800, 340); run.requestZoom(.4, true); run.tick(16);
    run.requestZoom(.8); run.settle();
    assert.equal(run.low, false); assert.equal(run.view.zoom, .8);
    assert.ok(run.swaps.slice(start).every(swap => !swap.low), 'a cancelled simple-mode request cannot be presented later');
    run.requestZoom(.4); run.tick();
    run.requestZoom(.8); run.tick(90);
    run.requestZoom(.3); run.tick(); run.tick(200);
    assert.equal(run.low, true); assert.equal(run.canvas.hidden, true);
});

test('zero-size switching waits and resumes only after a positive stable viewport returns', () => {
    const run = sizeSwitchRuntime(); run.requestZoom(.4); run.tick();
    run.resize(0, 0); run.requestZoom(.8); run.settle();
    assert.equal(run.low, true); assert.equal(run.canvas.hidden, true);
    run.resize(852, 393); run.observers.forEach(notify => notify()); run.settle();
    assert.equal(run.low, false); assert.equal(run.view.width, 852); assert.equal(run.view.zoom, .8);
});

test('disposing a map cancels a mode change waiting for stable dimensions', () => {
    const run = sizeSwitchRuntime(), start = run.swaps.length;
    run.resize(800, 340); run.requestZoom(.4);
    run.window.MapDetailLevel.dispose(run.board); run.board.isConnected = false;
    run.settle();
    assert.equal(run.swaps.length, start); assert.equal(run.canvas.width, 0);
});

test('the legacy map also validates both detail modes before using new screen dimensions', () => {
    const run = sizeSwitchRuntime(false);
    assert.equal(run.canvas, null); assert.equal(run.low, false);
    run.resize(800, 340); run.requestZoom(.4); run.settle();
    assert.equal(run.low, true); assert.equal(run.view.width, 800); assert.equal(run.view.zoom, .4);
    run.resize(760, 300); run.requestZoom(.8); run.settle();
    assert.equal(run.low, false); assert.equal(run.view.width, 760); assert.equal(run.view.zoom, .8);
});
