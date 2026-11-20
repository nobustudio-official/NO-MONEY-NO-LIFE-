/* SE presentation only. Never changes player balances, inventory, or turns. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else {
        root.GameSE = api.create(root, { confirm: buttonSound, loss: lostSound,
            dispatch: tatakiSound, moneyTransfer: sendSound, transfer: send2Sound,
            hatatakiEvade:createDeferredSE('sounds/瞬間移動.mp3'),
            playerSwitch:switchingSound,
            textAdvance:createDeferredSE('sounds/決定ボタン.mp3'),
            magicPowerUp:createDeferredSE('sounds/魔力向上.mp3'),
            moneyDisplay:createDeferredSE('sounds/金額表示.mp3'),
            rewardDisplay:createDeferredSE('sounds/報酬表示.mp3'),
            squarePass:createDeferredSE('sounds/マス通過音.mp3'),
            squareArrival:createDeferredSE('sounds/マス到着音.mp3'),
            itemUse:createDeferredSE('sounds/アイテム使用.mp3'),
            itemObtain:createDeferredSE('sounds/アイテム取得.mp3'),
            immunity:createDeferredSE('sounds/無敵SE.mp3'),
            marketBoom:createDeferredSE('sounds/ガイド/暴騰アナウンス1.mp3'),
            marketCrash:createDeferredSE('sounds/ガイド/暴落アナウンス1.mp3'),
            marketStableVoice:createDeferredSE('sounds/ガイド/物価安定アナウンス1.mp3'),
            marketChange:createDeferredSE('sounds/物価変動.mp3'),
            marketStable:createDeferredSE('sounds/物価安定.mp3'),
            payment:createDeferredSE('sounds/支払い.mp3'),
            moneyLoss:createDeferredSE('sounds/お金を失う.mp3'),
            mugging:createDeferredSE('sounds/カツアゲ.mp3'),
            ponziScam:createDeferredSE('sounds/ポンジスキーム.mp3'),
            ponziReveal:createDeferredSE('sounds/ポンジバラシ.mp3'),
            bridgeCollapse:createDeferredSE('sounds/橋崩し.mp3'),
            punishment:createDeferredSE('sounds/お仕置き.mp3'),
            punishmentLoss:createDeferredSE('sounds/お仕置き2.mp3'),
            guidebookAnnouncement:createDeferredSE('sounds/ガイド/攻略本アナウンス1.mp3'),
            guidebookReject:createDeferredSE('sounds/ビシッとツッコミ1.mp3'),
            jobStart:createDeferredSE('sounds/バイト開始.mp3'),
            multipleItems:createDeferredSE('sounds/複数アイテム.mp3') }, SE_VOLUME);
        root.playSharedSE = audio => root.GameSE.playShared(audio);
    }
})(typeof window === 'undefined' ? globalThis : window, function () {
    'use strict';
    const soundIds = Object.freeze(['confirm', 'loss', 'dispatch', 'hatatakiEvade', 'moneyTransfer', 'transfer','playerSwitch','textAdvance','magicPowerUp','moneyDisplay','rewardDisplay','squarePass','squareArrival','itemUse','itemObtain','immunity','marketChange','marketBoom','marketCrash','marketStable','marketStableVoice','payment','moneyLoss','mugging','ponziScam','bridgeCollapse','punishment','punishmentLoss','guidebookAnnouncement','guidebookReject','jobStart','multipleItems']);

    function create(root, sounds, defaultVolume = .5) {
        let context = null, sequence = 0, attached = null;
        let volumeLevel;
        const tuneMobile = root.mobileRuntimeTuning === true;
        const deferLoading = tuneMobile || root.mobilePerformanceEnabled !== false;
        let turnSoundWarmed = false;
        const buffers = new Map(), nodes = new Map(), generations = new WeakMap(), seen = new Set(), presentationSeen = new Set();
        const activeSE = new Set(), watchedSE = new WeakSet(), externalGains = new Set();
        const isConfirmSound = audio => audio === sounds.confirm || audio === sounds.textAdvance;
        function watchSE(audio) {
            if (!audio || typeof audio.addEventListener !== 'function') return;
            activeSE.add(audio);
            if (watchedSE.has(audio)) return;
            watchedSE.add(audio);
            const clear = () => activeSE.delete(audio);
            audio.addEventListener('ended', clear);
            audio.addEventListener('pause', () => { if (audio.paused) clear(); });
            audio.addEventListener('error', clear);
        }
        function hasOtherSEPlaying(audio) {
            for (const candidate of [...activeSE]) {
                if (candidate === audio || isConfirmSound(candidate)) continue;
                if (nodes.has(candidate) || candidate.paused === false && candidate.ended !== true) return true;
                activeSE.delete(candidate);
            }
            for (const candidate of nodes.keys()) {
                if (candidate !== audio && !isConfirmSound(candidate)) return true;
            }
            return false;
        }
        // Native dice loops and voiced events can retain their own playback timing.
        const mediaPrototype = root.HTMLMediaElement?.prototype;
        if (mediaPrototype && !mediaPrototype.__nmnlSEActivityHook) {
            const nativePlay = mediaPrototype.play, nativePause = mediaPrototype.pause;
            Object.defineProperty(mediaPrototype, 'play', { configurable:true, writable:true, value:function (...args) {
                const source = String(this.src || this.currentSrc || '').split(/[?#]/, 1)[0];
                if (/(?:^|\/)(?:sounds|images\/back-image)\//i.test(source)) {
                    this.volume = volume();
                    watchSE(this);
                }
                const result = nativePlay.apply(this, args);
                if (result && typeof result.catch === 'function') result.catch(() => activeSE.delete(this));
                return result;
            }});
            Object.defineProperty(mediaPrototype, 'pause', { configurable:true, writable:true, value:function (...args) {
                const result = nativePause.apply(this, args);
                activeSE.delete(this);
                return result;
            }});
            Object.defineProperty(mediaPrototype, '__nmnlSEActivityHook', { value:true });
        }
        for (const audio of Object.values(sounds)) {
            audio.preload = deferLoading ? 'none' : 'auto';
            audio.volume = volume();
        }
        const now = () => root.Date ? root.Date.now() : Date.now();
        const syncNow = () => attached && typeof attached.serverNow === 'function' ? attached.serverNow() : now();

        function load(audio) {
            const src = audio.src;
            if (!buffers.has(src)) {
                const pending = root.fetch(src).then(response => {
                    if (!response.ok) throw Error('SEの読み込みに失敗: ' + response.status);
                    return response.arrayBuffer();
                }).then(data => context.decodeAudioData(data));
                buffers.set(src, pending);
                pending.catch(() => buffers.delete(src));
            }
            return buffers.get(src);
        }
        function unlock() {
            const AudioContext = root.AudioContext || root.webkitAudioContext;
            if (!AudioContext || (!tuneMobile && context?.state === 'running')) return;
            try {
                if (!context) context = new AudioContext();
                // Resume inside the real gesture, before any network/decode wait.
                if (context.state !== 'running') {
                    const resumed = context.resume();
                    if (resumed && resumed.catch) resumed.catch(() => {});
                }
                if (tuneMobile && !turnSoundWarmed && sounds.playerSwitch && typeof root.fetch === 'function') {
                    turnSoundWarmed = true;
                    const warm = () => {
                        if (root.document?.hidden || context.state !== 'running') { turnSoundWarmed = false; return; }
                        load(sounds.playerSwitch).catch(() => { turnSoundWarmed = false; });
                    };
                    if (root.requestIdleCallback) root.requestIdleCallback(warm, { timeout: 1600 });
                    else root.setTimeout?.(warm, 500);
                } else if (!deferLoading && typeof root.fetch === 'function') {
                    for (const audio of Object.values(sounds)) load(audio).catch(() => {});
                }
            } catch (error) { console.warn('[SE] 音声の初期化を再試行します:', error); }
        }
        function stop(audio) {
            activeSE.delete(audio);
            generations.set(audio, (generations.get(audio) || 0) + 1);
            const entry = nodes.get(audio);
            if (entry) {
                nodes.delete(audio); entry.source.onended = null; entry.source.stop();
                entry.source.disconnect(); entry.gain.disconnect();
            }
            audio.pause();
            audio.currentTime = 0;
        }
        function stopSound(soundId) {
            const audio = sounds[soundId];
            if (audio) stop(audio);
        }
        function volume() {
            return volumeLevel ?? defaultVolume;
        }
        async function playLocal(audio, expiresAt = Infinity) {
            if (!audio) return;
            if (isConfirmSound(audio) && hasOtherSEPlaying(audio)) return;
            stop(audio);
            const generation = generations.get(audio);
            if (!context || context.state !== 'running' || typeof root.fetch !== 'function') {
                audio.volume = volume();
                watchSE(audio);
                const playback = audio.play();
                if (playback && typeof playback.catch === 'function') playback.catch(() => activeSE.delete(audio));
                return playback;
            }
            let buffer;
            try { buffer = await load(audio); }
            catch (error) {
                if (generation !== generations.get(audio) || syncNow() > expiresAt) return;
                audio.volume = volume();
                watchSE(audio);
                const playback = audio.play();
                if (playback && typeof playback.catch === 'function') playback.catch(() => activeSE.delete(audio));
                return playback;
            }
            if (generation !== generations.get(audio) || syncNow() > expiresAt) return;
            const source = context.createBufferSource(), gain = context.createGain();
            source.buffer = buffer; gain.gain.value = volume();
            source.connect(gain); gain.connect(context.destination);
            nodes.set(audio, { source, gain });
            source.onended = () => {
                if (nodes.get(audio)?.source !== source) return;
                nodes.delete(audio);
                activeSE.delete(audio);
                source.disconnect(); gain.disconnect();
                if (typeof audio.dispatchEvent === 'function' && root.Event) audio.dispatchEvent(new root.Event('ended'));
            };
            source.start();
        }
        function playShared(audio) {
            if (isConfirmSound(audio) && hasOtherSEPlaying(audio)) return Promise.resolve();
            const online = root.onlineGame, sync = online && online.isOnline && online.sync;
            const state = sync && sync.state, owner = state && state.players?.[state.activePlayerIndex];
            const soundId = Object.keys(sounds).find(key => sounds[key] === audio);
            if (soundId && owner && owner.id === (online.playerId || online.socket?.id) && typeof sync.syncSound === 'function') {
                sync.syncSound({ soundId, eventId: `se:${online.socket.id}:${now()}:${++sequence}`,
                    turnKey: `${state.currentTurn}:${state.activePlayerIndex}` }).then(response => {
                    if (!response || !response.ok) console.warn('[online] SEを同期できません:', response?.error);
                }).catch(error => console.warn('[online] SEを同期できません:', error));
            }
            return playLocal(audio);
        }
        function play(soundId,options={}) {
            const audio=sounds[soundId];if(!audio)return Promise.resolve();
            if (isConfirmSound(audio) && hasOtherSEPlaying(audio)) return Promise.resolve();
            if(options.eventId){
                const key=soundId+':'+options.eventId;
                if(presentationSeen.has(key))return Promise.resolve();
                presentationSeen.add(key);if(presentationSeen.size>500)presentationSeen.delete(presentationSeen.values().next().value);
            }
            return options.shared?playShared(audio):playLocal(audio);
        }
        function playAndWait(soundId,options={}){
            const audio=sounds[soundId];if(!audio)return Promise.resolve();
            return new Promise(resolve => {
                const finish = () => {
                    clearTimeout(timer);
                    audio.removeEventListener('ended', finish);
                    audio.removeEventListener('error', finish);
                    resolve();
                };
                const timer = setTimeout(finish, 8000);
                audio.addEventListener('ended', finish);
                audio.addEventListener('error', finish);
                try { Promise.resolve(play(soundId, options)).catch(finish); }
                catch { finish(); }
            });
        }
        function waitForEnd(soundId){
            const audio=sounds[soundId];if(!audio)return Promise.resolve();
            return new Promise(resolve=>{
                let timer, poll;
                const finish=()=>{clearTimeout(timer);clearInterval(poll);audio.removeEventListener('ended',finish);audio.removeEventListener('error',finish);resolve();};
                const playing=()=>nodes.has(audio)||activeSE.has(audio)||audio.paused===false&&!audio.ended;
                audio.addEventListener('ended',finish);audio.addEventListener('error',finish);
                timer=setTimeout(finish,8000);
                // Observers may receive the synchronized cue just after the presentation opens.
                // Poll active playback so a cue that starts after this call is still awaited.
                poll=setInterval(()=>{if(!playing())return;clearInterval(poll);poll=null;},40);
                if(playing()){clearInterval(poll);poll=null;}
            });
        }
        function receive(cue) {
            const state = attached && attached.state;
            if (!cue || !soundIds.includes(cue.soundId) || !cue.eventId || seen.has(cue.eventId)) return;
            if (!Number.isFinite(cue.expiresAt) || syncNow() > cue.expiresAt) return;
            if (state && cue.turnKey !== `${state.currentTurn}:${state.activePlayerIndex}`) return;
            seen.add(cue.eventId);
            if (seen.size > 300) seen.delete(seen.values().next().value);
            if (isConfirmSound(sounds[cue.soundId]) && hasOtherSEPlaying(sounds[cue.soundId])) return;
            playLocal(sounds[cue.soundId], cue.expiresAt).catch(error => console.warn('[online] SEを再生できません。画面を一度クリックしてください:', error));
        }
        function attach(sync) {
            if (!sync || attached === sync) return;
            attached = sync;
            sync.on('sound:cue', receive);
            // The acknowledgement sound belongs to the click that can hand off
            // the turn. Let this short one-shot finish instead of cutting it off.
            sync.on('turn:update', () => { for (const [id,audio] of Object.entries(sounds)) if(id!=='textAdvance'&&id!=='confirm')stop(audio); });
        }
        function setVolume(value) {
            volumeLevel = Math.max(0, Math.min(1, Number(value) || 0));
            for (const audio of new Set([...Object.values(sounds), ...activeSE])) audio.volume = volumeLevel;
            for (const entry of nodes.values()) entry.gain.gain.value = volumeLevel;
            for (const gain of externalGains) gain.value = volumeLevel;
        }
        function trackGain(gain) {
            gain.value = volume();
            externalGains.add(gain);
            return () => externalGains.delete(gain);
        }
        if (root.document) {
            const slider = root.document.getElementById('seVolumeSlider');
            if (slider?.value != null) setVolume(Number(slider.value) / 100);
            slider?.addEventListener?.('input', () => {
                setVolume(Number(slider.value) / 100);
                root.document.getElementById('seVolumeValue').textContent = `${slider.value}%`;
            });
            root.document.addEventListener('pointerdown', unlock, { capture: true });
            if (tuneMobile) root.document.addEventListener('touchend', unlock, { capture: true, passive: true });
            root.document.addEventListener('keydown', unlock, { capture: true });
        }
        return { play, playAndWait, waitForEnd, playShared, playLocal, stop, stopSound, attach, receive, unlock, setVolume, trackGain };
    }
    return { soundIds, create };
});
