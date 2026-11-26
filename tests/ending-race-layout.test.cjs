const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../ending-presentation.js'), 'utf8');
const css = fs.readFileSync(require.resolve('../ending-presentation.css'), 'utf8');
const start = source.indexOf('            const laneDimensions = () => {');
const end = source.indexOf('\n            positionAtStart();', start);
assert.ok(start >= 0 && end > start);
const layoutCode = source.slice(start, end) + '\nglobalThis.layout = {laneDimensions, positionAtStart, positionRacers, positionNames};';

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

test('two to four racers are 15% larger from the first waiting frame through running', () => {
    for (const count of [2, 3, 4]) for (const [width, height] of [[672, 307], [852, 393], [1920, 1080]]) {
        const run = fixture(count, width, height);
        run.layout.positionAtStart();
        const dimensions = run.layout.laneDimensions();
        const initial = run.racers.map(racer => ({...racer.style}));
        assert.equal(dimensions.size, Math.min(180, dimensions.laneH * .9) * 1.15);
        assert.ok(dimensions.size <= 207);
        assert.ok(run.racers.every(racer => Number.parseFloat(racer.style.width) === dimensions.size));
        run.layout.positionRacers(dimensions);
        assert.deepEqual(run.racers.map(racer => racer.style), initial, 'the first running frame cannot resize or move the waiting racers');
    }
});

test('names stay on the course at the start and leave the viewport with the start line', () => {
    const run = fixture(4, 852, 393);
    for (const height of [393, 307]) {
        run.route.clientHeight = height;
        run.layout.positionAtStart();
        const dimensions = run.layout.laneDimensions();
        const initialNames = run.racerNames.map(name => ({...name.style}));
        run.runnerX[1] += 150;
        run.layout.positionRacers(dimensions);
        assert.deepEqual(run.racerNames.map(name => name.style), initialNames, 'running cannot move the names');
        for (let i = 0; i < 4; i++) {
            assert.equal(Number.parseFloat(run.racerNames[i].style.left), dimensions.viewW * .08 + dimensions.size / 2 + 8);
            assert.equal(Number.parseFloat(run.racerNames[i].style.top), dimensions.centers[i]);
        }
        for (const camera of [{tx:-500,zoom:1,originX:0,originY:0},{tx:-800,zoom:1.62,originX:1200,originY:180}]) {
            const lineX = Number.parseFloat(run.startLine.style.left);
            const screenLineX = camera.tx + camera.originX + (lineX - camera.originX) * camera.zoom;
            run.racerNames.forEach((name, i) => {
                const screenX = camera.tx + camera.originX + (Number.parseFloat(name.style.left) - camera.originX) * camera.zoom;
                const distance = Number.parseFloat(initialNames[i].left) - lineX;
                assert.ok(Math.abs(screenX - screenLineX - distance * camera.zoom) < 1e-9);
                assert.ok(screenX < 0, 'the name leaves the screen after the camera passes the start');
            });
        }
    }
    const animate = source.slice(source.indexOf('            function animateRace('), source.indexOf('            function beginRace()'));
    assert.ok(!animate.includes('positionNames('), 'running frames must not rewrite name positions');
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
