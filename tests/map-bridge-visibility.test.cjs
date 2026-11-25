const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync(require.resolve('../' + name), 'utf8');

function runtime() {
    let clock = 0, sequence = 0;
    const timers = new Map(), frames = new Map(), images = [], drawn = [], fallback = [];
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
        getContext() { return new Proxy({ createPattern: () => ({}) }, { get: (o, k) => k in o ? o[k] : (...args) => { if (k === 'drawImage') drawn.push(args[0]); } }); }
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
    const window = { matchMedia: () => ({ matches: true }), mapViewportRendering: true, devicePixelRatio: 1,
        MapScene: { config: { width: 9216, height: 7424 }, getViewport: () => viewport,
            isViewportResizing: () => false, invalidateCameraLimits() {} },
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
        clearTimeout: id => timers.delete(id), ResizeObserver: class { observe() {} disconnect() {} } };
    vm.createContext(context);
    const load = file => vm.runInContext(read(file), context, { filename: file });
    return { area, board, background, svg, images, drawn, fallback, window, Element, Image, load,
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
