const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../battle-ui.js'), 'utf8');
const gestures = source.slice(source.indexOf('    function stopBattleMagicScroll()'), source.indexOf('    function usesBattleMotionLayout('));

function runtime() {
    let now = 0, nextId = 1;
    const timers = new Map(), frames = new Map(), captures = new Map(), saved = [], windowEvents = new Map();
    let list;
    class Element {
        constructor(magicId = null) {
            this.dataset = magicId ? { magicId: String(magicId) } : {};
            this.children = []; this.parent = null; this.style = {}; this.disabled = false;
            this.events = new Map(); this.classList = { add() {}, remove() {} };
        }
        get isConnected() { return Boolean(this.parent); }
        get nextElementSibling() { return this.parent?.children[this.parent.children.indexOf(this) + 1] || null; }
        get lastElementChild() { return this.children.at(-1); }
        closest() { return this.dataset.magicId ? this : null; }
        setAttribute() {}
        getBoundingClientRect() {
            const left = this === list ? 0 : (this.parent?.children.indexOf(this) || 0) * 100 - list.scrollLeft;
            const width = this === list ? 300 : 90;
            return { left, right: left + width, top: 100, bottom: 150, width, height: 50 };
        }
        append(child) { child.remove(); child.parent = this; this.children.push(child); }
        insertBefore(child, before) {
            child.remove(); child.parent = this;
            this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, child);
        }
        remove() {
            if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
            this.parent = null;
        }
        replaceWith(child) { this.parent.insertBefore(child, this); this.remove(); }
        cloneNode() { return new Element(this.dataset.magicId); }
        querySelectorAll() { return this.children.filter(child => child.dataset.magicId); }
        querySelector(selector) { return this.children.find(child => child.dataset.magicId === selector.match(/"(\d+)"/)[1]) || null; }
        addEventListener(type, handler) { if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push(handler); }
        emit(type, values = {}) {
            const event = { type, target: this, pointerId: 1, button: 0, clientX: 50, clientY: 125,
                defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...values };
            for (const handler of this.events.get(type) || []) handler(event);
            return event;
        }
        setPointerCapture(id) {
            const previous = captures.get(id); captures.set(id, this);
            if (previous && previous !== this) list.emit('lostpointercapture', { pointerId: id, target: previous });
        }
        hasPointerCapture(id) { return captures.get(id) === this; }
        releasePointerCapture(id) { captures.delete(id); list.emit('lostpointercapture', { pointerId: id, target: this }); }
    }
    list = new Element(); list.scrollLeft = 0;
    const buttons = Array.from({ length: 6 }, (_, i) => new Element(i + 1));
    buttons.forEach(button => list.append(button));
    const arrows = [-1, 1].map(direction => { const button = new Element(); button.dataset.scrollDirection = String(direction); return button; });
    const body = new Element(), popup = new Element();
    popup.querySelectorAll = () => arrows;
    const context = {
        document: { body, createElement: () => new Element(), getElementById: id => id === 'battleNewMagicList' ? list : id === 'battleMainPopup' ? popup : null },
        Date: { now: () => now }, performance: { now: () => now },
        setTimeout(callback, delay) { const id = nextId++; timers.set(id, { at: now + delay, callback }); return id; },
        clearTimeout: id => timers.delete(id), requestAnimationFrame(callback) { const id = nextId++; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id), addEventListener: (type, callback) => windowEvents.set(type, callback),
        battleMagicOrderStorageKey: () => 'player-1', saveBattleMagicOrder: () => saved.push(list.children.filter(c => c.dataset.magicId).map(c => c.dataset.magicId).join(','))
    };
    context.window = context;
    vm.createContext(context);
    const run = code => vm.runInContext(code, context);
    run('let battleMagicScrollFrame=0, battleMagicScrollDirection=0, battleMagicScrollLastTime=0, battleMagicDrag=null, battleMagicDragFrame=0, suppressBattleMagicCastUntil=0, battleMagicWindowEventsReady=false; const battleMagicBoundLists=new WeakSet();\n' + gestures);
    run('initializeBattleMagicInteractions()');
    return { list, buttons, arrows, saved, run,
        down: (target = buttons[0]) => list.emit('pointerdown', { target }),
        move: x => list.emit('pointermove', { clientX: x }),
        up: () => list.emit('pointerup'), cancel: () => list.emit('pointercancel'), blur: () => windowEvents.get('blur')(),
        advance(time) {
            now = time;
            for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
        },
        frame(time) { now = time; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); },
        order: () => list.children.filter(child => child.dataset.magicId).map(child => child.dataset.magicId).join(',') };
}

test('a short tap keeps magic selection available and never begins customization', () => {
    const f = runtime(); f.down(); f.advance(100); f.up(); f.advance(1000);
    assert.equal(f.run('battleMagicDrag'), null);
    assert.equal(f.run('suppressBattleMagicCastUntil'), 0);
    assert.equal(f.saved.length, 0);
});

test('swiping scrolls horizontally and cancels customization even after 0.6 seconds', () => {
    const f = runtime(); f.down(); f.advance(100);
    assert.equal(f.move(10).defaultPrevented, true);
    assert.equal(f.list.scrollLeft, 40);
    f.advance(900);
    assert.equal(f.run('battleMagicDrag.moved'), false);
    assert.equal(f.run('battleMagicDrag.scrolling'), true);
    assert.equal(f.order(), '1,2,3,4,5,6');
    f.up();
    assert.equal(f.run('Date.now() < suppressBattleMagicCastUntil'), true);
    assert.equal(f.saved.length, 0);
});

test('reordering starts at 600 ms and preserves the customized order', () => {
    const f = runtime(); f.down(); f.advance(599);
    assert.equal(f.run('battleMagicDrag.moved'), false);
    f.advance(600);
    assert.equal(f.run('battleMagicDrag.moved'), true);
    f.move(275); f.up();
    assert.equal(f.order(), '2,3,1,4,5,6');
    assert.deepEqual(f.saved, ['2,3,1,4,5,6']);
    assert.equal(f.run('Date.now() < suppressBattleMagicCastUntil'), true);
});

test('cancelling customization restores the original order without saving', () => {
    const f = runtime(); f.down(); f.advance(600); f.move(275); f.cancel();
    assert.equal(f.order(), '1,2,3,4,5,6');
    assert.equal(f.saved.length, 0);
    assert.equal(f.run('battleMagicDrag'), null);
});

for (const target of ['disabled', 'gap']) {
    test(`swipes starting on a ${target} still scroll without starting customization`, () => {
        const f = runtime();
        if (target === 'disabled') f.buttons[0].disabled = true;
        f.down(target === 'gap' ? f.list : f.buttons[0]); f.advance(600); f.move(10);
        assert.equal(f.list.scrollLeft, 40);
        assert.equal(f.run('battleMagicDrag.moved'), false);
        f.up();
        assert.equal(f.saved.length, 0);
    });
}

test('cancellation and window blur clear pending long presses', () => {
    for (const stop of ['cancel', 'blur']) {
        const f = runtime(); f.down(); f.advance(400); f[stop](); f.advance(1000);
        assert.equal(f.run('battleMagicDrag'), null);
        assert.equal(f.order(), '1,2,3,4,5,6');
        assert.equal(f.saved.length, 0);
    }
});

test('the existing scroll arrows still move the list and stop when released', () => {
    const f = runtime(); f.arrows[1].emit('pointerdown'); f.frame(16); f.frame(32);
    assert.ok(f.list.scrollLeft > 8);
    f.arrows[1].emit('pointerup');
    const stopped = f.list.scrollLeft; f.frame(64);
    assert.equal(f.list.scrollLeft, stopped);
});
