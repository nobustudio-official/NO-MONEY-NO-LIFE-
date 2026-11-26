const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../dividend-presentation.js'), 'utf8');
const start = source.indexOf('  function draw() {');
const end = source.indexOf('  function fitLegendItems()', start);
assert.ok(start >= 0 && end > start);

function chart(stage, width = 700) {
    const plot = {
        getBoundingClientRect: () => ({width, height: 240}),
        querySelectorAll: () => [], querySelector: () => null, innerHTML: ''
    };
    const context = {
        stage, body: {querySelector: selector => selector === '.dp-plot' ? plot : {style: {setProperty() {}}}, querySelectorAll: () => []},
        window: {innerWidth: 852}, document: {createElement: () => ({getContext: () => ({measureText: text => ({width: text.length * 8})})})},
        root: {}, getComputedStyle: () => ({fontFamily: 'sans-serif'}),
        data: [
            {name: 'A', property: 30, cash: 70, history: [-20, 0, 100], color: '#f00'},
            {name: 'B', property: 20, cash: -50, history: [10, 20, 80], color: '#0f0'}
        ],
        options: {historyTurns: [0, 1, 2]}, stages: ['', '', 'assets', 'history'],
        format: n => String(n), total: p => p.property + p.cash,
        stackedBarMarkup: () => '', updateChart() {}, fitLegendItems() {}, performance: {now: () => 0}
    };
    vm.runInNewContext(source.slice(start, end) + '\ndraw();', context);
    const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
    return {
        axes: [...plot.innerHTML.matchAll(/<line class="dp-axis-line"[^>]*>/g)].map(m => attributes(m[0])),
        ticks: [...plot.innerHTML.matchAll(/<text class="dp-x-tick"[^>]*>/g)].map(m => attributes(m[0]))
    };
}

test('history turn labels sit fully below the bottom axis, including negative balances', () => {
    for (const width of [360, 700]) {
        const {axes, ticks} = chart(3, width);
        const x = axes.find(axis => axis['data-axis'] === 'x'), y = axes.find(axis => axis['data-axis'] === 'y');
        assert.equal(x.y1, y.y2);
        assert.equal(x.y1, x.y2);
        assert.ok(ticks.length > 0);
        for (const tick of ticks) {
            assert.ok(Number(tick.y) - 14 > Number(x.y1), 'the text height clears the axis line');
            assert.ok(Number(tick.y) < 240, 'turn labels remain inside the reserved SVG area');
        }
    }
});

test('stacked bars keep their zero axis and graph height when balances are negative', () => {
    const {axes, ticks} = chart(2);
    assert.ok(Number(axes.find(axis => axis['data-axis'] === 'x').y1) < Number(axes.find(axis => axis['data-axis'] === 'y').y2));
    assert.equal(Number(axes.find(axis => axis['data-axis'] === 'y').y2), 236);
    assert.equal(ticks.length, 0);
});

test('opaque white axes are scoped to dividend and ending overlays', () => {
    const css = fs.readFileSync(require.resolve('../dividend-presentation.css'), 'utf8');
    const whiteAxes = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selector, body]) => selector.includes('.dp-axis-line') && /stroke:#fff(?:;|$)/.test(body));
    assert.equal(whiteAxes.length, 1);
    assert.equal(whiteAxes[0][1].trim(), ':is(#dividendPresentationOverlay, #endingPresentationOverlay) #nmnl-dividend-lab .dp-axis-line');
});

test('graph icons retain their four-player baseline and shrink to fit narrower player columns', () => {
    const begin = source.indexOf('  function fitLegendItems() {');
    const finish = source.indexOf('  function fitReceiptText()', begin);
    const code = source.slice(begin, finish) + '\nfitLegendItems();';
    for (const count of [2, 3, 4, 8, 12]) {
        const slotWidth = (420 - (count - 1) * 8) / count;
        const variables = new Map(), writes = [];
        const image = {style: {getPropertyValue: key => variables.get(key), setProperty: (key, value) => {variables.set(key, value); writes.push(value);}}};
        const label = {clientWidth: slotWidth, getBoundingClientRect: () => ({width: slotWidth}), querySelector: () => image};
        const name = {parentElement: label, style: {}, scrollWidth: 40};
        const context = {root: {closest: () => ({})}, body: {querySelectorAll: () => [name]}, getComputedStyle: element => element === image ? {width: '31.44px'} : {fontSize: '12px'}};
        vm.runInNewContext(code, context);
        const visibleWidth = 31.44 * Number(variables.get('--dp-axis-icon-scale'));
        if (count <= 4) assert.ok(Math.abs(visibleWidth - 36) < 1e-9);
        assert.ok(visibleWidth <= slotWidth - 4 + 1e-9);
        assert.deepEqual([...Object.keys(image.style)].sort(), ['getPropertyValue', 'setProperty']);
        vm.runInNewContext('fitLegendItems();', context);
        assert.equal(writes.length, 1, 'unchanged dimensions do not repeat the icon style write');
    }
});

test('legend fitting outside dividend and ending overlays does not change icon scaling', () => {
    const begin = source.indexOf('  function fitLegendItems() {'), finish = source.indexOf('  function fitReceiptText()', begin);
    const name = {parentElement: {clientWidth: 20, getBoundingClientRect: () => ({width: 20}), querySelector: () => {throw new Error('Unrelated icon accessed');}}, style: {}, scrollWidth: 40};
    vm.runInNewContext(source.slice(begin, finish) + '\nfitLegendItems();', {root: {closest: () => null}, body: {querySelectorAll: () => [name]}, getComputedStyle: () => ({fontSize: '12px'})});
    assert.equal(name.style.fontSize, '6px');
});
