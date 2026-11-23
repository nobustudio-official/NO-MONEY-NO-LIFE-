const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getEventListeners } = require('node:events');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync(require.resolve('../' + name), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function runtime(touch = true) {
    let sequence = 0;
    const timers = new Map(), frames = new Map(), observers = [], updates = [];
    class Element extends EventTarget {
        constructor(tag = 'div') {
            super(); this.tag = tag; this.parent = null; this.children = []; this.dataset = {};
            this.attributes = new Map(); this.style = { removeProperty() {}, setProperty() {} };
            this.classList = { contains: () => false, toggle() {} };
        }
        get isConnected() { return this.tag === 'body' || Boolean(this.parent?.isConnected); }
        append(child) { child.parent = this; this.children.push(child); }
        remove() { this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
        closest(selector) {
            if ((selector === '#mapBoard' && this.id === 'mapBoard') || (selector === '.map-area' && this.isArea)) return this;
            return this.parent?.closest(selector) || null;
        }
        querySelectorAll(selector) {
            return this.children.flatMap(child => [
                ...((selector === 'img' && child.tag === 'img') || (selector === '#mapBoard' && child.id === 'mapBoard') ? [child] : []),
                ...child.querySelectorAll(selector)
            ]);
        }
        getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100 }; }
        getAttribute(name) { return this.attributes.get(name) ?? null; }
        hasAttribute(name) { return this.attributes.has(name); }
        removeAttribute(name) { this.attributes.delete(name); }
        set src(value) { this.attributes.set('src', value); }
        get src() { return this.getAttribute('src'); }
        decode() { return Promise.resolve(); }
        load() { this.complete = true; this.naturalWidth = 100; this.dispatchEvent(new Event('load')); }
    }
    const body = new Element('body');
    const context = {
        document: {},
        matchMedia: () => ({ matches: touch }),
        ResizeObserver: class {
            constructor(callback) { this.callback = callback; observers.push(this); }
            observe(target) { this.target = target; }
            disconnect() { this.target = null; this.disconnected = true; }
        },
        requestAnimationFrame(callback) { const id = ++sequence; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, delay }); return id; },
        clearTimeout: id => timers.delete(id),
        MapBackgroundCache: { setViewport: board => updates.push(board) }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(read('map-detail-level.js'), context);
    const api = context.MapDetailLevel;
    return {
        api, context, timers, frames, observers, updates,
        board() {
            const area = new Element(); area.isArea = true;
            const board = new Element(); board.id = 'mapBoard'; body.append(area); area.append(board);
            return { area, board };
        },
        image(board) { const image = new Element('img'); board.append(image); return image; },
        pump() {
            for (const [id, task] of [...timers]) if (task.delay === 32) { timers.delete(id); task.callback(); }
        },
        settleScroll() {
            for (const [id, task] of [...timers]) if (task.delay === 160) { timers.delete(id); task.callback(); }
        }
    };
}

test('one observer per board; disposal removes listeners and cancels work, including late callbacks', () => {
    const f = runtime(), { area, board } = f.board();
    for (let i = 0; i < 10; i++) f.api.refresh(board, 1);
    assert.equal(f.observers.length, 1);
    assert.equal(f.observers[0].target, area);
    assert.equal(getEventListeners(area, 'scroll').length, 1);
    const lateScroll = getEventListeners(area, 'scroll')[0];
    area.dispatchEvent(new Event('scroll'));
    const lateTimer = [...f.timers.values()].find(task => task.delay === 160).callback;
    const lateFrame = [...f.frames.values()][0];
    f.api.dispose(board); f.api.dispose(board);
    assert.equal(f.observers[0].disconnected, true);
    assert.equal(getEventListeners(area, 'scroll').length, 0);
    assert.equal(f.frames.size, 0);
    assert.equal([...f.timers.values()].some(task => task.delay === 160), false);
    const before = f.updates.length;
    f.observers[0].callback(); lateScroll(); lateTimer(); lateFrame();
    f.api.scheduleViewport(board); f.api.refresh(board, 1); f.api.refreshPieces(board, 1); f.api.setZoom(board, .5);
    assert.equal(f.api.beginCameraJump(board), null);
    assert.equal(f.updates.length, before);
    assert.equal(f.frames.size, 0);
    assert.equal(f.observers.length, 1, 'a disposed board must never register again');
});

test('rebuilding fifty maps leaves only the current observer and scroll listener active', () => {
    const f = runtime(); let previous;
    for (let i = 0; i < 50; i++) {
        if (previous) { f.api.dispose(previous.board); previous.area.remove(); }
        previous = f.board(); f.api.refresh(previous.board, 1);
    }
    assert.equal(f.observers.filter(observer => observer.target).length, 1);
    assert.equal(getEventListeners(previous.area, 'scroll').length, 1);
    assert.equal(f.frames.size, 1);
});

test('disposal cancels old active, queued and detached images without cancelling another map', async () => {
    const f = runtime(), old = f.board(), next = f.board();
    f.api.refresh(old.board, 1); f.api.refresh(next.board, 1);
    const images = Array.from({ length: 3 }, () => f.image(old.board));
    const results = images.map((image, i) => f.api.requestImage(image, 'old-' + i)); f.pump();
    assert.equal(images.filter(image => image.src).length, 2);
    images[0].remove();
    const image = f.image(next.board), result = f.api.loadImage(image, 'next');
    f.api.dispose(old.board); f.pump();
    assert.deepEqual(await Promise.all(results), [null, null, null]);
    for (const retired of images) {
        assert.equal(retired.src, null);
        assert.equal(getEventListeners(retired, 'load').length, 0);
        assert.equal(getEventListeners(retired, 'error').length, 0);
        assert.equal(await f.api.loadImage(retired, 'late'), null);
    }
    const lateImage = f.image(old.board);
    f.api.setTileSources([{ element: lateImage, image: 'late', x: 0, y: 0, width: 10, height: 10 }],
        { left: 0, top: 0, right: 100, bottom: 100 });
    assert.equal(lateImage.src, null);
    assert.equal(image.src, 'next'); image.load(); assert.equal(await result, image);
});

test('a disposed camera jump cannot unblock another map camera jump', async () => {
    const f = runtime(), old = f.board(), next = f.board();
    const oldJump = f.api.beginCameraJump(old.board), newJump = f.api.beginCameraJump(next.board);
    const image = f.image(next.board), loaded = f.api.loadImage(image, 'next', 0);
    f.api.dispose(old.board); await oldJump.finish(); f.pump();
    assert.equal(image.src, null);
    assert.equal(f.api.isCameraJumping(next.board), true);
    const ready = newJump.finish(); f.pump();
    assert.equal(image.src, 'next'); image.load(); await loaded; await ready;
});

test('disposing a waiting jump resolves it and its late completion preserves the new map scroll pause', async () => {
    const f = runtime(), old = f.board(), next = f.board();
    let finishOverview;
    f.context.MapOverviewCache = { setZoom() {}, setMobileViewport: () => new Promise(resolve => { finishOverview = resolve; }) };
    const jump = f.api.beginCameraJump(old.board), ready = jump.finish();
    assert.ok([...f.timers.values()].some(task => task.delay === 1500));
    f.api.dispose(old.board);
    f.api.refresh(next.board, 1); next.area.dispatchEvent(new Event('scroll'));
    const image = f.image(next.board), loaded = f.api.loadImage(image, 'next');
    await ready;
    assert.equal([...f.timers.values()].some(task => task.delay === 1500), false);
    finishOverview(); await flush(); f.pump();
    assert.equal(image.src, null, 'old completion must not resume the new map loading');
    f.settleScroll(); f.pump(); assert.equal(image.src, 'next'); image.load(); await loaded;
});

test('disposing one scrolling map keeps the other scrolling map paused', async () => {
    const f = runtime(), old = f.board(), next = f.board();
    for (const map of [old, next]) { f.api.refresh(map.board, 1); map.area.dispatchEvent(new Event('scroll')); }
    const image = f.image(next.board), loaded = f.api.loadImage(image, 'next');
    f.api.dispose(old.board); f.pump(); assert.equal(image.src, null);
    f.settleScroll(); f.pump(); image.load(); assert.equal(await loaded, image);
});

test('desktop loading and tile updates cannot restart disposed images', async () => {
    const f = runtime(false), { board } = f.board(), image = f.image(board);
    f.api.refresh(board, 1); assert.equal(await f.api.loadImage(image, 'desktop'), image);
    f.api.dispose(board); assert.equal(await f.api.loadImage(image, 'late'), null); assert.equal(image.src, null);
});

test('the real template replacement disposes the map before removing its DOM', () => {
    const f = runtime(), { area, board } = f.board(); f.api.refresh(board, 1);
    f.context.document.getElementById = () => ({ content: { cloneNode: () => ({}) } });
    f.context.target = {
        querySelector: () => null, querySelectorAll: () => [board],
        replaceChildren() {
            assert.equal(board.isConnected, true);
            assert.equal(getEventListeners(area, 'scroll').length, 0);
            assert.equal(f.observers[0].disconnected, true);
            area.remove();
        }
    };
    const game = read('game.js');
    vm.runInContext(game.slice(game.indexOf('function renderGameTemplate('), game.indexOf('function showGameLoadingScreen(')), f.context);
    vm.runInContext('renderGameTemplate("mainGameTemplate", target)', f.context);
    assert.equal(board.isConnected, false);
});
