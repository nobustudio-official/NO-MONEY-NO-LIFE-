const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

async function preload(constrained, failed = new Set()) {
    const game = read('game.js');
    const requests = [];
    let active = 0, peak = 0;
    class Image {
        set src(value) {
            requests.push(value); active++; peak = Math.max(peak, active);
            queueMicrotask(() => { active--; (failed.has(value) ? this.onerror : this.onload)(); });
        }
    }
    const context = {
        Image, queueMicrotask,
        requestAnimationFrame: callback => queueMicrotask(callback),
        setTimeout: callback => queueMicrotask(callback),
        MapScene: { assetUrls: ['terrain.webp', 'land.svg'] },
        GAME_LOADING_ASSETS: ['gold.webp', 'dice.webp', 'gold.webp'], GAME_LOADING_MIN_TIME: 1200,
        mobileRuntimeTuning: constrained
    };
    context.window = context;
    vm.createContext(context);
    for (const file of ['map-background-raster-data.js', 'map-road-raster-data.js', 'map-overview-raster-data.js']) {
        vm.runInContext(read(file), context, { filename: file });
    }
    vm.runInContext(game.slice(game.indexOf('function preloadGameImage(path)'), game.indexOf('function loadMapData()')), context);
    vm.runInContext(game.slice(game.indexOf('function waitForGameAssets()'), game.indexOf('const startButton =')), context);
    await context.waitForGameAssets();
    return { requests, peak, context };
}

test('phone startup loads the overview without preloading terrain or road tiles', async () => {
    const { requests, peak, context } = await preload(true);
    assert.deepEqual(requests.sort(), [context.MapOverviewRasterData.mobileImage, 'gold.webp', 'dice.webp'].sort());
    assert.equal(peak, 2);
    const tiles = [...context.MapBackgroundRasterData.tiles, ...context.MapRoadRasterData.tiles];
    assert.ok(tiles.length > 50, 'check against production terrain data');
    assert.equal(context.MapRoadRasterData.tiles.length, 0, 'road raster tiles are disabled');
    assert.ok(tiles.every(tile => !requests.includes(tile.image)));
});

test('desktop preload keeps terrain assets and skips removed road tiles', async () => {
    const { requests, peak, context } = await preload(false);
    assert.equal(peak, 8);
    assert.ok(requests.includes('terrain.webp'));
    assert.ok(requests.includes(context.MapOverviewRasterData.image));
    assert.equal(context.MapRoadRasterData.tiles.length, 0);
    assert.equal(new Set(requests).size, requests.length);
});

test('an unavailable startup image does not prevent game initialization', async () => {
    const { requests, peak } = await preload(true, new Set(['gold.webp']));
    assert.ok(requests.includes('dice.webp'));
    assert.equal(peak, 2);
});

class Element {
    constructor(tag) {
        this.tag = tag; this.children = []; this.parentNode = null;
        this.attributes = new Map(); this.style = {}; this.dataset = {};
        this.events = new Map(); this.classes = new Set();
        this.classList = {
            add: (...names) => names.forEach(name => this.classes.add(name)),
            remove: (...names) => names.forEach(name => this.classes.delete(name)),
            contains: name => this.classes.has(name)
        };
    }
    set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
    get className() { return [...this.classes].join(' '); }
    get isConnected() { return this.tag === 'body' || Boolean(this.parentNode?.isConnected); }
    append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
    replaceChildren(...nodes) { this.children.forEach(node => { node.parentNode = null; }); this.children = []; this.append(...nodes); }
    remove() {
        if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
        this.parentNode = null;
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'class') this.className = String(value); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) { this.attributes.delete(name); }
    addEventListener(name, callback) { this.events.set(name, callback); }
    getContext() { return { isPointInPath: () => true }; }
    find(predicate) {
        if (predicate(this)) return this;
        for (const child of this.children) { const found = child.find(predicate); if (found) return found; }
        return null;
    }
    all(predicate) { return [...(predicate(this) ? [this] : []), ...this.children.flatMap(child => child.all(predicate))]; }
}

function opening({ mobile = true, lightweight = false, nextBoss = false } = {}) {
    const body = new Element('body'), images = [], timers = new Map(), frames = new Map();
    let sequence = 0, completed = 0;
    class Image extends Element {
        constructor() { super('img'); images.push(this); }
        set src(value) { this.setAttribute('src', value); }
        get src() { return this.getAttribute('src'); }
        decode() { return Promise.resolve(); }
    }
    class Audio extends Element {
        constructor(src) { super('audio'); this.src = src; }
        play() { queueMicrotask(() => this.events.get('ended')?.()); return Promise.resolve(); }
        pause() {}
    }
    const context = {
        console, Image, Audio, Path2D: class {},
        document: { body, createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag), getElementById: () => null },
        mobileRuntimeTuning: mobile,
        GameSE: { play: () => Promise.resolve(), playLocal: audio => audio.play() }, BossBattleRules: { DAMAGE_MULTIPLIER: 2 },
        MapRoadRasterData: { tiles: [{ image: 'road.webp', x: 0, y: 0, width: 1024, height: 1024 }], bridges: [] },
        performance: { now: () => 0 },
        setTimeout: callback => { const id = ++sequence; timers.set(id, callback); return id; },
        clearTimeout: id => timers.delete(id),
        setInterval: () => ++sequence, clearInterval: () => {},
        requestAnimationFrame: callback => { const id = ++sequence; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id)
    };
    context.window = context;
    vm.runInNewContext(read('boss-opening.js'), context);
    const options = {
        boss: { name: 'Boss', icon: 'boss.webp', hp: 1000, attack: 100, reward: 500 },
        square: { id: 1, x: 500, y: 500, type: 'monster' }, squares: [{ x: 500, y: 500, type: 'monster' }],
        regionData: { world: { width: 9216, height: 7424 }, regions: [{ id: 'grass', name: '草原', path: 'M0 0' }] },
        overview: { image: 'overview.webp', mobileImage: 'mobile.webp', cleanImage: 'clean.webp' },
        lightweight, nextBoss, winnerName: 'A', onComplete() { completed++; }
    };
    const done = context.BossOpening.show(options);
    const overlay = body.children[0];
    return {
        context, body, images, overlay, done,
        get completed() { return completed; },
        click() { overlay.events.get('click')(); },
        drain() {
            for (const [id, callback] of [...timers]) { timers.delete(id); callback(); }
            for (const [id, callback] of [...frames]) { frames.delete(id); callback(2000); }
        }
    };
}

test('phone opening uses the complete baked map without loading separate road tiles', async () => {
    const run = opening();
    assert.ok(run.images.every(image => !image.hasAttribute('src')), 'no early second map or boss decode during narration');
    for (let step = 0; step < 5; step++) run.click();
    await flush();
    const mapImage = run.overlay.find(node => node.tag === 'image');
    assert.equal(mapImage.getAttribute('href'), 'overview.webp');
    assert.equal(run.overlay.all(node => node.classes.has('boss-opening-road-tile')).length, 0);
});

test('the real opening completes narration, lottery, zoom, boss guide and map handoff', async () => {
    const run = opening();
    for (let step = 0; step < 5; step++) run.click();
    await flush();
    run.drain(); run.drain();
    const map = run.overlay.find(node => node.tag === 'svg');
    assert.ok(map.getAttribute('viewBox').split(' ').every(value => Number.isFinite(Number(value))));
    for (let step = 0; step < 6; step++) run.click();
    await run.done;
    assert.equal(run.completed, 1);
    assert.equal(run.body.children.length, 0);
    assert.ok(run.images.every(image => !image.hasAttribute('src')), 'temporary preload references are released');
    run.click();
    assert.equal(run.completed, 1);
});

test('next-boss announcements also use the complete map without a lightweight option', async () => {
    const run = opening({ nextBoss: true });
    await flush();
    assert.equal(run.overlay.find(node => node.tag === 'image').getAttribute('href'), 'overview.webp');
    run.click(); run.drain(); run.drain();
    run.click(); run.click(); run.click();
    await run.done;
    assert.equal(run.completed, 1);
});

test('desktop announcements use the complete map without separate road tile images', async () => {
    const run = opening({ mobile: false });
    assert.deepEqual(run.images.map(image => image.src), ['overview.webp', 'boss.webp']);
    for (let step = 0; step < 5; step++) run.click();
    await flush();
    assert.equal(run.overlay.find(node => node.tag === 'image').getAttribute('href'), 'overview.webp');
    assert.equal(run.overlay.all(node => node.classes.has('boss-opening-road-tile')).length, 0);
});

function mapContext() {
    const created = [];
    class MapImage extends Element {
        constructor() { super('img'); }
        set src(value) { this.setAttribute('src', value); }
    }
    const context = {
        console, URL, Image: MapImage,
        document: {
            currentScript: { src: '' }, documentElement: { style: { setProperty() {} } },
            createElement: tag => { created.push(tag); return new Element(tag); }, querySelector: () => null
        },
        MapContinentData: { grassTexture: 'grass.webp' }, MapRegionBackground: { assetUrls: [] },
        addEventListener() {}, getMapZoomUI: () => 1,
        MapWorkshopScene: { mount() {} }, mobileRuntimeTuning: true, mobileMapDetailEnabled: true
    };
    context.window = context; vm.createContext(context);
    const files = ['map-background-raster-data.js', 'map-road-raster-data.js', 'map-overview-raster-data.js',
        'map-workshop-data.js', 'map-authoring/imported-small-objects.js', 'map-authoring/catalog.js',
        'map-authoring/capital-roads.js', 'map-authoring/bridge-roads.js', 'map-authoring/region-roads.js',
        'map-road-renderer.js', 'map-road-cache.js', 'map-overview-cache.js', 'map.js', 'map-scene.js'];
    for (const file of files) {
        context.document.currentScript.src = 'https://example.test/game/' + file;
        vm.runInContext(read(file), context, { filename: file });
    }
    return { context, created };
}

test('the real production map uses a valid baked image instead of a full-world SVG on phones', () => {
    const { context, created } = mapContext();
    assert.equal(context.MapOverviewCache.signature(), context.MapOverviewRasterData.signature);
    assert.equal(context.MapRoadCache.signature(context.mapData), context.MapRoadRasterData.signature);
    const background = context.MapScene.createBackground(context.mapData);
    assert.ok(background.classList.contains('map-static-background'));
    assert.equal(background.children[0].getAttribute('src'), context.MapOverviewRasterData.mobileImage);
    assert.deepEqual(created, ['div']);
});

test('stale baked maps are rejected instead of masking changed roads or map objects', () => {
    const { context } = mapContext();
    context.MapOverviewRasterData.signature = 'stale';
    assert.equal(context.MapOverviewCache.mountAsBase(new Element('div'), context.mapData), false);
});

test('phones keep runtime memory tuning without a fixed desktop viewport', () => {
    const source = read('index.html');
    const settings = source.slice(source.indexOf('const defaultEnabled = false;'), source.indexOf('</script>', source.indexOf('const defaultEnabled = false;'))).replace(/\}\s*$/, '');
    const context = { URLSearchParams, location: { search: '' }, matchMedia: () => ({ matches: true }) };
    context.window = context;
    vm.runInNewContext(settings, context);
    assert.equal(context.mobileRuntimeTuning, true);
    assert.equal(context.mobileOpeningLightweight, true);
});

test('phone fallback terrain and objects stream even when the old performance rollout is disabled', () => {
    const context = { mobileRuntimeTuning: true, mobilePerformanceEnabled: false, matchMedia: () => ({ matches: false }) };
    context.window = context;
    vm.runInNewContext(read('map-detail-level.js'), context);
    assert.equal(context.MapDetailLevel.touchDevice, true);
});
