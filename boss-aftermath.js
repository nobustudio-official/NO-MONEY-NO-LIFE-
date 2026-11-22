// Boss-reward presentation. The caller owns game state and transitions.
(function () {
    'use strict';
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    const fmt = value => Number(value || 0).toLocaleString('ja-JP');
    const surchargeMessage = 'あら、これじゃお仕置きにならないわね。追加徴収額を上乗せします！';
    const surchargeVoice = '討伐アナウンス3';
    function icon(player) { return PLAYER_CONTENTS[Number(player.characterId)]?.icon || ''; }
    const guidebookGiftLine = '今回特別に、ボスを討伐した冒険者にはアイテムの贈呈があります！';
    function guidebookReceipt(main, player, canClaim, claim) {
        main.classList.add('bf-stage-receipt', 'bf-guidebook-receipt');
        const card = document.createElement('article');
        card.className = 'bf-receipt-card';
        card.innerHTML = '<img src="' + esc(icon(player)) + '" alt=""><strong class="bf-receipt-name">' + esc(player.name) + '</strong><strong class="bf-total">攻略本</strong><button type="button" class="bf-action bf-receive">受け取る</button>';
        const button = card.querySelector('button');
        button.disabled = !canClaim;
        button.onclick = () => {
            if (button.disabled) return;
            button.disabled = true;
            window.GameSE?.play('itemObtain', { shared: true })?.catch(() => {});
            card.classList.add('is-claimed');
            window.setTimeout(() => {
                if (claim() === false) {
                    card.classList.remove('is-claimed');
                    button.disabled = !canClaim;
                }
            }, 450);
        };
        const list = document.createElement('div');
        list.className = 'bf-receipt-list';
        list.dataset.count = '1';
        list.style.setProperty('--recipient-count', '1');
        list.append(card);
        main.append(list);
    }
    function renderPenaltyEquation(equation, { distance, multiplier, die, normalAmount, additionalAmount, amount }, showDeduction) {
        const formula = `${distance} × ${fmt(multiplier)} × ${die} ＝ <strong>${fmt(normalAmount)}G</strong>`;
        equation.innerHTML = showDeduction && additionalAmount > 0
            ? `<del>${formula}</del><br>追加徴収額 <strong>＋${fmt(additionalAmount)}G</strong> → 合計 <strong>${fmt(amount)}G</strong>`
            : formula;
        equation.style.visibility = 'visible';
    }
    function show(options) {
        const { players, awards, killerIndex, target, boss, background, bossDefeatedCount = 0 } = options;
        const claims = BossCeremonyRules.aggregateRewards(awards, players.length).map(row => ({ ...row, claimed:false }));
        return new Promise(resolve => {
            const root = document.createElement('section'); root.id = 'boss-aftermath'; root.classList.add('bf-ceremony-layout');
            root.innerHTML = '<div class="bf-background"></div><div class="bf-shade"></div><img class="bf-staff" alt="ギルドのお姉さん"><section class="bf-main"></section><div class="bf-banner"><img class="bf-banner-portrait" alt="" hidden><span class="bf-speaker">ギルドのお姉さん</span><p class="bf-copy" aria-live="polite"></p><button class="bf-next" type="button">次へ▶</button></div>';
            if (background && background !== 'none') root.querySelector('.bf-background').style.backgroundImage = background;
            const staff = root.querySelector('.bf-staff'), main = root.querySelector('.bf-main'), banner = root.querySelector('.bf-banner'), copy = root.querySelector('.bf-copy'), next = root.querySelector('.bf-next'), portrait = root.querySelector('.bf-banner-portrait');
            const battleScreen = options.battleScreen;
            staff.src = 'images/characters/npc/jobs/ギルド-店員.webp';
            if (battleScreen) {
                battleScreen.classList.add('battle-aftermath-active');
                battleScreen.closest('#battleMainPopup')?.classList.add('boss-aftermath-battle-hidden');
            }
            document.body.append(root);
            let stage = 'reward', frame = 0, timer = 0, dice = null, rollPhase = 'idle', began = 0, stopped = 0, value = 1, loop = null, guide = null;
            let penalty = null;
            const sound = (id, options) => { if (window.GameSE) Promise.resolve(window.GameSE.play(id, options)).catch(() => {}); };
            function stopGuide() { if (!guide) return; if (window.GameSE) window.GameSE.stop(guide); else { guide.pause(); guide.currentTime = 0; } guide = null; }
            function playGuide(name) { stopGuide(); guide = new Audio(`sounds/ガイド/${name}.mp3`); const slider = document.getElementById('seVolumeSlider'); guide.volume = slider ? Number(slider.value) / 100 : .7; const playback = window.GameSE ? window.GameSE.playLocal(guide) : guide.play(); Promise.resolve(playback).catch(error => console.warn(`[ボス討伐] 音声を再生できません: ${name}`, error)); }
            function header(title) { root.classList.remove('bf-reward-announcement'); main.className = 'bf-main'; main.replaceChildren(); const h = document.createElement('h1'); h.textContent = title; main.append(h); }
            function message(text) { copy.innerHTML = text; }
            window.Plane02Layout?.apply(root);
            function hide() { clearTimeout(timer); cancelAnimationFrame(frame); stopGuide(); if (loop) { loop.pause(); loop = null; } window.Plane02Layout?.release(root); root.remove(); battleScreen?.classList.remove('battle-aftermath-active'); battleScreen?.closest('#battleMainPopup')?.classList.remove('boss-aftermath-battle-hidden'); }
            function showReward() {
                stage = 'reward'; header('討伐報酬'); next.hidden = false;
                root.classList.add('bf-reward-announcement');
                const rows = [awards.first && ['先着報酬', awards.first], ...(awards.damageAwards || []).filter(row => Number(row.value) > 0).map(row => ['ダメージ報酬', row]), ['討伐報酬', awards.defeat]].filter(Boolean);
                const list = document.createElement('div'); list.className = 'bf-reward-list';
                for (const [label, row] of rows) { const player = players[row.playerIndex]; if (!player) continue; const line = document.createElement('div'); line.className = 'bf-reward-row'; line.innerHTML = `<span class="bf-reward-type">${esc(label)}</span><img src="${esc(icon(player))}" alt=""><span class="bf-reward-name">${esc(player.name)}</span><strong>＋${fmt(row.value)}G</strong>`; list.append(line); }
                main.append(list); message('討伐おめでとうございます！今回の報酬はこちらになります。'); playGuide('討伐アナウンス1');
            }
            function showReceipt() {
                stopGuide(); stage = 'receipt'; header('報酬受取'); main.classList.add('bf-stage-receipt'); next.hidden = true;
                const list = document.createElement('div'); list.className = 'bf-receipt-list'; list.dataset.count = String(claims.length); list.style.setProperty('--recipient-count', claims.length);
                const progress = document.createElement('p'); progress.className = 'bf-progress';
                for (const claim of claims) {
                    const player = players[claim.playerIndex], card = document.createElement('article'); card.className = 'bf-receipt-card';
                    card.innerHTML = `<img src="${esc(icon(player))}" alt=""><strong class="bf-receipt-name">${esc(player.name)}</strong><strong class="bf-total">＋${fmt(claim.amount)}G</strong><button type="button" class="bf-action bf-receive">受け取る</button>`;
                    card.querySelector('button').onclick = () => {
                        if (!BossCeremonyRules.claimReward(players, claims, claim.playerIndex)) return;
                        sound('moneyDisplay'); options.onClaim(player); card.classList.add('is-claimed'); card.querySelector('button').disabled = true;
                        const count = claims.filter(row => row.claimed).length; progress.textContent = `受取完了　${count} / ${claims.length}`;
                        if (count === claims.length) { progress.textContent = '全員の受け取りが完了しました'; timer = setTimeout(afterGoldReceipt, 1000); }
                    }; list.append(card);
                }
                progress.textContent = `受取完了　0 / ${claims.length}`; main.append(list, progress); message('それでは報酬を受け取ってください！');
                if (!claims.length) timer = setTimeout(afterGoldReceipt, 1000);
                requestAnimationFrame(() => main.querySelectorAll('.bf-total').forEach(el => { const available = el.parentElement.clientWidth - 12; if (el.scrollWidth > available) el.style.fontSize = Math.max(10, parseFloat(getComputedStyle(el).fontSize) * available / el.scrollWidth) + 'px'; }));
            }
            function afterGoldReceipt() {
                if (!options.onGuidebookClaim) { showPenalty(); return; }
                stage = 'guidebook';
                header('ドロップアイテム受取');
                next.hidden = true;
                message(guidebookGiftLine);
                playGuide('特別アイテム贈呈1');
                guidebookReceipt(main, players[killerIndex], true, () => {
                    if (stage !== 'guidebook' || !options.onGuidebookClaim()) return;
                    stopGuide();
                    showPenalty();
                    return true;
                });
            }
            function draw(time) { return dice.draw({ phase:rollPhase, count:1, results:[value], began, stopped, showIndividualResults:false, diceScale:window.DiceAnimation.gameplayScale, cornerLaunch:true, centerLanding:true, canvasLanding:true, launchHeight:.22 }, time); }
            function animate(time) { if (!dice) return; const done = draw(time); if (rollPhase === 'stopping' && done) { rollPhase = 'result'; draw(time); showFormula(); return; } frame = requestAnimationFrame(animate); }
            function showPenalty() {
                if (!target) { hide(); resolve({ target:null, amount:0 }); return; }
                playGuide('お仕置きアナウンス');
                stage = 'penalty'; staff.src = 'images/characters/npc/jobs/ギルド-店員-悲しみ.webp'; header('お仕置き'); main.classList.add('bf-penalty-layout'); next.hidden = true;
                const victim = players[target.playerIndex];
                if (window.DisadvantageImmunityRules?.isActive(victim)) {
                    stage = 'loss';
                    const targetCard = document.createElement('div'); targetCard.className = 'bf-target-card bf-immunity-target';
                    targetCard.innerHTML = `<img src="${esc(icon(victim))}" alt=""><strong>${esc(victim.name)}</strong><span class="bf-distance">${target.distance}マス</span>`;
                    main.append(targetCard);
                    message(`${esc(victim.name)}は無敵の加護でお仕置きを免れた！`);
                    next.hidden = false;
                    return;
                }
                if (window.UndergroundRules.ownsImmunity(victim)) {
                    stage = 'loss';
                    const targetCard = document.createElement('div'); targetCard.className = 'bf-target-card bf-immunity-target';
                    targetCard.innerHTML = `<img src="${esc(icon(victim))}" alt=""><strong>${esc(victim.name)}</strong><span class="bf-distance">${target.distance}マス</span>`;
                    main.append(targetCard);
                    message(`${esc(victim.name)}は免罪符でお仕置きを免れた！`);
                    next.hidden = false;
                    return;
                }
                const content = document.createElement('div'); content.className = 'bf-penalty-content';
                content.innerHTML = `<div class="bf-punish-grid"><div class="bf-target-card"><img src="${esc(icon(victim))}" alt=""><strong>${esc(victim.name)}</strong><span class="bf-distance">${target.distance}マス</span></div><div class="bf-factor-card"><span class="bf-field-label">お仕置き倍率</span><strong>× ${fmt(boss.counterDamage)}</strong></div><div class="bf-dice-slot"><canvas class="bf-dice-canvas" aria-label="黒いサイコロ"></canvas></div></div><div class="bf-equation" style="visibility:hidden"></div><button type="button" class="bf-action bf-roll">サイコロを振る</button>`;
                main.append(content); const button = content.querySelector('button'), canvas = content.querySelector('canvas');
                dice = DiceAnimation.createRenderer(canvas, { theme:'black', stopMotion:window.DiceStopMotion.sample }); rollPhase = 'result'; draw(performance.now()); rollPhase = 'idle';
                message(`そして、一番遠い冒険者にはお仕置きです。<br>ボスを討伐した${esc(players[killerIndex].name)}さんは、サイコロを振ってください。`);
                button.onclick = () => {
                    if (rollPhase === 'idle') {
                        rollPhase = 'rolling'; began = performance.now(); button.textContent = 'クリックして止める';
                        loop = new Audio('sounds/サイコロ.wav'); loop.volume = typeof buttonSound !== 'undefined' ? buttonSound.volume : .7; loop.addEventListener('timeupdate', () => { if (loop && loop.currentTime >= .83) loop.currentTime = 0; }); (window.GameSE ? window.GameSE.playLocal(loop, Infinity, { loopEnd: .83 }) : loop.play()).catch(() => {}); frame = requestAnimationFrame(animate);
                    } else if (rollPhase === 'rolling') {
                        if (loop) { loop.pause(); loop = null; } const stop = new Audio('sounds/サイコロ停止.mp3'); stop.volume = typeof buttonSound !== 'undefined' ? buttonSound.volume : .7; (window.GameSE ? window.GameSE.playLocal(stop) : stop.play()).catch(() => {});
                        value = 1 + Math.floor(Math.random() * 6); rollPhase = 'stopping'; stopped = performance.now(); button.disabled = true;
                    }
                };
            }
            function showFormula() {
                stopGuide();
                stage = 'formula';
                penalty = { ...BossCeremonyRules.penaltyBreakdown(target.distance, Number(boss.counterDamage || 0), value, bossDefeatedCount),
                    distance: target.distance, multiplier: boss.counterDamage, die: value };
                renderPenaltyEquation(main.querySelector('.bf-equation'), penalty, false);
                main.querySelector('.bf-roll').style.visibility = 'hidden';
                message(`お仕置き額は <strong>${fmt(penalty.normalAmount)}G</strong> です。`); next.hidden = false;
            }
            function showSurcharge() {
                stage = 'surcharge';
                message(surchargeMessage);
                playGuide(surchargeVoice);
            }
            function showLoss() {
                stopGuide(); stage = 'loss';
                const amount = penalty.amount, victim = players[target.playerIndex];
                renderPenaltyEquation(main.querySelector('.bf-equation'), penalty, true);
                sound('punishmentLoss', { shared:true, eventId:`boss-punishment-loss:${boss.id || boss.name}:${killerIndex}:${target.playerIndex}` });
                victim.money = Number(victim.money) - amount; options.onPenalty(victim); portrait.src = icon(victim); portrait.alt = victim.name; portrait.hidden = false;
                banner.classList.add('has-portrait'); root.querySelector('.bf-speaker').hidden = true; message(`${esc(victim.name)}は <strong>${fmt(amount)}G</strong> を失った！`);
            }
            function advanceScreen() {
                if (stage === 'reward') showReceipt();
                else if (stage === 'formula' && penalty.additionalAmount > 0) showSurcharge();
                else if (stage === 'formula' || stage === 'surcharge') showLoss();
                else if (stage === 'loss') { hide(); resolve({ target:players[target.playerIndex], amount:penalty?.amount ?? 0 }); }
            }
            next.onclick = advanceScreen;
            root.addEventListener('click', event => {
                event.stopPropagation();
                if (event.target.closest('button, input, select, textarea, .bf-receipt-card, .bf-dice-canvas')) return;
                advanceScreen();
            });
            showReward();
        });
    }
    let onlineTimer, onlineFrame, onlineKey = '', onlineSound;
    function closeOnline() {
        clearTimeout(onlineTimer); cancelAnimationFrame(onlineFrame); if (onlineSound) { if (window.GameSE) window.GameSE.stop(onlineSound); else onlineSound.pause(); } onlineSound = null; onlineKey = '';
        const root=document.getElementById('boss-aftermath');window.Plane02Layout?.release(root);root?.remove();
        document.querySelector('#battleMainPopup .battle-main-screen')?.classList.remove('battle-aftermath-active');
        document.getElementById('battleMainPopup')?.classList.remove('boss-aftermath-battle-hidden');
    }
    function renderOnline(snapshot, players, send) {
        const c = snapshot.ceremony; if (!c) return;
        const localId = window.onlineGame?.playerId || window.onlineGame?.socket?.id;
        const me = players.findIndex(p => String(p.id) === String(localId));
        const owner = me === snapshot.playerIndex;
        const stage = c.stage, key = snapshot.battleId + ':' + stage;
        const changedStage = onlineKey !== key; onlineKey = key;
        clearTimeout(onlineTimer); cancelAnimationFrame(onlineFrame);
        if (changedStage && onlineSound) { if (window.GameSE) window.GameSE.stop(onlineSound); else onlineSound.pause(); onlineSound = null; }
        let root = document.getElementById('boss-aftermath');
        if (!root) { root = document.createElement('section'); root.id = 'boss-aftermath'; document.body.append(root); }
        root.classList.add('bf-ceremony-layout');
        root.classList.toggle('bf-reward-announcement', stage === 'reward');
        window.Plane02Layout?.apply(root);
        const scene = document.querySelector('#battleMainPopup .battle-main-screen');
        scene?.classList.add('battle-aftermath-active');
        scene?.closest('#battleMainPopup')?.classList.add('boss-aftermath-battle-hidden');
        const background = scene ? getComputedStyle(scene).backgroundImage : '';
        root.innerHTML = '<div class="bf-background"></div><div class="bf-shade"></div><img class="bf-staff" alt="ギルドのお姉さん"><section class="bf-main"></section><div class="bf-banner"><img class="bf-banner-portrait" alt="" hidden><span class="bf-speaker">ギルドのお姉さん</span><p class="bf-copy"></p><button class="bf-next" type="button">次へ▶</button></div>';
        if (background && background !== 'none') root.querySelector('.bf-background').style.backgroundImage = background;
        const main = root.querySelector('.bf-main'), copy = root.querySelector('.bf-copy'), next = root.querySelector('.bf-next'), staff = root.querySelector('.bf-staff');
        staff.src = 'images/characters/npc/jobs/ギルド-店員' + (['penalty','rolling','formula','surcharge','loss','immune','noTarget'].includes(stage) ? '-悲しみ' : '') + '.webp';
        const header = title => { main.innerHTML = '<h1>' + title + '</h1>'; };
        const sendOnce = action => { if (root.dataset.pending) return; root.dataset.pending = '1'; Promise.resolve(send(action)).catch(error => { console.error('[online boss ceremony]', error); copy.textContent = '通信できませんでした。もう一度操作してください。'; }).finally(() => { if (root.isConnected) delete root.dataset.pending; }); };
        const line = text => { copy.innerHTML = text; };
        const snd = name => { if (window.GameSE) Promise.resolve(window.GameSE.play(name)).catch(() => {}); };
        if (changedStage && ['reward','guidebook','penalty','surcharge','immune','noTarget'].includes(stage)) {
            const file = stage === 'reward' ? '討伐アナウンス1' : stage === 'guidebook' ? '特別アイテム贈呈1' : stage === 'surcharge' ? surchargeVoice : 'お仕置きアナウンス';
            onlineSound = new Audio('sounds/ガイド/'+file+'.mp3');
            const slider=document.getElementById('seVolumeSlider'); onlineSound.volume=slider ? Number(slider.value)/100 : .7;
            Promise.resolve(window.GameSE ? window.GameSE.playLocal(onlineSound) : onlineSound.play()).catch(()=>{});
        }
        if (changedStage && stage === 'penalty') snd('punishment');
        if (changedStage && stage === 'rolling') { onlineSound=new Audio('sounds/サイコロ.wav');onlineSound.loop=true;onlineSound.volume=typeof buttonSound !== 'undefined' ? buttonSound.volume : .7;onlineSound.addEventListener('timeupdate',()=>{if(onlineSound && onlineSound.currentTime>=.83)onlineSound.currentTime=0});(window.GameSE ? window.GameSE.playLocal(onlineSound, Infinity, { loopEnd: .83 }) : onlineSound.play()).catch(()=>{}); }
        if (changedStage && stage === 'formula') { const stop=new Audio('sounds/サイコロ停止.mp3'); stop.volume=typeof buttonSound !== 'undefined' ? buttonSound.volume : .7; (window.GameSE ? window.GameSE.playLocal(stop) : stop.play()).catch(()=>{}); }
        next.hidden = !owner;
        if (stage === 'reward') {
            header('討伐報酬');
            const rows = [snapshot.bossRewards.first && ['先着報酬',snapshot.bossRewards.first], ...(snapshot.bossRewards.damageAwards||[]).filter(r=>r.value>0).map(r=>['ダメージ報酬',r]), ['討伐報酬',snapshot.bossRewards.defeat]].filter(Boolean);
            const list = document.createElement('div'); list.className = 'bf-reward-list';
            rows.forEach(([label,row]) => { const p = players[row.playerIndex]; if (!p) return; const el = document.createElement('div'); el.className='bf-reward-row'; el.innerHTML = '<span class="bf-reward-type">'+esc(label)+'</span><img src="'+esc(icon(p))+'" alt=""><span class="bf-reward-name">'+esc(p.name)+'</span><strong>＋'+fmt(row.value)+'G</strong>'; list.append(el); });
            main.append(list); line('討伐おめでとうございます！今回の報酬はこちらになります。');
        } else if (stage === 'receipt') {
            header('報酬受取'); main.classList.add('bf-stage-receipt'); next.hidden=true;
            const list = document.createElement('div'); list.className='bf-receipt-list'; list.dataset.count=String(c.claims.length); list.style.setProperty('--recipient-count',c.claims.length);
            if (snapshot.lastCeremonyAction === 'claim' && !snapshot.ceremonyCuePlayed) snd('moneyDisplay');
            c.claims.forEach(claim => { const p=players[claim.playerIndex]; if(!p)return; const card=document.createElement('article'); card.className='bf-receipt-card'+(claim.claimed?' is-claimed':''); card.innerHTML='<img src="'+esc(icon(p))+'" alt=""><strong class="bf-receipt-name">'+esc(p.name)+'</strong><strong class="bf-total">＋'+fmt(claim.amount)+'G</strong><button type="button" class="bf-action bf-receive">受け取る</button>'; const button=card.querySelector('button'); button.disabled=claim.claimed || me!==claim.playerIndex; button.onclick=()=>sendOnce('claim'); list.append(card); });
            main.append(list); const progress=document.createElement('p'); progress.className='bf-progress'; const done=c.claims.filter(r=>r.claimed).length; progress.textContent=done===c.claims.length?'全員の受け取りが完了しました':'受取完了　'+done+' / '+c.claims.length; main.append(progress); line('それでは報酬を受け取ってください！');
            if (owner && done===c.claims.length) onlineTimer=setTimeout(()=>sendOnce('next'),1000);
        } else if (stage === 'guidebook') {
            header('ドロップアイテム受取');
            next.hidden = true;
            line(guidebookGiftLine);
            guidebookReceipt(main, players[snapshot.playerIndex], owner, () => sendOnce('claimGuidebook'));
        } else {
            header('お仕置き'); main.classList.add('bf-penalty-layout');
            if (stage === 'immune') {
                const victim=players[c.target.playerIndex], card=document.createElement('div'); card.className='bf-target-card bf-immunity-target';
                card.innerHTML='<img src="'+esc(icon(victim))+'" alt=""><strong>'+esc(victim.name)+'</strong><span class="bf-distance">'+c.target.distance+'マス</span>';
                main.append(card);
                line(esc(victim.name)+(c.immunitySource==='disadvantage'?'は無敵の加護でお仕置きを免れた！':'は免罪符でお仕置きを免れた！'));
            }
            else if (stage === 'noTarget') line('お仕置きの対象者はいません。');
            else {
                const victim=players[c.target.playerIndex], content=document.createElement('div'); content.className='bf-penalty-content';
                content.innerHTML='<div class="bf-punish-grid"><div class="bf-target-card"><img src="'+esc(icon(victim))+'" alt=""><strong>'+esc(victim.name)+'</strong><span class="bf-distance">'+c.target.distance+'マス</span></div><div class="bf-factor-card"><span class="bf-field-label">お仕置き倍率</span><strong>× '+fmt(snapshot.monster.counterDamage)+'</strong></div><div class="bf-dice-slot"><canvas class="bf-dice-canvas"></canvas></div></div><div class="bf-equation"></div>';
                main.append(content);
                if (['formula','surcharge','loss'].includes(stage)) {
                    renderPenaltyEquation(content.querySelector('.bf-equation'), {
                        distance: c.target.distance, multiplier: snapshot.monster.counterDamage, die: c.die,
                        normalAmount: c.rawAmount ?? c.amount, additionalAmount: c.additionalAmount, amount: c.amount
                    }, stage === 'loss');
                }
                if (stage === 'loss') { const portrait=root.querySelector('.bf-banner-portrait'); portrait.src=icon(victim); portrait.hidden=false; root.querySelector('.bf-speaker').hidden=true; root.querySelector('.bf-banner').classList.add('has-portrait'); line(esc(victim.name)+'は <strong>'+fmt(c.amount)+'G</strong> を失った！'); if(changedStage)snd('punishmentLoss'); }
                else if (stage === 'formula') line('お仕置き額は <strong>'+fmt(c.rawAmount ?? c.amount)+'G</strong> です。');
                else if (stage === 'surcharge') line(surchargeMessage);
                else { next.hidden=true; line('そして、一番遠い冒険者にはお仕置きです。<br>ボスを討伐した'+esc(players[snapshot.playerIndex].name)+'さんは、サイコロを振ってください。'); if(owner){ const button=document.createElement('button');button.className='bf-action bf-roll';button.textContent=stage==='rolling'?'クリックして止める':'サイコロを振る';button.onclick=()=>sendOnce(stage==='rolling'?'stop':'roll');content.append(button); } }
                const canvas=content.querySelector('canvas'); const renderer=DiceAnimation.createRenderer(canvas,{theme:'black',stopMotion:window.DiceStopMotion.sample}); const start=performance.now(); const diceState={phase:stage==='rolling'?'rolling':stage==='formula'?'stopping':'result',count:1,results:[c.die||1],began:start,stopped:start,showIndividualResults:false,diceScale:window.DiceAnimation.gameplayScale,cornerLaunch:true,centerLanding:true,canvasLanding:true,launchHeight:.22};
                const draw=t=>{const done=renderer.draw(diceState,t);if(stage==='rolling'||stage==='formula'&&!done)onlineFrame=requestAnimationFrame(draw)};onlineFrame=requestAnimationFrame(draw);
            }
        }
        next.onclick=()=>sendOnce('next');
        root.onclick=event=>{event.stopPropagation();if(!owner || next.hidden || event.target.closest('button,input,select,textarea'))return;sendOnce('next');};
    }
    window.BossAftermath = Object.freeze({ show, renderOnline, closeOnline });
})();
