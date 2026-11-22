/* =========================================================
   battle-ui.js
   新バトルUI

   役割：
   ・通常モンスター戦のイントロ表示
   ・新バトルUIの生成／表示
   ・魔法選択と詳細表示
   ・攻撃／逃げる操作
   ・3ラウンド制の戦闘進行

   ※ 既存の game.js のデータ・ダメージ計算・報酬処理を利用します。
   ※ 旧 battle.js / battle-ui.js / battle-effect.js には依存しません。
========================================================= */

(function () {

    "use strict";


    const BATTLE_ESCAPE_RATE =
        0.5; // 仮設定：逃げる成功率。正式値決定後ここだけ変更。


    let activeBattle = null;
    let motionController = null;
    let motionPopup = null;
    let onlinePlayback = { battleId: null, sequence: -1, generation: 0, chain: Promise.resolve(), known: new Set(), closed: new Set() };
    const battleMagicBoundLists = new WeakSet();
    let battleMagicWindowEventsReady = false;
    let battleMagicScrollFrame = 0, battleMagicScrollDirection = 0, battleMagicScrollLastTime = 0;
    let battleMagicDrag = null, battleMagicDragFrame = 0, suppressBattleMagicCastUntil = 0;
    let battleDarkChainCleanup = null, battleGenericCircleCleanup = null;
    let battleBuffTintElement = null;

    function battleMagicOrderStorageKey(player = activeBattle?.player) {
        if (!player) return null;
        const participants = window.players || [];
        const online = Boolean(window.onlineGame?.isOnline);
        const index = participants.indexOf(player);
        const identity = online && player.id != null ? `online:${player.id}`
            : index >= 0 ? `offline:${index}` : player.id != null ? `player:${player.id}` : null;
        return identity === null ? null : `nmnl-battle-magic-order-v2:${encodeURIComponent(identity)}`;
    }

    function resetBattleMagicOrders(players = window.players || []) {
        if (!Array.isArray(players)) return;
        players.forEach(player => {
            const key = battleMagicOrderStorageKey(player);
            if (!key) return;
            try { window.localStorage.removeItem(key); } catch (_) {}
        });
    }

    function loadBattleMagicOrder(magicIds) {
        let stored = [];
        try {
            const key = battleMagicOrderStorageKey();
            const value = JSON.parse(key ? window.localStorage.getItem(key) || "[]" : "[]");
            if (Array.isArray(value)) stored = value.map(Number).filter(id => magicIds.includes(id));
        } catch (_) {}
        const unique = [...new Set(stored)];
        return [...unique, ...magicIds.filter(id => !unique.includes(id))];
    }

    function saveBattleMagicOrder(list, key = battleMagicOrderStorageKey()) {
        if (!key) return;
        const order = [...list.querySelectorAll(".battle-new-magic-item")].map(button => Number(button.dataset.magicId));
        let previous = [];
        try { previous = JSON.parse(window.localStorage.getItem(key) || "[]"); } catch (_) {}
        try {
            const absent = Array.isArray(previous) ? previous.map(Number).filter(id => Number.isInteger(id) && !order.includes(id)) : [];
            window.localStorage.setItem(key, JSON.stringify([...order, ...new Set(absent)]));
        } catch (_) {}
    }

    function stopBattleMagicScroll() {
        battleMagicScrollDirection = 0;
        battleMagicScrollLastTime = 0;
        if (battleMagicScrollFrame) window.cancelAnimationFrame(battleMagicScrollFrame);
        battleMagicScrollFrame = 0;
    }

    function scrollBattleMagicWhileHeld(time) {
        const list = document.getElementById("battleNewMagicList");
        if (!battleMagicScrollDirection || !list) { battleMagicScrollFrame = 0; return; }
        if (battleMagicScrollLastTime) list.scrollLeft += battleMagicScrollDirection * Math.min(32, (time - battleMagicScrollLastTime) * .72);
        battleMagicScrollLastTime = time;
        battleMagicScrollFrame = window.requestAnimationFrame(scrollBattleMagicWhileHeld);
    }

    function placeBattleMagicAt(pointerX, slot, list) {
        const buttons = [...list.querySelectorAll(".battle-new-magic-item")];
        const before = buttons.find(button => pointerX < button.getBoundingClientRect().left + button.getBoundingClientRect().width / 2);
        if (before) { if (slot.nextElementSibling !== before) list.insertBefore(slot, before); }
        else if (list.lastElementChild !== slot) list.append(slot);
    }

    function moveBattleMagicDrag(event) {
        const state = battleMagicDrag, list = document.getElementById("battleNewMagicList");
        if (!state || !list || state.pointerId !== event.pointerId) return;
        state.pointerX = event.clientX; state.pointerY = event.clientY;
        if (!state.moved && Math.hypot(event.clientX - state.startX, event.clientY - state.startY) >= 8) {
            state.moved = true;
            state.ghost = state.button.cloneNode(true);
            state.ghost.id = "battle-preview-magic-drag-ghost";
            state.ghost.classList.add("is-dragging"); state.ghost.setAttribute("aria-hidden", "true");
            state.ghost.style.cssText = `position:fixed;left:0;top:0;width:${state.rect.width}px;height:${state.rect.height}px;margin:0;`;
            document.body.append(state.ghost);
            state.slot = document.createElement("div"); state.slot.className = "battle-preview-drop-slot";
            state.slot.setAttribute("aria-hidden", "true"); state.slot.style.flexBasis = `${state.rect.width}px`;
            state.slot.style.width = `${state.rect.width}px`; state.slot.style.height = `${state.rect.height}px`;
            list.setPointerCapture(event.pointerId); state.button.replaceWith(state.slot);
            document.getElementById("battleMainPopup")?.classList.add("battle-magic-dragging");
            state.lastFrameTime = event.timeStamp; battleMagicDragFrame = window.requestAnimationFrame(autoScrollBattleMagicDrag);
        }
        if (!state.moved) return;
        event.preventDefault(); state.ghost.style.left = `${event.clientX - state.offsetX}px`;
        state.ghost.style.top = `${event.clientY - state.offsetY}px`; placeBattleMagicAt(event.clientX, state.slot, list);
    }

    function autoScrollBattleMagicDrag(time) {
        const state = battleMagicDrag, list = document.getElementById("battleNewMagicList");
        if (!state || !state.moved || !list) { battleMagicDragFrame = 0; return; }
        const bounds = list.getBoundingClientRect(), edgeZone = Math.min(88, bounds.width * .16);
        const elapsed = Math.min(40, Math.max(0, time - state.lastFrameTime)); state.lastFrameTime = time;
        if (state.pointerX < bounds.left + edgeZone) {
            const strength = Math.min(1, (bounds.left + edgeZone - state.pointerX) / edgeZone);
            list.scrollLeft -= (150 + 850 * strength * strength) * elapsed / 1000;
        } else if (state.pointerX > bounds.right - edgeZone) {
            const strength = Math.min(1, (state.pointerX - (bounds.right - edgeZone)) / edgeZone);
            list.scrollLeft += (150 + 850 * strength * strength) * elapsed / 1000;
        }
        placeBattleMagicAt(state.pointerX, state.slot, list); battleMagicDragFrame = window.requestAnimationFrame(autoScrollBattleMagicDrag);
    }

    function finishBattleMagicDrag(event, cancelled = false) {
        const state = battleMagicDrag, list = document.getElementById("battleNewMagicList");
        if (!state || !list || (event?.pointerId !== undefined && state.pointerId !== event.pointerId)) return;
        if (battleMagicDragFrame) window.cancelAnimationFrame(battleMagicDragFrame); battleMagicDragFrame = 0;
        if (state.ghost) state.ghost.remove();
        if (state.moved) {
            if (cancelled) {
                const originalNext = state.originalNextMagicId ? list.querySelector(`[data-magic-id="${state.originalNextMagicId}"]`) : null;
                list.insertBefore(state.button, originalNext || null);
            } else { list.insertBefore(state.button, state.slot); saveBattleMagicOrder(list, state.storageKey); suppressBattleMagicCastUntil = Date.now() + 180; }
            state.slot.remove();
        }
        document.getElementById("battleMainPopup")?.classList.remove("battle-magic-dragging"); battleMagicDrag = null;
        if (list.hasPointerCapture?.(state.pointerId)) list.releasePointerCapture(state.pointerId);
        if (state.button.hasPointerCapture?.(state.pointerId)) state.button.releasePointerCapture(state.pointerId);
    }

    function initializeBattleMagicInteractions() {
        const list = document.getElementById("battleNewMagicList"), popup = document.getElementById("battleMainPopup");
        if (!list || !popup || battleMagicBoundLists.has(list)) return;
        battleMagicBoundLists.add(list);
        popup.querySelectorAll(".battle-magic-scroll-arrow").forEach(button => {
            const begin = event => {
                if (event.type === "pointerdown" && event.button !== 0) return;
                event.preventDefault(); stopBattleMagicScroll(); battleMagicScrollDirection = Number(button.dataset.scrollDirection) || 0;
                list.scrollLeft += battleMagicScrollDirection * 8;
                if (event.pointerId !== undefined && button.setPointerCapture) button.setPointerCapture(event.pointerId);
                battleMagicScrollFrame = window.requestAnimationFrame(scrollBattleMagicWhileHeld);
            };
            const end = () => stopBattleMagicScroll();
            button.addEventListener("pointerdown", begin); button.addEventListener("pointerup", end);
            button.addEventListener("pointercancel", end); button.addEventListener("lostpointercapture", end);
            button.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") begin(event); });
            button.addEventListener("keyup", event => { if (event.key === "Enter" || event.key === " ") end(); });
            button.addEventListener("blur", end);
            button.addEventListener("click", event => { if (event.detail > 0) return; list.scrollLeft += (Number(button.dataset.scrollDirection) || 0) * 220; });
        });
        list.addEventListener("pointermove", moveBattleMagicDrag);
        list.addEventListener("pointerup", event => finishBattleMagicDrag(event));
        list.addEventListener("pointercancel", event => finishBattleMagicDrag(event, true));
        list.addEventListener("lostpointercapture", event => finishBattleMagicDrag(event, true));
        if (!battleMagicWindowEventsReady) {
            window.addEventListener("blur", () => { stopBattleMagicScroll(); if (battleMagicDrag) finishBattleMagicDrag(null, true); });
            battleMagicWindowEventsReady = true;
        }
    }

    function usesBattleMotionLayout(battle = activeBattle) {
        if (!window.BattleMotion || !battle || !battle.monster) return false;
        const compactLandscape = typeof window.matchMedia === "function"
            && window.matchMedia("(orientation: landscape) and (max-width: 1000px) and (max-height: 610px)").matches;
        return !battle.monster.specialBoss || compactLandscape;
    }

    function usesWholeBodyMotion(battle = activeBattle) {
        return Boolean(usesBattleMotionLayout(battle) && !battle.monster.specialBoss);
    }

    function updateBattleMotionLayout() {
        const popup = document.getElementById("battleMainPopup");
        if (!popup) return;
        const enabled = usesBattleMotionLayout();
        popup.classList.toggle("battle-motion-mode", enabled);
        const playerHp = popup.querySelector(".battle-player-hp");
        const controls = popup.querySelector(".battle-control-panel");
        const hud = popup.querySelector(".battle-lower-hud");
        const context = popup.querySelector(".battle-context");
        const detail = popup.querySelector(".battle-selected-magic");
        const message = document.getElementById("battleNewMessage");
        const actions = popup.querySelector(".battle-action-row");
        const commands = popup.querySelector(".battle-magic-panel");
        // Reuse live nodes and handlers. Special-boss combat stays legacy on
        // desktop; compact landscape uses this shared visual arrangement too.
        function move(node, parent, before = null) {
            if (node && parent && node.parentElement !== parent) parent.insertBefore(node, before && before.parentElement === parent ? before : null);
        }
        move(playerHp, enabled ? hud : controls, enabled ? context : detail);
        move(detail, enabled ? context : controls, enabled ? null : actions);
        move(message, enabled ? context : controls, enabled ? null : actions);
        move(actions, enabled ? commands : controls);
        move(popup.querySelector(".battle-round-badge"), popup.querySelector(enabled ? ".battle-field" : ".battle-main-screen"));
        const costLabel = popup.querySelector(".battle-magic-cost-label");
        if (costLabel) costLabel.textContent = enabled ? "消費ゴールド" : "コスト";
        const enemyArea = popup.querySelector(".battle-monster-area");
        const enemyStatus = popup.querySelector(".battle-enemy-status");
        const enemyVisual = popup.querySelector(".battle-monster-visual-wrap");
        const enemyName = document.getElementById("battleNewMonsterName");
        const enemyBar = popup.querySelector(".battle-hp-bar");
        const enemyHp = document.getElementById("battleNewMonsterHp");
        // Keep the existing value/bar elements and IDs: offline and online use
        // the same renderer. Return them to their original order for the Maou UI.
        if (enabled && enemyStatus) {
            [enemyName, enemyBar, enemyHp].forEach(function (node) {
                if (node && node.parentElement !== enemyStatus) enemyStatus.appendChild(node);
            });
        } else if (enemyArea && enemyVisual && enemyName && enemyName.parentElement !== enemyArea) {
            enemyArea.insertBefore(enemyName, enemyVisual);
            if (enemyBar) enemyArea.appendChild(enemyBar);
            if (enemyHp) enemyArea.appendChild(enemyHp);
        }
        const playerName = document.getElementById("battlePlayerStatusName");
        if (playerName && activeBattle) playerName.textContent = activeBattle.player.name || "プレイヤー";
        if (!enabled) return;
        if (usesWholeBodyMotion() && motionPopup !== popup) {
            if (motionController) motionController.destroy();
            motionPopup = popup;
            motionController = window.BattleMotion.create(popup);
        }
        const image = document.getElementById("battlePlayerBackImage");
        const fallback = document.getElementById("battlePlayerBackFallback");
        const sprite = window.BattleMotion.playerSprite(activeBattle.player.characterId);
        if (!image || !fallback) return;
        fallback.textContent = activeBattle.player.name || (sprite && sprite.name) || "プレイヤー";
        image.alt = `${fallback.textContent}の後ろ姿`;
        image.onerror = function () { image.style.display = "none"; fallback.style.display = "flex"; };
        if (sprite) {
            if (image.getAttribute("src") !== sprite.src) {
                image.src = sprite.src;
                image.style.display = "block";
                fallback.style.display = "none";
            }
        } else { image.style.display = "none"; fallback.style.display = "flex"; }
    }

    function playBattleMagicSound(magic) {
        if (!magic || !magic.sound) return;
        if (usesWholeBodyMotion() && motionController) motionController.playSound(magic.sound);
        else {
            const sound = new Audio(magic.sound);
            (window.GameSE ? window.GameSE.playLocal(sound) : sound.play()).catch(function () {});
        }
    }

    function prepareBattlePresentation() {
        const battle = activeBattle;
        if (!usesWholeBodyMotion(battle) || battle.presentationBusy) return;
        const popup = document.getElementById("battleMainPopup");
        if (battle.presentationPreparation) return;
        let effectsReady = Promise.resolve();
        if (window.BattleEffects && typeof window.BattleEffects.prepare === "function") {
            try { effectsReady = window.BattleEffects.prepare(popup); }
            catch (error) { console.error("[battle-effects] 準備を省略しました:", error); }
        }
        battle.presentationReady = false;
        const images = [...popup.querySelectorAll("[data-battle-actor] img")];
        // Decode rear/enemy sprites during the encounter, rather than on cast.
        // Failed images retain their existing fallback; a stalled request cannot
        // permanently lock a turn. Observers never receive control here.
        battle.presentationPreparation = new Promise(resolve => {
            const timer = window.setTimeout(resolve, 5000);
            Promise.allSettled([effectsReady, ...images.map(image => typeof image.decode === "function" ? image.decode() : Promise.resolve())])
                .then(() => { window.clearTimeout(timer); resolve(); });
        }).then(function () {
            if (activeBattle !== battle) return;
            battle.presentationReady = true;
            if (!battle.presentationBusy && battle.phase === "playerAction") {
                renderBattleMain();
                enableBattleActions();
            }
        });
    }

    function updateBattleGoldValue(current, start) {
        const value = document.getElementById("battlePlayerHpMax");
        if (value) value.textContent = usesBattleMotionLayout()
            ? `${formatBattleNumber(current)} / ${formatBattleNumber(start)}G`
            : `/ ${formatBattleNumber(start)}G`;
    }

    function clearBattleBuffTint() {
        if (!battleBuffTintElement) return;
        battleBuffTintElement.removeEventListener("animationend", onBattleBuffTintEnd);
        battleBuffTintElement.remove();
        battleBuffTintElement = null;
    }

    function onBattleBuffTintEnd(event) {
        if (event.animationName === "battle-buff-tint-rise" && event.target === battleBuffTintElement) clearBattleBuffTint();
    }

    function renderBattleActiveBuffIcons() {
        const row = document.getElementById("battleActiveBuffs");
        if (!row) return;
        row.replaceChildren();
        const ids = activeBattle && Array.isArray(activeBattle.activeBuffMagicIds) ? activeBattle.activeBuffMagicIds : [];
        ids.forEach(function (id) {
            const magic = MAGIC_CONTENTS[Number(id)];
            if (!magic) return;
            const icon = document.createElement("img");
            icon.className = `battle-active-buff-icon ${Number(id) === 6 ? "is-power" : "is-defense"}`;
            icon.src = String(magic.image || magic.icon || "");
            icon.alt = String(magic.name || "");
            icon.title = String(magic.name || "");
            row.append(icon);
        });
    }

    function showBattleBuffEffect(magicId) {
        if (![6, 7].includes(Number(magicId)) || !activeBattle) return;
        if (!Array.isArray(activeBattle.activeBuffMagicIds)) activeBattle.activeBuffMagicIds = [];
        if (!activeBattle.activeBuffMagicIds.includes(Number(magicId))) activeBattle.activeBuffMagicIds.push(Number(magicId));
        renderBattleActiveBuffIcons();

        clearBattleBuffTint();
        const image = document.getElementById("battlePlayerBackImage");
        if (!image || image.style.display === "none") return;
        const tint = image.cloneNode(false);
        tint.removeAttribute("id");
        tint.removeAttribute("alt");
        tint.setAttribute("aria-hidden", "true");
        tint.className = `battle-buff-tint ${Number(magicId) === 6 ? "is-power" : "is-defense"}`;
        tint.addEventListener("animationend", onBattleBuffTintEnd);
        image.after(tint);
        battleBuffTintElement = tint;
    }

    function presentBattleMotion(actor, onImpact, options = {}) {
        const battle = activeBattle;
        if (!usesWholeBodyMotion(battle)) {
            onImpact();
            return Promise.resolve();
        }
        updateBattleMotionLayout();
        battle.presentationBusy = true;
        battle.afterPresentation = [];
        disableBattleActions();
        if(actor === "player") {
            const magic = MAGIC_CONTENTS[Number(options.magicId)] || battle.selectedMagic;
            if(magic)showBattleMessage(magic.name+"！");
        }
        const magicId = Number(options.magicId);
        if (actor === "player" && (magicId === 6 || magicId === 7)) showBattleBuffEffect(magicId);
        const timing = { ...window.BattleMotion.timingFor(magicId, actor), ...options };
        const startedAt = Number(options.startedAt) || Date.now();
        let scheduledMagicSound = 0;
        if (actor === "player" && (magicId === 5 || magicId === 8 || magicId === 10)) {
            const magic = MAGIC_CONTENTS[magicId] || battle.selectedMagic;
            const soundAt = magicId === 5 ? timing.impact - 200 : magicId === 10 ? 0 : timing.release;
            scheduledMagicSound = window.setTimeout(function () {
                scheduledMagicSound = 0;
                if (activeBattle === battle && magic?.sound) playBattleMagicSound(magic);
            }, Math.max(0, startedAt + soundAt - Date.now()));
        }
        const playback = motionController.play({
            ...timing, ...options, actor, startedAt,
            onImpact: function () { if (activeBattle === battle) onImpact(); },
            onFinish: function (result) {
                if (scheduledMagicSound) { window.clearTimeout(scheduledMagicSound); scheduledMagicSound = 0; }
                if (battleGenericCircleCleanup) { battleGenericCircleCleanup(); battleGenericCircleCleanup = null; }
                if (battleDarkChainCleanup) { battleDarkChainCleanup(); battleDarkChainCleanup = null; }
                battle.presentationBusy = false;
                const callbacks = battle.afterPresentation || [];
                battle.afterPresentation = [];
                if (result.cancelled || activeBattle !== battle) return;
                callbacks.forEach(function (callback) { if (activeBattle === battle) callback(); });
                if (activeBattle !== battle) return;
                renderBattleMain();
                if (Number(battle.monsterHP) <= 0) {
                    const image = document.getElementById("battleNewMonsterImage");
                    if (image) image.style.display = "none";
                }
                if (battle.phase === "playerAction" && !battle.isOnlineObserver) enableBattleActions();
            }
        });
        if (actor === "player" && [4, 6, 7].includes(magicId) && window.BattleDarkChain) {
            battleGenericCircleCleanup = window.BattleDarkChain.drawReusableFireCircle(
                document.getElementById("battleMainPopup"), magicId,
                { ...timing, ...(options.duration ? { duration: options.duration } : {}), ...(options.impact ? { impact: options.impact } : {}) }, startedAt
            );
        }
        if (actor === "player" && magicId === 4 && window.BattleDarkChain) {
            battleDarkChainCleanup = window.BattleDarkChain.playDarkChain(
                document.getElementById("battleMainPopup"), Number(options.duration) || timing.duration
            );
        }
        return playback;
    }


    function setMessageWithBreaks(element, message) {

        if (!element) {
            return;
        }

        const parts =
            String(message ?? "").split(/<br\s*\/?\s*>/i);

        element.replaceChildren();

        parts.forEach(
            function (part, index) {
                if (index > 0) {
                    element.appendChild(
                        document.createElement("br")
                    );
                }

                element.appendChild(
                    document.createTextNode(part)
                );
            }
        );

    }


    function ensureBattleUI() {

        stopBattleMagicScroll();
        if (battleMagicDrag) finishBattleMagicDrag(null, true);
        window.BattleRewardUI?.close();

        if (motionController) motionController.destroy();
        motionController = null;
        motionPopup = null;

        let battleRoot =
            document.getElementById("battleUIRoot");

        if (!battleRoot) {

            battleRoot =
                document.createElement("div");

            battleRoot.id =
                "battleUIRoot";

            document.body.appendChild(
                battleRoot
            );

        }

        const battleTemplate =
            document.getElementById("battleUIRootTemplate");

        if (!battleTemplate) {
            console.error("バトルUIのテンプレートが見つかりません。");
            return null;
        }

        battleRoot.replaceChildren(
            battleTemplate.content.cloneNode(true)
        );

        bindIntroEvents();

        return battleRoot;

    }


    function bindIntroEvents() {

        const intro =
            document.getElementById("battleIntroPopup");

        if (!intro) {
            return;
        }

        intro.onclick =
            function () {

                if (
                    !activeBattle ||
                    intro.getAttribute("aria-hidden") === "true"
                ) {
                    return;
                }

                showBattleMain();

            };

    }


    function showLayer(id) {

        const element =
            document.getElementById(id);

        if (!element) {
            return;
        }

        element.setAttribute(
            "aria-hidden",
            "false"
        );

        element.classList.add("is-visible");

        if (id === "battleMainPopup") {
            window.Plane02Layout?.apply(element.querySelector(".battle-main-screen"));
        }

    }


    function hideLayer(id) {

        if (id === "battleMainPopup" && activeBattle && activeBattle.onlineBattleId
            && ["ended", "escaped", "rewardReceived", "waitDefeat", "bossDestination"].includes(activeBattle.phase)) {
            onlinePlayback.closed.add(String(activeBattle.onlineBattleId));
            if (onlinePlayback.closed.size > 150) onlinePlayback.closed.delete(onlinePlayback.closed.values().next().value);
        }
        if (id === "battleMainPopup") window.BattleRewardUI?.close();
        if (id === "battleMainPopup" && motionController) motionController.cancel();

        const element =
            document.getElementById(id);

        if (!element) {
            return;
        }

        element.setAttribute(
            "aria-hidden",
            "true"
        );

        element.classList.remove("is-visible");

        if (id === "battleMainPopup") {
            window.Plane02Layout?.release(element.querySelector(".battle-main-screen"));
        }

    }

    function showBattleMain() {

    hideLayer("battleIntroPopup");
    showLayer("battleMainPopup");

    if (!activeBattle) {
        return;
    }

    renderBattleMain();

    // エンカウント表示を終了
    document
        .getElementById("battleMainPopup")
        .classList.remove("battle-intro-mode");

}

// =========================
// モンスター被ダメージ点滅
// =========================

function flashMonsterOnDamage(callback) {

    if (window.BattleMotion && usesWholeBodyMotion() && activeBattle.presentationBusy) {
        if (callback) activeBattle.afterPresentation.push(callback);
        return;
    }

    const image =
        document.getElementById(
            "battleNewMonsterImage"
        );

    if (!image) {
        if (callback) {
            callback();
        }
        return;
    }

    image.classList.remove(
        "monster-damage-flash"
    );

    // アニメーションを確実に再実行
    void image.offsetWidth;

    if (callback) {
        image.addEventListener(
            "animationend",
            callback,
            { once: true }
        );
    }

    image.classList.add(
        "monster-damage-flash"
    );

}

// =========================
// プレイヤー被ダメージ点滅
// =========================

function flashPlayerOnDamage() {

   const targets = window.BattleMotion && usesWholeBodyMotion() && activeBattle.presentationBusy ? [] : [
    document.getElementById("battlePlayerHpIcon"),
    document.getElementById("battleNewMagicList"),
    document.querySelector("#battleMainPopup .battle-selected-magic"),
    document.querySelector("#battleMainPopup .battle-action-row")
];


    targets.forEach(
        function (target) {

            if (!target) {
                return;
            }

            target.classList.remove(
                "player-damage-flash"
            );

            // アニメーションを確実に再実行
            void target.offsetWidth;

            target.classList.add(
                "player-damage-flash"
            );

        }
    );


    // =========================
    // ダメージSE
    // 魔王第二形態ではOFF
    // =========================

    if (
        activeBattle &&
        activeBattle.monster &&
        activeBattle.monster.maouForm === 2
    ) {
        return;
    }


    const damageSEPath =
        activeBattle.isBoss
            ? "sounds/戦闘/中パンチ.mp3"
            : "sounds/戦闘/小パンチ.mp3";


    if (window.BattleMotion && usesWholeBodyMotion() && motionController) {
        motionController.playSound(damageSEPath);
        return;
    }

    const damageSE =
        new Audio(
            damageSEPath
        );

    damageSE.currentTime = 0;

    (window.GameSE ? window.GameSE.playLocal(damageSE) : damageSE.play()).catch(
        function (error) {

            console.warn(
                "【戦闘】ダメージSE再生失敗：",
                error
            );

        }
    );

}

    function renderBattleMain() {

        if (!activeBattle) {
            return;
        }

        const monster =
            activeBattle.monster;

        updateBattleMotionLayout();

       document.getElementById("battleNewRound").textContent =
    `ROUND ${activeBattle.round} / 3`;

        document.getElementById("battleNewMonsterName").textContent =
            monster.name;

        const image =
            document.getElementById("battleNewMonsterImage");

        const fallback =
            document.getElementById("battleNewMonsterFallback");

        if (image.getAttribute("src") !== (monster.icon || "")) image.src = monster.icon || "";

        image.alt =
            monster.name;

        image.style.display =
            "block";

        fallback.textContent =
            "👾";

        fallback.style.display =
            "none";

        image.onerror =
            function () {
                image.style.display = "none";
                fallback.style.display = "block";
            };

                const hpRate =
            monster.hp > 0
                ? Math.max(
                    0,
                    Math.min(
                        1,
                        activeBattle.monsterHP / monster.hp
                    )
                )
                : 0;

        document.getElementById(
            "battleNewMonsterHpFill"
        ).style.width =
            `${hpRate * 100}%`;

        document.getElementById(
            "battleNewMonsterHp"
        ).textContent =
            usesWholeBodyMotion()
                ? `${formatBattleNumber(activeBattle.monsterHP)} / ${formatBattleNumber(monster.hp)}`
                : `HP ${activeBattle.monsterHP} / ${monster.hp}`;


        // =========================
        // プレイヤーHP
        // 開始時ゴールドを100%として計算
        // =========================

        const playerStartGold =
            activeBattle.battleStartGold;

        const playerCurrentGold = activeBattle.presentationGold !== undefined
            ? activeBattle.presentationGold : activeBattle.player.money;

        const playerHpRate =
            playerStartGold > 0
                ? Math.max(
                    0,
                    Math.min(
                        1,
                        playerCurrentGold / playerStartGold
                    )
                )
                : 0;


        const playerHpFill =
            document.getElementById(
                "battlePlayerHpFill"
            );

        if (playerHpFill) {

            playerHpFill.style.width =
                `${playerHpRate * 100}%`;

        }


        updateBattleGoldValue(playerCurrentGold, playerStartGold);

// =========================
// プレイヤーHPアイコン
// =========================

const playerHpIcon =
    document.getElementById(
        "battlePlayerHpIcon"
    );

if (playerHpIcon) {

    const playerIndex =
        players.indexOf(
            activeBattle.player
        );

    playerHpIcon.src =
        getPlayerCharacterIcon(
            playerIndex
        );

}

renderBattleActiveBuffIcons();

        prepareBattlePresentation();
        renderMagicList();
        renderSelectedMagic();

        // プレイヤーの行動ターンに戻ったら、前ターンのバトルログを消す。
        if (activeBattle.phase === "playerAction") {
            showBattleMessage(activeBattle.presentationReady === false ? "戦闘の準備中…" : "");
        }

    }


    function formatBattleNumber(value) {

        if (
            typeof formatG === "function"
        ) {
            return formatG(value);
        }

        return Number(value || 0).toLocaleString("ja-JP");

    }


    function renderMagicList() {

        const list =
            document.getElementById("battleNewMagicList");

        if (!list || !activeBattle) {
            return;
        }
        initializeBattleMagicInteractions();

        if (battleMagicDrag) finishBattleMagicDrag(null, true);
        list.replaceChildren();

        const learnedMagicIds =
            Array.isArray(activeBattle.player.magic)
                ? activeBattle.player.magic.slice().sort((a, b) => Number(a) - Number(b))
                : [];
        const magicIds = loadBattleMagicOrder(learnedMagicIds.map(Number));

        if (magicIds.length === 0) {

            const emptyTemplate =
                document.getElementById("battleNewMagicEmptyTemplate");

            if (emptyTemplate) {
                list.appendChild(
                    emptyTemplate.content.cloneNode(true)
                );
            } else {
                const emptyMessage =
                    document.createElement("div");

                emptyMessage.className =
                    "battle-new-magic-empty";

                emptyMessage.textContent =
                    "魔法を覚えていません。";

                list.appendChild(emptyMessage);
            }

            return;

        }

        magicIds.forEach(
            function (magicId) {

                const magic =
                    MAGIC_CONTENTS[magicId];

                if (!magic) {
                    return;
                }

               
                const item =
                    document.createElement("button");

                item.type =
                    "button";

                item.className =
                    "battle-new-magic-item";
                item.dataset.magicId = String(magicId);
                item.disabled = activeBattle.isOnlineObserver || activeBattle.phase !== "playerAction"
                    || activeBattle.busy || activeBattle.presentationBusy || activeBattle.presentationReady === false;

                if (Number(activeBattle.armedMagicId) === Number(magicId)) {
                    item.classList.add("is-selected");
                }
                item.setAttribute("aria-pressed", String(item.classList.contains("is-selected")));

                const itemTemplate =
                    document.getElementById("battleNewMagicItemTemplate");

                if (itemTemplate) {
                    const itemContent =
                        itemTemplate.content.cloneNode(true);

                    const magicName =
                        itemContent.querySelector(".battle-new-magic-name");

                    const magicImage =
                        itemContent.querySelector(".battle-new-magic-icon");

                    const fallback =
                        itemContent.querySelector(".battle-new-magic-fallback");

                    if (magicName) {
                        magicName.textContent = String(magic.name ?? "");
                    }

                    if (magicImage) {
                        magicImage.src =
                            String(magic.image || magic.icon || "");

                        magicImage.alt = String(magic.name ?? "");

                        magicImage.addEventListener(
                            "error",
                            function () {
                                magicImage.style.display = "none";
                                if (fallback) {
                                    fallback.style.display = "block";
                                }
                            },
                            { once: true }
                        );
                    }

                    item.appendChild(itemContent);
                } else {
                    const magicName =
                        document.createElement("span");

                    magicName.className =
                        "battle-new-magic-name";

                    magicName.textContent =
                        String(magic.name ?? "");

                    item.appendChild(magicName);
                }

               item.addEventListener(
    "pointerdown",
    function (event) {
        if (event.button !== 0 || item.disabled) return;
        const rect = item.getBoundingClientRect();
        battleMagicDrag = { button: item, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
            storageKey: battleMagicOrderStorageKey(),
            pointerX: event.clientX, pointerY: event.clientY, offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top, rect, moved: false, ghost: null,
            originalNextMagicId: item.nextElementSibling?.dataset.magicId || null };
        if (item.setPointerCapture) item.setPointerCapture(event.pointerId);
    }
);

item.addEventListener(
    "mouseenter",
    function () {
        if (
            activeBattle &&
            activeBattle.phase === "playerAction" &&
            !activeBattle.busy &&
            !activeBattle.isOnlineObserver
        ) {
            renderSelectedMagic(magic);
            syncOnlineBattleMagicPreview(magic);
        }
    }
);

item.addEventListener(
    "mouseleave",
    function () {
        const selected = activeBattle && activeBattle.phase === "playerAction"
            && !activeBattle.busy && !activeBattle.presentationBusy
            ? activeBattle.selectedMagic : null;
        syncOnlineBattleMagicPreview(selected);
        renderSelectedMagic(selected);
    }
);

item.addEventListener(
    "focus",
    function () {
        if (
            activeBattle &&
            activeBattle.phase === "playerAction" &&
            !activeBattle.busy &&
            !activeBattle.isOnlineObserver
        ) {
            renderSelectedMagic(magic);
            syncOnlineBattleMagicPreview(magic);
        }
    }
);

item.addEventListener(
    "blur",
    function () {
        const selected = activeBattle && activeBattle.phase === "playerAction"
            && !activeBattle.busy && !activeBattle.presentationBusy
            ? activeBattle.selectedMagic : null;
        syncOnlineBattleMagicPreview(selected);
        renderSelectedMagic(selected);
    }
);

item.addEventListener(
    "click",
    function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.detail > 0 && Date.now() < suppressBattleMagicCastUntil) return;

        if (
            !activeBattle ||
            activeBattle.phase !== "playerAction" ||
            activeBattle.busy ||
            activeBattle.isOnlineObserver
        ) {
            return;
        }

        const clickedMagicId = Number(item.dataset.magicId);
        if (activeBattle.armedMagicId !== clickedMagicId) {
            activeBattle.selectedMagic = magic;
            activeBattle.armedMagicId = clickedMagicId;
            if (usesWholeBodyMotion(activeBattle)) activeBattle.previewMagic = magic;
            list.querySelectorAll(".battle-new-magic-item").forEach(function (button) {
                const selected = button === item;
                button.classList.toggle("is-selected", selected);
                button.setAttribute("aria-pressed", String(selected));
            });
            renderSelectedMagic(magic);
            syncOnlineBattleMagicPreview(magic);
            return;
        }

        activeBattle.selectedMagic = magic;
        activeBattle.armedMagicId = null;
        performSelectedMagic();
    }
);

list.appendChild(item);

            }
        );

    }


    function renderSelectedMagic(magicOverride) {

    const inlineContext = usesWholeBodyMotion();
    if (inlineContext && activeBattle && typeof magicOverride !== "undefined") {
        activeBattle.previewMagic = magicOverride;
    }

    if (activeBattle && (activeBattle.busy || activeBattle.presentationBusy)) return;

    const requestedMagic =
        typeof magicOverride !== "undefined"
            ? magicOverride
            : activeBattle
                ? (inlineContext ? activeBattle.previewMagic : activeBattle.selectedMagic)
                : null;

    const magic = requestedMagic || null;
    const context = document.querySelector("#battleMainPopup .battle-context");
    if (inlineContext && context) {
        const canPreview = activeBattle.phase === "playerAction" && !activeBattle.busy && !activeBattle.presentationBusy;
        context.dataset.mode = magic && canPreview ? "preview" : "message";
    }

    const icon =
        document.getElementById("battleNewSelectedMagicIcon");

    const name =
        document.getElementById("battleNewSelectedMagicName");

    const cost =
        document.getElementById("battleNewSelectedMagicCost");

    const damage =
        document.getElementById("battleNewSelectedMagicDamage");

    const effect =
        document.getElementById("battleNewSelectedMagicEffect");

    if (!icon || !name || !cost || !damage || !effect) {
        return;
    }

    if (!magic || !activeBattle) {

        icon.replaceChildren();
        name.textContent = usesWholeBodyMotion() ? "魔法なし" : "魔法をクリックして攻撃";
        cost.textContent = "—";
        damage.textContent = "—";
        effect.textContent = "";
        return;

    }

    const magicCost =
        calculateMagicCost(
            activeBattle.player,
            magic,
            activeBattle.battleState
        );

    const predictedBaseDamage =
        magic.type === "attack"
            ? calculateMagicDamage(
                activeBattle.player,
                magic,
                activeBattle.battleState
            )
            : 0;

    const maouDamageTakenRate =
        Number(
            activeBattle.maouBattleState?.damageTakenRate || 1
        );

    const predictedDamage =
        magic.type === "attack"
            ? Math.floor(
                predictedBaseDamage *
                maouDamageTakenRate
            )
            : 0;

    const selectedMagicIconTemplate =
        document.getElementById("battleSelectedMagicIconTemplate");

    if (selectedMagicIconTemplate) {

        const iconContent =
            selectedMagicIconTemplate.content.cloneNode(true);

        const magicImage =
            iconContent.querySelector(
                ".battle-selected-magic-icon-image"
            );

        const fallback =
            iconContent.querySelector(
                ".battle-selected-magic-icon-fallback"
            );

        if (magicImage) {

            magicImage.src =
                String(magic.image || magic.icon || "");

            magicImage.alt =
                String(magic.name ?? "");

            magicImage.addEventListener(
                "error",
                function () {
                    magicImage.style.display = "none";

                    if (fallback) {
                        fallback.style.display = "inline";
                    }
                },
                { once: true }
            );

        }

        icon.replaceChildren(iconContent);

    } else {

        icon.textContent = "✨";

    }

    name.textContent =
        String(magic.name ?? "");

    cost.textContent =
        formatBattleNumber(magicCost);

    damage.textContent =
        magic.type === "attack"
            ? formatBattleNumber(predictedDamage)
            : "—";

    effect.textContent =
        String(magic.effect ?? "");

}


    function syncOnlineBattleMagicPreview(magic) {
        if (!activeBattle || !activeBattle.onlineBattleId || activeBattle.isOnlineObserver) return;
        const sync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync
            ? window.onlineGame.sync
            : null;
        if (!sync || typeof sync.syncBattleView !== "function") return;
        const magicId = magic
            ? Number(Object.keys(MAGIC_CONTENTS).find(function (id) { return MAGIC_CONTENTS[id] === magic; }))
            : null;
        sync.syncBattleView({ battleId: activeBattle.onlineBattleId, magicId }).then(function (response) {
            // Preview changes are transient; a stale update during a phase change
            // may be rejected without affecting the authoritative battle.
        });
    }


    function applyOnlineBattleView(view) {
        if (!activeBattle || !activeBattle.isOnlineObserver || !view
            || String(view.battleId) !== String(activeBattle.onlineBattleId)) return;
        const magic = view.magicId === null ? null : MAGIC_CONTENTS[Number(view.magicId)];
        renderSelectedMagic(magic || null);
    }


    function closeFinishedOnlineBattleOnTurnChange() {
        if (!activeBattle || !activeBattle.onlineBattleId) return;
        const state = window.onlineGame && window.onlineGame.sync && window.onlineGame.sync.state;
        const owner = state && state.players && state.players[Number(state.activePlayerIndex)];
        const changedTurn = owner && String(owner.id) !== String(activeBattle.player.id);
        const summary = state && ["roundSummary", "finished"].includes(state.matchPhase);
        if (!changedTurn && !summary && (!activeBattle.isOnlineObserver || !["ended", "rewardReceived", "waitDefeat", "bossTransition", "bossDestination"].includes(activeBattle.phase))) return;
        onlinePlayback.closed.add(String(activeBattle.onlineBattleId));
        onlinePlayback.generation += 1;
        hideLayer("battleMainPopup");
        activeBattle = null;
    }

    function closeOnlineBossRewardPopup() {
        const screen = document.querySelector("#battleMainPopup .battle-main-screen");
        document.getElementById("boss-aftermath")?.remove();
        screen?.classList.remove("battle-aftermath-active");
        document.getElementById("battleMainPopup")?.classList.remove("boss-aftermath-battle-hidden");
        const popup = document.getElementById("eventPopup");
        if (!popup || !popup.classList.contains("boss-reward-popup")) return;
        popup.style.display = "none";
        popup.classList.remove("boss-reward-popup", "boss-reward-complete-popup");
        const button = document.getElementById("eventPopupButton");
        if (button) { button.disabled = false; button.onclick = null; }
    }

    function renderOnlineBossRewards(snapshot) {
        if (!activeBattle || !snapshot.bossRewards) return;
        const screen = document.querySelector("#battleMainPopup .battle-main-screen");
        if (!screen) return;
        let panel = document.getElementById("boss-aftermath");
        if (!panel) {
            panel = document.createElement("section");
            panel.id = "boss-aftermath";
            panel.innerHTML = '<div class="bf-background"></div><div class="bf-shade"></div><img class="bf-staff" src="images/characters/npc/jobs/ギルド-店員.webp" alt="ギルドのお姉さん"><section class="bf-main"><h1>討伐報酬</h1><div class="bf-online-rewards"></div></section><div class="bf-banner"><span class="bf-speaker">ギルドのお姉さん</span><p class="bf-copy"></p><button class="bf-next" type="button">次へ▶</button></div>';
            const background = getComputedStyle(screen).backgroundImage;
            if (background && background !== "none") panel.querySelector(".bf-background").style.backgroundImage = background;
            document.body.append(panel);
        }
        screen.classList.add("battle-aftermath-active");
        screen.closest("#battleMainPopup")?.classList.add("boss-aftermath-battle-hidden");
        const message = panel.querySelector(".bf-online-rewards");
        const button = panel.querySelector(".bf-next");
        const rewards = snapshot.bossRewards;
        const step = Number(snapshot.rewardStep) || 0;
        if (step === 0 && !activeBattle.bossRewardGuideStarted) {
            activeBattle.bossRewardGuideStarted = true;
            const audio = new Audio('sounds/ガイド/討伐アナウンス1.mp3');
            const slider = document.getElementById('seVolumeSlider');
            audio.volume = slider ? Number(slider.value) / 100 : .7;
            activeBattle.bossRewardGuideAudio = audio;
            Promise.resolve(window.GameSE ? window.GameSE.playLocal(audio) : audio.play())
                .catch(error => console.warn('[ボス討伐] 音声を再生できません: 討伐アナウンス1', error));
        } else if (step > 0 && activeBattle.bossRewardGuideAudio) {
            const audio = activeBattle.bossRewardGuideAudio;
            if (window.GameSE) window.GameSE.stop(audio); else audio.pause();
            activeBattle.bossRewardGuideAudio = null;
        }
        let text;
        if (step === 0) text = "🥇 先着報酬<br>" + (rewards.first ? `${rewards.first.name}：+${formatBattleNumber(rewards.first.value)}G` : "対象者なし");
        else if (step === 1) text = "⚔️ ダメージ報酬<br>" + rewards.damageAwards.map(function (award) { return `${award.name}：+${formatBattleNumber(award.value)}G`; }).join("<br>");
        else if (step === 2) text = `👑 撃破報酬<br>${rewards.defeat.name}：+${formatBattleNumber(rewards.defeat.value)}G`;
        else text = "プレイヤー達は<br>報酬を受け取った！";
        setMessageWithBreaks(message, text.replace(/[🥇⚔️👑]/gu, ""));
        panel.querySelector(".bf-copy").textContent = step < 3 ? "討伐おめでとうございます！今回の報酬はこちらになります。" : "報酬を受け取りました！";
        button.textContent = "次へ▶";
        button.disabled = activeBattle.isOnlineObserver || activeBattle.busy;
        button.onclick = function () {
            if (!activeBattle || activeBattle.isOnlineObserver) return;
            requestOnlineBattleAction(step >= 3 ? "bossComplete" : "bossRewardNext");
        };
        if (!document.__bossRewardAnyClickBound && typeof document.addEventListener === "function") {
            document.__bossRewardAnyClickBound = true;
            document.addEventListener("click", function (event) {
                if (!activeBattle || !activeBattle.onlineBattleId || activeBattle.phase !== "bossRewards"
                    || activeBattle.isOnlineObserver || activeBattle.busy || event.target.closest("button, input, select, textarea")) return;
                const currentStep = Number(activeBattle.rewardStep) || 0;
                requestOnlineBattleAction(currentStep >= 3 ? "bossComplete" : "bossRewardNext");
            }, true);
        }
    }


  function showBattleMessage(message) {

    const element =
        document.getElementById("battleNewMessage");

    if (!element) {
        return;
    }

    const inlineLog = usesWholeBodyMotion();
    const hasNext = /(?:＞＞|>>)/.test(String(message || ""));
    const cleanMessage = String(message || "").replace(/(?:＞＞|>>)/g, "").trim();
    const text = cleanMessage || (inlineLog && activeBattle.phase === "playerAction"
        ? "魔法をクリックして攻撃" : "");
    const body = document.createElement("span");
    body.className = "battle-log-text";

    const isActive =
        Boolean(text);

    if (inlineLog) {
        // Keep short messages on one line. If they do not fit, wrap whole
        // sentences before splitting a very long name or damage description.
        const phrases = String(text).match(/[^。！？!?\n]*[。！？!?]+|[^。！？!?\n]+|\n/gu) || [];
        body.replaceChildren(...phrases.map(function (phrase) {
            if (phrase === "\n") return document.createTextNode(phrase);
            const span = document.createElement("span");
            span.className = "battle-log-phrase";
            span.textContent = phrase;
            return span;
        }));
        const context = document.querySelector("#battleMainPopup .battle-context");
        if (context) context.dataset.mode = "message";
    } else {
        body.textContent = text;
    }

    element.replaceChildren(body);
    if(hasNext){
        const next=document.createElement("small");next.className="battle-log-next";next.textContent="次へ▶";element.append(next);
    }

    element.classList.toggle(
        "is-active",
        isActive
    );

    // The common screen shares its log with the forecast. Only the legacy
    // special-boss screen retains the full-size message overlay.
    const battlePopup =
        document.getElementById("battleMainPopup");

    if (battlePopup) {
        battlePopup.classList.toggle(
            "battle-log-active",
            isActive && !inlineLog
        );
    }

}


 function bindMainButtons() {

    const escapeButton =
        document.getElementById("battleNewEscapeButton");

    const battleScreen =
        document.querySelector(
            "#battleMainPopup .battle-main-screen"
        );

    if (!escapeButton) {

        console.error(
            "【戦闘エラー】逃げるボタンが見つかりません"
        );

        return;

    }

    escapeButton.onclick =
        function (event) {

            event.preventDefault();
            event.stopPropagation();

            console.log(
                "【戦闘】逃げるボタン押下"
            );

            attemptEscape();

        };

    if (battleScreen) {

        battleScreen.onclick =
            function (event) {

                if (event.target.closest("#boss-aftermath")) return;
                if (
                    event.target.closest(
                        "button, input, select, textarea, a"
                    )
                ) {
                    return;
                }

                handleBattleScreenTap();

            };

    }

}


    function handleBattleScreenTap() {

    if (!activeBattle) {
        return;
    }

    if (activeBattle.presentationBusy) return;
    if (activeBattle.isOnlineObserver) return;

    if (activeBattle.phase === "escaped") {
        const player = activeBattle.player;
        hideLayer("battleMainPopup");
        activeBattle = null;
        finishTurn(player);
        return;
    }

    // =========================
    // 戦闘開始メッセージを閉じる
    // =========================

    if (activeBattle.phase === "battleIntro") {

        if (requestOnlineBattleAction("intro")) return;

        activeBattle.phase =
            "playerAction";
        
    document
    .getElementById("battleMainPopup")
    .classList.remove("battle-intro-mode");

        showBattleMessage("");

        renderBattleMain();

        enableBattleActions();

        return;
    }

      if (activeBattle.phase === "waitBossReward") {

        if (requestOnlineBattleAction("bossRewardNext")) return;

        activeBattle.busy =
            true;

        showBossRewardPopup(
            activeBattle.player,
            activeBattle.monster
        );

        return;

    }


    // =====================================================
    // 魔王第二形態撃破後
    // 魔王が消えた状態を見せてからクリック待ち
    // =====================================================

    if (
        activeBattle.phase ===
        "waitMaouDefeat"
    ) {

        activeBattle.busy =
            true;

        if (
            activeBattle.monster &&
            activeBattle.monster.specialBoss &&
            activeBattle.monster.maouForm === 2 &&
            typeof window.handleSpecialBossDefeat ===
            "function"
        ) {

            window.handleSpecialBossDefeat(
                activeBattle,
                activeBattle.monster
            );

        }

        return;

    }


    if (activeBattle.phase === "waitEnemyCounter") {

            if (requestOnlineBattleAction("enemyCounter")) return;

            activeBattle.phase =
                "enemyCounter";

            enemyCounterAttack();

            return;

        }


    // =====================================================
    // 魔王に倒された後
    // 「プレイヤーは倒れた」→
    // 「魔王がHP回復」→
    // クリックで復活処理へ
    // =====================================================

    if (
        activeBattle.phase ===
        "waitMaouHeal"
    ) {

        const maouMaxHP =
            Number(
                activeBattle.maouMaxHP || 0
            );

        const maouHealAmount =
            Number(
                activeBattle.maouHealAmount || 0
            );

        activeBattle.monsterHP =
            Math.min(
                maouMaxHP,
                Number(
                    activeBattle.monsterHP || 0
                ) +
                maouHealAmount
            );

        if (
            activeBattle.isBoss
        ) {

            currentBossHP =
                activeBattle.monsterHP;

        }

        // 魔王HPバーを即座に回復後の状態へ更新
        renderBattleMain();

        activeBattle.phase =
            "waitDefeat";

        showBattleMessage(
            `プレイヤーは倒れた……\n` +
            `魔王は${maouHealAmount.toLocaleString()}回復した！　＞＞`
        );

        return;

    }


    if (activeBattle.phase === "waitDefeat") {
        const player = activeBattle.player;
        hideLayer("battleMainPopup");
        activeBattle = null;
        finishTurn(player);
        return;

    }

        if (activeBattle.phase === "waitNextRound") {

            if (requestOnlineBattleAction("continueRound")) return;

            activeBattle.round += 1;
            activeBattle.selectedMagic = null;
            activeBattle.previewMagic = null;
            activeBattle.armedMagicId = null;
            activeBattle.busy = false;
            activeBattle.phase = "playerAction";

            renderBattleMain();
            enableBattleActions();

            showBattleMessage("");

        }

        if (activeBattle.phase === "waitBattleEnd") {

            finishBattleNow(
                activeBattle.endWithReward === true
            );

        }

    }


   function performSelectedMagic() {

    console.log("【戦闘】攻撃処理開始");


    // =========================
    // 戦闘データ確認
    // =========================

    if (!activeBattle) {

        console.error(
            "【戦闘エラー】activeBattle がありません"
        );

        return;

    }


    const player =
        activeBattle.player;

    const monster =
        activeBattle.monster;

    const magic =
        activeBattle.selectedMagic;

        


    console.log(
        "【戦闘】選択魔法：",
        magic
    );


    if (!player) {

        console.error(
            "【戦闘エラー】player がありません"
        );

        return;

    }


    if (!monster) {

        console.error(
            "【戦闘エラー】monster がありません"
        );

        return;

    }


    if (!magic) {

        console.error(
            "【戦闘エラー】魔法が選択されていません"
        );

        return;

    }


    // =========================
    // 連打防止
    // =========================

    if (activeBattle.busy || activeBattle.presentationBusy || activeBattle.presentationReady === false) {

        console.log(
            "【戦闘】現在処理中です"
        );

        return;

    }

    if (activeBattle.onlineBattleId) {
        const magicId = Number(Object.keys(MAGIC_CONTENTS).find(function (id) {
            return MAGIC_CONTENTS[id] === magic;
        }));
        requestOnlineBattleAction("castMagic", { magicId });
        return;
    }


    activeBattle.busy =
        true;


    // =========================
    // 魔法コスト
    // =========================

    const magicCost =
        calculateMagicCost(
            player,
            magic,
            activeBattle.battleState
        );


    console.log(
        "【戦闘】魔法コスト：",
        magicCost
    );


    // =========================
    // G不足
    // =========================

    if (
        player.money < magicCost
    ) {

        activeBattle.busy =
            false;

        showBattleMessage(
            "所持金が足りません。"
        );

        return;

    }


    // =========================
    // 魔法コストを消費
    // =========================

    player.money -=
        magicCost;
    
    // HPバーを即時更新
    renderBattleMain();


    if (
        typeof updatePlayerStatusUI === "function"
    ) {

        updatePlayerStatusUI(
            player
        );

    }


    if (
        typeof renderPlayers === "function"
    ) {

        renderPlayers();

    }


   
    console.log(
        "【戦闘】魔法コスト消費完了"
    );

    activeBattle.lastDamage = 0;
    if (window.BattleMotion && !monster.specialBoss) {
        const battle = activeBattle;
        showBattleMessage("");
        presentBattleMotion("player", function () {
            resolveOfflineMagicEffect(player, monster, magic);
        }, { magicId: Number(Object.keys(MAGIC_CONTENTS).find(id => MAGIC_CONTENTS[id] === magic)),
            damage: function () { return magic.type === "attack" ? battle.lastDamage : 0; } });
        return;
    }
    resolveOfflineMagicEffect(player, monster, magic);
}

function resolveOfflineMagicEffect(player, monster, magic) {

    // =========================
    // バフ魔法
    // コスト消費後に効果を適用
    // =========================

    if (magic.type === "buff") {

        if (
            magic.buffTarget === "self" &&
            magic.buffStat === "magicPower"
        ) {

            activeBattle.battleState.magicPowerRate =
                Number(magic.buffRate || 1);

            console.log(
                "【戦闘】魔力バフ適用：",
                activeBattle.battleState.magicPowerRate
            );

        }

        if (
            magic.buffTarget === "enemy" &&
            magic.buffStat === "attackPower"
        ) {

            activeBattle.battleState.enemyAttackRate =
                Number(magic.buffRate || 1);

            console.log(
                "【戦闘】敵攻撃力バフ適用：",
                activeBattle.battleState.enemyAttackRate
            );

        }

        // バフ魔法の効果音
        if (magic.sound) {
            playBattleMagicSound(magic);
        }

        showBattleMessage(`${magic.name}を使った！`);

        activeBattle.busy = false;
        activeBattle.phase = "waitEnemyCounter";

        disableBattleActions();

        return;
    }

    // =========================
    // 魔法SE
    // =========================

    const magicId = Number(Object.keys(MAGIC_CONTENTS).find(id => MAGIC_CONTENTS[id] === magic));
    if (magic.sound && !(usesWholeBodyMotion(activeBattle) && (magicId === 5 || magicId === 8 || magicId === 10))) {
        playBattleMagicSound(magic);
    }

    // =========================
    // ダメージ計算
    // =========================

              const baseDamage =
        calculateMagicDamage(
            player,
            magic,
            activeBattle.battleState
        );

    const maouDamageTakenRate =
        Number(
            activeBattle.maouBattleState?.damageTakenRate || 1
        );

    const damage =
        Math.floor(
            Number(baseDamage || 0) *
            maouDamageTakenRate
        );


    activeBattle.lastDamage =
        Number(damage);


    console.log(
        "【戦闘】実ダメージ：",
        damage
    );


    // =========================
    // モンスターHP
    // =========================

    const beforeHP =
        Number(
            activeBattle.monsterHP
        );


    activeBattle.monsterHP =
        Math.max(
            0,
            beforeHP - Number(damage)
        );

    if (activeBattle.isBoss) {
        currentBossHP = activeBattle.monsterHP;
        activeBattle.player.bossDamage += Math.min(Math.max(0, beforeHP), Math.max(0, Number(damage)));
    }


    console.log(
        "【戦闘】モンスターHP：",
        beforeHP,
        "→",
        activeBattle.monsterHP
    );


    
    // =========================
    // 画面だけ更新
    // =========================

    renderBattleMain();


 // =========================    
// 被ダメージ演出
// =========================

if (activeBattle.monsterHP <= 0) {

    if (window.BattleMotion && usesWholeBodyMotion()) {
        showBattleMessage(activeBattle.isBoss
            ? `${magic.name}！　＞＞`
            : `${magic.name}！ ${damage}ダメージ！ ${monster.name}を倒した！　＞＞`);
    }

     // =========================
    // 魔王第二形態撃破
    // HPが0になった瞬間にBGMをフェードアウト
    // =========================
    if (
        activeBattle.isBoss &&
        activeBattle.monster &&
        activeBattle.monster.specialBoss &&
        activeBattle.monster.maouForm === 2 &&
        typeof window.fadeMaouBGM === "function"
    ) {
        window.fadeMaouBGM();
    }
   
    // 撃破時だけ、点滅が終わるまで待つ
    flashMonsterOnDamage(function () {

        // 点滅終了後にモンスターを消す
        const monsterImage =
            document.getElementById(
                "battleNewMonsterImage"
            );

        if (monsterImage) {
            monsterImage.style.display =
                "none";
        }

        // =========================
        // 魔王第二形態撃破
        // 点滅・消滅を見せてから
        // クリック待ちにする
        // =========================
        if (
            activeBattle.isBoss &&
            activeBattle.monster &&
            activeBattle.monster.specialBoss &&
            activeBattle.monster.maouForm === 2
        ) {

            currentBossHP =
                0;

            activeBattle.busy =
                false;

            activeBattle.phase =
                "waitMaouDefeat";

            showBattleMessage(
                `${magic.name}！　＞＞`
            );

            disableBattleActions();

            return;
        }

        // =========================
        // 通常ボス撃破
        // =========================
         if (activeBattle.isBoss) {

            currentBossHP =
                0;

            if (
                activeBattle.monster &&
                activeBattle.monster.specialBoss
            ) {
                bossCounterEnabled =
                    false;
            }

            finishBossBattle();

            return;
        }

        activeBattle.busy =
            false;

        activeBattle.phase =
            "waitBattleEnd";

        activeBattle.endWithReward =
            true;

        showBattleMessage(
            `${magic.name}！ ${damage}ダメージ！ ${monster.name}を倒した！　＞＞`
        );

        disableBattleActions();

    });

    return;
}

// HPが残っている場合は、今までどおり点滅だけ
flashMonsterOnDamage();


console.log(
    "【戦闘】画面更新完了"
);


    // =========================
// 撃破判定
// =========================

if (
    activeBattle.monsterHP <= 0
) {

    console.log(
        "【戦闘】モンスター撃破"
    );


    // =========================
    // ボス撃破
    // =========================

    if (activeBattle.isBoss) {

            currentBossHP =
                0;

            finishBossBattle();

            return;
        }


 // =========================
// 通常モンスター撃破
// =========================

activeBattle.busy =
    false;

activeBattle.phase =
    "waitBattleEnd";

activeBattle.endWithReward =
    true;

// モンスターを消す
const monsterImage =
    document.getElementById(
        "battleNewMonsterImage"
    );

if (monsterImage) {
    monsterImage.style.display =
        "none";
}

    showBattleMessage(
        `${magic.name}！ ${damage}ダメージ！ ${monster.name}を倒した！　＞＞`
    );

    disableBattleActions();

    return;

}


    // =========================
    // 攻撃結果表示
    // =========================

    showBattleMessage(
        `${magic.name}！ ${damage}ダメージ！`
    );


    console.log(
        "【戦闘】攻撃結果表示。　画面タップ待ち"
    );

    activeBattle.busy =
        false;

    activeBattle.phase =
        "waitEnemyCounter";

    showBattleMessage(
        `${magic.name}！ ${damage}ダメージ！　＞＞`
    );

    disableBattleActions();

}

   function enemyCounterAttack() {

    if (window.BattleMotion && usesWholeBodyMotion() && !activeBattle.onlineBattleId) {
        const battle = activeBattle;
        showBattleMessage("");
        presentBattleMotion("enemy", resolveEnemyCounterAttack, { damage: function () { return battle.lastEnemyDamage; } });
        return;
    }
    resolveEnemyCounterAttack();
}

function resolveEnemyCounterAttack() {

    console.log(
        "【戦闘】敵反撃開始"
    );


    if (!activeBattle) {

        console.error(
            "【戦闘エラー】activeBattle がありません"
        );

        return;

    }


    const player =
        activeBattle.player;

    const monster =
        activeBattle.monster;

    // =========================
    // 特殊敵ターン
    // 魔王第二形態などは、既存の戦闘画面・ラウンド管理を
    // 利用したまま、敵側の行動だけ専用AIへ委譲します。
    // =========================

    if (
        typeof activeBattle.specialEnemyTurn === "function"
    ) {

        activeBattle.specialEnemyTurn(
            activeBattle,
            {
                render: renderBattleMain,
                showMessage: showBattleMessage,
                flashPlayer: flashPlayerOnDamage,
                disableActions: disableBattleActions,
                updatePlayerStatus: updatePlayerStatusUI,
                renderPlayers: renderPlayers
            }
        );

        return;

    }

    if (activeBattle.onlineBattleId) {
        requestOnlineBattleAction("enemyCounter");
        return;
    }


    // =========================
    // 敵の攻撃力
    // =========================

    const enemyAttackRate =
        Number(
            activeBattle.battleState?.enemyAttackRate || 1
        );


    const baseDamage =
        Math.floor(
            Number(monster.attack || 0) *
            enemyAttackRate
        );


    console.log(
        "【戦闘】敵攻撃力：",
        baseDamage
    );


    // =========================
    // 実ダメージ
    // =========================

    const damage = window.DisadvantageImmunityRules?.isActive(player) ? 0 : getMonsterDamage(player, baseDamage);

    activeBattle.lastEnemyDamage = Number(damage);


    console.log(
        "【戦闘】敵からのダメージ：",
        damage
    );


    // =========================
    // Gを減らす
    // =========================

    player.money -=
    damage;


// =========================
// プレイヤーHPバー即時更新
// =========================

const playerStartGold =
    activeBattle.battleStartGold;

const playerCurrentGold =
    player.money;

const playerHpRate =
    playerStartGold > 0
        ? Math.max(
            0,
            Math.min(
                1,
                playerCurrentGold / playerStartGold
            )
        )
        : 0;

const playerHpFill =
    document.getElementById(
        "battlePlayerHpFill"
    );

if (playerHpFill) {

    playerHpFill.style.width =
        `${playerHpRate * 100}%`;

}


// =========================
// プレイヤー被ダメージ演出
// =========================

updateBattleGoldValue(playerCurrentGold, playerStartGold);
flashPlayerOnDamage();


    // =========================
    // HUD更新
    // =========================

    if (
        typeof updatePlayerStatusUI === "function"
    ) {

        updatePlayerStatusUI(
            player
        );

    }


    if (
        typeof renderPlayers === "function"
    ) {

        renderPlayers();

    }


    console.log(
        "【戦闘】敵反撃後G：",
        player.money
    );


    // =========================
// プレイヤー0G
// =========================

if (
    player.money <= 0
) {

    // =========================
    // ダメージ表示
    // =========================

    showBattleMessage(
        `${monster.name}の反撃！ ${damage}Gのダメージ！　＞＞`
    );


    activeBattle.busy =
        false;


    activeBattle.phase =
        "waitDefeat";


    disableBattleActions();


    return;

}


    // =========================
    // 3ROUND終了
    // =========================

    if (
        activeBattle.round >= 3
    ) {

        activeBattle.busy =
            false;

        activeBattle.phase =
            "waitBattleEnd";

        activeBattle.endWithReward =
            false;

        showBattleMessage(
            `${monster.name}の反撃！ ${damage}Gのダメージ！戦闘が終わった！　　＞＞`
        );

        disableBattleActions();

        return;

    }


   // =========================
// 次のROUND
// =========================

activeBattle.busy =
    false;

activeBattle.phase =
    "waitNextRound";

activeBattle.selectedMagic =
    null;
activeBattle.previewMagic =
    null;
activeBattle.armedMagicId =
    null;

console.log(
    "【戦闘】次ROUND待機"
);

disableBattleActions();

showBattleMessage(
    `${monster.name}の反撃！ ${damage}Gのダメージ！　＞＞`
);

}


    function performBossPass() {

        if (!activeBattle || activeBattle.busy || activeBattle.presentationBusy || !activeBattle.isBoss) {
            return;
        }

        if (requestOnlineBattleAction("pass")) return;
        activeBattle.busy = true;
        showBattleMessage("パスした！");
        enemyCounterAttack();

    }


    function attemptEscape() {

    if (activeBattle && activeBattle.isBoss) {
        performBossPass();
        return;
    }

    // =========================
    // 戦闘中・連打防止
    // =========================

    if (
        !activeBattle ||
        activeBattle.busy ||
        activeBattle.presentationBusy ||
        activeBattle.isOnlineObserver
    ) {
        return;
    }

    if (activeBattle.onlineBattleId) {
        requestOnlineBattleAction("escape");
        return;
    }

    activeBattle.busy =
        true;


    const player =
        activeBattle.player;

    const monster =
        activeBattle.monster;


    // =========================
    // 逃走判定
    // =========================

    const escaped =
        Math.random() <
        BATTLE_ESCAPE_RATE;


    // =========================
    // 逃走成功
    // =========================

    if (
        escaped
    ) {

        activeBattle.phase = "escaped";
        activeBattle.busy = false;
        disableBattleActions();
        showBattleMessage(`${player.name}は ${monster.name}から逃げ切った！　＞＞`);


        return;

    }

    // =========================
    // 逃走失敗
    // =========================

    showBattleMessage(
        "逃げられなかった！"
    );


    // 敵の反撃は画面タップ後に実行
    activeBattle.busy =
        false;

    activeBattle.phase =
        "waitEnemyCounter";

    disableBattleActions();

    showBattleMessage(
        "逃げられなかったｗｗｗ　＞＞"
    );

}


      function disableBattleActions() {

    const escapeButton =
        document.getElementById("battleNewEscapeButton");

    const magicList =
        document.getElementById("battleNewMagicList");

    if (escapeButton) {
        escapeButton.disabled = true;
    }

    if (magicList) {
        magicList.style.pointerEvents = "none";
        magicList.style.opacity = "0.5";
        magicList.querySelectorAll("button").forEach(function (button) { button.disabled = true; });
    }

}


function enableBattleActions() {

    if (!activeBattle || activeBattle.presentationBusy || activeBattle.presentationReady === false || activeBattle.isOnlineObserver || activeBattle.phase !== "playerAction") {
        disableBattleActions();
        return;
    }

    const escapeButton =
        document.getElementById("battleNewEscapeButton");

    const magicList =
        document.getElementById("battleNewMagicList");

    if (escapeButton) {
        escapeButton.disabled = false;
    }

    if (magicList) {
        magicList.style.pointerEvents = "auto";
        magicList.style.opacity = "1";
        magicList.querySelectorAll("button").forEach(function (button) { button.disabled = false; });
    }

}


 function finishBattleNow(giveReward) {

    if (!activeBattle) {
        return;
    }

    // 報酬フローは1回だけ開始する。
    // 報酬選択後、受け取り確認ポップアップの外側をクリックしても
    // 戦闘画面側のクリック処理から報酬選択が再表示されないようにする。
    if (giveReward && activeBattle.rewardFlowStarted) {
        return;
    }

    if (giveReward) {
        activeBattle.rewardFlowStarted = true;
    }

    const player =
        activeBattle.player;

    if (activeBattle.onlineBattleId) {
        if (giveReward) {
            activeBattle.rewardFlowStarted = true;
            const battleId = activeBattle.onlineBattleId;
            requestOnlineBattleAction("finishBattle", {}, function () {
                showRewardPopup(player, function () {
                    hideLayer("battleMainPopup");
                    activeBattle = null;
                    window.finishTurn(player);
                }, window.getCurrentTurn(), activeBattle.monster, battleId);
            });
        } else {
            requestOnlineBattleAction("finishBattle", {}, function () {
                hideLayer("battleMainPopup");
                activeBattle = null;
                window.finishTurn(player);
            });
        }
        return;
    }


    // =========================
    // 通常モンスター撃破
    // 報酬選択が終わるまで
    // 戦闘画面を閉じない
    // =========================

    if (giveReward) {

        showRewardPopup(
    player,
    function () {

        hideLayer(
            "battleMainPopup"
        );

        activeBattle =
            null;

        window.finishTurn(
            player
        );

    },
    window.getCurrentTurn(),
    activeBattle.monster
);

        return;

    }


    // =========================
    // 報酬なしで戦闘終了
    // =========================

    hideLayer(
        "battleMainPopup"
    );

    activeBattle =
        null;

    window.finishTurn(
        player
    );

}


    function getBossData() {

        if (typeof BOSS_CONTENTS === "undefined" ||
            typeof currentBossId === "undefined") {
            return null;
        }

        return BOSS_CONTENTS[currentBossId] || null;

    }


   function finishBossBattle() {

    if (!activeBattle) {
        return;
    }

// =========================
// ボス戦BGM停止
// =========================

bossBattleBGM.pause();

bossBattleBGM.currentTime = 0;

// =========================
// ボスカウンター停止
// =========================

bossCounterEnabled = false;

    const boss =
        activeBattle.monster;

    // =========================
    // 特殊ボス処理
    // 魔王などは通常のボス報酬フローへ進めず、
    // 専用の次処理へ渡します。
    // =========================

    if (
        boss &&
        boss.specialBoss &&
        typeof window.handleSpecialBossDefeat === "function"
    ) {

        window.handleSpecialBossDefeat(
            activeBattle,
            boss
        );

        return;

    }


   


       // =========================
    // ボス撃破ログを表示
    // =========================

    activeBattle.phase =
        "waitBossReward";

    activeBattle.busy =
        false;

    showBattleMessage(
        `${activeBattle.selectedMagic?.name || "魔法"}！ ${formatBattleNumber(activeBattle.lastDamage)}ダメージ！ ボスを倒した！　＞＞`
    );

    disableBattleActions();

    return;

}

function getCurrentBossRewards(player, boss) {
    const players = window.players;
    return BossBattleRules.rewards({
        players,
        bossFirstPlayerIndex: players.indexOf(bossFirstPlayer),
        marketExponent: currentMarketExponent()
    }, boss, players.indexOf(player));
}

function showBossRewardPopup(player, boss) {

    if (!(window.onlineGame && window.onlineGame.isOnline)) {
        showOfflineBossAftermath(player, boss);
        return;
    }

// =========================
// 凱旋BGM開始
// =========================

setupBGM(
    bossVictoryBGM,
    bossVictoryBGMGain,
    setBossVictoryBGMGain
);


    // =========================
    // 報酬内容を作成
    // =========================

    let firstRewardMessage =
        `🥇 先着報酬<br>`;

    const awards = getCurrentBossRewards(player, boss);
    if (awards.first) {

        firstRewardMessage +=
            `${awards.first.name}：+${formatBattleNumber(awards.first.value)}G`;

    }


    let damageRewardMessage =
        `⚔️ ダメージ報酬<br>`;

    awards.damageAwards.forEach(
        function ({ name, value }) {
            damageRewardMessage +=
                `${name}：+${formatBattleNumber(value)}G<br>`;

        }
    );


    let defeatRewardMessage =
        `👑 撃破報酬<br>`;

    defeatRewardMessage +=
        `${awards.defeat.name}：+${formatBattleNumber(awards.defeat.value)}G`;


    // =========================
    // 全報酬
    // =========================

    // =========================
    // ポップアップ取得
    // =========================

    const popup =
        document.getElementById(
            "eventPopup"
        );

    const popupTitle =
        popup.querySelector(
            ".event-popup-title"
        );

    const popupMessage =
        document.getElementById(
            "eventPopupMessage"
        );

    const popupButton =
        document.getElementById(
            "eventPopupButton"
        );


    // =========================
    // ボス報酬専用クラス
    // =========================

    popup.classList.add(
        "boss-reward-popup"
    );


    // =========================
    // タイトル
    // =========================

    popupTitle.textContent =
        "ボス撃破！";


    // =========================
    // 現在の表示段階
    // =========================

    let rewardStep = 0;


    // =========================
    // 報酬表示更新
    // =========================

    function renderRewardStep() {

        if (rewardStep === 0) {

            setMessageWithBreaks(
                popupMessage,
                `${boss.name}を倒した！<br><br>${firstRewardMessage}`
            );

            popupButton.textContent =
                "次へ";

            return;

        }


        if (rewardStep === 1) {

            setMessageWithBreaks(
                popupMessage,
                `${boss.name}を倒した！<br><br>${damageRewardMessage}`
            );

            popupButton.textContent =
                "次へ";

            return;

        }


        if (rewardStep === 2) {

            setMessageWithBreaks(
                popupMessage,
                `${boss.name}を倒した！<br><br>${defeatRewardMessage}`
            );

            popupButton.textContent =
                "次へ";

            return;

        }


        // =========================
        // 報酬を実際に加算
        // =========================

        if (
            bossRewardGiven === false
        ) {
            BossBattleRules.payRewards({ players: window.players, bossRewardGiven }, awards);
            if (typeof updatePlayerStatusUI === "function") window.players.forEach(updatePlayerStatusUI);


            if (
                typeof renderPlayers ===
                "function"
            ) {

                renderPlayers();

            }


            bossRewardGiven =
                true;

        }


        // =========================
        // 報酬受け取り完了表示
        // =========================

        setMessageWithBreaks(
            popupMessage,
            "プレイヤー達は<br>報酬を受け取った！"
        );

popup.classList.add(
    "boss-reward-complete-popup"
);

popupButton.textContent =
    "OK";

    }


    // =========================
    // ポップアップ表示
    // =========================

    popup.style.display =
        "block";


    renderRewardStep();


    // =========================
    // タップ処理
    // =========================

    popupButton.onclick =
        function () {

            // =========================
            // 最終表示
            // =========================

            if (rewardStep >= 3) {

                popup.style.display =
                    "none";

                popup.classList.remove(
                 "boss-reward-popup"
                );

                popup.classList.remove(
                 "boss-reward-complete-popup"
                );


                // =========================
                // 戦闘画面を閉じる
                // =========================

                hideLayer(
                    "battleMainPopup"
                );


// =========================
// ボス撃破数を更新
// =========================

bossDefeatedCount += 1;


// =========================
// 魔王判定
// =========================

if (
    typeof window.handleMaouNextBoss ===
    "function"
) {

    const maouStarted =
        window.handleMaouNextBoss(
            player
        );

    if (maouStarted) {

        // =========================
        // ボス戦情報をリセット
        // =========================

        bossFirstPlayer =
            null;

        bossRewardGiven =
            false;


        window.players.forEach(
            function (p) {

                p.bossDamage =
                    0;

            }
        );


        // =========================
        // 戦闘データを終了
        // =========================

        activeBattle =
            null;

        return;

    }
}

// =========================
// 次のボスを設定
// =========================

previousBossSquareId =
    currentBossSquareId;

const bossIds =
    Object.keys(
        BOSS_CONTENTS
    )
    .map(Number)
    .sort(
        function (a, b) {
            return a - b;
        }
    );


                const currentIndex =
                    bossIds.indexOf(
                        currentBossId
                    );


                if (
                    currentIndex >= 0 &&
                    currentIndex <
                        bossIds.length - 1
                ) {

                    currentBossId =
                        bossIds[
                            currentIndex + 1
                        ];

                }


                currentBossHP =
                    BOSS_CONTENTS[
                        currentBossId
                    ].hp;


                selectBossSquare();


                // =========================
                // ボス戦情報をリセット
                // =========================

                bossFirstPlayer =
                    null;

                bossRewardGiven =
                    false;


                window.players.forEach(
                    function (p) {

                        p.bossDamage =
                            0;

                    }
                );


                // =========================
                // マップ更新
                // =========================

                window.renderMap();


                // =========================
                // 戦闘データを終了
                // =========================

                activeBattle =
                    null;


                // =========================
                // 次のボス目的地を表示
                // =========================

                window.showBossDestinationPopup(
                    function () {

                        window.finishTurn(
                            player
                        );

                    }
                );

                return;

            }


            // =========================
            // 次の報酬へ
            // =========================

            rewardStep +=
                1;


            renderRewardStep();

        };

}


async function showOfflineBossAftermath(player, boss) {
    const players = window.players;
    const killerIndex = players.indexOf(player);
    if (bossDefeatedCount === 1) {
        window.OfflineDividends?.setMarketEventTurnFromBossDefeat?.(window.getCurrentTurn?.() ?? 1);
    }
    const defeatedSquare = currentBossSquareId;
    const awards = getCurrentBossRewards(player, boss);
    try {
        const target = BossCeremonyRules.farthestPlayer(window.mapData, players, defeatedSquare, killerIndex);
        const scene = document.querySelector('#battleMainPopup .battle-main-screen');
        const background = scene ? getComputedStyle(scene).backgroundImage : '';
        setupBGM(bossVictoryBGM, bossVictoryBGMGain, setBossVictoryBGMGain);
        await BossAftermath.show({ players, awards, killerIndex, target, boss, background, battleScreen:scene, bossDefeatedCount,
            onClaim: p => { window.updatePlayerStatusUI(p); window.renderPlayers(); },
            onGuidebookClaim: window.canReceiveGuidebook?.() ? () => window.claimOfflineGuidebook(killerIndex) : null,
            onPenalty: p => { window.updatePlayerStatusUI(p); window.renderPlayers(); }
        });
        bossRewardGiven = true;
        hideLayer('battleMainPopup');
        bossDefeatedCount += 1;
        bossFirstPlayer = null;
        bossRewardGiven = false;
        players.forEach(p => { p.bossDamage = 0; });
        activeBattle = null;
        if (typeof window.handleMaouNextBoss === 'function' && window.handleMaouNextBoss(player)) return;
        previousBossSquareId = currentBossSquareId;
        const bossIds = Object.keys(BOSS_CONTENTS).map(Number).filter(id => id !== 9999 && !BOSS_CONTENTS[id].specialBoss).sort((a,b) => a-b);
        const index = bossIds.indexOf(Number(currentBossId));
        if (index >= 0 && index < bossIds.length - 1) currentBossId = bossIds[index + 1];
        currentBossHP = BOSS_CONTENTS[currentBossId].hp;
        const square = await selectBossSquare();
        window.renderMap();
        await BossOpening.show({ boss:BOSS_CONTENTS[currentBossId], square, squares:window.mapData,
            regionData:window.MapRegionData, overview:window.MapOverviewRasterData,
            background, nextBoss:true, winnerName:player.name });
        stopAllBGM();
        setupAdventureBGM();
        window.finishTurn(player);
    } catch (error) {
        console.error('[boss-aftermath] 進行できません:', error);
        window.showEventPopup('ボス進行エラー', 'ボス討伐後の処理を続けられませんでした。コンソールのエラーをご確認ください。', function () {});
    }
}


    function startSharedBattle(player, enemy, isBoss) {

       clearBattleBuffTint();
       activeBattle = {
    player: player,
    monster: enemy,
    monsterHP: isBoss 
    ? currentBossHP 
    : enemy.hp,

    // =========================
    // 戦闘開始時のゴールド
    // HPバーの100%基準
    // =========================

    battleStartGold:
        player.money,

    round: 1,
    selectedMagic: null,
    armedMagicId: null,
    previewMagic: null,
    activeBuffMagicIds: [],
    busy: false,
    phase: "playerAction",
    isBoss: isBoss,
    onlineBattleId: null,
    isOnlineObserver: false,
    battleState: {
        magicPowerRate: 1,
        enemyAttackRate: 1
    }
};

                ensureBattleUI();
        bindMainButtons();

        // =========================
        // 戦闘背景切り替え
        // =========================

        const battleMainPopup =
            document.getElementById(
                "battleMainPopup"
            );

        if (battleMainPopup) {

            battleMainPopup.classList.toggle(
                "boss-battle-mode",
                isBoss
            );

            const scene = battleMainPopup.querySelector(".battle-main-screen");
            if (scene) {
                const scenery = isBoss ? "" : window.MapAreaAudio?.battleBackground(player);
                if (scenery) scene.style.setProperty("--battle-scenery", `url("${scenery}")`);
                else scene.style.removeProperty("--battle-scenery");
            }

        }

        const actionButton =
            document.getElementById("battleNewEscapeButton");

        if (actionButton) {
            actionButton.textContent = isBoss ? "パス" : "逃げる";
        }

activeBattle.phase = "battleIntro";

showBattleMain();

document
    .getElementById("battleMainPopup")
    .classList.add("battle-intro-mode");

showBattleMessage(
    `${enemy.name}が現れた！　＞＞`
);

    }

    function applyOnlineNormalBattle(envelope) {
        if (!envelope || !envelope.battle) return;
        if (window.BattleMotion && !envelope.motionResolved) return queueOnlineBattlePresentation(envelope);
        const snapshot = envelope.battle;
        const player = players[Number(snapshot.playerIndex)];
        if (!player) return;

        if (!activeBattle || activeBattle.onlineBattleId !== snapshot.battleId) {
            startSharedBattle(player, snapshot.monster, snapshot.kind === "boss");
        }
        if (!activeBattle) return;

        const previousPlayerGold = Number(activeBattle.player && activeBattle.player.money);
        const previousBattlePhase = activeBattle.phase;
        activeBattle.player = player;
        activeBattle.monster = snapshot.monster;
        activeBattle.monsterHP = Number(snapshot.monsterHP);
        activeBattle.battleStartGold = Number(snapshot.battleStartGold);
        activeBattle.round = Number(snapshot.round) || 1;
        activeBattle.phase = snapshot.phase;
        if (snapshot.phase === "playerAction" && previousBattlePhase !== "playerAction") {
            activeBattle.previewMagic = null;
            activeBattle.armedMagicId = null;
        }
        activeBattle.selectedMagic = MAGIC_CONTENTS[Number(snapshot.selectedMagicId)] || null;
        activeBattle.lastDamage = Number(snapshot.lastDamage) || 0;
        activeBattle.endWithReward = snapshot.endWithReward === true;
        activeBattle.reward = snapshot.reward || null;
        activeBattle.battleState = {
            magicPowerRate: Number(snapshot.magicPowerRate) || 1,
            enemyAttackRate: Number(snapshot.enemyAttackRate) || 1
        };
        activeBattle.onlineBattleId = snapshot.battleId;
        activeBattle.isOnlineObserver = !(window.onlineGame && window.onlineGame.socket
            && String(player.id) === String((window.onlineGame.playerId || window.onlineGame.socket.id)));
        activeBattle.busy = false;
        activeBattle.bossRewards = snapshot.bossRewards || null;
        activeBattle.rewardStep = snapshot.rewardStep;

        const battlePopup = document.getElementById("battleMainPopup");
        if (battlePopup) battlePopup.classList.toggle("battle-intro-mode", snapshot.phase === "battleIntro");

        if (envelope.state && typeof window.applyOnlineCanonicalState === "function") {
            window.applyOnlineCanonicalState(envelope.state, "normal-battle", true);
        }
        const challengePopup = document.getElementById("monsterChoicePopup");
        if (snapshot.kind === "boss" && ["bossChallenge", "battleIntro"].includes(snapshot.phase) && bossBattleBGM.paused) {
            setupBGM(bossBattleBGM, bossBattleBGMGain, setBossBattleBGMGain);
        }
        if (snapshot.phase === "bossChallenge") {
            hideLayer("battleMainPopup");
            window.showBossChallengePopup(player, snapshot.isRechallenge, {
                observer: activeBattle.isOnlineObserver,
                fight: function () { requestOnlineBattleAction("challenge"); },
                decline: function () { requestOnlineBattleAction("decline"); }
            });
            return;
        }
        if (challengePopup) {
            window.BossGateUI?.release();
            challengePopup.style.display = "none";
        }
        if (snapshot.phase === "resumeTurn") {
            const observer = activeBattle.isOnlineObserver;
            hideLayer("battleMainPopup");
            activeBattle = null;
            if (!observer) {
                window.updateNextPlayerView();
                const dice = document.getElementById("rouletteButton");
                if (dice) dice.disabled = false;
            }
            return;
        }
        showLayer("battleMainPopup");
        renderBattleMain();
        showBattleMessage(String(snapshot.message || ""));
        if (Number(snapshot.monsterHP) <= 0 && ["rewardSelection", "rewardReceived", "bossRewards", "bossTransition", "bossDestination"].includes(snapshot.phase)) {
            const defeatedMonsterImage = document.getElementById("battleNewMonsterImage");
            if (defeatedMonsterImage) defeatedMonsterImage.style.display = "none";
        }

        // Action effects are played from the same server-confirmed transition
        // on both clients, so spectators see the same hit and spell cues.
        if (!envelope.suppressEffects && snapshot.lastAction && snapshot.lastAction !== activeBattle.lastSyncedAction) {
            if (snapshot.lastAction === "castMagic") {
                const magic = MAGIC_CONTENTS[Number(snapshot.selectedMagicId)];
                if (magic && magic.sound) {
                    const magicId = Number(snapshot.selectedMagicId);
                    if (magicId === 10 && usesWholeBodyMotion(activeBattle)) {
                        if (!snapshot.presentation) {
                            const battle = activeBattle;
                            window.setTimeout(function () {
                                if (activeBattle === battle && activeBattle.lastSyncedAction === snapshot.lastAction) playBattleMagicSound(magic);
                            }, 0);
                        }
                    } else {
                        const magicSE = new Audio(magic.sound);
                        (window.GameSE ? window.GameSE.playLocal(magicSE) : magicSE.play()).catch(function () {});
                    }
                }
                if (Number(snapshot.lastDamage) > 0) {
                    const battleId = snapshot.battleId;
                    flashMonsterOnDamage(function () {
                        if (!activeBattle || activeBattle.onlineBattleId !== battleId || Number(snapshot.monsterHP) > 0) return;
                        const image = document.getElementById("battleNewMonsterImage");
                        if (image) image.style.display = "none";
                    });
                    if (Number(snapshot.monsterHP) <= 0) {
                        window.setTimeout(function () {
                            if (!activeBattle || activeBattle.onlineBattleId !== battleId) return;
                            const image = document.getElementById("battleNewMonsterImage");
                            if (image) image.style.display = "none";
                        }, 500);
                    }
                }
            } else if (snapshot.lastAction === "enemyCounter") {
                // A canonical money snapshot may arrive before this battle
                // event. Use its damage result rather than comparing balances.
                if (Number(snapshot.lastEnemyDamage) > 0 || Number(player.money) < previousPlayerGold) flashPlayerOnDamage();
            }
        }
        activeBattle.lastSyncedAction = snapshot.lastAction || null;
        if (!activeBattle.isOnlineObserver && snapshot.phase === "playerAction") enableBattleActions();
        else disableBattleActions();

        if (snapshot.kind === "boss" && ["waitBossReward", "bossRewards"].includes(snapshot.phase)) {
            bossBattleBGM.pause();
            bossBattleBGM.currentTime = 0;
        }
        if (snapshot.phase === "bossRewards") {
            if (!activeBattle.victoryMusicStarted) {
                setupBGM(bossVictoryBGM, bossVictoryBGMGain, setBossVictoryBGMGain);
                activeBattle.victoryMusicStarted = true;
            }
            renderOnlineBossRewards(snapshot);
            return;
        }
        if (snapshot.phase === 'bossCeremony') {
            bossBattleBGM.pause();
            if (!activeBattle.victoryMusicStarted) { setupBGM(bossVictoryBGM, bossVictoryBGMGain, setBossVictoryBGMGain); activeBattle.victoryMusicStarted = true; }
            window.BossAftermath.renderOnline(snapshot, players, async function(action) {
                const sync = window.onlineGame?.sync;
                const response = await sync.actBossCeremony({ battleId:snapshot.battleId, action, requestId:createOnlineSyncEventId('boss-ceremony-'+action) });
                if (!response?.ok) { console.error('[ボス討伐]',response?.error); throw new Error(response?.error || '操作を確定できませんでした'); }
                await applyOnlineNormalBattle({ ...response, motionResolved:true });
            });
            return;
        }
        if (["bossTransition", "bossDestination"].includes(snapshot.phase)) {
            const observer = activeBattle.isOnlineObserver;
            closeOnlineBossRewardPopup();
            hideLayer("battleMainPopup");
            if (snapshot.phase === "bossTransition") {
                if (observer) return;
                if (typeof window.updateEncounterCondition === "function") window.updateEncounterCondition();
                if (typeof window.handleMaouNextBoss === "function" && window.handleMaouNextBoss(player)) {
                    activeBattle = null;
                    return;
                }
                requestOnlineBattleAction("bossNext");
            } else {
                if (activeBattle.bossOpeningStarted) return;
                activeBattle.bossOpeningStarted = true;
                const syncState = envelope.state || window.onlineGame?.sync?.state || {};
                const bossId = Number(syncState.currentBossId || window.currentBossId || 1);
                const squareId = Number(syncState.currentBossSquareId || syncState.bossSquareId || window.currentBossSquareId);
                const squares = Array.isArray(window.mapData) ? window.mapData : [];
                const square = squares.find(entry => Number(entry.id) === squareId);
                if (!square || !window.BossOpening?.show) {
                    activeBattle = null;
                    window.showBossDestinationPopup(function () { window.finishTurn(player); });
                    return;
                }
                const canAdvance = () => {
                    const state = window.onlineGame?.sync?.state;
                    const local = state?.players?.[state.activePlayerIndex];
                    const localId = window.onlineGame?.playerId || window.onlineGame?.socket?.id;
                    return Boolean(local && localId && String(local.id) === String(localId));
                };
                window.BossOpening.show({ boss:BOSS_CONTENTS[bossId], square, squares,
                    regionData:window.MapRegionData, overview:window.MapOverviewRasterData,
                    nextBoss:true, winnerName:player.name,
                    syncKey:`next:${Number(syncState.bossDefeatedCount) || 0}:${bossId}:${squareId}`, canAdvance })
                    .then(() => {
                        stopAllBGM();
                        setupAdventureBGM();
                        if (!observer) {
                            activeBattle = null;
                            window.finishTurn(player);
                        }
                    })
                    .catch(error => console.error('[online boss opening] 演出を開始できません:', error));
            }
            return;
        }
        if (snapshot.kind === "boss" && snapshot.lastAction === "decline" && snapshot.phase === "ended") {
            const observer = activeBattle.isOnlineObserver;
            hideLayer("battleMainPopup");
            if (!observer) showEventPopup("ボスから撤退", `${player.name}は今回はボスへの挑戦を見送った。`, function () {
                activeBattle = null;
                window.finishTurn(player);
            }, {subjectIndex:players.indexOf(player)});
            return;
        }

        if (["rewardSelection", "rewardReceived"].includes(snapshot.phase) && snapshot.kind !== "boss") {
            const observer = activeBattle.isOnlineObserver;
            activeBattle.rewardFlowStarted = true;
            showRewardPopup(player, function () {
                if (observer) return;
                hideLayer("battleMainPopup");
                activeBattle = null;
                window.finishTurn(player);
            }, window.getCurrentTurn(), snapshot.monster, snapshot.battleId);
            if (snapshot.phase === "rewardReceived") window.BattleRewardUI?.receive(snapshot.reward, snapshot.battleId);
        }
    }

    function queueOnlineBattlePresentation(envelope) {
        const snapshot = envelope.battle;
        const id = String(snapshot.battleId);
        function isCurrentTurn() {
            const state = window.onlineGame && window.onlineGame.sync && window.onlineGame.sync.state;
            return !state || ((!state.matchPhase || state.matchPhase === "playing")
                && Number(state.activePlayerIndex) === Number(snapshot.playerIndex)
                && (!envelope.state || Number(envelope.state.currentTurn) >= Number(state.currentTurn)));
        }
        if (onlinePlayback.closed.has(id) || !isCurrentTurn()) return Promise.resolve({ skipped: true });
        if (onlinePlayback.battleId !== id) {
            if (onlinePlayback.known.has(id)) return Promise.resolve({ skipped: true });
            onlinePlayback.known.add(id);
            if (onlinePlayback.known.size > 150) onlinePlayback.known.delete(onlinePlayback.known.values().next().value);
            onlinePlayback.battleId = id;
            onlinePlayback.sequence = -1;
            onlinePlayback.generation += 1;
            onlinePlayback.chain = Promise.resolve();
            if (motionController) motionController.cancel();
        }
        const sequence = Number(snapshot.actionSequence) || 0;
        if (sequence <= onlinePlayback.sequence) return onlinePlayback.chain;
        onlinePlayback.sequence = sequence;
        const generation = onlinePlayback.generation;
        const task = onlinePlayback.chain.then(function () {
            if (generation !== onlinePlayback.generation || onlinePlayback.closed.has(id) || !isCurrentTurn()) return;
            const cue = snapshot.presentation;
            if (!cue) {
                return applyOnlineNormalBattle({ ...envelope, motionResolved: true });
            }
            const magic = MAGIC_CONTENTS[Number(cue.magicId)];
            // Only presentation data is held back. Canonical player balances
            // remain server-owned and are never rewritten for an animation.
            applyOnlineNormalBattle({
                ...envelope, state: null, motionResolved: true, suppressEffects: true,
                battle: { ...snapshot, monsterHP: cue.before.monsterHP, phase: "presentation", lastAction: null,
                    message: "" }
            });
            const battle = activeBattle;
            if (!battle) return;
            battle.presentationGold = cue.before.playerGold;
            renderBattleMain();
            const sync = window.onlineGame && window.onlineGame.sync;
            const serverNow = sync && typeof sync.serverNow === "function" ? sync.serverNow() : Date.now();
            return presentBattleMotion(cue.actor, function () {
                delete battle.presentationGold;
                applyOnlineNormalBattle({ ...envelope, motionResolved: true, suppressEffects: true });
                if (cue.actor === "player" && Number(cue.magicId) !== 5 && Number(cue.magicId) !== 8 && Number(cue.magicId) !== 10 && magic && magic.sound) {
                    playBattleMagicSound(magic);
                } else if (cue.actor === "enemy" && Number(cue.damage) > 0) flashPlayerOnDamage();
            }, { id: cue.id, magicId: cue.magicId, duration: cue.duration, impact: cue.impact, release: cue.release, damage: cue.damage,
                startedAt: Date.now() + cue.startedAt - serverNow });
        });
        onlinePlayback.chain = task.catch(function (error) {
            console.error("[battle-motion] 同期演出に失敗:", error);
            if (generation !== onlinePlayback.generation) return;
            if (activeBattle) { activeBattle.presentationBusy = false; delete activeBattle.presentationGold; }
            applyOnlineNormalBattle({ ...envelope, motionResolved: true, suppressEffects: true });
        });
        return onlinePlayback.chain;
    }

    function requestOnlineBattleAction(action, details = {}, onSuccess = null) {
        const sync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync
            ? window.onlineGame.sync
            : null;
        if (!activeBattle || !activeBattle.onlineBattleId || !sync || typeof sync.actNormalBattle !== "function") return false;
        if (activeBattle.isOnlineObserver || activeBattle.busy || activeBattle.presentationBusy) return true;
        activeBattle.busy = true;
        disableBattleActions();
        const pendingControls = activeBattle.phase === "bossChallenge"
            ? ["monsterFightButton", "monsterEscapeButton"]
            : activeBattle.phase === "bossRewards" ? ["eventPopupButton"] : [];
        pendingControls.forEach(function (id) {
            const button = document.getElementById(id);
            if (button) button.disabled = true;
        });
        const requestId = createOnlineSyncEventId("battle-" + action);
        sync.actNormalBattle(action, { ...details, battleId: activeBattle.onlineBattleId }, requestId).then(function (response) {
            if (!response || !response.ok || !response.battle) {
                if (!activeBattle) return;
                activeBattle.busy = false;
                pendingControls.forEach(function (id) { const button = document.getElementById(id); if (button) button.disabled = false; });
                if (activeBattle.phase === "bossRewards") renderOnlineBossRewards({ bossRewards: activeBattle.bossRewards, rewardStep: activeBattle.rewardStep });
                showBattleMessage(response && response.error || "戦闘操作を確定できませんでした。");
                if (activeBattle.phase === "playerAction") enableBattleActions();
                return;
            }
            return Promise.resolve(applyOnlineNormalBattle(response)).then(function () {
                if (activeBattle && activeBattle.onlineBattleId === response.battle.battleId && typeof onSuccess === "function") onSuccess(response);
            });
        }).catch(function (error) {
            if (!activeBattle) return;
            activeBattle.busy = false;
            pendingControls.forEach(function (id) { const button = document.getElementById(id); if (button) button.disabled = false; });
            console.error("[online] 通常戦闘の操作に失敗:", error);
            showBattleMessage("通信エラーが発生しました。もう一度操作してください。");
            if (activeBattle.phase === "playerAction") enableBattleActions();
        });
        return true;
    }


   function startBossBattle(player) {

    const boss = getBossData();

    // 魔王は通常ボスの報酬・遷移処理ではなく、
    // maou.js の専用開始処理へ渡します。
    if (
        boss &&
        boss.specialBoss &&
        typeof window.startMaouBattle === "function"
    ) {

        window.startMaouBattle(
            player
        );

        return;
    }

    if (!boss) {
        console.error("BOSS_CONTENTS または currentBossId が見つかりません。");
        return;
    }

    if (window.onlineGame && window.onlineGame.isOnline) {
        window.startOnlineBossEncounter(player, false);
        return;
    }

    if (currentBossHP <= 0) {
        currentBossHP = boss.hp;
    }

    // =========================
    // ボス戦BGM開始
    // 共通の音量設定を使用
    // =========================

    if (
        bossBattleBGM.paused
    ) {

        setupBGM(
            bossBattleBGM,
            bossBattleBGMGain,
            setBossBattleBGMGain
        );

    }

    // =========================
    // ボスカウンター開始
    // =========================

    bossCounterEnabled = true;

    startSharedBattle(
        player,
        boss,
        true
    );

}


    function startNormalBattle(player, monster) {

        startSharedBattle(player, monster, false);

    }


    window.startBossBattle =
        function (player) {
            startBossBattle(player);
        };


    // =========================
    // 特殊ボス戦開始
    // 既存の startSharedBattle() をそのまま利用します。
    // =========================

   window.startSpecialBossBattle =
    function (player, boss, options) {

        options = options || {};

        if (!player || !boss) {
            console.error("【特殊ボス戦】player または boss がありません。");
            return;
        }

        // =====================================================
        // 特殊ボスのHPは、すでに設定されている
        // currentBossHP をそのまま使用する。
        //
        // 魔王の場合、
        // 1回目の戦闘で削ったHPを
        // 次のプレイヤーにも引き継ぐため、
        // ここではHPをboss.hpへ戻さない。
        // =====================================================

        bossCounterEnabled =
            options.enableBossCounter !== false;

        startSharedBattle(
            player,
            boss,
            true
        );

        if (activeBattle) {
            activeBattle.specialEnemyTurn =
                options.enemyTurn || null;
        }

    };


    window.startOnlineBossEncounter = function (player, isRechallenge) {
        const sync = window.onlineGame && window.onlineGame.sync;
        if (!sync || !window.isLocalOnlineTurn()) return;
        sync.startBossEncounter(createOnlineSyncEventId("boss-encounter"), isRechallenge).then(function (response) {
            if (!response || !response.ok || !response.battle) {
                showEventPopup("ボスに挑戦できません", response && response.error || "戦闘情報を取得できませんでした。", function () {});
                return;
            }
            applyOnlineNormalBattle(response);
        });
    };

   window.startMonsterBattle =
    function (player) {
        if (player.money < 0) {
            showEventPopup("", "借金中は通常モンスターと戦えません。", () => finishTurn(player));
            return;
        }

        const onlineSync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync
            ? window.onlineGame.sync
            : null;
        if (onlineSync && typeof onlineSync.startNormalBattle === "function") {
            const oldPopup = document.getElementById("monsterChoicePopup");
            if (oldPopup) {
                window.BossGateUI?.release();
                oldPopup.style.display = "none";
            }
            const requestId = createOnlineSyncEventId("normal-battle");
            onlineSync.startNormalBattle(requestId).then(function (response) {
                if (!response || !response.ok || !response.battle) {
                    showEventPopup("戦闘を開始できません", response && response.error || "サーバーが戦闘を開始できませんでした。", function () {});
                    return;
                }
                applyOnlineNormalBattle(response);
            }).catch(function (error) {
                console.error("[online] 通常戦闘の開始に失敗:", error);
                showEventPopup("通信エラー", "通常戦闘を開始できませんでした。", function () {});
            });
            return;
        }

        const monsterIds =
            Object.keys(MONSTER_CONTENTS).filter(id => !MONSTER_CONTENTS[id].encounterDisabled);

        const randomMonsterId =
            monsterIds[
                Math.floor(
                    Math.random() * monsterIds.length
                )
            ];

        const baseMonster =
            MONSTER_CONTENTS[
                randomMonsterId
            ];


        // =========================
        // ボス撃破数に応じた
        // モンスターステータス倍率
        // =========================

        const monsterInflationMultiplier =
            getMonsterInflationMultiplier();


        // =========================
        // 基礎データをコピーして
        // 今回の戦闘用モンスターを作成
        // =========================

        const monster = {

            ...baseMonster,

            hp:
                Math.floor((baseMonster.hp * monsterInflationMultiplier + 1e-7) / 10) * 10,

            attack:
                Math.floor((baseMonster.attack * monsterInflationMultiplier + 1e-7) / 10) * 10

        };


        // 旧遭遇選択画面は使わない
        const oldPopup =
            document.getElementById(
                "monsterChoicePopup"
            );

        if (oldPopup) {
            window.BossGateUI?.release();
            oldPopup.style.display = "none";
        }


        startNormalBattle(
            player,
            monster
        );

    };


    // 既存のHTMLを新UIに置き換え、旧バトル画面を非表示にします。
    function init() {

        ensureBattleUI();

        if (window.onlineGame && window.onlineGame.sync && typeof window.onlineGame.sync.on === "function") {
            window.onlineGame.sync.on("battle:sync", applyOnlineNormalBattle);
            window.onlineGame.sync.on("battle:view", applyOnlineBattleView);
            window.onlineGame.sync.on("recovery:before", function (frame) {
                if (frame.observer) {
                    onlinePlayback.generation += 1;
                    if (motionController) motionController.cancel();
                    hideLayer("battleMainPopup");
                    hideLayer("rewardPopup");
                    const rewardPopup = document.getElementById('rewardPopup');
                    if (rewardPopup) rewardPopup.dataset.rewardFlowActive = 'false';
                    activeBattle = null;
                }
            });
            window.onlineGame.sync.on("turn:update", closeFinishedOnlineBattleOnTurnChange);
            window.onlineGame.sync.on("state", function (payload) {
                if (payload && payload.state && ["roundSummary", "finished"].includes(payload.state.matchPhase)) closeFinishedOnlineBattleOnTurnChange();
            });
        }

        const oldBattlePopup =
            document.getElementById("battlePopup");

        if (oldBattlePopup) {
            oldBattlePopup.style.display = "none";
        }

        const oldMagicPopup =
            document.getElementById("battleMagicPopup");

        if (oldMagicPopup) {
            oldMagicPopup.style.display = "none";
        }

    }


    window.resetBattleMagicOrders = resetBattleMagicOrders;

    if (
        document.readyState === "loading"
    ) {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
