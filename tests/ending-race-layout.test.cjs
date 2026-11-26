const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../ending-presentation.js'), 'utf8');
const css = fs.readFileSync(require.resolve('../ending-presentation.css'), 'utf8');
const start = source.indexOf('            const laneDimensions = () => {');
const end = source.indexOf('\n            positionAtStart();', start);
assert.ok(start >= 0 && end > start);
const layoutCode = source.slice(start, end) + '\nglobalThis.layout = {laneDimensions, positionAtStart, positionRacers};';

function fixture(count, width, height) {
    const run = {
        count, finalPlayers: Array.from({length: count}, () => ({})),
        racers: Array.from({length: count}, () => ({style: {}})),
        racerNames: Array.from({length: count}, () => ({style: {}})),
        runnerX: Array(count).fill(0), route: {clientWidth: width, clientHeight: height},
        stageEl: {clientWidth: width * 2.2}, startLine: {style: {}}, finish: {style: {}},
        raceRules: require('../ending-race-rules.js')
    };
    vm.runInNewContext(layoutCode, run);
    return run;
}

test('two to four racers start at their running size and fit inside their lanes', () => {
    for (const count of [2, 3, 4]) for (const [width, height] of [[672, 307], [852, 393], [1920, 1080]]) {
        const run = fixture(count, width, height);
        run.layout.positionAtStart();
        const dimensions = run.layout.laneDimensions();
        const initial = run.racers.map(racer => ({...racer.style}));
        assert.ok(dimensions.size <= dimensions.laneH * .9);
        assert.ok(dimensions.size <= 180);
        assert.ok(run.racers.every(racer => Number.parseFloat(racer.style.width) === dimensions.size));
        run.layout.positionRacers(dimensions);
        assert.deepEqual(run.racers.map(racer => racer.style), initial, 'the first running frame cannot resize or move the waiting racers');
    }
});

test('names follow the racer front at lane center, including after a waiting-screen resize', () => {
    const run = fixture(4, 852, 393);
    for (const height of [393, 307]) {
        run.route.clientHeight = height;
        run.layout.positionAtStart();
        const dimensions = run.layout.laneDimensions();
        run.runnerX[1] += 150;
        run.layout.positionRacers(dimensions);
        for (let i = 0; i < 4; i++) {
            assert.equal(Number.parseFloat(run.racerNames[i].style.left), run.runnerX[i] + dimensions.size / 2 + 8);
            assert.equal(Number.parseFloat(run.racerNames[i].style.top), dimensions.centers[i]);
        }
    }
});

test('name labels are below every racer layer and the duplicate START label is absent', () => {
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const z = selector => Number(rules.filter(([, s, body]) => s.trim() === selector && /z-index:/.test(body)).at(-1)[2].match(/z-index:(\d+)/)[1]);
    assert.ok(z('#endingPresentationOverlay.bf-new-ending-race-scene .bf-racer-name') < z('#endingPresentationOverlay .bf-race-lane'));
    assert.ok(z('#endingPresentationOverlay .bf-race-lane') < z('#endingPresentationOverlay .bf-racer'));
    assert.ok(css.includes('text-align:left;white-space:nowrap'));
    assert.ok(!source.includes('<span>START</span>'));
    assert.ok(source.includes('class="bf-race-startline" aria-hidden="true"></div>${nameMarkup}${laneMarkup}'));
    const button = rules.find(([, s]) => s.trim() === '#endingPresentationOverlay .bf-race-ready button')[2];
    for (const declaration of ['padding:3px 7px', 'border:1px solid #d8ba71', 'border-radius:5px', 'background:#0d2239ed', 'color:#ffdc83']) assert.ok(button.includes(declaration));
});
