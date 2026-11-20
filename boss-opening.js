// Presentation only. The boss square is selected by the existing game rules.
(function () {
    'use strict';
    const NS = 'http://www.w3.org/2000/svg';
    const number = value => Number(value || 0).toLocaleString('ja-JP');
    function element(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text != null) el.textContent = text;
        return el;
    }
    function svgElement(tag, attrs) {
        const el = document.createElementNS(NS, tag);
        for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
        return el;
    }
    function regionAt(square, data) {
        const lake = data.lake;
        if (lake) {
            const angle = -lake.rotation * Math.PI / 180;
            const dx = square.x - lake.x, dy = square.y - lake.y;
            const x = dx * Math.cos(angle) - dy * Math.sin(angle);
            const y = dx * Math.sin(angle) + dy * Math.cos(angle);
            if ((x / lake.radiusX) ** 2 + (y / lake.radiusY) ** 2 <= 1) return { id: 'lake', name: '湖', lake: true };
        }
        const ctx = document.createElement('canvas').getContext('2d');
        return data.regions.find(region => region.path && ctx.isPointInPath(new Path2D(region.path), square.x, square.y)) || null;
    }
    function show(options) {
        const { boss, square, squares, regionData, overview } = options;
        const isNext = Boolean(options.nextBoss);
        if (!boss || !square || !Array.isArray(squares) || !regionData || !overview?.image) return Promise.reject(new Error('開始演出のデータが不足しています。'));
        return new Promise(resolve => {
            const root = element('section', 'boss-opening');
            if (options.background) root.style.backgroundImage = options.background;
            root.setAttribute('aria-label', 'ゲーム開始のご案内');
            const staff = element('img', 'boss-opening-staff'); staff.src = 'images/characters/npc/jobs/ギルド-店員.webp'; staff.alt = 'ギルドのお姉さん';
            const main = element('div', 'boss-opening-main');
            const banner = element('div', 'boss-opening-banner');
            const speaker = element('div', 'boss-opening-speaker', 'ギルドのお姉さん');
            const copy = element('p', 'boss-opening-copy', 'こんにちは！NO MONEY, NO LIFE の世界へようこそ！');
            const next = element('button', 'boss-opening-next', '次へ▶'); next.type = 'button';
            banner.append(speaker, copy, next); root.append(staff, main, banner); document.body.append(root);
            if (!isNext) root.classList.add('boss-opening-start', 'boss-opening-intro-scene');
            let stage = 'intro', timer = null, frame = null, interval = null, audioSource = null, audioContext = null, soundGeneration = 0;
            let introStep = 0, guideAudio = null, guideAudioResolve = null, releaseLotteryGain = null;
            const guideLines = [
                'こんにちは！NO MONEY, NO LIFE の世界へようこそ！',
                'この世界のルールは簡単、誰よりも沢山のお金を持っていれば勝ちです！',
                'そして冒険者の皆さんにはお願いがあります。それは、襲い来るボスを倒して欲しいのです。',
                '討伐してくれた方には報酬を。そうでない方には・・・お仕置きがあります。すみませんこれも仕事なのです。',
                'それでは最初のボスの位置を確認しましょう。',
                'ボスの居場所はこちらです！',
                'それでは皆さん頑張ってくださいね！'
            ];
            const sequenceKey = String(options.syncKey || '');
            const onlineSync = sequenceKey && window.onlineGame?.isOnline ? window.onlineGame.sync : null;
            let expectedStep = 0, requestPending = false, stopRemoteAdvance = null;
            const useBakedRoads = options.lightweight === true;
            const overviewSource = useBakedRoads ? overview.mobileImage || overview.image : overview.cleanImage || overview.image;
            const overviewPreload = new Image();
            if (!useBakedRoads) overviewPreload.src = overviewSource;
            const bossPreload = new Image();
            if (!useBakedRoads) bossPreload.src = boss.icon;
            function stopGuideAudio() {
                if (guideAudio) { guideAudio.pause(); guideAudio.currentTime = 0; guideAudio = null; }
                if (guideAudioResolve) { const resolve = guideAudioResolve; guideAudioResolve = null; resolve(); }
            }
            function playGuide(index) {
                stopGuideAudio();
                return new Promise(resolve => {
                    const version = index === '開始アナウンス6-2' ? '?v=20261103' : index === 8 || index === 9 ? '?v=20261101' : '';
                    const name = typeof index === 'number' ? `開始アナウンス${index}` : index;
                    const audio = new Audio(`sounds/ガイド/${name}.mp3${version}`);
                    guideAudio = audio;
                    guideAudioResolve = resolve;
                    const finish = () => {
                        if (guideAudio !== audio) return;
                        guideAudio = null;
                        guideAudioResolve = null;
                        resolve();
                    };
                    audio.addEventListener('ended', finish, { once:true });
                    audio.addEventListener('error', finish, { once:true });
                    audio.play().catch(error => { console.warn(`[開始アナウンス${index}] 音声を再生できません:`, error); finish(); });
                });
            }
            function stopSound() { soundGeneration++; releaseLotteryGain?.(); releaseLotteryGain = null; if (audioSource) { try { audioSource.stop(); } catch (_) {} audioSource.disconnect(); audioSource = null; } }
            function playLottery() {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                try {
                    audioContext = new AudioContext(); audioContext.resume().catch(() => {});
                    const token = soundGeneration;
                    fetch('sounds/ボスルーレット.mp3').then(response => { if (!response.ok) throw new Error('SEの読み込みに失敗'); return response.arrayBuffer(); })
                        .then(data => audioContext.decodeAudioData(data)).then(buffer => {
                            if (token !== soundGeneration) return;
                            const source = audioContext.createBufferSource(), gain = audioContext.createGain();
                            source.buffer = buffer; source.loop = true; source.loopEnd = Math.min(.6, buffer.duration);
                            source.connect(gain); gain.connect(audioContext.destination);
                            gain.gain.value = Number(document.getElementById('seVolumeSlider')?.value ?? 50) / 100;
                            const untrack = window.GameSE?.trackGain?.(gain.gain);
                            releaseLotteryGain = () => { untrack?.(); gain.disconnect(); };
                            source.start(); audioSource = source;
                        }).catch(error => console.warn('[開始演出] ルーレットSE:', error));
                } catch (error) { console.warn('[開始演出] SE:', error); }
            }
            function playStop() { new Audio('sounds/ボスルーレット停止2.mp3').play().catch(() => {}); }
            const cleanup = () => { clearTimeout(timer); clearInterval(interval); cancelAnimationFrame(frame); stopGuideAudio(); stopSound(); stopRemoteAdvance?.(); if (audioContext) audioContext.close().catch(() => {}); root.remove(); };
            function showBoss() {
                stage = 'boss'; next.hidden = false; next.textContent = '次へ▶';
                main.replaceChildren(element('h1', '', '次の討伐依頼'));
                const info = element('div', 'boss-opening-info');
                const portrait = element('div', 'boss-opening-portrait');
                const img = element('img'); img.src = bossPreload.getAttribute('src') || boss.icon; img.alt = boss.name;
                portrait.append(img, element('strong', '', boss.name));
                const stats = element('div', 'boss-opening-stats');
                for (const [label, value, cls] of [['HP', number(boss.hp)], ['攻撃力', number(boss.attack)], ['先着報酬', number(boss.reward) + 'G', 'gold'], ['ダメージ報酬', number(window.BossBattleRules.DAMAGE_MULTIPLIER) + '倍', 'gold'], ['討伐報酬', number(boss.reward) + 'G', 'gold']]) {
                    stats.append(element('span', '', label), element('strong', cls, value));
                }
                info.append(portrait, stats); main.append(info);
                copy.textContent = (isNext ? '次' : '最初') + 'のボス情報はこちらです。';
            }
            async function showMap() {
                stage = 'mapLoading'; next.hidden = true;
                next.textContent = '次へ▶';
                root.classList.remove('boss-opening-intro-scene');
                copy.textContent = isNext ? `それでは、次のボスの場所を示します。討伐した${options.winnerName}さん、ルーレットを止めてください。` : guideLines[5];
                main.append(element('h1', '', 'ボスの出現エリア'));
                const map = element('div', 'boss-opening-map');
                const w = regionData.world.width, h = regionData.world.height;
                const svg = svgElement('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid meet', 'aria-label': 'マップ全体' });
                if (!overviewPreload.hasAttribute('src')) overviewPreload.src = overviewSource;
                try { await overviewPreload.decode(); } catch (error) { console.warn('[開始演出] 全体図の読み込みに失敗:', error); }
                if (!root.isConnected) return;
                svg.append(svgElement('image', { href: overviewSource, width: w, height: h }));
                // The clean overview intentionally omits roads for a quieter map.
                // Reuse the baked road tiles here so the lottery overview still
                // communicates the traversable routes without redrawing them.
                const roadData = window.MapRoadRasterData;
                if (!useBakedRoads && Array.isArray(roadData?.tiles)) {
                    roadData.tiles.forEach(tile => svg.append(svgElement('image', {
                        href: tile.image, x:tile.x, y:tile.y, width:tile.width, height:tile.height,
                        class:'boss-opening-road-tile'
                    })));
                }
                // Bridges are baked as a separate layer from ordinary roads.
                // Use the map's authored bridge assets and edge IDs here too,
                // so opening and boss-lottery maps show the same route network.
                if (Array.isArray(roadData?.bridges)) {
                    const collapse = window.bridgeCollapseVisualState || window.bridgeCollapseState || null;
                    roadData.bridges.forEach(bridge => {
                        const edge = String(bridge.key || '').split(':').map(Number);
                        const collapsed = edge.length === 2 && window.BridgeCollapseRules?.isClosed(collapse, edge[0], edge[1]);
                        if (collapsed) return;
                        svg.append(svgElement('image', {
                            href:bridge.image, x:bridge.x, y:bridge.y, width:bridge.width, height:bridge.height,
                            class:'boss-opening-bridge', 'data-bridge-edge':bridge.key
                        }));
                    });
                }
                // Region paths are presentation approximations and may extend
                // slightly past the coastline. Clip the highlight to the actual
                // continent silhouette so no lottery glow appears over the sea.
                const continent = window.MapContinentData;
                let highlightLayer = svg;
                if (Array.isArray(continent?.coast) && continent.coast.length > 2) {
                    const coastPath = 'M' + continent.coast.map(point => `${point.x},${point.y}`).join(' L') + ' Z';
                    const defs = svgElement('defs', {});
                    const clip = svgElement('clipPath', { id:'boss-opening-land-clip', clipPathUnits:'userSpaceOnUse' });
                    // The land outline contains a lake opening. Encode both
                    // boundaries in one even-odd path so highlighted regions
                    // cannot paint over the water inside the continent.
                    const lake = continent.lake;
                    let landClipPath = coastPath;
                    if (lake && lake.radiusX > 0 && lake.radiusY > 0) {
                        const angle = Number(lake.rotation || 0) * Math.PI / 180;
                        const lakePoints = Array.from({ length:96 }, (_, index) => {
                            const theta = index * Math.PI * 2 / 96;
                            const x = Math.cos(theta) * lake.radiusX;
                            const y = Math.sin(theta) * lake.radiusY;
                            return `${lake.x + x * Math.cos(angle) - y * Math.sin(angle)},${lake.y + x * Math.sin(angle) + y * Math.cos(angle)}`;
                        });
                        landClipPath += ' M' + lakePoints.join(' L') + ' Z';
                    }
                    clip.append(svgElement('path', { d:landClipPath, 'clip-rule':'evenodd', 'fill-rule':'evenodd' }));
                    defs.append(clip);
                    svg.append(defs);
                    highlightLayer = svgElement('g', { 'clip-path':'url(#boss-opening-land-clip)' });
                    svg.append(highlightLayer);
                }
                const shapes = regionData.regions.filter(region => region.path).map(region => {
                    const shape = svgElement('path', { d: region.path, class: 'boss-opening-region' }); highlightLayer.append(shape); return { region, shape };
                });
                if (regionData.lake) {
                    const l = regionData.lake;
                    const shape = svgElement('ellipse', { cx:l.x, cy:l.y, rx:l.radiusX, ry:l.radiusY, transform:`rotate(${l.rotation} ${l.x} ${l.y})`, class:'boss-opening-region' });
                    // The lake itself remains a selectable lottery region,
                    // outside the land-only clipping group.
                    svg.append(shape); shapes.push({ region:{ id:'lake', name:'湖' }, shape });
                }
                map.append(svg); main.append(map);
                function finishRoll() {
                    if (stage !== 'rolling') return;
                    stage = 'zooming'; next.hidden = true;
                    clearInterval(interval); stopSound(); playStop(); shapes.forEach(item => item.shape.classList.remove('active'));
                    const region = regionAt(square, regionData);
                    const selected = shapes.find(item => item.region.id === region?.id); selected?.shape.classList.add('active');
                    copy.textContent = region ? `${isNext ? '次' : '最初'}のボスの出現エリアは${region.name}！詳細な位置はこちらです！` : `${isNext ? '次' : '最初'}のボスの出現位置はこちらです！`;
                    timer = setTimeout(() => {
                        selected?.shape.classList.remove('active');
                        for (const node of squares) svg.append(svgElement('circle', { cx:node.x, cy:node.y, r:30, fill:node.type === 'monster' ? '#e65050' : '#f4c746', stroke:'#fff', 'stroke-width':8 }));
                        svg.append(svgElement('image', { href:boss.icon, x:square.x-150, y:square.y-220, width:300, height:300 }));
                        const zw=w*.22, zh=h*.22, x=Math.max(0,Math.min(w-zw,square.x-zw/2)), y=Math.max(0,Math.min(h-zh,square.y-zh/2)), start=performance.now();
                        function zoom(now) { const t=Math.min(1,(now-start)/1800), e=1-(1-t)**3; svg.setAttribute('viewBox', `${x*e} ${y*e} ${w+(zw-w)*e} ${h+(zh-h)*e}`); if(t<1) frame=requestAnimationFrame(zoom); else {stage='reveal';next.hidden=false;} }
                        frame=requestAnimationFrame(zoom);
                    }, 600);
                }
                finishCurrentRoll = finishRoll;
                function beginRoll() {
                    if (stage !== 'mapLoading') return;
                    stage = 'rolling'; next.hidden = !isNext;
                    playLottery();
                    let previous = -1;
                    interval = setInterval(() => { const n = Math.floor(Math.random() * shapes.length); if (shapes[previous]) shapes[previous].shape.classList.remove('active'); shapes[n]?.shape.classList.add('active'); previous = n; }, 160);
                    if (!isNext) timer = setTimeout(finishRoll, 2600);
                }
                if (isNext) { root.dataset.stopRoll = 'true'; beginRoll(); }
                else playGuide(6).then(beginRoll);
            }
            function applyAdvance(step) {
                if (step !== expectedStep) return;
                expectedStep++;
                requestPending = false;
                if (stage === 'intro') {
                    if (introStep < 4) { introStep++; copy.textContent = guideLines[introStep]; playGuide(introStep + 1); }
                    else showMap();
                    return;
                }
                if (stage === 'rolling' && isNext) { finishCurrentRoll?.(); return; }
                if (stage === 'reveal') { showBoss(); return; }
                if (stage === 'boss' && !isNext) {
                    stage = 'bossGuide62';
                    copy.textContent = 'ボスまでの移動にはサイコロやアイテムを使用します。';
                    playGuide('開始アナウンス6-2');
                    return;
                }
                if (stage === 'bossGuide62') {
                    stage = 'bossGuide8';
                    copy.textContent = '戦闘には魔法を使用します。使うのにも新たな魔法を覚えるのにもお金がかかります。';
                    next.textContent = '次へ▶';
                    playGuide(8);
                    return;
                }
                if (stage === 'bossGuide8') {
                    stage = 'bossGuide9';
                    copy.textContent = '他にはアイテムや資産の購入にも・・・まあ細かいことは冒険しながら覚えることでしょう。';
                    playGuide(9);
                    return;
                }
                if (stage === 'bossGuide9') {
                    stage = 'finalGuide'; main.replaceChildren(); root.classList.add('boss-opening-intro-scene');
                    copy.textContent = guideLines[6]; next.textContent = 'マップへ▶'; playGuide(7);
                    return;
                }
                if (stage === 'boss' && isNext) {
                    stage = 'finalGuide'; main.replaceChildren(); root.classList.add('boss-opening-intro-scene');
                    copy.textContent = '次の活躍にも期待しています！頑張ってくださいね。';
                    next.textContent = '次のプレイヤーへ▶'; playGuide('討伐アナウンス2');
                    return;
                }
                if (stage === 'finalGuide') {
                    stage = 'transitioning';
                    const finish = () => {
                        if (useBakedRoads) cleanup();
                        try { options.onComplete?.(); }
                        catch (error) { console.warn('[開始演出] 完了時の処理に失敗しました:', error); }
                        if (!useBakedRoads) cleanup();
                        resolve();
                    };
                    if (!isNext && window.TurnHandoff && window.TurnHandoff.run(finish)) return;
                    finish();
                }
            }
            let finishCurrentRoll = null;
            if (onlineSync && typeof onlineSync.on === 'function') {
                stopRemoteAdvance = onlineSync.on('boss-opening:advance', event => {
                    if (event?.sequenceKey === sequenceKey) applyAdvance(Number(event.step));
                });
            }
            function requestAdvance() {
                if (options.canAdvance && !options.canAdvance()) return;
                if (stage === 'mapLoading' || stage === 'transitioning') return;
                if (stage === 'rolling' && !isNext) return;
                // Stopping the next-boss roulette is an action, not a page turn.
                if (!(stage === 'rolling' && isNext)) window.GameSE?.play?.('confirm', { shared: true }).catch(error => console.warn('[SE] 画面送り音を再生できません:', error));
                if (onlineSync) {
                    if (requestPending) return;
                    requestPending = true;
                    onlineSync.advanceBossOpening(sequenceKey, expectedStep).then(response => {
                        if (!response?.ok) { requestPending = false; console.warn('[開始演出] 画面送りを同期できません:', response?.error); }
                    }).catch(error => { requestPending = false; console.warn('[開始演出] 画面送りを同期できません:', error); });
                    return;
                }
                applyAdvance(expectedStep);
            }
            root.addEventListener('click', () => requestAdvance());
            if (isNext) showMap();
            else playGuide(1);
        });
    }
    window.BossOpening = Object.freeze({ show });
})();
