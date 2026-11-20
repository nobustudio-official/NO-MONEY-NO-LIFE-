const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../se-sync.js');

function setup({ decode, ignoreVolume = true } = {}) {
    class Audio extends EventTarget {
        constructor(src) { super(); this.src = src; this.paused = true; this.currentTime = 0; this.nativePlays = 0; this.level = 1; }
        set volume(value) { if (!ignoreVolume) this.level = value; }
        get volume() { return this.level; }
        play() { this.nativePlays++; this.paused = false; return Promise.resolve(); }
        pause() { this.paused = true; }
        dispatchEvent(event) { const result = super.dispatchEvent(event); this['on' + event.type]?.(event); return result; }
    }
    const sources = [];
    const node = () => ({ connect(target) { this.target = target; }, disconnect() {} });
    class AudioContext {
        constructor() { this.state = 'running'; this.destination = {}; }
        resume() { return Promise.resolve(); }
        decodeAudioData() { return decode ? decode() : Promise.resolve({ duration: 3 }); }
        createGain() { return { ...node(), gain: { value: 1 } }; }
        createBufferSource() {
            const source = { ...node(), starts: 0, stops: 0, start() { this.starts++; }, stop() { this.stops++; } };
            sources.push(source); return source;
        }
    }
    const slider = new EventTarget(); slider.value = '20';
    const label = { textContent: '' };
    const document = new EventTarget();
    document.getElementById = id => id === 'seVolumeSlider' ? slider : label;
    const root = { HTMLMediaElement: Audio, AudioContext, Event, document, mobileRuntimeTuning: true,
        fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }) };
    const se = create(root, {});
    se.unlock();
    const setSlider = value => { slider.value = String(value); slider.dispatchEvent(new Event('input')); };
    return { Audio, se, sources, setSlider };
}

test('routed SE follows the existing slider when native audio volume is ignored', async () => {
    const f = setup(), audio = new f.Audio('sounds/warp.mp3');
    await f.se.playLocal(audio);
    assert.equal(audio.nativePlays, 0);
    assert.equal(f.sources[0].target.gain.value, .2);
    for (const value of [0, 10, 50, 100]) {
        f.setSlider(value);
        assert.equal(f.sources[0].target.gain.value, value / 100);
    }
});

for (const loopEnd of [.83, 2]) {
    test(`dice/roulette preserves its ${loopEnd}s loop and stops through the existing pause call`, async () => {
        const f = setup(), audio = new f.Audio('sounds/spin.wav');
        await f.se.playLocal(audio, Infinity, { loopEnd });
        const source = f.sources[0];
        assert.equal(source.loop, true);
        assert.equal(source.loopEnd, loopEnd);
        f.setSlider(0);
        assert.equal(source.target.gain.value, 0);
        audio.pause();
        assert.equal(source.stops, 1);
        await f.se.playLocal(audio, Infinity, { loopEnd });
        assert.equal(f.sources[1].target.gain.value, 0);
        f.setSlider(30);
        assert.equal(f.sources[1].target.gain.value, .3);
    });
}

test('closing an event during decoding cancels the queued SE', async () => {
    let finishDecode;
    const f = setup({ decode: () => new Promise(resolve => { finishDecode = resolve; }) });
    const audio = new f.Audio('sounds/guide.mp3');
    const pending = f.se.playLocal(audio);
    await new Promise(resolve => setImmediate(resolve));
    audio.pause();
    finishDecode({ duration: 3 });
    await pending;
    assert.equal(f.sources.length, 0);
    assert.equal(audio.nativePlays, 0);
});

test('one-shot completion still notifies existing event listeners and onended callbacks', async () => {
    const f = setup(), audio = new f.Audio('sounds/roulette-stop.mp3');
    let listener = 0, callback = 0;
    audio.addEventListener('ended', () => listener++);
    audio.onended = () => callback++;
    await f.se.playLocal(audio);
    assert.equal(f.sources[0].loop, false);
    f.sources[0].onended();
    assert.equal(listener, 1);
    assert.equal(callback, 1);
    audio.pause();
    assert.equal(f.sources[0].stops, 0);
});

test('restarting a loop stops the previous source before creating another', async () => {
    const f = setup(), audio = new f.Audio('sounds/spin.wav');
    await f.se.playLocal(audio, Infinity, { loopEnd: .83 });
    await f.se.playLocal(audio, Infinity, { loopEnd: .83 });
    assert.equal(f.sources[0].stops, 1);
    assert.equal(f.sources[1].starts, 1);
    f.se.stop(audio);
    assert.equal(f.sources[1].stops, 1);
});
