(function () {
    'use strict';
    const sceneOrder = ['thanks', 'announce', 'race', 'winner', 'assets', 'history', 'ranking', 'closing'];
    const sceneNames = ['newEnding1', 'newEnding3', 'newEnding4', 'newEnding5', 'newEnding6', 'newEnding7', 'newEnding8', 'newEnding9'];
    const speech = {
        thanks: 'sounds/ガイド/終了アナウンス1.mp3',
        announce: 'sounds/ガイド/終了アナウンス2.mp3',
        closing: 'sounds/ガイド/終了アナウンス4.mp3'
    };
    const effects = {
        start: 'sounds/試合開始のゴング.mp3', pass: 'sounds/マス通過音.mp3',
        first: 'sounds/1位.mp3', other: 'sounds/2位以下.mp3', last: 'sounds/最下位.mp3', cheers: 'sounds/歓声と拍手.mp3'
    };
    const fmt = value => Number(value || 0).toLocaleString('ja-JP');
    const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    let current = null;

    function show(ranking, players, history, online) {
        if (current) return;
        const sync = online ? window.onlineGame?.sync : null;
        const initialState = sync?.state;
        const ending = initialState?.endingPresentation;
        const eventId = ending?.eventId || `ending:${initialState?.roomCode || 'local'}:${initialState?.completedTurns || 0}`;
        const rows = ranking.map(entry => {
            const playerIndex = Number.isInteger(entry.playerIndex) ? entry.playerIndex : players.findIndex(player => player.name === entry.name);
            return { ...entry, playerIndex, player: players[playerIndex] || {}, totalAsset: Number(entry.totalAsset ?? entry.total ?? 0) };
        }).sort((a, b) => b.totalAsset - a.totalAsset || a.playerIndex - b.playerIndex);
        const totals = players.map((player, index) => rows.find(row => row.playerIndex === index)?.totalAsset ?? Number(player.money || 0));
        const raceSchedule = window.EndingRaceRules.createSchedule(totals);
        const historyPoints = (Array.isArray(history) ? history : []).map(point => ({ turn: Number(point.turn), totals: [...(point.totals || [])].map(Number) })).sort((a, b) => a.turn - b.turn);
        const completedTurn = Number(initialState?.completedTurns ?? initialState?.currentTurn ?? historyPoints.at(-1)?.turn ?? 0);
        if (!historyPoints.length || historyPoints[historyPoints.length - 1].turn !== completedTurn) historyPoints.push({ turn: completedTurn, totals });
        else historyPoints[historyPoints.length - 1] = { turn: completedTurn, totals };
        const finalPlayers = players.map((player, index) => {
            return {
                name: player.name, character: PLAYER_CONTENTS[player.characterId]?.name || '', characterId: player.characterId,
                icon: PLAYER_CONTENTS[player.characterId]?.icon || '', color: PLAYER_CONTENTS[player.characterId]?.graphColor,
                cash: Number(player.money || 0), assets: Math.max(0, totals[index] - Number(player.money || 0)),
                total: totals[index], history: historyPoints.map(point => Number(point.totals[index] || 0))
            };
        });

        const root = document.createElement('section');
        root.id = 'endingPresentationOverlay';
        root.className = 'bf-ending-sequence';
        root.setAttribute('aria-label', 'ゲームの最終結果');
        root.innerHTML = '<div class="bf-background"></div><div class="bf-shade"></div><img class="bf-staff" alt="進行役・ギルドのお姉さん"><section class="bf-main"></section><div class="bf-banner"><span class="bf-speaker">ギルドのお姉さん</span><p class="bf-copy" aria-live="polite"></p><button class="bf-next" type="button">次へ▶</button></div>';
        document.body.append(root);
        const main = root.querySelector('.bf-main'), staff = root.querySelector('.bf-staff');
        const banner = root.querySelector('.bf-banner'), copy = root.querySelector('.bf-copy'), next = root.querySelector('.bf-next');
        staff.src = 'images/characters/npc/jobs/ギルド-店員.webp';

        let step = Math.max(0, Math.min(8, Number(ending?.step ?? 0)));
        let pending = false, raceStarted = Boolean(ending?.raceStarted), raceStartedAt = Number(ending?.raceStartedAt) || null;
        let raceComplete = false, animationFrame = 0, chartCleanup = null, voice = null, bgm = null;
        let raceStartHandler = null, listener = null, returnAfterBlack = false, disposed = false, chartObserver = null;
        let fadeTimer = 0, sceneGeneration = 0, bgmGain = 1, endingConfirmed = false;
        const canControl = () => !sync || window.onlineGame?.playerId ===
            (sync.state?.endingPresentation?.ownerId || sync.state?.players?.[sync.state?.activePlayerIndex]?.id);
        const seSlider = document.getElementById('seVolumeSlider');
        const seVolume = () => Math.max(0, Math.min(1, Number(seSlider?.value ?? 50) / 100));
        const liveSounds = new Set();
        let bgmFadeFrame = 0;

        function updateVolumes() {
            liveSounds.forEach(audio => { audio.volume = seVolume(); });
        }
        seSlider?.addEventListener('input', updateVolumes);

        function playEffect(path) {
            const audio = new Audio(path);
            audio.volume = seVolume();
            liveSounds.add(audio);
            const release = () => liveSounds.delete(audio);
            audio.addEventListener('ended', release, { once: true });
            audio.addEventListener('error', release, { once: true });
            Promise.resolve(window.GameSE ? window.GameSE.playLocal(audio) : audio.play())
                .catch(error => { release(); console.warn('[新・エンディング] 効果音を再生できません:', error); });
            return audio;
        }
        function stopVoice() {
            if (!voice) return;
            if (window.GameSE) window.GameSE.stop(voice); else { voice.pause(); voice.currentTime = 0; }
            liveSounds.delete(voice); voice = null;
        }
        function playVoice(path, waitForEnd = false) {
            stopVoice();
            voice = new Audio(path); voice.volume = seVolume();
            const audio = voice; liveSounds.add(audio);
            const release = () => liveSounds.delete(audio);
            audio.addEventListener('ended', release, { once: true });
            audio.addEventListener('error', release, { once: true });
            const playback = window.GameSE ? window.GameSE.playLocal(audio) : audio.play();
            if (!waitForEnd) {
                Promise.resolve(playback).catch(error => console.warn('[新・エンディング] 音声を再生できません:', error));
                return Promise.resolve();
            }
            return new Promise(resolve => {
                let finished = false;
                const finish = () => { if (finished) return; finished = true; release(); resolve(); };
                audio.addEventListener('ended', finish, { once: true });
                audio.addEventListener('error', finish, { once: true });
                Promise.resolve(playback).catch(error => { console.warn('[新・エンディング] 音声を再生できません:', error); finish(); });
            });
        }
        function startBGM() {
            if (bgm) return;
            bgm = window.DividendBGMController?.start() || null;
            if (!bgm) {
                console.warn('[新・エンディング] 共通の配当BGM制御が利用できません。');
                return;
            }
            const alignMusic = () => {
                if (!ending?.startedAt || !Number.isFinite(bgm?.duration) || bgm.duration <= 0) return;
                bgm.currentTime = Math.max(0, ((sync?.serverNow?.() ?? Date.now()) - ending.startedAt) / 1000) % bgm.duration;
            };
            bgm.addEventListener('loadedmetadata', alignMusic, { once:true });
            alignMusic();
            bgm.play().catch(error => console.warn('[新・エンディング] BGMを再生できません:', error));
        }
        function fadeBGM(duration) {
            if (!bgm) return;
            cancelAnimationFrame(bgmFadeFrame);
            const startedAt = performance.now(), startingGain = bgmGain;
            const fade = now => {
                if (!bgm || disposed) return;
                const progress = Math.min(1, (now - startedAt) / duration);
                bgmGain = startingGain * (1 - progress);
                window.DividendBGMController?.setFade(bgmGain);
                if (progress < 1) bgmFadeFrame = requestAnimationFrame(fade);
                else { bgm.pause(); bgmFadeFrame = 0; }
            };
            bgmFadeFrame = requestAnimationFrame(fade);
        }
        function stopBGM() {
            cancelAnimationFrame(bgmFadeFrame); bgmFadeFrame = 0;
            if (bgm) { window.DividendBGMController?.stop(); bgm = null; }
        }
        function cancelScene() {
            sceneGeneration++;
            clearTimeout(fadeTimer); fadeTimer = 0;
            chartObserver?.disconnect(); chartObserver = null;
            cancelAnimationFrame(animationFrame); animationFrame = 0;
            if (chartCleanup) chartCleanup(); chartCleanup = null;
            raceStartHandler = null;
            [...liveSounds].forEach(audio => { if (window.GameSE) window.GameSE.stop(audio); else { audio.pause(); audio.currentTime = 0; } });
            liveSounds.clear(); voice = null;
        }
        function setSceneClasses() {
            const names = ['thanks', 'announce', 'race', 'winner', 'assets', 'history', 'ranking', 'closing'];
            const sceneName = sceneNames[step];
            root.className = `bf-ending-sequence bf-ending-scene-${names[step]}`;
            root.classList.toggle('bf-intro-scene', [0, 1, 7].includes(step));
            root.classList.toggle('bf-new-ending-race-scene', step === 2);
            root.classList.toggle('bf-new-ending-winner-scene', step === 3);
            root.classList.toggle('bf-new-ending-graph-scene', step === 4 || step === 5);
            root.classList.toggle('bf-new-ending-rank-scene', step === 6);
            root.dataset.stage = sceneName;
            root.dataset.step = String(step);
            root.setAttribute('aria-label', `ゲームの最終結果：${names[step]}`);
            staff.hidden = [2, 4, 5, 6].includes(step);
            banner.hidden = [2, 4, 5, 6].includes(step);
            root.querySelector('.bf-speaker').hidden = [2, 4, 5, 6].includes(step);
        }
        function canonicalState(state) {
            const flow = state?.endingPresentation;
            if (!state || state.matchPhase !== 'finished' || flow?.eventId !== eventId) return;
            if (flow.step < step) return;
            if (flow.step === 8) {
                endingConfirmed = true;
                if (step !== 7 || returnAfterBlack) returnToTitle();
                return;
            }
            if (Number.isInteger(flow.step) && flow.step > step) { step = Math.min(7, flow.step); render(); }
            if (flow.raceStarted && !raceStarted) {
                raceStarted = true; raceStartedAt = Number(flow.raceStartedAt) || raceStartedAt;
                if (step === 2 && raceStarted) { playEffect(effects.start); raceStartHandler?.(); }
            }
        }
        async function advance() {
            if (disposed || pending || !canControl() || step >= 7 || (step === 2 && !raceComplete)
                || ([4, 5].includes(step) && main.querySelector('.dp-plot')?.dataset.revealState !== 'complete')) return;
            const target = step + 1;
            stopVoice();
            if (!sync) { step = target; render(); return; }
            pending = true; next.disabled = true;
            try {
                const response = await sync.advanceEnding({ eventId, step: target, requestId: `${eventId}:advance:${target}` });
                if (!response?.ok) throw new Error(response?.error || '終了画面を進められませんでした。');
                canonicalState(response.state || sync.state);
            } catch (error) {
                next.disabled = false; console.error('[新・エンディング] 画面進行:', error);
            } finally { pending = false; }
        }
        function mountDividendChart(chartStage) {
            const mount = document.createElement('div');
            mount.id = 'nmnl-dividend-lab'; mount.className = 'bf-dividend-embed';
            mount.innerHTML = '<nav class="dp-steps" hidden></nav><section class="dp-screen"><h2 class="dp-title"></h2><div class="dp-body" aria-live="polite"></div><footer class="dp-footer"><small></small><button type="button" class="dp-next">次へ▶</button></footer></section>';
            main.append(mount);
            chartCleanup = window.DividendPresentation.mount(mount, {
                stage: chartStage, map: 'images/backgrounds/scenes/配当.webp',
                gold: 'images/map/space-icons/gold.webp',
                historyTurns: historyPoints.map(point => point.turn),
                players: finalPlayers.map(player => ({ name: player.name, characterId: player.characterId, icon: player.icon,
                    color: player.color, cash: player.cash, property: player.assets, income: 0,
                    history: player.history })),
                readOnly: true, onNext() {}
            });
            chartObserver = new MutationObserver(() => {
                next.disabled = pending || !canControl() || mount.querySelector('.dp-plot')?.dataset.revealState !== 'complete';
            });
            chartObserver.observe(mount, { subtree:true, attributes:true, attributeFilter:['data-reveal-state'] });
        }

        function returnToTitle() {
            if (disposed) return;
            root.classList.add('bf-ending-returning');
            current?.close(true);
            location.reload();
        }

        async function finishEnding() {
            if (!returnAfterBlack || disposed || pending || !canControl()) return;
            if (!sync) { returnToTitle(); return; }
            pending = true;
            try {
                const response = await sync.advanceEnding({ eventId, step:8, requestId:`${eventId}:advance:8` });
                if (!response?.ok) throw new Error(response?.error || 'タイトルへ戻れませんでした。');
                canonicalState(response.state || sync.state);
            } catch (error) { console.error('[新・エンディング] 終了:', error); }
            finally { pending = false; }
        }

        function renderRace() {
            const raceRules = window.EndingRaceRules;
            main.classList.add('bf-ending-race');
            const laneMarkup = finalPlayers.map((player, index) =>
                `<div class="bf-race-lane" style="--lane:${index};--lane-count:${finalPlayers.length};top:${finalPlayers.length === 4 ? 4 + index * 23 : index * 100 / finalPlayers.length}%;height:${finalPlayers.length === 4 ? 20 : 100 / finalPlayers.length}%"><div class="bf-racer"><img src="images/characters/player/directions/${player.character}_right.webp" alt="${escapeHTML(player.name)}、右向き"></div><span class="bf-racer-name">${escapeHTML(player.name)}</span></div>`
            ).join('');
            main.insertAdjacentHTML('beforeend', `<section class="bf-race-view" aria-label="プレイヤーレース"><div class="bf-race-heading"></div><div class="bf-race-route" tabindex="0"><div class="bf-race-stage"><div class="bf-race-depth" data-scenery="royal" aria-hidden="true"><div class="bf-depth-layer bf-depth-far"></div><div class="bf-depth-layer bf-depth-mid"></div><div class="bf-depth-layer bf-depth-near"></div></div><div class="bf-race-world" aria-hidden="true"></div><div class="bf-race-startline" aria-hidden="true"><span>START</span></div>${laneMarkup}<div class="bf-race-finish" aria-label="ゴール"></div></div><div class="bf-race-ready"><button type="button">スタート</button></div></div></section>`);
            const route = main.querySelector('.bf-race-route'), stageEl = main.querySelector('.bf-race-stage');
            stageEl.style.width = `${(raceRules.courseLengthInViews + .08 + .2) * 100}%`;
            const finish = main.querySelector('.bf-race-finish'), startLine = main.querySelector('.bf-race-startline');
            const ready = main.querySelector('.bf-race-ready'), depth = main.querySelector('.bf-race-depth');
            const depthLayers = { far: main.querySelector('.bf-depth-far'), mid: main.querySelector('.bf-depth-mid'), near: main.querySelector('.bf-depth-near') };
            const racers = [...main.querySelectorAll('.bf-racer')];
            const count = racers.length, runnerX = finalPlayers.map(() => 0);
            const motion = raceRules.createRaceMotion(finalPlayers.map(player => player.history));
            const passBeatDuration = 60 / 112, passBeatPhase = .283;
            const nextPassBeatAt = time => passBeatPhase + Math.ceil((time - passBeatPhase + .0001) / passBeatDuration) * passBeatDuration;
            let spotlight = null, started = false, priorSpotlightRank = -1;
            let lastPassBgmTime = 0, nextPassSoundAt = 0, lastPassSoundAt = -Infinity, racePassAudio = null;
            const crispRacers = finalPlayers.map(player => {
                const image = document.createElement('img'); image.className = 'bf-spotlight-racer'; image.alt = player.name; image.hidden = true;
                image.src = `images/characters/player/directions/${player.character}_right.webp`; route.append(image); return image;
            });
            const finishTotals = finalPlayers.map(player => {
                const total = document.createElement('span'); total.className = 'bf-race-finish-total';
                total.textContent = `${fmt(player.total)}G`; total.setAttribute('aria-label', `${player.name}の総資産 ${fmt(player.total)}G`); total.hidden = true;
                route.append(total); return total;
            });
            const laneDimensions = () => {
                const viewW = route.clientWidth, stageW = stageEl.clientWidth || viewW * 2.2;
                const laneH = route.clientHeight * (count === 4 ? .2 : 1 / count);
                const size = count === 4 ? 180 : Math.min(180, laneH * .9);
                const centers = finalPlayers.map((_, index) => route.clientHeight * (count === 4 ? .14 + index * .23 : (index + .5) / count));
                return { viewW, stageW, finishX:viewW * (.08 + raceRules.courseLengthInViews), laneH, size, centers };
            };
            function positionAtStart() {
                const { viewW, finishX } = laneDimensions(), startX = viewW * .08;
                runnerX.fill(startX);
                racers.forEach(racer => { racer.style.left = `${startX - laneDimensions().size / 2}px`; });
                startLine.style.left = `${startX - 2}px`; finish.style.left = `${finishX}px`;
            }
            positionAtStart();

            function animateRace(now) {
                if (disposed || step !== 2 || !root.contains(route)) return;
                const elapsed = Math.max(0, ((sync?.serverNow?.() ?? Date.now()) - raceStartedAt) / 1000);
                const sample = raceRules.sample(elapsed, raceSchedule);
                const { viewW, stageW, finishX, laneH, size, centers } = laneDimensions();
                finalPlayers.forEach((_, index) => {
                    const entry = raceSchedule.entries[index];
                    const progress = motion(index, sample.runningTime, entry.finishTime);
                    runnerX[index] = viewW * .08 + (finishX - viewW * .08) * progress;
                    const crossed = entry.groupIndex < sample.finishedCount || entry.groupIndex === sample.spotlightRank;
                    racers[index].classList.toggle('is-finished', crossed);
                    crispRacers[index].classList.toggle('is-finished', crossed);
                    finishTotals[index].hidden = !crossed;
                    if (crossed) finishTotals[index].classList.add('is-visible');
                });
                route.classList.toggle('is-finish-pause', sample.spotlightRank >= 0);
                if (sample.spotlightRank >= 0) {
                    const group = raceSchedule.groups[sample.spotlightRank];
                    if (sample.spotlightRank !== priorSpotlightRank) {
                        spotlight = { indices:group.playerIndices, elapsed:sample.spotlightElapsed };
                        if (sample.spotlightElapsed < .15) {
                            playEffect(group.rank === 1 ? effects.first : sample.spotlightRank === raceSchedule.groups.length - 1 ? effects.last : effects.other);
                        }
                    }
                    spotlight.elapsed = sample.spotlightElapsed;
                    racePassAudio?.pause();
                } else {
                    spotlight = null;
                    const bgmTime = bgm?.currentTime ?? 0;
                    if (priorSpotlightRank >= 0 || bgmTime < lastPassBgmTime - .25) nextPassSoundAt = nextPassBeatAt(bgmTime);
                    lastPassBgmTime = bgmTime;
                    while (bgm && bgmTime + .16 >= nextPassSoundAt) {
                        if (bgmTime - nextPassSoundAt < .08 && now - lastPassSoundAt > 120) {
                            if (!racePassAudio) {
                                racePassAudio = new Audio(effects.pass); racePassAudio.preload = 'auto';
                                racePassAudio.addEventListener('ended', () => liveSounds.delete(racePassAudio));
                                racePassAudio.addEventListener('error', () => liveSounds.delete(racePassAudio));
                            }
                            racePassAudio.pause(); racePassAudio.currentTime = 0; racePassAudio.volume = seVolume();
                            liveSounds.add(racePassAudio);
                            Promise.resolve(window.GameSE ? window.GameSE.playLocal(racePassAudio) : racePassAudio.play()).catch(() => {});
                            lastPassSoundAt = now;
                        }
                        nextPassSoundAt += passBeatDuration;
                    }
                }
                priorSpotlightRank = sample.spotlightRank;
                const raceLeaderX = Math.max(...runnerX);
                let tx = Math.min(0, viewW * .36 - raceLeaderX), cameraZoom = 1;
                tx = Math.max(viewW - stageW, tx);
                if (spotlight) {
                    const amount = spotlight.elapsed, zoomIn = Math.max(0, Math.min(1, amount / .18)), zoomOut = Math.max(0, Math.min(1, (amount - 2.1) / .3));
                    const ys = spotlight.indices.map(index => centers[index]);
                    const span = Math.max(...ys) - Math.min(...ys) + size;
                    const peak = Math.min(1.62, Math.max(1, route.clientHeight * .94 / span));
                    cameraZoom = 1 + (peak - 1) * zoomIn * (1 - zoomOut);
                    if (spotlight.cameraX === undefined) {
                        spotlight.cameraX = tx; spotlight.cameraOriginX = runnerX[spotlight.indices[0]];
                        spotlight.cameraWorldY = (Math.min(...ys) + Math.max(...ys)) / 2;
                    }
                    const worldY = spotlight.cameraWorldY;
                    // Keep the tied finishers in view with one camera transform. Other
                    // racers keep their lane coordinates rather than being clamped.
                    const focusY = Math.max(span * cameraZoom / 2, Math.min(route.clientHeight - span * cameraZoom / 2, worldY));
                    const cameraY = focusY - worldY * cameraZoom;
                    spotlight.cameraOriginY = cameraZoom !== 1 ? cameraY / (1 - cameraZoom) : worldY;
                    tx = spotlight.cameraX; stageEl.style.transformOrigin = `${spotlight.cameraOriginX}px ${spotlight.cameraOriginY}px`;
                } else stageEl.style.transformOrigin = '0 0';
                stageEl.style.transform = `translate3d(${tx}px,0,0) scale(${cameraZoom})`;
                if (spotlight) {
                    racers.forEach(racer => { racer.style.visibility = 'hidden'; });
                    crispRacers.forEach((image, index) => {
                        const worldY = centers[index], x = tx + spotlight.cameraOriginX + (runnerX[index] - spotlight.cameraOriginX) * cameraZoom;
                        const y = spotlight.cameraOriginY + (worldY - spotlight.cameraOriginY) * cameraZoom;
                        image.style.width = `${size * cameraZoom}px`; image.style.height = `${size * cameraZoom}px`;
                        image.style.left = `${x - size * cameraZoom / 2}px`;
                        image.style.top = `${y - size * cameraZoom / 2}px`; image.hidden = false;
                    });
                } else {
                    racers.forEach(racer => { racer.style.visibility = 'visible'; }); crispRacers.forEach(image => { image.hidden = true; });
                }
                const originX = spotlight ? spotlight.cameraOriginX : 0, originY = spotlight ? spotlight.cameraOriginY : 0;
                const fontSize = Math.max(20, Math.min(34, window.innerWidth * .023)) * cameraZoom;
                finishTotals.forEach((amount, index) => {
                    if (amount.hidden) return;
                    const x = tx + originX + (runnerX[index] - originX) * cameraZoom;
                    const y = originY + (centers[index] - originY) * cameraZoom;
                    amount.style.left = `${x - size * cameraZoom / 2 - 18 * cameraZoom}px`;
                    amount.style.top = `${y}px`; amount.style.fontSize = `${fontSize}px`;
                });
                const pan = Math.max(0, -tx);
                depthLayers.far.style.transform = `translate3d(${pan * .78}px,0,0)`;
                depthLayers.mid.style.transform = `translate3d(${pan * .42}px,0,0)`;
                depthLayers.near.style.transform = `translate3d(${-pan * .32}px,0,0)`;
                finish.style.left = `${finishX}px`;
                racers.forEach((racer, index) => {
                    racer.style.left = `${runnerX[index] - size / 2}px`;
                    racer.style.top = `${laneH / 2 - size / 2}px`;
                    racer.style.width = `${size}px`; racer.style.height = `${size}px`;
                });
                raceComplete = sample.finishedCount === raceSchedule.groups.length;
                if (raceComplete) { root.classList.add('bf-race-finished'); next.hidden = true; }
                else animationFrame = requestAnimationFrame(animateRace);
            }

            function beginRace() {
                if (started) return;
                started = true; ready.hidden = true; route.classList.add('is-running');
                lastPassBgmTime = bgm?.currentTime ?? 0; nextPassSoundAt = nextPassBeatAt(lastPassBgmTime);
                if (!raceStartedAt) raceStartedAt = Date.now();
                requestAnimationFrame(animateRace);
            }
            function requestRaceStart() {
                if (started || pending || !canControl()) return;
                if (!sync) { raceStarted = true; raceStartedAt = Date.now(); playEffect(effects.start); beginRace(); return; }
                pending = true; ready.querySelector('button').disabled = true;
                sync.startEndingRace(eventId).then(response => {
                    if (!response?.ok) throw new Error(response?.error || 'レースを開始できませんでした。');
                    canonicalState(response.state || sync.state);
                    raceStarted = true; raceStartedAt = Number(response.state?.endingPresentation?.raceStartedAt) || raceStartedAt || Date.now();
                    pending = false; beginRace();
                }).catch(error => { pending = false; ready.querySelector('button').disabled = false; console.error('[新・エンディング] レース開始:', error); });
            }
            raceStartHandler = beginRace;
            ready.querySelector('button').disabled = !canControl();
            ready.querySelector('button').addEventListener('click', requestRaceStart);
            route.addEventListener('click', event => { if (!event.target.closest('button')) requestRaceStart(); });
            route.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); requestRaceStart(); }
            });
            if (raceStarted) beginRace();
            next.hidden = true;
            route.tabIndex = 0;
        }

        function render() {
            cancelScene();
            if (step === 8) { returnToTitle(); return; }
            root.classList.remove('bf-final-fadeout', 'bf-race-finished');
            setSceneClasses();
            main.className = `bf-main bf-stage-${sceneNames[step]}`;
            main.replaceChildren();
            copy.textContent = '';
            next.hidden = false; next.disabled = !canControl(); next.textContent = '次へ▶';
            if (step === 0) {
                main.classList.add('bf-ending-cardless'); copy.textContent = '皆様、お疲れさまでした！';
                playVoice(speech.thanks);
            } else if (step === 1) {
                main.classList.add('bf-ending-cardless'); copy.textContent = 'それでは、最終結果を発表します！';
                playVoice(speech.announce);
            } else if (step === 2) {
                renderRace();
            } else if (step === 3) {
                main.classList.add('bf-new-ending-winner');
                const winners = rows.filter(row => row.totalAsset === rows[0].totalAsset);
                const cards = winners.map(winner => `<div class="bf-new-winner"><img src="${PLAYER_CONTENTS[winner.player.characterId]?.icon || ''}" alt="${escapeHTML(winner.name)}のアイコン"><span class="bf-new-winner-name">${escapeHTML(winner.name)}</span></div>`).join('');
                main.insertAdjacentHTML('beforeend', winners.length > 1 ? `<div class="bf-new-winners" style="--winner-columns:${Math.min(3, winners.length)}">${cards}</div>` : cards);
                playEffect(effects.cheers); copy.textContent = `優勝は、${winners.map(winner => `${winner.name}さん`).join('、')}！おめでとうございます！`;
            } else if (step === 4 || step === 5) {
                main.classList.add('bf-new-ending-chart');
                mountDividendChart(step === 4 ? 2 : 3);
                next.disabled = true;
                copy.textContent = step === 4 ? '現在の総資産' : '総資産の推移';
            } else if (step === 6) {
                main.classList.add('bf-new-ending-rank');
                const rankRows = rows.map(row => `<div class="bf-new-rank-row${raceSchedule.entries[row.playerIndex].rank === 1 ? ' is-winner' : ''}"><strong>${raceSchedule.entries[row.playerIndex].rank}位</strong><img src="${PLAYER_CONTENTS[row.player.characterId]?.icon || ''}" alt=""><span>${escapeHTML(row.name)}</span><b>${fmt(row.totalAsset)}G</b></div>`).join('');
                main.insertAdjacentHTML('beforeend', `<section class="bf-new-rank-table" aria-label="最終順位"><h2>最終順位</h2>${rankRows}</section>`);
                copy.textContent = '最終順位はこちらです。';
            } else {
                main.classList.add('bf-ending-cardless', 'bf-ending-closing');
                copy.textContent = '以上でNO MONEY, NO LIFE は終了となります！また来てくださいね！';
                next.hidden = true;
                const generation = sceneGeneration;
                playVoice(speech.closing, true).then(() => {
                    if (disposed || step !== 7 || generation !== sceneGeneration) return;
                    root.classList.add('bf-final-fadeout'); fadeBGM(2000);
                    fadeTimer = window.setTimeout(() => {
                        if (disposed || step !== 7) return;
                        returnAfterBlack = true;
                        if (endingConfirmed) returnToTitle();
                    }, 2000);
                });
            }
            if (step < 7) next.onclick = advance;
            else next.onclick = null;
        }

        root.addEventListener('click', event => {
            if (event.target.closest('button')) return;
            if (step === 7) { finishEnding(); return; }
            if (step === 2) { if (raceComplete) advance(); return; }
            advance();
        });
        if (sync) listener = sync.on('state', payload => canonicalState(payload?.state));
        current = {
            close(keepScreen = false) {
                if (disposed) return; disposed = true;
                cancelScene(); listener?.(); stopBGM();
                seSlider?.removeEventListener('input', updateVolumes);
                if (!keepScreen) { root.remove(); current = null; }
            }
        };
        startBGM(); render();
    }

    window.EndingPresentation = { show, close() { current?.close(); } };
})();
