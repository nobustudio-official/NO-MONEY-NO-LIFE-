const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function runtime({ portrait = false, mounted = true, touch = true } = {}) {
    let clock = 0, sequence = 0, wide = true;
    const frames = new Map(), timers = new Map(), observers = [], images = [], media = new Map(), counts = {};
    const count = name => { counts[name] = (counts[name] || 0) + 1; };
    class Element extends EventTarget {
        constructor(tag = 'div') {
            super(); this.tag = tag; this.isConnected = true; this.dataset = {}; this.children = []; this.attrs = new Map();
            this.parentElement = null; this.hidden = false; this.complete = true; this.naturalWidth = 0; this.naturalHeight = 0;
            this.scrollLeft = 6500; this.scrollTop = 4000; this.clientWidth = 852; this.clientHeight = 393;
            this.scrollWidth = 20000; this.scrollHeight = 16000; this.offsetLeft = 5000; this.offsetTop = 1800;
            const properties = {};
            this.style = new Proxy({ setProperty: (k, v) => { properties[k] = v; },
                getPropertyValue: k => properties[k] || '', removeProperty: k => delete properties[k] },
                { get: (o, k) => k in o ? o[k] : properties[k] || '', set: (o, k, v) => { properties[k] = v; return true; } });
            const classes = new Set();
            this.classList = { contains: k => classes.has(k), add: k => classes.add(k), remove: k => classes.delete(k),
                toggle(k, on) { if (on) classes.add(k); else classes.delete(k); } };
            this._width = this._height = 0;
        }
        get width() { return this._width; } set width(v) { count('canvasSizes'); this._width = v; }
        get height() { return this._height; } set height(v) { count('canvasSizes'); this._height = v; }
        append(child) { this.children.push(child); child.parentElement = this; }
        closest(selector) { for (let p = this; p; p = p.parentElement) if (selector === '#mapBoard' ? p === board : p === area) return p; return null; }
        querySelector(selector) { if (this === container) return screen; if (this === screen && selector === '.game-hud') return hud; return null; }
        querySelectorAll() { return []; }
        getClientRects() { return [{}]; }
        getBoundingClientRect() {
            count('rects');
            if (this === board) return { left: 5000 - area.scrollLeft, top: 1800 - area.scrollTop, width: 9216, height: 7424 };
            return { left: 0, top: 0, right: 852, bottom: this === hud ? 60 : 393, width: 852, height: this === hud ? 60 : 393 };
        }
        getContext() { return { setTransform() {}, clearRect() { count('groundDraws'); }, drawImage() {}, createPattern() {},
            fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }; }
        setAttribute(k, v) { this.attrs.set(k, v); } removeAttribute(k) { this.attrs.delete(k); }
        hasAttribute(k) { return this.attrs.has(k); } getAttribute(k) { return this.attrs.get(k) || null; }
        remove() { this.isConnected = false; }
    }
    const root = new Element(), body = new Element(), container = new Element(), screen = new Element(), hud = new Element();
    const area = new Element(), board = new Element(), background = new Element();
    body.append(container); container.append(screen); screen.append(hud); screen.append(area); area.append(board); board.append(background);
    let visibleCards = [];
    class Image extends Element {
        constructor() { super('img'); images.push(this); }
        set src(value) { count('imageStarts'); this.attrs.set('src', value); }
        get src() { return this.attrs.get('src') || ''; }
    }
    const window = new EventTarget();
    Object.assign(window, { innerWidth: 852, innerHeight: 393, devicePixelRatio: 3, mapViewportRendering: true,
        visualViewport: Object.assign(new EventTarget(), { scale: 1, offsetTop: 0, width: 852, height: 393 }),
        MapContinentData: { grassTexture: 'grass', coast: [{ x: 0, y: 0 }, { x: 9000, y: 0 }, { x: 9000, y: 7000 }] },
        MapRegionBackground: { assetUrls: [] }, MapOverviewRasterData: { mobileImage: 'overview.webp' },
        BossAftermath: { measureGuidebookCard() { count('referenceMeasurements'); return { width: 135, height: 260 }; } },
        matchMedia(query) {
            if (!media.has(query)) {
                const m = new EventTarget();
                Object.defineProperty(m, 'matches', { get: () => query.includes('pointer: coarse') && !touch ? false : query.includes('orientation: portrait') ? portrait
                    : query.includes('orientation: landscape') ? !portrait : query.includes('max-width: 700px') ? !wide : true });
                media.set(query, m);
            }
            return media.get(query);
        } });
    const document = { documentElement: root, body, baseURI: 'https://test.invalid/', hidden: false,
        createElement: tag => new Element(tag), addEventListener() {}, removeEventListener() {},
        getElementById: () => mounted ? board : null,
        querySelector: selector => selector.includes('map-area') ? (mounted ? area : null) : selector === '.game-container' ? container : selector === '.game-screen' ? screen : null,
        querySelectorAll: selector => selector.includes('>') ? [] : visibleCards };
    const context = { window, document, Image, Event, URL, console, getMapZoomUI: () => 1, performance: { now: () => clock },
        requestAnimationFrame(callback) { const id = ++sequence; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, at: clock + delay }); return id; },
        clearTimeout: id => timers.delete(id),
        ResizeObserver: class { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} disconnect() {} },
        MutationObserver: class { observe() {} }, getComputedStyle: () => ({ width: '66px', height: '66px' }) };
    window.requestAnimationFrame = context.requestAnimationFrame;
    vm.createContext(context);
    const load = name => vm.runInContext(fs.readFileSync(require.resolve('../' + name), 'utf8'), context, { filename: name });
    for (const name of ['map-scene.js', 'map-detail-level.js', 'map-viewport-renderer.js', 'player-card-size.js', 'mobile-viewport-sync.js']) load(name);
    window.getMapZoomUI = () => 1;
    window.setMapZoomUI = value => { window.MapScene.setZoom(value); if (mounted) window.MapDetailLevel.setZoom(board, value); };
    if (mounted) {
        window.setMapZoomUI(1); window.MapViewportRenderer.mount(background, new Element());
        for (const image of images) { image.naturalWidth = image.naturalHeight = 256; image.attrs.set('src', 'cached.webp'); }
    }
    function tick(ms = 17) {
        clock += ms;
        for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.callback(); }
        const scheduled = [...frames]; frames.clear(); for (const [, callback] of scheduled) callback(clock);
    }
    const run = { context, window, area, board, root, images, counts, load, tick,
        reset() { for (const key of Object.keys(counts)) delete counts[key]; },
        get pendingFrames() { return frames.size; }, get pendingTimers() { return timers.size; },
        cards() { visibleCards = [new Element()]; },
        turn(value) {
            portrait = value; wide = !value;
            window.innerWidth = value ? 393 : 852; window.innerHeight = value ? 852 : 393;
            window.visualViewport.width = window.innerWidth; window.visualViewport.height = window.innerHeight;
            for (const query of media.values()) query.dispatchEvent(new Event('change'));
            window.dispatchEvent(new Event('resize')); window.visualViewport.dispatchEvent(new Event('resize'));
            for (const observer of observers) observer.callback();
        },
        setPortraitWithoutEvent(value) { portrait = value; },
        settle() { for (let i = 0; i < 45; i++) tick(); } };
    if (!portrait) run.settle();
    return run;
}

test('portrait parks drawing and measurements, retaining loaded images and Canvas buffers', () => {
    const run = runtime(), sources = run.images.map(image => image.src);
    const size = run.area.style.getPropertyValue('--map-space-icon-size');
    run.cards(); run.reset(); run.turn(true); run.settle();
    assert.equal(run.counts.groundDraws || 0, 0); assert.equal(run.counts.canvasSizes || 0, 0);
    assert.equal(run.counts.referenceMeasurements || 0, 0); assert.equal(run.counts.rects || 0, 0);
    assert.deepEqual(run.images.map(image => image.src), sources);
    assert.equal(run.area.style.getPropertyValue('--map-space-icon-size'), size);
    assert.equal(run.pendingFrames, 0); assert.equal(run.pendingTimers, 0);
    assert.equal(run.root.hasAttribute('data-game-viewport-paused'), true);
    run.turn(false); run.settle();
    assert.equal(run.root.hasAttribute('data-game-viewport-paused'), false);
    assert.equal(run.counts.canvasSizes || 0, 0, 'same landscape dimensions reuse the buffers');
    assert.equal(run.counts.referenceMeasurements, 1);
    for (let i = 0; i < 5; i++) { run.window.dispatchEvent(new Event('resize')); run.tick(); }
    run.settle(); assert.equal(run.counts.referenceMeasurements, 1, 'unchanged card geometry reuses its measurement');
});

test('portrait startup holds boardless preloads and resumes them without needing a map board', () => {
    const run = runtime({ portrait: true, mounted: false }), image = new run.context.Image();
    run.window.MapDetailLevel.loadImage(image, 'startup.webp'); run.settle();
    assert.equal(run.counts.imageStarts || 0, 0);
    run.turn(false); run.settle();
    assert.equal(run.counts.imageStarts, 1);
});

test('notifications across many portrait frames coalesce into one deferred callback', () => {
    const run = runtime(); run.turn(true); let calls = 0;
    const update = () => calls++;
    for (let i = 0; i < 10; i++) { assert.equal(run.window.MapScene.deferViewportUpdate(update), true); run.tick(); }
    assert.equal(calls, 0); run.turn(false); run.settle(); assert.equal(calls, 1);
});

test('portrait arriving between stability frames cannot release a camera restore', async () => {
    const run = runtime(); let ready = false;
    const promise = run.window.MapScene.whenViewportStable(run.board).then(value => { ready = value; });
    run.tick(120); run.setPortraitWithoutEvent(true); run.tick(); await Promise.resolve();
    assert.equal(ready, false); run.turn(false); run.settle(); await promise; assert.equal(ready, true);
});

test('map-only resize never constructs a hidden reward-card reference', () => {
    const run = runtime(); run.reset();
    for (let i = 0; i < 5; i++) { run.window.dispatchEvent(new Event('resize')); run.tick(); }
    run.settle(); assert.equal(run.counts.referenceMeasurements || 0, 0);
});

test('mouse-driven desktop windows keep rendering when their shape is portrait', () => {
    const run = runtime({ touch: false }); run.turn(true); run.settle();
    assert.equal(run.window.MapScene.isPortrait(), false);
    assert.equal(run.window.MapScene.isViewportResizing(), false);
    assert.equal(run.root.hasAttribute('data-game-viewport-paused'), false);
});
