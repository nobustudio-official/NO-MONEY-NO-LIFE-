// =========================
// BGM
// =========================

// 基本音量
const BGM_VOLUME = 0.10;
let currentBGMVolume = BGM_VOLUME;
const SE_VOLUME = 0.50;
const bgmStates = new Map();

function createBGM(path) {
    const audio = new Audio();
    audio.preload = "none";
    audio.src = path;
    bgmStates.set(audio, { gain: null, enabled: false, version: 0, level: BGM_VOLUME });
    return audio;
}

//冒険
const adventureBGM =
    createBGM("BGM/冒険.mp3");

let bgmAudioContext = null;

let adventureBGMGain = null;
let townBGMGain = null;
let dividendBGMGain = null;
let dividendBGMFadeMultiplier = 1;
let grasslandBGMGain = null;
let desertBGMGain = null;
let volcanoBGMGain = null;
let forestBGMGain = null;
let snowBGMGain = null;
let ancientRuinsBGMGain = null;
let undergroundBGMGain = null;
let bossVictoryBGMGain = null;
let bossBattleBGMGain = null;
let maouFastBGMGain = null;
let maouFinalBGMGain = null;
let maouEndBGMGain = null;

let pendingBGMPlayback = null;

function resumeBGMContext() {
    if (!bgmAudioContext || !["suspended", "interrupted"].includes(bgmAudioContext.state)) return;
    try {
        bgmAudioContext.resume().catch(error => console.warn("【BGM】音声処理を再開できません:", error));
    } catch (error) {
        console.warn("【BGM】音声処理を再開できません:", error);
    }
}

function retryBGMPlayback() {
    // Both calls must happen within the gesture, without awaiting resume().
    resumeBGMContext();
    const request = pendingBGMPlayback;
    if (!request || request.inFlight) return;
    const state = bgmStates.get(request.audio);
    if (!state.enabled || state.version !== request.version) return;
    setBGMLevel(request.audio, state.level);
    request.inFlight = true;
    const failed = error => {
        if (pendingBGMPlayback !== request) return;
        request.inFlight = false;
        console.warn("【BGM】再生失敗:", error);
    };
    try {
        Promise.resolve(request.audio.play()).then(() => {
            // A late completion must never revive a track that was stopped.
            if (!state.enabled) {
                silenceBGM(request.audio);
                request.audio.pause();
                return;
            }
            if (state.version !== request.version) return;
            setBGMLevel(request.audio, state.level);
            if (pendingBGMPlayback === request) pendingBGMPlayback = null;
        }, failed);
    } catch (error) {
        failed(error);
    }
}

function playBGM(bgm) {
    const state = bgmStates.get(bgm);
    state.enabled = true;
    pendingBGMPlayback = { audio: bgm, inFlight: false, version: ++state.version };
    bgm.muted = false;
    retryBGMPlayback();
}

function silenceBGM(bgm) {
    // Web playback keeps the media element stable and silences its GainNode.
    const gain = bgmStates.get(bgm).gain;
    if (gain) {
        gain.gain.cancelScheduledValues(0);
        gain.gain.value = 0;
    } else bgm.volume = 0;
}

function deactivateBGM(bgm) {
    const state = bgmStates.get(bgm);
    state.enabled = false;
    state.version++;
    if (pendingBGMPlayback?.audio === bgm) pendingBGMPlayback = null;
    silenceBGM(bgm);
}

function pauseBGM(bgm) {
    deactivateBGM(bgm);
    bgm.pause();
}

function setBGMLevel(bgm, volume) {
    const state = bgmStates.get(bgm);
    state.level = Math.max(0, Math.min(1, Number(volume) || 0));
    const level = state.enabled ? state.level : 0;
    if (state.gain) {
        state.gain.gain.value = level;
    } else bgm.volume = level;
}

function recoverBGM() {
    if (!document.hidden) retryBGMPlayback();
}

for (const event of ["pointerdown", "touchend", "keydown"]) {
    document.addEventListener(event, recoverBGM, { capture: true, passive: true });
}
document.addEventListener("visibilitychange", recoverBGM);

adventureBGM.loop = true;
adventureBGM.volume = BGM_VOLUME;
adventureBGM.preload = "none";


// =========================
// BGM共通再生処理
// Web / スマホ対応
// =========================

function setupBGM(
    bgm,
    gainNode,
    gainSetter
) {
    // Silence outgoing tracks before any context/source preparation can stall.
    stopAllBGM();
    bgm.preload = "auto";
    const gain = setupBGMGain(bgm, gainNode);
    if (gain) {
        gainSetter(gain);
        bgm.volume = 1;
    }
    setBGMLevel(bgm, currentBGMVolume);
    bgm.currentTime = 0;
    playBGM(bgm);
}

// =========================
// BGM GainNode設定
// =========================

function setAdventureBGMGain(
    gain
) {

    adventureBGMGain =
        gain;

}


function setDividendBGMGain(gain) {
    dividendBGMGain = gain;
}

function startDividendBGM() {
    dividendBGMFadeMultiplier = 1;
    setupBGM(dividendBGM, dividendBGMGain, setDividendBGMGain);
    return dividendBGM;
}

function setDividendBGMFade(multiplier) {
    dividendBGMFadeMultiplier = Math.max(0, Math.min(1, Number(multiplier) || 0));
    setBGMLevel(dividendBGM, currentBGMVolume * dividendBGMFadeMultiplier);
}

function stopDividendBGM() {
    pauseBGM(dividendBGM);
    dividendBGM.currentTime = 0;
    dividendBGM.preload = "none";
    setDividendBGMFade(1);
}

window.DividendBGMController = Object.freeze({
    start: startDividendBGM,
    setFade: setDividendBGMFade,
    stop: stopDividendBGM
});

function setAncientRuinsBGMGain(gain) {
    ancientRuinsBGMGain = gain;
}


function setBossVictoryBGMGain(
    gain
) {

    bossVictoryBGMGain =
        gain;

}


function setBossBattleBGMGain(
    gain
) {

    bossBattleBGMGain =
        gain;

}

function setMaouFastBGMGain(
    gain
) {

    maouFastBGMGain =
        gain;

}


function setMaouFinalBGMGain(
    gain
) {

    maouFinalBGMGain =
        gain;

}


function setMaouEndBGMGain(
    gain
) {

    maouEndBGMGain =
        gain;

}

// =========================
// 冒険BGM
// =========================

function setupAdventureBGM() {
    setupBGM(adventureBGM, adventureBGMGain, setAdventureBGMGain);
}

// =========================
// 各BGMのWeb / スマホ用設定
// =========================

function setupBGMGain(
    bgm,
    gainNode
) {

    if (location.protocol === "file:") {

        return;

    }

    const state = bgmStates.get(bgm);
    if (gainNode || state.gain) {
        state.gain = gainNode || state.gain;
        return state.gain;
    }


    if (!bgmAudioContext) {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        bgmAudioContext =
            new AudioContext();

    }


    const newGain =
        bgmAudioContext.createGain();

    const source =
        bgmAudioContext.createMediaElementSource(
            bgm
        );

    source.connect(
        newGain
    );

    newGain.connect(
        bgmAudioContext.destination
    );

    newGain.gain.value = state.enabled ? currentBGMVolume : 0;
    state.gain = newGain;

    return newGain;

}

//街
const townBGM =
    createBGM("BGM/街.mp3");

townBGM.loop = true;
townBGM.volume = BGM_VOLUME;
townBGM.preload = "none";

// 配当中
const dividendBGM = createBGM("BGM/配当.mp3");
dividendBGM.loop = true;
dividendBGM.volume = BGM_VOLUME;
dividendBGM.preload = "none";

// 草原・火山エリア
const grasslandBGM = createBGM("BGM/草原.mp3");
grasslandBGM.loop = true;
grasslandBGM.volume = BGM_VOLUME;
grasslandBGM.preload = "none";

const desertBGM = createBGM("BGM/砂漠.mp3");
desertBGM.loop = true;
desertBGM.volume = BGM_VOLUME;
desertBGM.preload = "none";

const volcanoBGM = createBGM("BGM/火山.mp3");
volcanoBGM.loop = true;
volcanoBGM.volume = BGM_VOLUME;
volcanoBGM.preload = "none";

const forestBGM = createBGM("BGM/森.mp3");
forestBGM.loop = true;
forestBGM.volume = BGM_VOLUME;
forestBGM.preload = "none";

const snowBGM = createBGM("BGM/雪山.mp3");
snowBGM.loop = true;
snowBGM.volume = BGM_VOLUME;
snowBGM.preload = "none";

const ancientRuinsBGM = createBGM("BGM/古代遺跡.mp3");
ancientRuinsBGM.loop = true;
ancientRuinsBGM.volume = BGM_VOLUME;
ancientRuinsBGM.preload = "none";

// 地下労働施設の本体実装時に、エリアBGMとして切り替える。
const undergroundBGM = createBGM("BGM/地下.mp3");
undergroundBGM.loop = true;
undergroundBGM.volume = BGM_VOLUME;
undergroundBGM.preload = "none";

//凱旋
const bossVictoryBGM =
    createBGM("BGM/凱旋.mp3");
bossVictoryBGM.loop = true;
bossVictoryBGM.volume = BGM_VOLUME;
bossVictoryBGM.preload = "none";

//ボス戦
const bossBattleBGM =
    createBGM("BGM/ボス戦.mp3");

bossBattleBGM.loop = true;
bossBattleBGM.volume = BGM_VOLUME;
bossBattleBGM.preload = "none";

function setupBossBattleBGM() {
    const state = bgmStates.get(bossBattleBGM);
    if (!state.enabled || (bossBattleBGM.paused && pendingBGMPlayback?.audio !== bossBattleBGM)) {
        setupBGM(bossBattleBGM, bossBattleBGMGain, setBossBattleBGMGain);
        return;
    }
    // Keep the arrival track running through the challenge and encounter screens.
    resumeBGMContext();
    setBGMLevel(bossBattleBGM, currentBGMVolume);
    if (pendingBGMPlayback?.audio === bossBattleBGM) retryBGMPlayback();
}

//魔王-fast
const maouFastBGM =
    createBGM("BGM/魔王-fast.mp3");

maouFastBGM.loop = true;
maouFastBGM.volume = BGM_VOLUME;
maouFastBGM.preload = "none";

//魔王-final
const maouFinalBGM =
    createBGM("BGM/魔王-final.mp3");

maouFinalBGM.loop = true;
maouFinalBGM.volume = BGM_VOLUME;
maouFinalBGM.preload = "none";

//魔王-end
const maouEndBGM =
    createBGM("BGM/魔王-end.mp3");

maouEndBGM.loop = true;
maouEndBGM.volume = BGM_VOLUME;
maouEndBGM.preload = "none";


// =========================
// すべてのBGMを停止
// =========================

function stopAllBGM() {

    pendingBGMPlayback = null;
    areaBGMTransitionId++;
    activeAreaBGMKey = null;
    requestedAreaBGMKey = null;
    applyAreaBGMMix = null;

    // Mute every track first, then pause; a slow pause must not leave another audible.
    for (const bgm of bgmStates.keys()) deactivateBGM(bgm);
    for (const bgm of bgmStates.keys()) {
        bgm.pause();
        bgm.preload = "none";
    }

}

// エリアBGMの切り替えは、現在の曲と次の曲を短くクロスフェードする。
let activeAreaBGMKey = null;
let requestedAreaBGMKey = null;
let areaBGMTransitionId = 0;
let applyAreaBGMMix = null;
let pausedAreaBGM = null;
const AREA_BGM_TRACKS = {
    adventure: { audio: adventureBGM, getGain: () => adventureBGMGain, setGain: value => { adventureBGMGain = value; } },
    town: { audio: townBGM, getGain: () => townBGMGain, setGain: value => { townBGMGain = value; } },
    dividend: { audio: dividendBGM, getGain: () => dividendBGMGain, setGain: value => { dividendBGMGain = value; } },
    grassland: { audio: grasslandBGM, getGain: () => grasslandBGMGain, setGain: value => { grasslandBGMGain = value; } },
    desert: { audio: desertBGM, getGain: () => desertBGMGain, setGain: value => { desertBGMGain = value; } },
    volcano: { audio: volcanoBGM, getGain: () => volcanoBGMGain, setGain: value => { volcanoBGMGain = value; } },
    forest: { audio: forestBGM, getGain: () => forestBGMGain, setGain: value => { forestBGMGain = value; } },
    snow: { audio: snowBGM, getGain: () => snowBGMGain, setGain: value => { snowBGMGain = value; } },
    ruins: { audio: ancientRuinsBGM, getGain: () => ancientRuinsBGMGain, setGain: setAncientRuinsBGMGain },
    underground: { audio: undergroundBGM, getGain: () => undergroundBGMGain, setGain: value => { undergroundBGMGain = value; } }
};

function pauseAreaBGM() {
    const playingKey = requestedAreaBGMKey || Object.keys(AREA_BGM_TRACKS).find(key => !AREA_BGM_TRACKS[key].audio.paused);
    const pause = { key: playingKey };
    pausedAreaBGM = pause;
    stopAllBGM();

    return () => {
        if (pausedAreaBGM !== pause) return;
        pausedAreaBGM = null;
        if (pause.key) transitionAreaBGM(pause.key, 0, {resume: pause.key === playingKey});
    };
}

function transitionAreaBGM(key, duration = 1400, {resume = false} = {}) {
    const targetKey = AREA_BGM_TRACKS[key] ? key : "adventure";
    if (pausedAreaBGM) {
        pausedAreaBGM.key = targetKey;
        return;
    }
    resumeBGMContext();
    if (!bossBattleBGM.paused || pendingBGMPlayback?.audio === bossBattleBGM) return;
    if (targetKey === requestedAreaBGMKey && !AREA_BGM_TRACKS[targetKey].audio.paused) return;
    requestedAreaBGMKey = targetKey;
    const transitionId = ++areaBGMTransitionId;
    const target = AREA_BGM_TRACKS[targetKey];
    const tracks = Object.values(AREA_BGM_TRACKS);
    const isFile = location.protocol === "file:";
    let context = bgmAudioContext;
    if (!isFile && !context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) bgmAudioContext = context = new AudioContext();
    }

    tracks.forEach(track => {
        if (track.audio.paused) return;
        if (!isFile && context) {
            let gain = track.getGain();
            if (!gain) {
                gain = setupBGMGain(track.audio, null);
                if (gain) track.setGain(gain);
            }
            track._gain = gain;
        }
    });

    if (target.audio.paused || !bgmStates.get(target.audio).enabled) {
        if (isFile || !context) target.audio.volume = 0;
        else {
            let gain = target.getGain();
            if (!gain) {
                gain = setupBGMGain(target.audio, null);
                if (gain) target.setGain(gain);
            }
            target._gain = gain;
            if (gain) {
                gain.gain.cancelScheduledValues(context.currentTime);
                gain.gain.value = 0;
            }
            target.audio.volume = 1;
        }
        target.audio.preload = "auto";
        if (!resume) target.audio.currentTime = 0;
        setBGMLevel(target.audio, 0);
        playBGM(target.audio);
    }

    const startedAt = performance.now();
    const from = new Map(tracks.map(track => {
        const level = isFile || !context ? track.audio.volume : track._gain?.gain.value ?? 0;
        return [track, !track.audio.paused && currentBGMVolume > 0 ? level / currentBGMVolume : 0];
    }));
    let progress = 0;
    applyAreaBGMMix = () => {
        const eased = progress * progress * (3 - 2 * progress);
        tracks.forEach(track => {
            const weight = from.get(track) * (1 - eased) + (track === target ? eased : 0);
            const value = Math.min(1, weight * currentBGMVolume);
            setBGMLevel(track.audio, value);
        });
    };
    const tick = now => {
        if (transitionId !== areaBGMTransitionId) return;
        progress = duration <= 0 ? 1 : Math.min(1, (now - startedAt) / duration);
        applyAreaBGMMix();
        if (progress < 1) requestAnimationFrame(tick);
        else {
            tracks.forEach(track => {
                if (track !== target) {
                    pauseBGM(track.audio);
                    track.audio.currentTime = 0;
                    track.audio.preload = "none";
                }
            });
            activeAreaBGMKey = targetKey;
            applyAreaBGMMix = null;
        }
    };
    if (duration <= 0) tick(performance.now());
    else requestAnimationFrame(tick);
}

// =========================
// すべてのBGMの音量を設定
// =========================

function setBGMVolume(volume) {
    currentBGMVolume = Math.max(0, Math.min(1, Number(volume) || 0));
    for (const bgm of bgmStates.keys()) {
        const multiplier = bgm === dividendBGM ? dividendBGMFadeMultiplier : 1;
        setBGMLevel(bgm, currentBGMVolume * multiplier);
    }
    applyAreaBGMMix?.();
}

window.transitionAreaBGM = transitionAreaBGM;
window.pauseAreaBGM = pauseAreaBGM;
const bgmSlider = document.getElementById('bgmVolumeSlider');
bgmSlider?.addEventListener?.('input', () => {
    setBGMVolume(Number(bgmSlider.value) / 100);
    document.getElementById('bgmVolumeValue').textContent = `${bgmSlider.value}%`;
});

// =========================
// SE
// =========================



//開始音
const startSound =
    new Audio("sounds/シャララン.wav");
startSound.preload = "auto";

//サイコロ回転中
const diceSound =
    new Audio("sounds/サイコロ.wav");
diceSound.preload = "auto";

//サイコロ停止
const stopSound =
    new Audio("sounds/サイコロ停止.mp3");
stopSound.preload = "auto";

//ボタン音
function createDeferredSE(src) {
    const audio = new Audio();
    audio.volume = SE_VOLUME;
    audio.preload = window.mobilePerformanceEnabled === false && window.mobileRuntimeTuning !== true ? "auto" : "none";
    audio.src = src;
    return audio;
}
const buttonSound = createDeferredSE("sounds/決定ボタン.mp3");

//ルーレット回転中
const rouletteSound =
    new Audio("sounds/ルーレット回転中.mp3");
rouletteSound.preload = "auto";

//ルーレット停止
const roulettestopSound =
    new Audio("sounds/ルーレット停止.mp3");
roulettestopSound.preload = "auto";

//プレイヤー切り替え
const switchingSound = createDeferredSE("sounds/プレイヤー切り替え.mp3");

//仮面割れる
const kamenSound =
    new Audio("sounds/ガラスが割れる2.mp3");
kamenSound.preload = "auto";

//魔王第二形態
const secondFormSound =
    new Audio("sounds/忍び寄る恐怖.mp3");
secondFormSound.preload = "auto";

//瞬間移動
const warpSound =
    new Audio("sounds/瞬間移動.mp3");
warpSound.preload = "auto";

//叩き派遣
const tatakiSound = createDeferredSE("sounds/叩き派遣.mp3");

//ロストマジック，ロスノート
const lostSound = createDeferredSE("sounds/ドンドンパフパフ.mp3");

//闇みずほ
const sendSound = createDeferredSE("sounds/金額表示.mp3");

//闇ヤマト・闇スーモ
const send2Sound = createDeferredSE("sounds/回想.mp3");
