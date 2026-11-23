(function () {
    'use strict';
    const rules = window.UndergroundRules;
    const format = value => Number(value).toLocaleString('ja-JP');
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
    const penica = value => format(value) + 'ペニカ';
    const gold = value => '<strong>' + value + '</strong>';
    const guardLines = [
        'あなたは強制地下労働施設に収容されました。',
        'ここでは地上の通貨は使用できません。代わりに' + gold('ペニカ') + 'を使用します。',
        'ペニカの価値は、ゴールドの1/10です。',
        '地上に戻るためには、50万ペニカが必要です。それでは。'
    ];
    const foremanLines = [
        'クックック…こんな薄暗い地下にいたんじゃ、昼と夜の区別もつかなくなっちまう。',
        'おかげでまともに寝れなくなっちまった。',
        'お前だって、早くここから抜け出したいだろ？ならいい話があるぜ。',
        'ここでは内密に、賭場が開催されているんだ。一度勝てば、50万ペニカが手に入る。',
        '掛け金は、' + rules.stake / 10000 + '万ペニカ。悪い話じゃないだろう？',
        'ルールは簡単、３つのサイコロを振って、出た目の数が大きいほうの勝ち。'
    ];
    const duelStages = ['duel', 'playerRolling', 'playerResult', 'foremanRolling', 'duelResult', 'lostTaunt', 'lost', 'interrupt', 'cheat', 'confession', 'exposed', 'won'];
    const sceneStages = ['foreman', 'offer', 'paid', 'declined', 'guard', 'release', ...duelStages];
    const saleStages = ['selling', 'sale', 'unsold', 'solvent', 'debt'];
    let root, latest, owner, send, viewKey, lastArea, generation = 0, frame, timer, voice, reel, lastMusic;
    let busy = false;
    let playCue;
    let areaTransitionPending = false;
    let transferFade = null;
    let immunitySound;
    let menuPlaceholder, menuNode, hudPlaceholder, hudNode, returnButtonState;
    function updateHudBoundary() {
        if (!root || root.hidden) return;
        root.style.setProperty('--ug-hud-bottom', Math.ceil(document.querySelector('.game-hud')?.getBoundingClientRect().bottom || 80) + 'px');
    }
    window.addEventListener('resize', updateHudBoundary);
    function restoreMenu() {
        if (returnButtonState) {
            const { button, onclick, display, disabled } = returnButtonState;
            button.onclick = onclick; button.style.display = display; button.disabled = disabled;
            returnButtonState = null;
        }
        if (menuNode && menuPlaceholder?.parentNode) menuPlaceholder.replaceWith(menuNode);
        menuPlaceholder = null;
        if (hudNode && hudPlaceholder?.parentNode) hudPlaceholder.replaceWith(hudNode);
        hudPlaceholder = null; hudNode = null;
    }
    function placeMenu() {
        const menu = document.querySelector('.action-menu');
        if (!menu || !root) return;
        menuNode = menu;
        menuPlaceholder = document.createComment('action menu');
        menu.replaceWith(menuPlaceholder);
        const host = document.createElement('div');
        host.className = 'game-screen ug-menu-host';
        host.append(menu); root.append(host);
        // Keep the original HUD and its badge in the same stacking context as
        // the underground board. Its controls and layout are reused unchanged.
        const hud = document.querySelector('.game-hud');
        if (hud) {
            hudNode = hud;
            hudPlaceholder = document.createComment('underground hud');
            hud.replaceWith(hudPlaceholder);
            const hudHost = document.createElement('div');
            hudHost.className = 'game-screen ug-hud-host';
            hudHost.append(hud); root.append(hudHost);
        }
        const button = menu.querySelector('#diceMovementReturnButton');
        if (button) {
            returnButtonState = { button, onclick: button.onclick, display: button.style.display, disabled: button.disabled };
            button.style.display = latest.undergroundFlow?.stage === 'choose' ? 'grid' : 'none';
            button.disabled = !owner || !rules.canResetMove(latest.undergroundFlow);
            button.onclick = event => { event.stopPropagation(); click('resetMove'); };
        }
    }

    function cue(name, loopEnd) {
        if (playCue) { playCue.pause(); playCue = null; }
        if (!name) return;
        playCue = new Audio('sounds/' + name);
        playCue.volume = typeof buttonSound !== 'undefined' ? buttonSound.volume : 0.7;
        if (loopEnd) {
            const audio = playCue;
            audio.loop = true;
            audio.addEventListener('timeupdate', () => { if (audio.currentTime >= loopEnd) audio.currentTime = 0; });
        }
        (window.GameSE ? window.GameSE.playLocal(playCue, Infinity, { loopEnd: loopEnd || 0 }) : playCue.play()).catch(() => {});
    }

    function say(name) {
        voice?.pause();
        voice = new Audio('sounds/ガイド/地下アナウンス' + name + '.mp3?v=underground');
        voice.volume = typeof buttonSound !== 'undefined' ? buttonSound.volume : 0.7;
        (window.GameSE ? window.GameSE.playLocal(voice) : voice.play()).catch(() => {});
    }

    function portrait(player) {
        return window.getPlayerCharacterIcon?.(latest.players.indexOf(player)) || '';
    }

    function undergroundMusic(active, stage) {
        if (!active) { lastMusic = null; return; }
        const key = ['cheat','confession'].includes(stage) ? 'silent'
            : ['exposed','won'].includes(stage) || stage === 'release' && latest.undergroundFlow.victory ? 'bossVictory'
            : duelStages.includes(stage) && !['lostTaunt','lost'].includes(stage) ? 'bossBattle' : 'underground';
        if (lastMusic === key) return;
        lastMusic = key;
        if (key === 'silent') stopAllBGM();
        else if (key === 'bossBattle') setupBGM(bossBattleBGM, bossBattleBGMGain, setBossBattleBGMGain);
        else if (key === 'bossVictory') setupBGM(bossVictoryBGM, bossVictoryBGMGain, setBossVictoryBGMGain);
        else {
            if (!bossBattleBGM.paused || !bossVictoryBGM.paused) stopAllBGM();
            window.transitionAreaBGM?.(key, 0);
        }
    }

    function changeArea(underground, isRelease, isAdmission) {
        const previous = lastArea;
        lastArea = underground;
        if (previous === undefined || previous === underground || window.TurnHandoff?.isBlack()) return false;
        const fade = document.createElement('div');
        fade.className = 'ug-fade' + (isRelease || isAdmission ? ' ug-fade-transfer' : '');
        if (isRelease || isAdmission) transferFade = fade;
        document.body.append(fade);
        fade.addEventListener('animationend', () => {
            if (transferFade === fade) transferFade = null;
            fade.remove();
        }, { once: true });
        return true;
    }

    function click(action = 'next') {
        if (!owner || busy || areaTransitionPending || !latest.undergroundFlow) return;
        const currentGeneration = generation;
        const { turnKey, step, stage } = latest.undergroundFlow;
        busy = true;
        const dispatch = send;
        Promise.resolve().then(() => dispatch({ turnKey, step, stage, action })).catch(error => {
            if (generation !== currentGeneration) return;
            console.error('[地下労働]', error);
            const notice = root.querySelector('.ug-error');
            if (!notice) return;
            notice.textContent = error.message + ' ';
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.dataset.action = action;
            retry.textContent = '再試行';
            notice.append(retry);
        }).finally(() => { if (generation === currentGeneration) busy = false; });
    }

    function map(player) {
        const [x,y] = rules.track[player.underground.position];
        const flow = latest.undergroundFlow;
        const positions = { down:'0% 0%', up:'100% 0%', left:'0% 100%', right:'100% 100%' };
        const choices = flow?.stage === 'choose' ? rules.neighbors(player.underground.position) : [];
        const endpoints = flow?.stage === 'choose' ? rules.reachable(player.underground.position, flow.previousPosition ?? null, flow.remaining) : [];
        const glowElapsed = Math.max(0, Date.now() - (player.underground.memoGlowStartedAt || Date.now()));
        return '<div class="ug-map"><div class="ug-cross-rail ug-cross-horizontal"></div><div class="ug-cross-rail ug-cross-vertical"></div>' + rules.track.map(([column,row], index) => {
            const reachable = endpoints.includes(index);
            const memo = player.underground.memoTile === index && !player.underground.memo;
            const action = choices.includes(index) ? 'target:' + index : reachable ? 'destination:' + index : '';
            return '<div class="ug-tile' + (reachable ? ' ug-reachable' : '') + (memo ? ' ug-memo-tile' : '') + '" ' +
                (action && owner ? 'data-action="' + action + '"' : '') +
                ' style="--x:' + column + ';--y:' + row + (memo ? ';--ug-glow-delay:-' + glowElapsed % 3000 + 'ms' : '') + '"></div>';
        }).join('') +
            latest.players.filter(candidate => candidate.underground && rules.track[candidate.underground.position]).map(candidate => {
                const [column, row] = rules.track[candidate.underground.position];
                const peers = latest.players.filter(other => other.underground && other.underground.position === candidate.underground.position);
                const offset = (peers.indexOf(candidate) - (peers.length - 1) / 2) * 18;
                const character = PLAYER_CONTENTS[Number(candidate.characterId)];
                const direction = candidate.underground.direction in positions ? candidate.underground.direction : 'down';
                const directionalSprite = character?.spriteDirections?.[direction];
                const sprite = directionalSprite || character?.sprite || '';
                const facing = directionalSprite ? 'center' : positions[direction];
                return '<div class="ug-marker' + (candidate === player ? ' ug-marker-active' : '') + (directionalSprite ? ' ug-marker-directional' : '') + '" role="img" aria-label="' + escape(candidate.name) + '" style="left:calc(var(--cell)*' + column + ');top:calc(var(--cell)*' + row + ');--ug-offset:' + offset + '%;background-image:url(&quot;' + escape(sprite) + '&quot;);background-position:' + facing + '"></div>';
            }).join('') +
            (flow?.stage === 'choose' ? choices.map(target => {
                const [nx,ny] = rules.track[target];
                const angle = nx > x ? 90 : nx < x ? -90 : ny > y ? 180 : 0;
                return '<button class="ug-arrow" data-action="target:' + target + '" style="left:calc(var(--cell)*' + x + ' + var(--cell)*' + (nx-x) * .55 + ');top:calc(var(--cell)*' + y + ' + var(--cell)*' + (ny-y) * .55 + ');--rotation:' + angle + 'deg" aria-label="移動"></button>';
            }).join('') : '') +            '</div>';
    }

    function message(flow, player) {
        const name = escape(player.name);
        const lastSold = flow.sales?.at(-1);
        const ownsMonopolizedBranch = rules.holdsMonopolizedBranch(player,
            typeof ASSET_BOXES !== 'undefined' ? ASSET_BOXES : {});
        const lines = {
            reminder: player.debtTurns === 1
                ? 'デフォルトまであと1ターンです。返済できなければデフォルトとなります。'
                : 'デフォルトまであと' + player.debtTurns + 'ターンです。',
            selling: 'ゴールドが不足したため、資産を売却します。',
            sale: lastSold && escape(lastSold.name) + 'を ' + gold(format(lastSold.payout) + 'G') + ' で売却しました。',
            solvent: '売却により赤字を解消しました。',
            unsold: flow.sales?.length ? 'すべての資産を売却しても返済できませんでした。' : '保有している資産はありません。',
            debt: '3ターン以内に借金を返済してください。できなかった場合はデフォルト（債務不履行）となります。',
            repaid: '借金を完済しました！',
            default: '返済期限を超過しました。デフォルト処理を実施します。借金は免除となり、所持ゴールドは' + gold('0G') + 'となります。' +
                (ownsMonopolizedBranch ? '<br>なお、強制地下労働中は資産からの配当金が0Gとなります。' : ''),
            labour: '強制地下労働を開始します。',
            confiscated: '所持アイテムはすべて没収されました。',
            guard: guardLines[flow.page],
            earned: gold(penica(flow.amount)) + 'を獲得した！',
            foreman: foremanLines[flow.page],
            offer: flow.retry ? 'もうひと勝負していくか？' : 'どうだ、お前もやっていくか？',
            paid: gold(penica(rules.stake)) + 'を支払った！',
            declined: name + 'は班長の誘いを断った！',
            duel: '班長にサイコロ勝負を挑んだ！',
            lostTaunt: '悪いな' + name + '、また勝負しようぜ',
            lost: '班長に負けた！',
            interrupt: 'ちょっと待った！',
            cheat: '班長のサイコロは「四五六サイ」だ！！一・二・三の出目がない、イカサマのサイコロだ！！',
            confession: ['ち、違う！俺は何も知らない！許してくれ！', '言い逃れはできない、お前が一年前から不正をしていたことは、このメモ帳を見れば一目瞭然だ！', '一年前だって！？このサイコロは半年前ようやく完成した代物で・・・はっ！！', '今の証言も、この「四五六サイ」でイカサマをしていた証拠だ！', 'ち・・・ちくしょーーー！！'][flow.page],
            exposed: '班長の不正を暴いた！50万ペニカに加えて、班長が貯め込んでいたペニカを全て入手した！',
            won: gold(penica(flow.amount)) + 'を入手した！',
            memo: ['……ん？　土の中に、何か埋まっている。', name + 'は「メモ帳」を拾った！', 'メモ帳には、班長のサイコロの出目が記録されている……。', 'よく見ると、出目の合計は12以上のものしかない……！'][flow.page],
            release: flow.releaseFinal ? '強制地下労働施設から解放します。' : flow.victory ? '50万ペニカを確認しました。所持しているペニカはゴールドに変換します。' : '50万ペニカを確認しました。地上へ送還します。',
            returned: name + 'は地上に生還した！ ' + gold(format(flow.amount) + 'G') + 'を入手した！',
            memoDropped: 'メモ帳は地下に落としてきてしまった！',
            returnItem: name + 'は「' + escape(ITEM_CONTENTS[flow.returnItem]?.name || '人力車') + '」を手に入れた！',
            returnImmunityNotice: '1ターン無敵になった！'
        };
        return lines[flow.stage];
    }

    function drawDice(flow) {
        const currentGeneration = generation;
        const started = performance.now();
        const rolling = flow.stage === 'playerRolling' ? 'player' : flow.stage === 'foremanRolling' ? 'foreman' : null;
        const stopping = flow.stage === 'playerResult' ? 'player' : ['duelResult','interrupt'].includes(flow.stage) ? 'foreman' : null;
        const renderers = ['player','foreman'].map(side => {
            const canvas = root.querySelector('[data-dice="' + side + '"]');
            const faceValuesForTop = value => {
                const top = value >= 4 && value <= 6 ? value : 4;
                const front = 4 + (top - 3) % 3, left = 4 + (top - 2) % 3;
                return { top, bottom: top, front, back: front, left, right: left };
            };
            const renderer = window.DiceAnimation.createRenderer(canvas, {
                ...(side === 'foreman' ? { theme:'black', faceValuesForTop } : {}),
                stopMotion: window.DiceStopMotion.sample
            });
            const results = flow[side + 'Dice'];
            if (!results && rolling !== side) return null;
            const phase = flow.stage === 'cheat' && side === 'foreman' ? 'rolling' : rolling === side ? 'rolling' : stopping === side ? 'stopping' : 'result';
            return { renderer, state:{ phase, results:results || [], count:3, began:started, stopped:started,
                showIndividualResults:false, centerLanding:true, canvasLanding:true, diceScale:window.DiceAnimation.gameplayScale }, side };
        }).filter(Boolean);
        if (stopping) busy = true;
        function animate(now) {
            if (generation !== currentGeneration) return;
            let keep = false;
            for (const entry of renderers) {
                const drawTime = flow.stage === 'cheat' && entry.side === 'foreman' ? started + (now-started)*.18 : now;
                const done = entry.renderer.draw(entry.state, drawTime);
                if (flow.stage === 'interrupt' && entry.side === 'foreman' && now-started >= 230) {
                    stopAllBGM();lastMusic='silent';cue('ビシッとツッコミ1.mp3');
                    const caption = root.querySelector('.ug-caption');
                    if (caption) caption.style.visibility = '';
                    busy = false;
                    return;
                }
                if (entry.state.phase === 'stopping' && done) {
                    entry.state.phase = 'result';
                    entry.renderer.draw(entry.state, now);
                    root.querySelector('[data-score="' + entry.side + '"]').textContent = rules.total(entry.state.results);
                    busy = false;
                }
                keep ||= entry.state.phase !== 'result';
            }
            if (keep) frame = requestAnimationFrame(animate);
        }
        animate(started);
    }

    function render(state, canOperate, dispatch) {
        latest = state;
        owner = canOperate;
        send = dispatch;
        if (areaTransitionPending) return;
        const flow = state.undergroundFlow;
        const active = state.players[state.activePlayerIndex];
        if (!active) return;
        const player = state.players[flow?.playerIndex] || active;
        const stage = flow?.stage;
        const underground = Boolean(active.underground);
        const playingImmunitySound = stage === 'returnImmunity';
        const immunityNotice = stage === 'returnImmunityNotice';
        if (!state.matchPhase || state.matchPhase === 'playing') {
            if (!underground && lastArea === true) {
                stopAllBGM();
                if (state.bossCounterEnabled) setupBGM(bossBattleBGM, bossBattleBGMGain, setBossBattleBGMGain);
                else window.MapAreaAudio?.updateForPlayer(active, { immediate:true });
            }
            const isRelease = !underground && lastArea === true && stage === 'returned';
            const isAdmission = underground && lastArea === false && stage === 'confiscated';
            if (changeArea(underground, isRelease, isAdmission)) {
                areaTransitionPending = true;
                setTimeout(() => {
                    areaTransitionPending = false;
                    render(latest, owner, send);
                }, isRelease || isAdmission ? 270 : 100);
                return;
            }
            undergroundMusic(underground, stage);
        } else lastMusic = null;
        const stageKey = [state.matchPhase, flow?.turnKey, flow?.step, stage, underground].join(':');
        const key = playingImmunitySound || immunityNotice ? `${stageKey}:${owner}` : stageKey;
        if (key === viewKey) return;
        const priorViewKey = viewKey;
        viewKey = key;
        generation++;
        busy = false;
        cancelAnimationFrame(frame);
        clearTimeout(timer);
        restoreMenu();
        const previousSlotKey = [state.matchPhase, flow?.turnKey, flow?.step - 1, 'slot', underground].join(':');
        const previousSlot = stage === 'slotStop' && priorViewKey === previousSlotKey && root?.querySelector('.ug-slot');
        if (!previousSlot) reel?.cancel();
        voice?.pause();
        cue();
        if (!root) {
            root = document.createElement('section');
            root.id = 'undergroundPresentation';
            document.addEventListener('click', event => {
                if (root.hidden || !saleStages.includes(latest?.undergroundFlow?.stage) || event.target.closest('#onlineRecoveryButton')) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                if (!owner || busy || areaTransitionPending) return;
                window.GameSE?.play?.('confirm', { shared: true }).catch(error => console.warn('[SE] 画面送り音を再生できません:', error));
                click();
            }, true);
            root.addEventListener('click', event => {
                const menuButton = event.target.closest('#inventoryButton,#magicButton,#otherButton');
                if (menuButton && owner && latest.undergroundFlow?.stage === 'roll') {
                    root.style.zIndex = '0';
                    const popupIds = ['inventoryPopup','magicPopup','otherMenuPopup','assetPopup','soundSettingsPopup'];
                    setTimeout(() => {
                        const watcher = setInterval(() => {
                            const visible = popupIds.some(id => { const popup = document.getElementById(id); return popup && getComputedStyle(popup).display !== 'none' && getComputedStyle(popup).visibility !== 'hidden'; });
                            if (!visible) { clearInterval(watcher); if (root) root.style.zIndex = ''; }
                        }, 200);
                    }, 0);
                    return;
                }
                const action = event.target.closest('[data-action]')?.dataset.action;
                if (action === 'roll') return click();
                if (['inventory','magic','other'].includes(action)) {
                    if (!owner || latest.undergroundFlow?.stage !== 'roll') return;
                    const game = document.querySelector('.game-container');
                    game.inert = false;
                    root.style.zIndex = '0';
                    const id = {inventory:'inventoryButton',magic:'magicButton',other:'otherButton'}[action];
                    document.getElementById(id)?.click();
                    const popups = ['inventoryPopup','magicPopup','otherMenuPopup','assetPopup','soundSettingsPopup'];
                    const watcher = setInterval(() => {
                        const visible = popups.some(name => {
                            const popup = document.getElementById(name);
                            return popup && getComputedStyle(popup).display !== 'none' && getComputedStyle(popup).visibility !== 'hidden';
                        });
                        if (visible) return;
                        clearInterval(watcher);
                        root.style.zIndex = '';
                        if (!root.hidden) game.inert = true;
                    }, 200);
                    return;
                }
                const stage = latest.undergroundFlow?.stage;
                if (stage === 'returnImmunity' && action !== 'immunitySoundComplete') return;
                if (stage === 'returnImmunityNotice' && busy) return;
                if (action) {
                    if (action === 'next' && stage !== 'duel' && owner) window.GameSE?.play?.('confirm', { shared: true }).catch(error => console.warn('[SE] 画面送り音を再生できません:', error));
                    return click(action);
                }
                if (stage && !['offer','roll','choose','duel','done','moving','foremanRolling'].includes(stage)) {
                    if (owner) window.GameSE?.play?.('confirm', { shared: true }).catch(error => console.warn('[SE] 画面送り音を再生できません:', error));
                    click();
                }
            });
            document.body.append(root);
        }
        root.hidden = (!underground && (!flow || stage === 'done')) || Boolean(state.matchPhase && state.matchPhase !== 'playing');
        const game = document.querySelector('.game-container');
        if (game) game.inert = !root.hidden && !underground;
        if (root.hidden) { window.DiceMovementCounter?.hide(); return; }
        const scene = sceneStages.includes(stage);
        if (!playingImmunitySound && !immunityNotice) immunitySound = null;
        const dice = ['duel','playerRolling','playerResult','foremanRolling','duelResult','lostTaunt','lost','interrupt','cheat'].includes(stage);
        const guard = ['guard','release'].includes(stage);
        const foreman = ['foreman','offer','lostTaunt'].includes(stage) || stage === 'confession' && [0,2,4].includes(flow.page);
        const gambling = duelStages.includes(stage) || stage === 'release' && flow.victory;
        const caption = flow && message(flow, player);
        root.className = (underground ? 'ug-underground' : 'ug-ground') + (scene ? ' ug-scene-active' : '');
        root.classList.toggle('ug-immunity-sound', playingImmunitySound || (immunityNotice && Boolean(immunitySound)));
        updateHudBoundary();
        const button = (label, action = 'next', css = '') => '<button type="button" class="' + css + '" data-action="' + action + '">' + label + '</button>';
        const score = side => flow[side + 'Dice'] && !(stage === 'playerResult' && side === 'player') && !(['duelResult','foremanRolling','interrupt','cheat'].includes(stage) && side === 'foreman')
            ? rules.total(flow[side + 'Dice']) : '';
        const participant = (side, image, name) => '<div><img alt="" src="' + escape(image) + '"><b>' + name + '</b><output data-score="' + side + '">' + score(side) + '</output><canvas data-dice="' + side + '"></canvas></div>';
        const sale = flow?.sales && saleStages.includes(stage);
        const content = sale ? '<section class="ug-sale"><h2>資産の強制売却</h2><div class="ug-sale-row"><b>支店名</b><b>資産名</b><b>評価額</b><b>売却価格</b></div><div class="ug-sale-list">' +
            flow.sales.map(asset => {
                const shop = typeof ASSET_BOXES !== 'undefined' ? ASSET_BOXES[asset.store] : null;
                const branch = escape(String(shop?.name || '未分類').replace(/支店$|店$/, ''));
                const valuation = marketPrice(ASSET_CONTENTS[asset.id].price, state.marketExponent ?? 0);
                return '<div class="ug-sale-row"><span>' + branch + '</span><span>' + escape(asset.name) + '</span><span>' + format(valuation) + 'G</span>' + gold(format(asset.payout) + 'G') + '</div>';
            }).join('') + '</div><div class="ug-sale-totals"><span>所持ゴールド <strong class="ug-sale-balance">' + format(player.money) +
            'G</strong></span><span>売却合計 ' + gold(format(flow.sales.reduce((sum, asset) => sum + asset.payout, 0)) + 'G') + '</span></div></section>' : '';
        const stageContent = scene ? '<div class="ug-scene' + (gambling ? ' ug-gambling' : '') + (stage === 'cheat' ? ' ug-inspection' : '') + '">' +
            (guard ? '<img class="ug-character" alt="" src="images/characters/npc/shops/黒服.webp">' : '') +
            (['foreman','offer','confession'].includes(stage) ? '<img class="ug-character" alt="" src="images/characters/npc/shops/' + (stage === 'confession' ? '班長2.webp' : '班長1.webp') + '">' : '') +
            (stage === 'offer' ? '<div class="ug-options">' + button(player.underground.memo ? 'メモ帳を所持<br>して挑戦' : '挑戦する','challenge') + button('断る','decline') + '</div>' : '') +
            (dice ? '<div class="ug-dice">' + participant('player', portrait(player), escape(player.name)) +
            participant('foreman','images/characters/npc/shops/班長アイコン1.webp','班長') + '</div>' : '') +
            (stage === 'duel' ? button('<img src="images/ui/icons/interface/dice.webp" alt="">サイコロを振る','next','ug-roll') : '') + '</div>' : '';
        root.innerHTML = (underground && !scene ? map(active) : '') + stageContent + content +
            (['rolling','diceResult'].includes(stage) ? '<div class="ug-normal-dice"><canvas></canvas></div>' : '') +
            (['slot','slotStop'].includes(stage) ? '<div class="ug-slot gold-roulette"><div class="gold-roulette-title">獲得ペニカ</div><div class="gold-roulette-number"></div></div>' : '') +
            (caption ? '<div class="ug-caption"' + (immunityNotice ? ' style="visibility:hidden"' : '') + '>' +
                (guard || foreman ? '<span class="ug-speaker">' + (guard ? '黒服' : '班長') + '</span>' :
                    '<img alt="" src="' + escape(portrait(player)) + '">') + '<p>' + caption + '</p>' +
                (!['offer','duel'].includes(stage) && (!immunityNotice || owner) ? button('次へ▶','next','ug-next') : '') + '</div>' :
                (['playerRolling','playerResult','duelResult'].includes(stage) ? button('次へ▶','next','ug-next') : '')) +
            '<div class="ug-error" role="status"></div>';
        const telop = root.querySelector('.ug-caption');
        window.TelopStandard?.apply(telop, { message: telop?.querySelector('p'), portrait: telop?.querySelector('img'),
            next: telop?.querySelector('.ug-next'), speaker: telop?.querySelector('.ug-speaker') });
        if (underground) placeMenu();
        if (underground && ['choose','moving'].includes(stage) && flow.remaining > 0) window.DiceMovementCounter?.show(flow.remaining, !owner);
        else if (underground) window.DiceMovementCounter?.hide();
        if (underground) {
            const diceButton = document.getElementById('rouletteButton');
            if (diceButton) diceButton.disabled = !owner || stage !== 'roll';
            for (const id of ['inventoryButton','magicButton','otherButton']) { const button = document.getElementById(id); if (button) button.disabled = !owner || stage !== 'roll'; }
        }
        if (sale) {
            const list = root.querySelector('.ug-sale-list'); list.scrollTop = list.scrollHeight;
            const balance = root.querySelector('.ug-sale-balance');
            const payout = stage === 'sale' ? Number(flow.sales[flow.sales.length-1]?.payout || 0) : 0;
            if (balance && payout && window.GoldCounterUI?.animate) window.GoldCounterUI.animate(balance, Number(player.money)-payout, Number(player.money));
        }
        if (stage === 'labour') window.GameSE?.play?.('punishment', {shared:true,eventId:`underground-labour:${flow.turnKey}:${flow.step}`}).catch(error => console.warn('[地下労働] お仕置きSEを再生できません:', error));
        if (stage === 'paid') window.GameSE?.play?.('payment', {eventId:`underground-stake:${flow.turnKey}:${flow.step}`}).catch(error => console.warn('[地下勝負] 支払いSEを再生できません:', error));
        if (stage === 'sale') window.GameSE?.play?.('mugging', {eventId:`debt-sale:${flow.turnKey}:${flow.step}`}).catch(() => {});
        if (stage === 'guard') say(['1','2','2-2','3'][flow.page]);
        if (stage === 'release') say(flow.releaseFinal ? '5' : flow.victory ? '4-1' : '4-2');
        if (stage === 'interrupt') { const caption = root.querySelector('.ug-caption'); if (caption) caption.style.visibility = 'hidden'; }
        if (['earned','won'].includes(stage)) cue('金額表示.mp3');
        if (stage === 'returned') {
            if (transferFade) {
                const currentView = viewKey;
                transferFade.addEventListener('animationend', () => {
                    if (viewKey === currentView && latest?.undergroundFlow?.stage === 'returned') cue('金額表示.mp3');
                }, { once: true });
            } else cue('金額表示.mp3');
        }
        if (playingImmunitySound) {
            if (immunitySound?.key !== stageKey) {
                const finished = Promise.resolve().then(() => window.GameSE?.playAndWait?.('immunity')).catch(error => {
                    console.warn('[地下生還] 無敵SEを再生できません:', error);
                });
                immunitySound = { key:stageKey, finished };
            }
            const current = generation;
            immunitySound.finished.then(() => {
                if (current === generation) click('immunitySoundComplete');
            });
        }
        if (immunityNotice) {
            busy = true;
            const current = generation;
            const banner = root.querySelector('.ug-caption');
            Promise.resolve(immunitySound?.finished).then(() => {
                if (current !== generation) return;
                root.classList.remove('ug-immunity-sound');
                // 発光を描画してから、次のフレームでテロップを表示する。
                frame = requestAnimationFrame(() => {
                    frame = requestAnimationFrame(() => {
                        if (current !== generation) return;
                        banner.style.visibility = '';
                        busy = false;
                    });
                });
            });
        }
        if (['playerRolling','foremanRolling'].includes(stage)) cue('サイコロ.wav', 0.83);
        if (['playerResult','duelResult'].includes(stage)) cue('サイコロ停止.mp3');
        if (dice) drawDice(flow);
        if (['rolling','diceResult'].includes(stage)) {
            const canvas = root.querySelector('.ug-normal-dice canvas');
            const renderer = window.DiceAnimation.createRenderer(canvas, {stopMotion:window.DiceStopMotion.sample});
            const began = performance.now(), current = generation;
            const diceState = { phase:stage === 'rolling' ? 'rolling' : 'stopping', count:1, results:stage === 'diceResult' ? [flow.move] : [], began, stopped:began, showIndividualResults:false, centerLanding:true, cornerLaunch:true, launchHeight:.22, diceScale:window.DiceAnimation.gameplayScale, landingOffsetY:80 };
            if (stage === 'rolling') cue('サイコロ.wav', .83);
            else { cue('サイコロ停止.mp3'); busy = true; }
            const draw = time => {
                if (current !== generation) return;
                if (renderer.draw(diceState,time)) { busy = false; return; }
                frame = requestAnimationFrame(draw);
            };
            frame = requestAnimationFrame(draw);
        }
        if (stage === 'foremanRolling' && owner) timer = setTimeout(() => click(), 2000);
        if (stage === 'moving') {
            const marker = root.querySelector('.ug-marker-active');
            const cell = root.querySelector('.ug-tile').getBoundingClientRect().width;
            const points = [flow.moveFrom, active.underground.position].map(position => {
                const [x,y] = rules.track[position];
                return { left:x * cell + 'px', top:y * cell + 'px' };
            });
            marker.animate(points, { duration:250, easing:'linear' });
            if (owner) timer = setTimeout(() => click(), 250);
        }
        if (['slot','slotStop'].includes(stage)) {
            const target = root.querySelector('.ug-slot');
            if (previousSlot) target.replaceWith(previousSlot);
            else reel = window.VerticalSlot.start(target, target.querySelector('.gold-roulette-number'), rules.amounts.map(penica));
            if (stage === 'slot') cue('ルーレット回転中.mp3', 2);
            else {
                cue('ルーレット停止.mp3');
                busy = true;
                reel.stop(penica(flow.amount), () => {
                    timer = setTimeout(() => { busy = false; if (owner) click(); }, 1000);
                });
            }
        }
    }

    function turnEndFailed(message, retry) {
        const notice = root?.querySelector('.ug-error');
        if (!notice) return;
        notice.textContent = message + ' ';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = '再試行';
        button.addEventListener('click', () => {
            notice.textContent = '';
            retry();
        });
        notice.append(button);
    }

    function suspend() {
        generation++;
        clearTimeout(timer);
        cancelAnimationFrame(frame);
        reel?.cancel();
        voice?.pause();
        cue();
        viewKey = null;
        lastMusic = null;
        restoreMenu();
        window.DiceMovementCounter?.hide();
        if (root) root.hidden = true;
        const game = document.querySelector('.game-container');
        if (game) game.inert = false;
    }

    function handleDiceButton() {
        if (!root || root.hidden || !latest?.players[latest.activePlayerIndex]?.underground) return false;
        if (owner && latest.undergroundFlow?.stage === 'roll') click();
        return true;
    }
    function prepareTurnHandoff() {
        if (!root || root.hidden) return;
        root.querySelector('.ug-caption')?.remove();
        root.querySelector('.ug-error')?.replaceChildren();
    }
    window.UndergroundUI = { render, turnEndFailed, suspend, handleDiceButton, prepareTurnHandoff };
})();
