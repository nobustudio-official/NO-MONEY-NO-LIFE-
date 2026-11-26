const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../ending-presentation.js'), 'utf8');
const css = fs.readFileSync(require.resolve('../ending-presentation.css'), 'utf8');
const framesStart = source.indexOf('    const raceSpriteFrames = {');
const framesEnd = source.indexOf('\n    function show(', framesStart);
const start = source.indexOf('            let spriteLaneH = -1, sprites = [];');
const end = source.indexOf('\n            positionAtStart();', start);
assert.ok(framesStart >= 0 && framesEnd > framesStart && start >= 0 && end > start);
const layoutCode = source.slice(framesStart, framesEnd) + source.slice(start, end) +
    '\nglobalThis.layout = {laneDimensions, positionAtStart, positionRacers, positionNames, positionSprite, fitRaceSprite, raceSpriteFrames};';

function element() {
    const style = {};
    Object.defineProperty(style, 'setProperty', {value(name, value) { this[name] = value; }});
    return {style};
}

function fixture(count, width, height) {
    const run = {
        count, finalPlayers: Array.from({length: count}, (_, index) => ({character: ['めぐみ', '剣士', '聖職者', '魔術師'][index % 4]})),
        racers: Array.from({length: count}, element),
        racerNames: Array.from({length: count}, () => ({style: {}})),
        runnerX: Array(count).fill(0), route: {clientWidth: width, clientHeight: height},
        stageEl: {clientWidth: width * 2.2}, startLine: {style: {}}, finish: {style: {}},
        raceRules: require('../ending-race-rules.js')
    };
    vm.runInNewContext(layoutCode, run);
    return run;
}

test('two to four racers use their lane height from the first waiting frame through running', () => {
    for (const count of [2, 3, 4]) for (const [width, height] of [[672, 307], [852, 393], [1920, 1080]]) {
        const run = fixture(count, width, height);
        run.layout.positionAtStart();
        const dimensions = run.layout.laneDimensions();
        const initial = run.racers.map(racer => ({...racer.style}));
        assert.equal(dimensions.size, dimensions.laneH - 2);
        run.racers.forEach((racer, index) => {
            const sprite = dimensions.sprites[index];
            assert.equal(Number.parseFloat(racer.style.width), sprite.width);
            assert.equal(Number.parseFloat(racer.style.height), sprite.height);
            assert.ok(Math.abs(Number.parseFloat(racer.style.top) + sprite.centerY - dimensions.laneH / 2) < 1e-9);
        });
        run.layout.positionRacers(dimensions);
        assert.deepEqual(run.racers.map(racer => racer.style), initial, 'the first running frame cannot resize or move the waiting racers');
        assert.equal(run.layout.laneDimensions().sprites, dimensions.sprites, 'unchanged lane height reuses fitted geometry');
    }
});

test('all ten alpha bounds maximize the visible racer while allowing its full running sway', () => {
    const run = fixture(4, 852, 393);
    const frames = run.layout.raceSpriteFrames;
    assert.equal(Object.keys(frames).length, 10);
    for (const character of Object.keys(frames)) for (const laneH of [61.4, 78.6, 540]) {
        const sprite = run.layout.fitRaceSprite(character, laneH);
        const [width, height, left, top, right, bottom] = frames[character];
        assert.ok(Math.abs(sprite.width / width - sprite.height / height) < 1e-9, 'keep the source aspect ratio');
        assert.ok(Math.abs(sprite.visibleHeight / (bottom - top) - sprite.visibleWidth / (right - left)) < 1e-9);
        for (let degrees = -7; degrees <= 7; degrees++) {
            const angle = degrees * Math.PI / 180;
            const envelope = sprite.visibleHeight * Math.cos(angle) + sprite.visibleWidth * Math.abs(Math.sin(angle));
            assert.ok(envelope <= laneH - 2 + 1e-9, 'visible corners stay within the lane during sway');
            if (Math.abs(degrees) === 7) assert.ok(Math.abs(envelope - (laneH - 2)) < 1e-9, 'fit reaches the available height');
        }
    }
    assert.ok(run.layout.fitRaceSprite('戦士', 540).visibleHeight > 207, 'large lanes are no longer limited by the old fixed cap');
});

test('spotlight sprites keep the same visible center and scale as the course sprites', () => {
    const run = fixture(4, 852, 393);
    for (const sprite of run.layout.laneDimensions().sprites) for (const zoom of [1, 1.62]) {
        const image = element();
        run.layout.positionSprite(image, sprite, 700, 200, zoom);
        assert.ok(Math.abs(Number.parseFloat(image.style.left) + sprite.centerX * zoom - 700) < 1e-9);
        assert.ok(Math.abs(Number.parseFloat(image.style.top) + sprite.centerY * zoom - 200) < 1e-9);
        assert.equal(Number.parseFloat(image.style.height), sprite.height * zoom);
        assert.equal(image.style['--bf-racer-origin'], sprite.origin);
    }
    assert.ok(css.includes('transform-origin:var(--bf-racer-origin,50% 50%)'));
    assert.ok(source.includes('positionSprite(image, sprites[index], x, y, cameraZoom)'));
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
            assert.equal(Number.parseFloat(run.racerNames[i].style.left), dimensions.viewW * .08 + dimensions.sprites[i].visibleWidth / 2 + 8);
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
