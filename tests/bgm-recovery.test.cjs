const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const read = file => fs.readFileSync(require.resolve('../' + file), 'utf8');
const sound = read('sound.js');
const game = read('game.js');
const bossCase = game.indexOf('case "monster":', game.indexOf('function handleSquareEvent('));
assert.ok(bossCase >= 0);
const bossArrival = 'switch ("monster") {' + game.slice(bossCase, game.indexOf('break;', bossCase) + 6) + '}';
const flush = () => new Promise(resolve => setImmediate(resolve));

function runtime(protocol = 'https:') {
    const tracks = [], contexts = [], warnings = [], frames = [];
    let now = 0;
    class Audio {
        constructor(src) {
            Object.assign(this, { src, paused: true, currentTime: 0, volume: 1, attempts: 0, behavior: null });
            tracks.push(this);
        }
        pause() { this.paused = true; }
        play() {
            this.attempts++;
            if (this.behavior) return this.behavior();
            this.paused = false;
            return Promise.resolve();
        }
    }
    class AudioContext {
        constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; this.resumes = 0; contexts.push(this); }
        createGain() { return { connect() {}, gain: { value: 1, cancelScheduledValues() {} } }; }
        createMediaElementSource(audio) {
            assert.equal(audio.routed, undefined, 'reuse the original media source and gain');
            audio.routed = true;
            return { connect(gain) { audio.gain = gain.gain; } };
        }
        resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); }
    }
    const document = new EventTarget();
    document.hidden = false;
    document.getElementById = () => null;
    const context = { Audio, AudioContext, document, location: { protocol },
        console: { warn: (...args) => warnings.push(args) }, performance: { now: () => now },
        requestAnimationFrame: callback => frames.push(callback),
        player: { position: 7 }, currentBossSquareId: 7,
        // The live challenge popup now owns starting the boss-arrival music.
        showBossChallengePopup() { context.gateShown = true; context.setupBossBattleBGM(); } };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(sound, context, { filename: 'sound.js' });
    return { contexts, warnings, document, context,
        run: code => vm.runInContext(code, context),
        track: name => tracks.find(audio => audio.src === 'BGM/' + name + '.mp3'),
        tap: (type = 'touchend') => document.dispatchEvent(new Event(type)),
        tick(time) { now = time; for (const callback of frames.splice(0)) callback(now); } };
}

function reject(audio) {
    audio.behavior = () => Promise.reject(Object.assign(new Error('Playback not allowed'), { name: 'NotAllowedError' }));
}

test('boss arrival retries rejected playback on the next tap at the current slider volume', async () => {
    const f = runtime(), boss = f.track('ボス戦');
    f.run('setupAdventureBGM(); setBGMVolume(.23);');
    await flush();
    reject(boss);
    f.run(bossArrival);
    await flush();
    assert.equal(f.context.gateShown, true);
    assert.equal(f.track('冒険').paused, true);
    assert.equal(boss.paused, true);
    assert.equal(f.warnings.length, 1);
    // Map updates must not replace the pending boss music with a region track.
    f.run('transitionAreaBGM("grassland", 0)');
    assert.equal(f.track('草原').attempts, 0);
    f.run('setBGMVolume(.37)');
    boss.behavior = null;
    f.tap();
    await flush();
    assert.equal(boss.attempts, 2);
    assert.equal(boss.paused, false);
    assert.equal(boss.volume, 1);
    assert.equal(boss.gain.value, .37);
    f.tap();
    assert.equal(boss.attempts, 2, 'successful playback is not restarted on every tap');
});

for (const state of ['suspended', 'interrupted']) {
    test(`${state} BGM context resumes on touch without restarting the song`, async () => {
        const f = runtime(), boss = f.track('ボス戦');
        f.run(bossArrival);
        await flush();
        boss.currentTime = 25;
        f.contexts[0].state = state;
        f.tap();
        assert.equal(f.contexts[0].state, 'running');
        assert.equal(f.contexts[0].resumes, 1);
        assert.equal(boss.currentTime, 25);
        assert.equal(boss.attempts, 1);
    });
}

test('updating the same region resumes a suspended context before returning', async () => {
    const f = runtime();
    f.run('transitionAreaBGM("adventure", 0)');
    await flush();
    f.contexts[0].state = 'suspended';
    f.run('transitionAreaBGM("adventure", 0)');
    assert.equal(f.contexts[0].resumes, 1);
    assert.equal(f.track('冒険').attempts, 1);
});

for (const stop of ['stopAllBGM()', 'pauseBGM(bossBattleBGM)']) {
    test(`${stop} cancels failed playback so a later tap cannot revive it`, async () => {
        const f = runtime(), boss = f.track('ボス戦');
        reject(boss);
        f.run(bossArrival);
        await flush();
        f.run(stop);
        boss.behavior = null;
        f.tap();
        await flush();
        assert.equal(boss.paused, true);
        assert.equal(boss.attempts, 1);
    });
}

test('a delayed failure from an old song cannot replace the newer pending song', async () => {
    const f = runtime(), boss = f.track('ボス戦'), adventure = f.track('冒険');
    let rejectOld;
    boss.behavior = () => new Promise((_, reject) => { rejectOld = reject; });
    f.run(bossArrival);
    reject(adventure);
    f.run('setupAdventureBGM()');
    await flush();
    rejectOld(new Error('Old request aborted'));
    await flush();
    adventure.behavior = null;
    f.tap();
    await flush();
    assert.equal(adventure.paused, false);
    assert.equal(adventure.attempts, 2);
    assert.equal(boss.attempts, 1);
});

test('pointer and touch events do not duplicate an unsettled play request', async () => {
    const f = runtime(), boss = f.track('ボス戦');
    reject(boss);
    f.run(bossArrival);
    await flush();
    let complete;
    boss.behavior = () => new Promise(resolve => { complete = resolve; });
    f.tap('pointerdown');
    f.tap('touchend');
    f.tap('keydown');
    assert.equal(boss.attempts, 2);
    complete();
    await flush();
});

test('hidden pages defer recovery until they become visible', async () => {
    const f = runtime(), boss = f.track('ボス戦');
    reject(boss);
    f.run(bossArrival);
    await flush();
    boss.behavior = null;
    f.document.hidden = true;
    f.tap('visibilitychange');
    assert.equal(boss.attempts, 1);
    f.document.hidden = false;
    f.tap('visibilitychange');
    await flush();
    assert.equal(boss.paused, false);
});

test('intentional event silence and dividend stopping cancel retries', async () => {
    const f = runtime(), adventure = f.track('冒険'), dividend = f.track('配当');
    reject(adventure);
    f.run('transitionAreaBGM("adventure", 0)');
    await flush();
    f.run('pauseAreaBGM()');
    adventure.behavior = null;
    f.tap();
    assert.equal(adventure.attempts, 1);
    reject(dividend);
    f.run('startDividendBGM()');
    await flush();
    f.run('stopDividendBGM()');
    dividend.behavior = null;
    f.tap();
    assert.equal(dividend.attempts, 1);
});

test('region crossfades keep their existing duration and volume mix', async () => {
    const f = runtime();
    f.run('setBGMVolume(.2); transitionAreaBGM("adventure", 0)');
    await flush();
    f.run('transitionAreaBGM("grassland", 1400)');
    await flush();
    f.tick(700);
    assert.equal(f.track('冒険').gain.value, .1);
    assert.equal(f.track('草原').gain.value, .1);
    f.tick(1400);
    assert.equal(f.track('冒険').paused, true);
    assert.equal(f.track('草原').gain.value, .2);
});

test('file playback can retry without creating a Web Audio context', async () => {
    const f = runtime('file:'), boss = f.track('ボス戦');
    reject(boss);
    f.run(bossArrival);
    await flush();
    boss.behavior = null;
    f.tap();
    await flush();
    assert.equal(boss.paused, false);
    assert.equal(f.contexts.length, 0);
    assert.equal(boss.volume, .1);
});

function mapAudio(f, regions = ['grassland']) {
    Object.assign(f.context, {
        gameOpeningComplete: true,
        players: regions.map((_, i) => ({ position: i + 1 })),
        getCurrentPlayerIndex: () => 0,
        mapData: regions.map((_, i) => ({ id: i + 1, x: i + 1, y: 0 })),
        MapRegionRules: { regionAt: (_, x) => ({ id: regions[x - 1] }) }
    });
    f.run(read('map-area-audio.js'));
}

test('returning from boss music plays the active region directly and a map refresh does not restart it', async () => {
    const tracks = { grassland: '草原', town: '街', desert: '砂漠', volcano: '火山', forest: '森', snow: '雪山', ruins: '古代遺跡' };
    for (const [region, name] of Object.entries(tracks)) {
        const f = runtime(); mapAudio(f, [region]);
        f.run('setupBGM(bossVictoryBGM, bossVictoryBGMGain, setBossVictoryBGMGain); resumeMapBGM();');
        await flush();
        assert.equal(f.track('凱旋').paused, true);
        assert.equal(f.track('冒険').attempts, 0);
        assert.equal(f.track(name).paused, false);
        assert.equal(f.track(name).gain.value, .1);
        f.track(name).currentTime = 12;
        f.run('MapAreaAudio.updateForPlayer(players[0]);');
        await flush();
        assert.equal(f.track(name).attempts, 1);
        assert.equal(f.track(name).currentTime, 12);
    }
});

test('the shared return follows the current player or online owner instead of the defeated boss location', async () => {
    for (const online of [false, true]) {
        const f = runtime(); mapAudio(f, ['grassland', 'forest']);
        if (online) {
            delete f.context.getCurrentPlayerIndex;
            f.context.onlineGame = { sync: { state: { activePlayerIndex: 1 } } };
        } else f.context.getCurrentPlayerIndex = () => 1;
        f.run('setupBGM(bossVictoryBGM, bossVictoryBGMGain, setBossVictoryBGMGain); resumeMapBGM();');
        await flush();
        assert.equal(f.track('森').paused, false);
        assert.equal(f.track('草原').attempts, 0);
        assert.equal(f.track('冒険').attempts, 0);
    }
});

test('map return preserves the underground track and the intentional adventure fallback', async () => {
    const underground = runtime(); mapAudio(underground);
    underground.context.players[0].underground = {};
    underground.run('resumeMapBGM()');
    await flush();
    assert.equal(underground.track('地下').paused, false);
    assert.equal(underground.track('冒険').attempts, 0);
    const fallback = runtime(); mapAudio(fallback, ['capital']);
    fallback.run('resumeMapBGM()');
    await flush();
    assert.equal(fallback.track('冒険').paused, false);
});

test('the actual offline boss aftermath returns straight to grassland before handing off the turn', async () => {
    const f = runtime(); mapAudio(f);
    const battle = read('battle-ui.js');
    f.context.document.querySelector = () => null;
    Object.assign(f.context, {
        bossDefeatedCount: 1, currentBossId: 1, bossFirstPlayer: null, bossRewardGiven: false,
        activeBattle: {}, previousBossSquareId: null,
        BOSS_CONTENTS: { 1: { hp: 100 }, 2: { hp: 200 } },
        getCurrentBossRewards: () => [], BossCeremonyRules: { farthestPlayer: () => null },
        BossAftermath: { show: () => Promise.resolve() }, BossOpening: { show: () => Promise.resolve() },
        selectBossSquare: () => Promise.resolve({ id: 8 }), renderMap() {}, hideLayer() {},
        finishTurn() { f.context.turnFinished = true; }
    });
    f.run(battle.slice(battle.indexOf('async function showOfflineBossAftermath('), battle.indexOf('function startSharedBattle(')));
    await f.run('showOfflineBossAftermath(players[0], BOSS_CONTENTS[1])');
    await flush();
    assert.equal(f.context.turnFinished, true);
    assert.equal(f.track('冒険').attempts, 0);
    assert.equal(f.track('草原').attempts, 1);
    assert.equal(f.track('凱旋').paused, true);
});
