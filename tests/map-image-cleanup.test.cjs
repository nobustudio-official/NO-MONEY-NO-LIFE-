const { test: runTest } = require('node:test');
const test = (name, callback) => runTest(name, { timeout: 2000 }, callback);
const assert = require('node:assert/strict');
const { getEventListeners } = require('node:events');
const fs = require('node:fs');
const vm = require('node:vm');

function runtime(touch = true) {
    const timers = new Map(); let sequence = 0;
    const window = { matchMedia: () => ({ matches: touch }) };
    vm.runInNewContext(fs.readFileSync(require.resolve('../map-detail-level.js'), 'utf8'), {
        window, setTimeout(callback) { const id = ++sequence; timers.set(id, callback); return id; },
        clearTimeout: id => timers.delete(id)
    });
    return { api: window.MapDetailLevel, pump() {
        let count = 0;
        while (timers.size) {
            assert.ok(++count < 100, 'image queue failed to settle');
            const [id, callback] = timers.entries().next().value; timers.delete(id); callback();
        }
    } };
}
class Image extends EventTarget {
    constructor() { super(); this.dataset = {}; this.attributes = new Map(); this.complete = false; this.naturalWidth = 0; }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) { this.attributes.delete(name); }
    set src(value) { this.attributes.set('src', value); this.complete = false; this.naturalWidth = 0; }
    get src() { return this.getAttribute('src'); }
    load() { this.complete = true; this.naturalWidth = 100; this.dispatchEvent(new Event('load')); }
    fail() { this.complete = true; this.naturalWidth = 0; this.dispatchEvent(new Event('error')); }
    decode() { return Promise.resolve(); }
}
function listeners(image, load = 0, error = 0) {
    assert.equal(getEventListeners(image, 'load').length, load, 'remaining load listeners');
    assert.equal(getEventListeners(image, 'error').length, error, 'remaining error listeners');
}

test('reusing an image after successful loads leaves no obsolete error listeners', async () => {
    const { api, pump } = runtime(), image = new Image();
    for (let i = 0; i < 50; i++) {
        const result = api.loadImage(image, 'tile-' + i); pump(); listeners(image, 1, 1);
        image.load(); assert.equal(await result, image); listeners(image);
        api.releaseImage(image); pump(); listeners(image);
    }
});
test('failed loads detach both listeners and reject their own request', async () => {
    const { api, pump } = runtime(), image = new Image();
    for (let i = 0; i < 50; i++) {
        const result = api.loadImage(image, 'missing-' + i); pump();
        const rejected = assert.rejects(result, /画像を読み込めません/);
        image.fail(); await rejected; listeners(image);
        api.releaseImage(image); pump();
    }
});
test('cancelling active loads settles their promises and removes both listeners', async () => {
    const { api, pump } = runtime(), image = new Image();
    for (let i = 0; i < 50; i++) {
        const result = api.loadImage(image, 'cancel-' + i); pump(); listeners(image, 1, 1);
        api.releaseImage(image); assert.equal(await result, null); listeners(image);
        assert.equal(image.hasAttribute('src'), false); pump();
    }
});
test('late callbacks from a cancelled load cannot finish or remove a newer request', async () => {
    const { api, pump } = runtime(), image = new Image();
    const old = api.loadImage(image, 'old'); pump();
    const oldLoad = getEventListeners(image, 'load')[0], oldError = getEventListeners(image, 'error')[0];
    api.releaseImage(image); assert.equal(await old, null);
    const next = api.loadImage(image, 'new'); pump();
    assert.equal(api.loadImage(image, 'new'), next);
    oldLoad(new Event('load')); oldError(new Event('error')); listeners(image, 1, 1);
    let settled = false; next.then(() => { settled = true; }); await Promise.resolve();
    assert.equal(settled, false);
    image.load(); assert.equal(await next, image); listeners(image);
});
test('cleanup preserves listeners owned by the map artwork', async () => {
    const { api, pump } = runtime(), image = new Image(); let loaded = 0, failed = 0;
    const onLoad = () => loaded++, onError = () => failed++;
    image.addEventListener('load', onLoad); image.addEventListener('error', onError);
    const first = api.loadImage(image, 'one'); pump(); image.load(); await first;
    api.releaseImage(image); listeners(image, 1, 1);
    const second = api.loadImage(image, 'two'); pump(); api.releaseImage(image); await second;
    listeners(image, 1, 1);
    assert.deepEqual(getEventListeners(image, 'load'), [onLoad]);
    assert.deepEqual(getEventListeners(image, 'error'), [onError]);
    assert.equal(loaded, 1); assert.equal(failed, 0);
});
test('cancelling a queued image and an externally cleared source releases the two-load queue', async () => {
    const { api, pump } = runtime(), images = Array.from({ length: 4 }, () => new Image());
    const results = images.map((image, i) => api.loadImage(image, 'tile-' + i)); pump();
    assert.deepEqual(images.map(image => Boolean(image.src)), [true, true, false, false]);
    api.releaseImage(images[2]); assert.equal(await results[2], null); listeners(images[2]);
    images[0].removeAttribute('src'); api.releaseImage(images[0]); pump();
    assert.equal(await results[0], null); listeners(images[0]);
    assert.equal(images[3].src, 'tile-3');
    images[1].load(); images[3].load(); await Promise.all([results[1], results[3]]);
    images.forEach(image => listeners(image));
});
test('desktop image loading retains its native decode path', async () => {
    const { api, pump } = runtime(false), image = new Image();
    assert.equal(await api.loadImage(image, 'desktop'), image); pump();
    assert.equal(image.src, 'desktop'); listeners(image);
});
