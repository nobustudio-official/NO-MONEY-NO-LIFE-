// 共有UI・ルーレットの開始から終了まで同じイベントIDを使う。
// サーバーはイベントIDで開始／終了の対応関係と所有者を検証する。
let onlineSyncEventSequence = 0;
function createOnlineSyncEventId(type) {
    onlineSyncEventSequence += 1;
    const socketId = window.onlineGame && window.onlineGame.socket && (window.onlineGame.playerId || window.onlineGame.socket.id)
        ? (window.onlineGame.playerId || window.onlineGame.socket.id)
        : "local";
    return `${String(type || "event")}-${socketId}-${Date.now()}-${onlineSyncEventSequence}`.slice(0, 120);
}

// =========================
// 異世界冒険人生ゲーム
// =========================

// マス移動中は詳細表示を無効化
window.isSquareMovementInProgress = false;

// =========================
// UI・マップ用画像
// =========================
// マスの画像は mapData の type を基準に決定します。
// mapData 側の icon は画像が読み込めない場合の予備表示として残します。

const MAP_TYPE_ICON_PATHS = {
    start: "images/map/space-icons/start.webp",
    money: "images/map/space-icons/gold.webp",
    job: "images/map/space-icons/job.webp",
    shop: "images/map/space-icons/shop.webp",
    worst: "images/map/space-icons/worst.webp",
    monster: "images/map/space-icons/monster.webp",
    magic_shop: "images/map/space-icons/magic-shop.webp",
    asset: "images/map/space-icons/asset.webp",
    treasure: "images/map/space-icons/treasure.webp"
};

const BOSS_MAP_ICON_PATH =
    "images/map/space-icons/boss.webp";

const DICE_MOVEMENT_ARROW_PATH =
    "images/ui/icons/interface/yajirushi.webp";

const MAP_TYPE_ICON_FALLBACKS = {
    start: "🏕️",
    money: "💰",
    job: "💼",
    shop: "🏪",
    worst: "💀",
    monster: "👾",
    magic_shop: "🔮",
    asset: "🏰",
    treasure: "🎁"
};

// 4方向スプライトシートの配置
//
// 元画像は2×2配置です。
// 左上：正面
// 右上：背面
// 左下：左向き
// 右下：右向き
const PLAYER_DIRECTIONS = {
    down:  { row: 0, column: 0 },
    up:    { row: 0, column: 1 },
    left:  { row: 1, column: 0 },
    right: { row: 1, column: 1 }
};

// Keep the four direction images for the player currently taking a turn
// decoded before movement starts, so changing direction does not trigger a
// first-use image decode during a camera move.
let activePlayerDirectionPreloadKey = '';
let activePlayerDirectionPreloadImages = [];
let activePlayerDirectionPreloadPromise = Promise.resolve();

function preloadPlayerDirectionSprites(player) {
    const character = PLAYER_CONTENTS[player?.characterId];
    if (!character) return Promise.resolve();
    const directions = character.spriteDirections || {};
    const sources = [...new Set(['down', 'up', 'left', 'right']
        .map(direction => directions[direction] || character.sprite)
        .filter(Boolean))];
    const key = sources.join('|');
    if (!key || key === activePlayerDirectionPreloadKey) return activePlayerDirectionPreloadPromise;

    activePlayerDirectionPreloadKey = key;
    activePlayerDirectionPreloadImages = [];
    activePlayerDirectionPreloadPromise = Promise.all(sources.map(source => {
        const image = new Image();
        image.decoding = 'async';
        image.src = source;
        if (typeof image.decode === 'function') {
            return image.decode().then(() => image, () => null);
        }
        return new Promise(resolve => {
            image.onload = () => resolve(image);
            image.onerror = () => resolve(null);
            if (image.complete) resolve(image.naturalWidth ? image : null);
        });
    })).then(images => {
        if (key === activePlayerDirectionPreloadKey) {
            activePlayerDirectionPreloadImages = images.filter(Boolean);
        }
    });
    return activePlayerDirectionPreloadPromise;
}


// =========================
// プレイヤー画像取得
// =========================

// マップ移動用の4方向スプライト
function getPlayerCharacterSprite(playerIndex, direction = null) {

    const player =
        players[playerIndex];

    if (!player) {
        return "";
    }

    const character =
        PLAYER_CONTENTS[player.characterId];

    if (!character) {
        return "";
    }

    if (direction && character.spriteDirections?.[direction]) {
        return character.spriteDirections[direction];
    }

    return character.sprite;
}


// プレイヤーアイコン表示用
function getPlayerCharacterIcon(playerIndex) {

    const player =
        players[playerIndex];

    if (!player) {
        return "";
    }

    const character =
        PLAYER_CONTENTS[player.characterId];

    if (!character) {
        return "";
    }

    return character.icon;
}

// プレイヤーの現在の向きを取得します。
// 未設定のプレイヤーは正面（down）を初期値にします。
function getPlayerDirection(player) {

    if (!player.direction || !PLAYER_DIRECTIONS[player.direction]) {
        player.direction = "down";
    }

    return player.direction;

}

// 4方向スプライトシートから、現在の向きだけを表示します。
function updatePlayerSprite(element, playerIndex, player) {

    if (!element || !player) {
        return;
    }

    const direction =
        getPlayerDirection(player);

    const imagePath =
        getPlayerCharacterSprite(playerIndex, direction);

    const spritePosition =
        PLAYER_DIRECTIONS[direction];

    element.style.backgroundImage =
        `url("${imagePath}")`;

    element.dataset.direction =
        direction;

    element.style.backgroundPosition =
        `${spritePosition.column === 0 ? "0%" : "100%"} ${spritePosition.row === 0 ? "0%" : "100%"}`;

    window.MapCharacterLayout.apply(element, imagePath, direction);

}

// =========================
// HUD用プレイヤー顔アイコン
// =========================
// マップ上のプレイヤーとは別管理。
// 常に正面（down）のスプライトを表示します。
function updateHudPlayerAvatar(
    element,
    playerIndex
) {

    if (!element) {
        return;
    }

    element.style.backgroundImage =
    `url("${getPlayerCharacterIcon(playerIndex)}")`;

    element.dataset.direction =
        "down";

    element.style.backgroundPosition =
        "16.7% 0%";

    element.classList.toggle(
        "disadvantage-immunity-gold",
        Boolean(window.DisadvantageImmunityRules?.isActive(players[playerIndex]))
    );

}

// =========================
// HUD用プレイヤー名サイズ
// =========================

function updateHudPlayerName(
    element,
    name
) {

    if (!element) {
        return;
    }

    // HTMLテンプレート側では名前を空にしているため、
    // 現在のプレイヤー名はここでテキストとして設定する。
    element.textContent = name ?? "";

}

// =========================
// お金マスのランダム報酬
// =========================

function getRandomGoldReward() {

    // MONEY_CONTENTSのcontents ID「1」を使用

    const setting =
        MONEY_CONTENTS[1];


    // 設定がなければ0G

    if (!setting) {

        return 0;

    }


    // 1～100の乱数

    const random =
        Math.random() * 100;


    let total =
        0;


    // 確率を順番に足していく

    for (
        const reward of setting.rewards
    ) {

        total +=
            reward.probability;


        if (
            random < total
        ) {

            return calculateGoldSquareReward(reward.amount, getMonsterInflationMultiplier());

        }

    }


    return 0;

}

function getGoldSquareSlotValues() {
    const multiplier = getMonsterInflationMultiplier();
    return (MONEY_CONTENTS[1]?.rewards || []).map(entry => `${formatG(calculateGoldSquareReward(entry.amount, multiplier))}G`);
}

// =========================
// 30マス版 異世界マップ
// =========================
//
// next は「基本となる道」
//
// ゲーム中の移動では、
// next の方向だけでなく、
// 他のマスから現在地へつながっている道も
// 自動的に認識する。
//
// つまりゲーム上では双方向に移動できる。
//
// 例：
//
// 0 → 17
//
// と書いてあれば、ゲーム上では
//
// 0 ↔ 17
//
// として扱う。
//
// これが桃鉄型の移動システム。
// =========================


// =========================
// バイトデータ
// =========================


// 現在のバイト単価を取得

function getCurrentJobWage(baseWage) {
    return calculateJobWage(baseWage, bossDefeatedCount);
}


// バイトIDからデータを取得

function getJobData(jobId) {

    return JOB_CONTENTS[
        jobId
    ];

}


// =========================
// ボス管理
// =========================

let currentBossSquareId = null;
let previousBossSquareId = null;

// ボス撃破数
let bossDefeatedCount = 0;

// =========================
// 通常モンスターのインフレ倍率
// =========================

function getMonsterInflationMultiplier() {

    return Math.pow(
        1.1,
        bossDefeatedCount
    );

}
// 現在のボスID
let currentBossId = 1;

// 現在のボスHP
let currentBossHP =
    BOSS_CONTENTS[
        currentBossId
    ].hp;

let bossFirstPlayer = null;

let bossRewardGiven = false;

let bossCounterEnabled = false;

// ボス報酬設定

const BOSS_DAMAGE_MULTIPLIER =
    window.BossBattleRules.DAMAGE_MULTIPLIER;

// =========================
// ボスカウンター無効判定
// =========================

function hasBossCounterImmunity(
    player
) {

    if (player.jobTurnsRemaining > 0) {
    return true;
}

    if (
        !player.inventory
    ) {

        return false;

    }

    return player.inventory.some(
        function (inventoryData) {

            // 通常アイテムは対象外
            if (
                typeof inventoryData !==
                "object"
            ) {

                return false;

            }

            const item =
                ITEM_CONTENTS[
                    inventoryData.id
                ];

            if (!item) {

                return false;

            }

            return (
                item.effectType ===
                "bossCounterImmunity"
            );

        }
    );

}


// =========================
// ボス出現マスを決定
// =========================

function selectBossSquare() {

    const start = mapData.find(square => square.type === "start");
    const origin = currentBossSquareId ?? start?.id;
    const isInitialBossSelection = currentBossSquareId == null && bossDefeatedCount === 0;
    const reachableBossCandidates = BossBattleRules.reachableBossSquares(mapData, origin, previousBossSquareId);
    const bossCandidates = isInitialBossSelection
        ? reachableBossCandidates.filter(square => {
            const region = window.MapRegionRules?.regionAt(
                window.MapRegionData,
                Number(square.x),
                Number(square.y)
            );
            return region?.id === "grassland";
        })
        : bossDefeatedCount > 0
            ? BossBattleRules.nextBossCandidates(mapData, origin, previousBossSquareId, players,
                window.MapRegionData, window.MapRegionRules?.regionAt)
        : reachableBossCandidates;

    if (bossCandidates.length === 0) {
        return Promise.resolve(null);
    }

    // Online clients must use one server-selected square rather than rolling
    // independently. Offline play keeps the original local random selection.
    if (window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync) {
        const candidateIds = bossCandidates.map(square => Number(square.id));
        return window.onlineGame.sync.selectBossSquare(candidateIds).then(function (response) {
            if (!response || !response.ok || !Number.isInteger(Number(response.bossSquareId))) {
                throw new Error(response && response.error || "ボスマスの同期に失敗しました。");
            }
            const selectedBoss = mapData.find(square => Number(square.id) === Number(response.bossSquareId));
            if (!selectedBoss || selectedBoss.type !== "monster") {
                throw new Error("サーバーから受け取ったボスマスがマップに存在しません。");
            }
            currentBossSquareId = selectedBoss.id;
            previousBossSquareId = null;
            return selectedBoss;
        });
    }

    const randomIndex = Math.floor(Math.random() * bossCandidates.length);
    const selectedBoss = bossCandidates[randomIndex];
    currentBossSquareId = selectedBoss.id;
    previousBossSquareId = null;
    if (bossDefeatedCount === 1 && !window.OfflineDividends.marketOutcomeAt18?.()) {
        window.OfflineDividends.setMarketOutcomeAt18(Math.random() < 0.5 ? 'crash' : 'boom');
    }
    return Promise.resolve(selectedBoss);
}

// =========================
// オンライン初期ゲーム状態の同期
// =========================

function synchronizeInitialGameState(maxTurns) {
    if (!(window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync)) {
        return Promise.resolve(null);
    }

    const localPlayers = Array.isArray(window.players) ? window.players : [];
    const initialState = {
        maxTurns: maxTurns,
        players: localPlayers,
        currentBossSquareId: currentBossSquareId,
        previousBossSquareId: previousBossSquareId,
        bossDefeatedCount: bossDefeatedCount,
        currentBossId: currentBossId,
        currentBossHP: currentBossHP,
        bossRewardGiven: bossRewardGiven,
        bossCounterEnabled: bossCounterEnabled,
        gameStarted: gameStarted,
        bossFirstPlayerIndex: -1,
        assetOwners: {}
    };

    return window.onlineGame.sync.bootstrapState(initialState).then(function (state) {
        if (!state || !Array.isArray(state.players) || state.players.length === 0) {
            throw new Error("サーバーから受け取った初期プレイヤー情報が不正です。");
        }
        // Update the shared global reference before showGameScreen reads it.
        applyOnlinePlayersInPlace(state.players);
        currentBossSquareId = state.currentBossSquareId;
        previousBossSquareId = state.previousBossSquareId;
        bossDefeatedCount = state.bossDefeatedCount;
        currentBossId = state.currentBossId;
        currentBossHP = state.currentBossHP;
        bossRewardGiven = state.bossRewardGiven;
        bossCounterEnabled = state.bossCounterEnabled;
        return state;
    });
}


// オンラインでは自分の手番以外、ゲーム操作をロックする。
// ポップアップのOKと各画面の閉じるボタンだけは各クライアントで操作可能。
function isLocalOnlineTurn() {
    if (!(window.onlineGame && window.onlineGame.isOnline && window.onlineGame.socket)) return true;
    const socketId = (window.onlineGame.playerId || window.onlineGame.socket.id);
    const playerIndex = typeof window.getCurrentPlayerIndex === "function"
        ? window.getCurrentPlayerIndex()
        : Number(window.onlineGame.sync && window.onlineGame.sync.state && window.onlineGame.sync.state.activePlayerIndex);
    const sharedPlayers = Array.isArray(window.players) ? window.players : [];
    return Boolean(socketId && Number.isInteger(Number(playerIndex)) && sharedPlayers[Number(playerIndex)] && String(sharedPlayers[Number(playerIndex)].id) === String(socketId));
}
window.isLocalOnlineTurn = isLocalOnlineTurn;

function refreshOnlineTurnControls() {
    if (!(window.onlineGame && window.onlineGame.isOnline)) return;
    const phase = window.onlineGame.sync && window.onlineGame.sync.state && window.onlineGame.sync.state.matchPhase;
    const localTurn = isLocalOnlineTurn() && !["roundSummary", "finished"].includes(phase) && !window.onlineRoundFlowPending;
    const controls = document.querySelectorAll('button, input, select, textarea, [role="button"]');
    controls.forEach(function (control) {
        const id = String(control.id || '');
        if (phase === "finished" && id === "resultButton") {
            control.disabled = false;
            if (control.dataset) { delete control.dataset.onlineTurnDisabled; delete control.dataset.onlineTurnPreviousDisabled; }
            return;
        }
        const className = typeof control.className === 'string' ? control.className : '';
        const isPopupOk = id === 'eventPopupButton';
        const isCloseControl = /close|cancel|dismiss/i.test(id + ' ' + className) || control.getAttribute('data-allow-offturn') === 'true';
        if (isPopupOk || isCloseControl) {
            if (control.dataset && control.dataset.onlineTurnDisabled === 'true') {
                control.disabled = control.dataset.onlineTurnPreviousDisabled === 'true';
                delete control.dataset.onlineTurnDisabled;
                delete control.dataset.onlineTurnPreviousDisabled;
            }
            return;
        }
        if (!localTurn) {
            if (!control.disabled) {
                control.disabled = true;
                if (control.dataset) {
                    control.dataset.onlineTurnDisabled = 'true';
                    control.dataset.onlineTurnPreviousDisabled = 'false';
                }
            }
        } else if (control.dataset && control.dataset.onlineTurnDisabled === 'true') {
            control.disabled = control.dataset.onlineTurnPreviousDisabled === 'true';
            delete control.dataset.onlineTurnDisabled;
            delete control.dataset.onlineTurnPreviousDisabled;
        }
    });
}

// Shared spectator screens disable their close controls directly. Restore
// those static buttons when the local client becomes the active player so a
// previous observer turn cannot leave later shops permanently unclosable.
function resetSharedShopCloseControls() {
    document.querySelectorAll('.item-action-back-button, .loss-note-back-button').forEach(button => { button.disabled = false; });
    ["shopCloseButton", "shopCloseButton2", "magicShopCloseButton", "powerShopCloseButton", "assetCloseButton", "assetPurchaseCloseButton", "inventoryCloseButton", "magicCloseButton", "otherMenuCloseButton", "soundSettingsCloseButton", "bgmVolumeSlider", "seVolumeSlider"].forEach(function (id) {
        const button = document.getElementById(id);
        if (button) button.disabled = false;
    });
}

// 旧呼び出し元のための同期バリア。通常ゲームの値は送らず、正本を確認する。
// 未移行の魔王だけは、明示した項目を専用の互換入口へ渡す。
let onlineStatePublishChain = Promise.resolve();
window.publishOnlineGameState = function () {
    if (!(window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync)) return Promise.resolve({ ok: true, offline: true });
    if (!window.onlineGame.sync.state) return Promise.resolve({ ok: true, waitingForBootstrap: true });
    const initialState = window.onlineGame.sync.state;
    const requestedTurnKey = `${initialState.currentTurn}:${initialState.activePlayerIndex}`;
    const task = onlineStatePublishChain.then(function () {
        const sync = window.onlineGame.sync;
        const state = sync.state;
        const turnKey = `${state.currentTurn}:${state.activePlayerIndex}`;
        if (turnKey !== requestedTurnKey) return { ok: true, skipped: true };
        const metadata = { turnKey };
        const maouCompatibility = Number(currentBossId) === 9999 || Number(state.currentBossId) === 9999;
        const request = maouCompatibility ? sync.publishMaouState({
            ...metadata, baseRevision: Number.isFinite(sync.revision) ? sync.revision : Number(state.revision),
            players: (window.players || []).map(function (player) {
                return { id: player.id, money: Number(player.money), bossDamage: Number(player.bossDamage) || 0 };
            }),
            currentBossSquareId, previousBossSquareId: previousBossSquareId == null ? null : previousBossSquareId,
            currentBossId, currentBossHP, bossRewardGiven, bossCounterEnabled,
            bossFirstPlayerIndex: players.indexOf(bossFirstPlayer)
        }) : sync.flushState(metadata);
        return request.then(function (response) {
            if (response && response.ok && response.state) applyOnlineCanonicalState(response.state, "publish", true);
            return response;
        });
    });
    onlineStatePublishChain = task.catch(function (error) { console.error("[online] 状態送信に失敗:", error); });
    return task;
};

// オンライン購入は商品IDだけを送り、価格と残高・所持状態はサーバーで確定する。
function submitOnlineShopPurchase(category, contentId, button, onSuccess) {
    const sync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync
        ? window.onlineGame.sync
        : null;
    if (!sync) return false;

    button.disabled = true;
    sync.requestShopPurchase(category, Number(contentId)).then(function (response) {
        if (!response || !response.ok) {
            button.disabled = false;
            showEventPopup("購入できません", response && response.error || "サーバーで購入を確認できませんでした。", function () {});
            return;
        }

        if (response.state) applyOnlineCanonicalState(response.state, "shop-purchase");
        if (typeof onSuccess === "function") onSuccess();
    }).catch(function (error) {
        button.disabled = false;
        console.error("[online] 購入要求に失敗しました:", error);
        showEventPopup("通信エラー", "購入結果を確認できませんでした。画面を更新して状態を確認してください。", function () {});
    });
    return true;
}

function submitOnlineTargetedItem(itemId, details, button, onSuccess) {
    const sync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync
        ? window.onlineGame.sync
        : null;
    if (!sync) return false;
    const actor = window.players?.[window.getCurrentPlayerIndex?.()];
    const returnToInventory = () => {
        if (![17, 25, 26].includes(Number(itemId))) return;
        if (actor && ApprovedCommerce.canAct(actor)) showInventoryPopup(actor);
    };
    const closeFailedSpecialScreen = () => {
        if (![25,26].includes(Number(itemId))) return;
        window.specialItemActionPending = false;
        window.SpecialItemUI?.hide();
        const active = window.players?.[window.getCurrentPlayerIndex?.()];
        if (active) window.syncOnlineScreenView?.('', active, 'close');
    };

    if (button) button.disabled = true;
    const requestId = createOnlineSyncEventId(`item-${Number(itemId)}`);
    sync.useTargetedItem({ ...details, itemId: Number(itemId), requestId }).then(function (response) {
        if (!response || !response.ok || !response.state) {
            if (button) button.disabled = false;
            closeFailedSpecialScreen();
            showEventPopup("アイテムを使用できません", response && response.error || "サーバーで使用結果を確認できませんでした。", returnToInventory);
            return;
        }
        applyOnlineCanonicalState(response.state, `item-${Number(itemId)}`, true);
        const activePlayer = Array.isArray(window.players) && typeof window.getCurrentPlayerIndex === "function"
            ? window.players[window.getCurrentPlayerIndex()]
            : null;
        if (activePlayer && typeof window.syncOnlineScreenView === "function") window.syncOnlineScreenView("", activePlayer, "close");
        if (typeof onSuccess === "function") onSuccess(response.result || {});
    }).catch(function (error) {
        if (button) button.disabled = false;
        console.error(`[online] アイテム${Number(itemId)}の使用に失敗:`, error);
        closeFailedSpecialScreen();
        showEventPopup("通信エラー", "アイテムの使用結果を確認できませんでした。状態を確認してください。", returnToInventory);
    });
    return true;
}

// Keep the original players array and player objects stable across canonical snapshots.
// showGameScreen owns a local `const players` reference; replacing window.players
// would split the UI/movement logic from the canonical state and cause stale paths.
function applyOnlinePlayersInPlace(incomingPlayers) {
    if (!Array.isArray(incomingPlayers)) return Array.isArray(window.players) ? window.players : [];
    const currentPlayers = Array.isArray(window.players) ? window.players : [];
    const nextPlayers = incomingPlayers.map(function (incoming, index) {
        // Local inventory helpers may mutate arrays. Keep those mutations out
        // of the bridge's retained canonical snapshot while preserving pieces.
        const copied = incoming && typeof incoming === "object" ? JSON.parse(JSON.stringify(incoming)) : incoming;
        const existing = currentPlayers.find(function (candidate) {
            return candidate && incoming && candidate.id != null && incoming.id != null
                && String(candidate.id) === String(incoming.id);
        }) || currentPlayers[index];
        if (!existing || typeof existing !== "object" || !incoming || typeof incoming !== "object") {
            return copied;
        }
        Object.keys(existing).forEach(function (key) {
            if (!Object.prototype.hasOwnProperty.call(copied, key)) delete existing[key];
        });
        Object.assign(existing, copied);
        return existing;
    });
    currentPlayers.splice(0, currentPlayers.length, ...nextPlayers);
    window.players = currentPlayers;
    return currentPlayers;
}

function applyOnlineCanonicalState(state, source, preserveLocalTurn = false, options = {}) {
    if (!state || !Array.isArray(state.players) || !state.players.length) return;
    const sync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync;
    if (sync && typeof sync.rememberState === "function" && !sync.rememberState(state)) return;
    const preserveCamera = (source === 'guidebook-ack' || source === 'snapshot')
        && Number(state.activePlayerIndex) === window.getCurrentPlayerIndex?.()
        && Number(state.currentTurn) === window.getCurrentTurn?.()
        && (['offer', 'applied'].includes(state.guidebook?.view?.kind) || window.GuidebookUI?.isPurchaseRequestOpen());
    if (Array.isArray(state.nextDiceAllSixPlayerIds)) {
        window.nextDiceAllSixPlayerIds = new Set(state.nextDiceAllSixPlayerIds.map(String));
    }
    // Ignore snapshots while the local client is animating its own action. The
    // server excludes the acting socket from action broadcasts, but this also
    // protects against delayed snapshots from an earlier revision.
    applyOnlinePlayersInPlace(state.players);
    if (Number.isInteger(Number(state.currentBossSquareId))) currentBossSquareId = Number(state.currentBossSquareId);
    if (state.previousBossSquareId === null || Number.isInteger(Number(state.previousBossSquareId))) previousBossSquareId = state.previousBossSquareId;
    if (Number.isFinite(Number(state.bossDefeatedCount))) bossDefeatedCount = Number(state.bossDefeatedCount);
    if (Number.isFinite(Number(state.currentBossId))) currentBossId = Number(state.currentBossId);
    if (Number.isFinite(Number(state.currentBossHP))) currentBossHP = Number(state.currentBossHP);
    if (Number(currentBossId) === 9999 && typeof window.ensureOnlineMaouBossData === "function") window.ensureOnlineMaouBossData();
    if (typeof state.bossRewardGiven === "boolean") bossRewardGiven = state.bossRewardGiven;
    if (typeof state.bossCounterEnabled === "boolean") bossCounterEnabled = state.bossCounterEnabled;
    if (Number.isInteger(state.bossFirstPlayerIndex)) bossFirstPlayer = players[state.bossFirstPlayerIndex] || null;
    if (typeof state.gameStarted === "boolean") gameStarted = state.gameStarted;
    if (Object.prototype.hasOwnProperty.call(state, 'bridgeCollapse')) {
        const previousCollapse = window.bridgeCollapseState;
        const incomingCollapse = state.bridgeCollapse || null;
        window.bridgeCollapseState = incomingCollapse;
        if (!incomingCollapse) {
            if (!window.bridgeCollapseRecoveryPending) window.bridgeCollapseVisualState = null;
        } else if (!String(source || '').startsWith('bridge-collapse')
            && (!previousCollapse || String(previousCollapse.eventId) !== String(incomingCollapse.eventId))) {
            window.bridgeCollapseVisualState = incomingCollapse;
        }
    }
    if (state.assetOwners && typeof state.assetOwners === "object" && typeof ASSET_CONTENTS === "object") {
        Object.keys(state.assetOwners).forEach(function (assetId) {
            if (ASSET_CONTENTS[assetId]) ASSET_CONTENTS[assetId].owner = state.assetOwners[assetId];
        });
    }
    if (!preserveLocalTurn && Number.isInteger(Number(state.activePlayerIndex)) && typeof window.setOnlineTurnState === "function") {
        window.setOnlineTurnState(Number(state.activePlayerIndex), state.currentTurn);
    }
    const activePlayer = players[Number(state.activePlayerIndex)];
    if (activePlayer) window.MapAreaAudio?.updateForPlayer(activePlayer);
    if (!options.deferTurnView) {
        renderMap({ preserveCamera });
        renderPlayers();
        if (typeof window.renderTurn === "function") window.renderTurn();
        refreshShortestPathToBoss();
        refreshOnlineTurnControls();
    }
    if (!options.deferTurnView && state.undergroundFlow?.stage === "reminder") window.centerCurrentPlayerOnMap?.("auto");
    window.renderOnlineUnderground?.(state);
}


// =========================
// ボス決定演出
// =========================

function showBossDestinationPopup(
    callback,
    cameraOnly = false
) {

    const boss =
        mapData.find(function (square) {
            return square.id === currentBossSquareId;
        });

    if (!boss) {
        return;
    }

    const popup =
        document.getElementById(
            "eventPopup"
        );

    // =========================
    // ボス決定ポップアップ専用表示
    // =========================

    if (popup) {
        popup.classList.add(
            "boss-destination-popup"
        );
    }

        // =========================
    // ボスマスを中央へ移動
    // =========================
    // プレイヤーのカメラ移動と同じ方式で、
    // 余白・ズーム倍率を考慮して中央に合わせます。
    // =========================

    setTimeout(function () {

        const mapArea =
            document.querySelector(
                ".game-screen .map-area"
            );

        const mapBoard =
            document.getElementById(
                "mapBoard"
            );

        const bossNode =
            document.querySelector(
                `.map-node[data-square-id="${boss.id}"]`
            );

        if (
            !mapArea ||
            !mapBoard ||
            !bossNode
        ) {
            return;
        }


        // =========================
        // 現在のズーム倍率
        // =========================

        const zoom =
            typeof getMapZoomUI ===
            "function"
                ? getMapZoomUI()
                : 1;


        // =========================
        // マップの余白
        // =========================

        const paddingLeft =
            parseFloat(
                getComputedStyle(
                    mapArea
                ).paddingLeft
            ) || 0;

        const paddingTop =
            parseFloat(
                getComputedStyle(
                    mapArea
                ).paddingTop
            ) || 0;


        // =========================
        // ボスマスの中心座標
        // =========================

        const squareCenterX =
            bossNode.offsetLeft +
            bossNode.offsetWidth / 2;

        const squareCenterY =
            bossNode.offsetTop +
            bossNode.offsetHeight / 2;


        // =========================
        // マップ本体の中心座標
        // =========================

        const boardCenterX =
            mapBoard.clientWidth / 2;

        const boardCenterY =
            mapBoard.clientHeight / 2;


        // =========================
        // ズーム後のボスマス座標
        // =========================

        const zoomedSquareCenterX =
            boardCenterX +
            (
                squareCenterX -
                boardCenterX
            ) *
            zoom;

        const zoomedSquareCenterY =
            boardCenterY +
            (
                squareCenterY -
                boardCenterY
            ) *
            zoom;


        // =========================
        // 画面中央へ合わせる
        // =========================

        const targetScrollLeft =
            paddingLeft +
            (parseFloat(getComputedStyle(mapBoard).marginLeft) || 0) +
            zoomedSquareCenterX -
            mapArea.clientWidth / 2;

        const targetScrollTop =
            paddingTop +
            (parseFloat(getComputedStyle(mapBoard).marginTop) || 0) +
            zoomedSquareCenterY -
            mapArea.clientHeight / 2;


        // =========================
        // スクロール可能範囲
        // =========================

        const maxScrollLeft =
            Math.max(
                0,
                mapArea.scrollWidth -
                mapArea.clientWidth
            );

        const maxScrollTop =
            Math.max(
                0,
                mapArea.scrollHeight -
                mapArea.clientHeight
            );


        // =========================
        // 範囲内に収める
        // =========================

        const finalScrollLeft =
            Math.max(
                0,
                Math.min(
                    targetScrollLeft,
                    maxScrollLeft
                )
            );

        const finalScrollTop =
            Math.max(
                0,
                Math.min(
                    targetScrollTop,
                    maxScrollTop
                )
            );


        // =========================
        // ボスマス中央へ移動
        // =========================

        mapArea.scrollTo({
            left: finalScrollLeft,
            top: finalScrollTop,
            behavior: "smooth"
        });

    }, 50);

    // =========================
    // ポップアップ表示
    // =========================
    // showEventPopup() のタイトルは
    // textContentで処理されるため、
    // HTMLは本文側にだけ入れます。
    // =========================

    if (cameraOnly) return;

    setTimeout(function () {

        showEventPopup(
            "次の目的地が決定！",
            `
            <div class="boss-destination-image-wrap">
                <img
                    src="${BOSS_MAP_ICON_PATH}"
                    alt="ボス"
                    class="boss-destination-popup-icon"
                >
            </div>

            <div class="boss-destination-line">
                ${BOSS_CONTENTS[currentBossId].name}
            </div>

            <div class="boss-destination-message">
                がこのマスで待ち受けている！
            </div>
            `,
            function () {

                // =========================
                // 専用クラスを解除
                // =========================

                if (popup) {
                    popup.classList.remove(
                        "boss-destination-popup"
                    );
                }

// =========================
// 凱旋BGMが流れている場合だけ
// 冒険BGMを最初から再生
// =========================

if (
    !bossVictoryBGM.paused ||
    bossVictoryBGM.currentTime > 0
) {

    stopAllBGM();

    setupAdventureBGM();

}

// =========================
// ボス撃破後など
// =========================

if (callback) {
    callback();
    return;
}

  
                

            }
        );

    }, 1200);

}


// =========================
// ゲーム開始時の読み込み画面
// =========================

const GAME_LOADING_MIN_TIME = 1200;

const GAME_LOADING_ASSETS = [
    "images/map/space-icons/start.webp",
    "images/map/space-icons/gold.webp",
    "images/map/space-icons/job.webp",
    "images/map/space-icons/shop.webp",
    "images/map/space-icons/worst.webp",
    "images/map/space-icons/monster.webp",
    "images/map/space-icons/magic-shop.webp",
    "images/map/space-icons/asset.webp",
    "images/map/space-icons/treasure.webp",
    "images/map/space-icons/boss.webp",
    "images/ui/icons/interface/gold.webp",
    "images/ui/icons/interface/mana.webp",
    "images/map/space-icons/boss.webp",
    "images/ui/icons/interface/dice.webp",
    "images/ui/icons/interface/item.webp",
    "images/ui/icons/interface/magic.webp",
    "images/ui/icons/interface/settings.webp",
    "images/ui/icons/interface/yajirushi.webp"
];



function preloadGameImage(path) {

    return new Promise(function (resolve) {

        const image =
            new Image();

        if (window.MapDetailLevel?.touchDevice) {
            window.MapDetailLevel.loadImage(image, path, 2).then(resolve, resolve);
            return;
        }

        image.onload =
            function () {
                resolve();
            };

        image.onerror =
            function () {
                // 画像がなくてもゲーム開始は止めない
                resolve();
            };

        image.src = path;

    });
}

async function preloadGameImages(paths, concurrency) {
    let cursor = 0;
    async function worker() {
        while (cursor < paths.length) {
            const path = paths[cursor++];
            await preloadGameImage(path);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, paths.length) }, worker));
}

// =========================
// マップデータ読み込み
// =========================

function loadMapData() {

    return new Promise(function (resolve, reject) {

        // すでに読み込み済みなら何もしない
        if (
            Array.isArray(window.mapData) &&
            window.mapData.length > 0
        ) {

            resolve();

            return;

        }

        const script =
            document.createElement("script");

        script.src = "map.js?v=asset-type-ids-20261110";

        script.onload =
            function () {

                if (
                    !Array.isArray(window.mapData) ||
                    window.mapData.length === 0
                ) {

                    reject(
                        new Error(
                            "マップデータが空です。"
                        )
                    );

                    return;

                }

                resolve();

            };

        script.onerror =
            function () {

                reject(
                    new Error(
                        "map.js の読み込みに失敗しました。"
                    )
                );

            };

        document.head.appendChild(script);

    });

}

function renderGameTemplate(templateId, target) {
    const template = document.getElementById(templateId);
    if (!template || !target) {
        console.error(`画面テンプレートを読み込めません: ${templateId}`);
        return;
    }

    const titleBackdrop = target.querySelector(".title-screen");
    const isTitleSetup = ["playerSetupTemplate", "turnSelectTemplate"].includes(templateId);
    if (titleBackdrop && isTitleSetup) {
        let setup = titleBackdrop.querySelector(".title-screen__setup");
        if (!setup) {
            setup = document.createElement("div");
            setup.className = "title-screen__setup";
            const card = document.createElement("section");
            card.className = "title-screen__setup-card";
            const content = document.createElement("div");
            content.className = "title-screen__setup-content";
            const footer = document.createElement("footer");
            footer.className = "title-screen__setup-footer";
            const backButton = document.createElement("button");
            backButton.className = "title-screen__setup-back";
            backButton.type = "button";
            backButton.textContent = "戻る";
            backButton.addEventListener("click", function () {
                handleTitleSetupBack(titleBackdrop, target);
            });
            footer.appendChild(backButton);
            card.append(content, footer);
            setup.appendChild(card);
            titleBackdrop.appendChild(setup);
        }
        setup.firstElementChild.querySelector(".player-setup-confirm")?.remove();
        const setupContent = setup.firstElementChild.querySelector(".title-screen__setup-content");
        setupContent.replaceChildren(template.content.cloneNode(true));
        setupContent.classList.toggle("is-player-setup-content", templateId === "playerSetupTemplate");
        if (templateId === "playerSetupTemplate") {
            const heading = setupContent.querySelector("h2");
            const scrollArea = document.createElement("div");
            scrollArea.className = "player-setup-scroll";
            [...setupContent.children].forEach(child => {
                if (child !== heading) scrollArea.appendChild(child);
            });
            setupContent.appendChild(scrollArea);
        }
        titleBackdrop.classList.add("is-setup");
        titleBackdrop.dataset.setupStage = templateId === "playerSetupTemplate" ? "players" : "turns";
        if (templateId === "playerSetupTemplate") titleBackdrop.dataset.setupStep = "count";
        return;
    }

    target.replaceChildren(template.content.cloneNode(true));
}

function showGameLoadingScreen() {

    const gameContainer =
        document.querySelector(
            ".game-container"
        );

    if (!gameContainer) {
        return;
    }

    renderGameTemplate("gameLoadingTemplate", gameContainer);
}

function waitForGameAssets() {

    // A desktop-sized layout must not imply desktop-sized image allocations.
    // Phones use the existing baked overview and load detail tiles on demand.
    const constrained = window.mobileRuntimeTuning === true;
    const overview = window.MapOverviewRasterData;
    const mapAssets = constrained ? [overview?.mobileImage || overview?.image, overview?.lowDetailMobileImage] : [
        ...MapScene.assetUrls,
        ...(window.MapBackgroundRasterData?.tiles || []).map(tile => tile.image),
        overview?.image
    ];
    const assets = [...new Set([...mapAssets, ...GAME_LOADING_ASSETS].filter(Boolean))];
    const assetPromise = preloadGameImages(assets, constrained ? 2 : 8);

    const minimumTimePromise =
        new Promise(function (resolve) {

            setTimeout(
                resolve,
                GAME_LOADING_MIN_TIME
            );

        });

    return Promise.all([
        assetPromise,
        minimumTimePromise
    ]).then(function () {

        // ブラウザに読み込み画面を描画させてから切り替える
        return new Promise(function (resolve) {

            requestAnimationFrame(function () {
                requestAnimationFrame(resolve);
            });

        });

    });
}

// =========================
// ゲーム開始
// =========================

const startButton =
    document.getElementById("startButton");

const titleScreen = document.querySelector(".title-screen");
const titleModeMenu = document.getElementById("titleModeMenu");
const titleSetupDraft = { playerCount: null, names: [], characterIds: [], turns: 30 };
let draggedPlayerSetupRow = null;

function captureTitlePlayerDraft() {
    const names = [...document.querySelectorAll("#player-names .player-name")];
    const characters = [...document.querySelectorAll("#player-names .player-character-button")];
    if (names.length) {
        titleSetupDraft.names = names.map((input, index) => input.value || `プレイヤー${index + 1}`);
        titleSetupDraft.characterIds = characters.map(button => Number(button.dataset.characterId || 1));
    }
}

function renderTitlePlayerSetup(restoreNames) {
    if (!titleScreen || !startButton) return;
    titleScreen.dataset.modeChosen = "local";
    startButton.click();
    if (restoreNames) {
        document.querySelector(`.player-count[data-count="${titleSetupDraft.playerCount}"]`)?.click();
    }
}

function handleTitleSetupBack(titleBackdrop, target) {
    const stage = titleBackdrop.dataset.setupStage;
    const step = titleBackdrop.dataset.setupStep;
    if (stage === "turns") {
        renderTitlePlayerSetup(true);
        return;
    }
    if (stage === "players" && step === "names") {
        captureTitlePlayerDraft();
        renderTitlePlayerSetup(false);
        return;
    }

    titleBackdrop.querySelector(".title-screen__setup")?.remove();
    titleBackdrop.classList.remove("is-setup");
    delete titleBackdrop.dataset.setupStage;
    delete titleBackdrop.dataset.setupStep;
    delete titleBackdrop.dataset.modeChosen;
    if (titleModeMenu) titleModeMenu.hidden = false;
    document.getElementById("localGameButton")?.focus();
}

function updateSetupPlayTimeEstimate(playerCount, turns) {
    const output = document.getElementById("setupPlayTimeEstimate");
    if (!output) return;
    const validTurns = Number.isInteger(turns) && turns >= 1 && turns <= 300;
    if (!validTurns) {
        output.textContent = "予測プレイ時間：ターン数を入力してください";
        return;
    }
    const totalMinutes = Math.ceil((180 + playerCount * turns * 30 + Math.floor(turns / 6) * 60) / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const duration = hours && minutes ? `${hours}時間${minutes}分` : hours ? `${hours}時間` : `${minutes}分`;
    output.textContent = `予測プレイ時間：約${duration}`;
}

function refreshPlayerSetupRowOrder(playerNames) {
    const rows = [...playerNames.querySelectorAll(".player-name-input")];
    rows.forEach((row, index) => {
        const label = row.querySelector(".player-name-label");
        const characterButton = row.querySelector(".player-character-button");
        const nameInput = row.querySelector(".player-name");
        if (label) label.textContent = `プレイヤー${index + 1}`;
        if (characterButton) characterButton.dataset.playerIndex = String(index);
        if (nameInput) nameInput.setAttribute("aria-label", `プレイヤー${index + 1}の名前`);
    });
    captureTitlePlayerDraft();
}

function bindPlayerSetupRowReordering(playerNames, row) {
    const handles = [row.querySelector(".player-character-button"), row.querySelector(".player-name")].filter(Boolean);
    handles.forEach(handle => {
        handle.draggable = true;
        handle.addEventListener("dragstart", event => {
            draggedPlayerSetupRow = row;
            row.classList.add("is-dragging");
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", "player-order");
            }
        });
        handle.addEventListener("dragend", () => {
            draggedPlayerSetupRow = null;
            playerNames.querySelectorAll(".player-name-input").forEach(item => {
                item.classList.remove("is-dragging", "is-drop-target");
            });
        });
    });

    row.addEventListener("dragover", event => {
        if (!draggedPlayerSetupRow || draggedPlayerSetupRow === row) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        row.classList.add("is-drop-target");
    });
    row.addEventListener("drop", event => {
        event.preventDefault();
        const rows = [...playerNames.querySelectorAll(".player-name-input")];
        const from = rows.indexOf(draggedPlayerSetupRow);
        const to = rows.indexOf(row);
        if (from < 0 || to < 0 || from === to) return;
        [rows[from], rows[to]] = [rows[to], rows[from]];
        const confirmRow = playerNames.querySelector(".player-confirm-row");
        rows.forEach(item => playerNames.insertBefore(item, confirmRow));
        refreshPlayerSetupRowOrder(playerNames);
        row.classList.remove("is-drop-target");
    });
}

document.getElementById("localGameButton")?.addEventListener("click", function () {
    if (titleScreen) titleScreen.dataset.modeChosen = "local";
    startButton.click();
});

document.getElementById("backToTitleButton")?.addEventListener("click", function () {
    if (titleScreen) delete titleScreen.dataset.modeChosen;
    if (titleModeMenu) titleModeMenu.hidden = true;
    startButton.hidden = false;
    startButton.focus();
});

startButton.addEventListener(
    "click",
    function () {

        if (titleScreen && titleModeMenu && titleScreen.dataset.modeChosen !== "local") {
            startButton.hidden = true;
            titleModeMenu.hidden = false;
            document.getElementById("localGameButton")?.focus();
            return;
        }

        renderGameTemplate("playerSetupTemplate", document.querySelector(".game-container"));

        const playerCountButtons =
            document.querySelectorAll(
                ".player-count"
            );

        playerCountButtons.forEach(button => {
            button.classList.toggle("is-selected", Number(button.dataset.count) === titleSetupDraft.playerCount);
        });


        playerCountButtons.forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        const count =
                            Number(
                                button.dataset.count
                            );

                        captureTitlePlayerDraft();
                        titleSetupDraft.playerCount = count;
                        titleScreen.dataset.setupStep = "names";
                        playerCountButtons.forEach(item => {
                            item.classList.toggle("is-selected", Number(item.dataset.count) === count);
                        });


                        const playerNames =
                            document.getElementById(
                                "player-names"
                            );


                        playerNames.replaceChildren();

                        const headingTemplate =
                            document.getElementById("playerNamesHeadingTemplate");
                        const playerRowTemplate =
                            document.getElementById("playerNameInputTemplate");
                        const confirmTemplate =
                            document.getElementById("confirmPlayersButtonTemplate");

                        const heading =
                            headingTemplate.content.firstElementChild.cloneNode(true);
                        heading.textContent =
                            "キャラの選択と名前の入力をしてください。";
                        playerNames.appendChild(heading);

                        Array.from({ length: count }, function (_, index) {
                            const row =
                                playerRowTemplate.content.firstElementChild.cloneNode(true);
                            const label = row.querySelector(".player-name-label");
                            const characterButton =
                                row.querySelector(".player-character-button");
                            const preview =
                                row.querySelector(".player-character-preview");
                            const characterId = Number(titleSetupDraft.characterIds[index] || 1);
                            const nameInput = row.querySelector(".player-name");

                            label.textContent = `プレイヤー${index + 1}`;
                            characterButton.dataset.playerIndex = String(index);
                            characterButton.dataset.characterId = String(characterId);
                            preview.src = PLAYER_CONTENTS[characterId]?.icon || PLAYER_CONTENTS[1].icon;
                            nameInput.value = titleSetupDraft.names[index] || "";
                            nameInput.setAttribute("aria-label", `プレイヤー${index + 1}の名前`);
                            nameInput.addEventListener("input", captureTitlePlayerDraft);
                            playerNames.appendChild(row);
                            bindPlayerSetupRowReordering(playerNames, row);
                        });

                        const confirmRow = document.createElement("div");
                        confirmRow.className = "player-confirm-row";
                        const orderInstruction = document.createElement("p");
                        orderInstruction.className = "player-order-instruction";
                        orderInstruction.textContent = "ドラッグしてプレイヤーの順番を入れ替え";
                        confirmRow.appendChild(orderInstruction);
                        playerNames.appendChild(confirmRow);

                        const setupFooter = titleScreen.querySelector(".title-screen__setup-footer");
                        setupFooter.querySelector(".player-setup-confirm")?.remove();
                        const confirmAction = document.createElement("div");
                        confirmAction.className = "player-setup-confirm";
                        confirmAction.appendChild(confirmTemplate.content.firstElementChild.cloneNode(true));
                        setupFooter.appendChild(confirmAction);



 // =========================
// キャラクター選択ボタン
// =========================

const characterButtons =
    document.querySelectorAll(
        ".player-character-button"
    );


characterButtons.forEach(
    function (button) {

        button.addEventListener(
            "click",
            function () {

                // キャラクター選択ウィンドウ
                const characterWindowTemplate =
                    document.getElementById("playerCharacterWindowTemplate");
                const characterOptionTemplate =
                    document.getElementById("playerCharacterOptionTemplate");
                const characterWindow =
                    characterWindowTemplate.content.firstElementChild.cloneNode(true);
                const characterList =
                    characterWindow.querySelector(".player-character-list");

                Object.entries(PLAYER_CONTENTS)
                    .filter(function ([, character]) { return character.selectable !== false; })
                    .forEach(function ([id, character]) {
                    const option =
                        characterOptionTemplate.content.firstElementChild.cloneNode(true);
                    const image = option.querySelector("img");
                    const name = option.querySelector("span");

                    option.dataset.characterId = id;
                    image.src = character.icon;
                    image.alt = character.name;
                    name.textContent = character.name;
                    characterList.appendChild(option);
                });

                document.body.appendChild(
                    characterWindow
                );


                // =========================
                // キャラクター選択
                // =========================

                const options =
                    characterWindow.querySelectorAll(
                        ".player-character-option"
                    );


                options.forEach(
                    function (option) {

                        option.addEventListener(
                            "click",
                            function () {

                                const characterId =
                                    Number(
                                        option.dataset.characterId
                                    );

                                const character =
                                    PLAYER_CONTENTS[
                                        characterId
                                    ];

                                if (!character || character.selectable === false) return;


                                // 選択したアイコンを表示
                                const preview =
                                    button.querySelector(
                                        ".player-character-preview"
                                    );

                                preview.src =
                                    character.icon;


                                // 選択したキャラクターIDを保存
                                button.dataset.characterId =
                                    characterId;
                                titleSetupDraft.characterIds[Number(button.dataset.playerIndex)] = characterId;


                                // ウィンドウを閉じる
                                characterWindow.remove();

                            }
                        );

                    }
                );


                // =========================
                // ウィンドウ外をクリック
                // =========================

                characterWindow.addEventListener(
                    "click",
                    function (event) {

                        if (
                            event.target ===
                            characterWindow
                        ) {

                            characterWindow.remove();

                        }

                    }
                );

            }
        );

    }
);


                        const confirmButton =
                            document.getElementById(
                                "confirmPlayers"
                            );


                        confirmButton.addEventListener(
                            "click",
                            function () {

                                captureTitlePlayerDraft();

                                const nameInputs =
                                    document.querySelectorAll(
                                        ".player-name"
                                    );


                                const players = [];
                                window.players = players;

                                nameInputs.forEach(
                                    function (
                                        input,
                                        index
                                    ) {

                           const name =
                               input.value.trim() ||
                              `プレイヤー${index + 1}`;

  players.push({
    name: name,
    money: 100000,
    magicPower: 1000,
    bossDamage: 0,
    position: 139,   
    characterId:
    Number(
        document.querySelectorAll(
            ".player-character-button"
        )[index].dataset.characterId || 1
    ),
    inventory: [],
    assets: [],
    magic: [1],
    undergroundForemanSetCompleted: false,

    // バイト関連
    jobTurnsRemaining: 0,
    jobReward: 0
});

// =========================
// 初期アイテム
// =========================

players[index].inventory = [1];


// =========================
// 初期パッシブアイテム
// =========================

addItems(
    players[index], 
    [],
    1
);


                                    }
                                );


                                showTurnSelectScreen(
                                    players
                                );

                            }
                        );

                    }
                );

            }
        );

    }
);


/// =========================
// プレイターン数選択
// =========================

function showTurnSelectScreen(
    players
) {

    const gameContainer =
        document.querySelector(
            ".game-container"
        );


    renderGameTemplate("turnSelectTemplate", gameContainer);


    // =========================
    // ターン数入力
    // =========================

    const turnCountInput =
        document.getElementById(
            "turnCountInput"
        );

    turnCountInput.value = String(titleSetupDraft.turns);
    const refreshSetupTime = function () {
        const turns = Number(turnCountInput.value);
        titleSetupDraft.turns = turns;
        updateSetupPlayTimeEstimate(players.length, turns);
    };
    turnCountInput.addEventListener("input", refreshSetupTime);
    refreshSetupTime();


    // =========================
    // 開始ボタン
    // =========================

    const confirmTurnButton =
        document.getElementById(
            "confirmTurnButton"
        );


    confirmTurnButton.addEventListener(
        "click",
        function () {

            let maxTurns =
                Number(
                    turnCountInput.value
                );


            // =========================
            // 1～300の範囲に調整
            // =========================

            if (
                maxTurns < 1
            ) {

                maxTurns = 1;

            }


            if (
                maxTurns > 300
            ) {

                maxTurns = 300;

            }


            // =========================
            // 小数を防ぐ
            // =========================

            maxTurns =
                Math.floor(
                    maxTurns
                );

            titleSetupDraft.turns = maxTurns;


// =========================
// ゲーム開始
// =========================

gameStarted = true;
window.OfflineDividends.reset(players);
const lightweightOpening = window.mobileOpeningLightweight === true && (window.mobileRuntimeTuning === true || window.matchMedia?.('(pointer: coarse)').matches);


// =========================
// 読み込み画面を表示
// =========================

showGameLoadingScreen();


// =========================
// マップデータを読み込む
// =========================

loadMapData()

    .then(function () {

        // =========================
        // マップデータ読み込み確認
        // =========================

        if (
            !Array.isArray(window.mapData) ||
            window.mapData.length === 0
        ) {

            throw new Error(
                "マップデータを確認できませんでした。"
            );

        }


        // =========================
        // 最初のボスを決定
        // =========================

        return selectBossSquare();

    })
    .then(function () {

        // =========================
        // 開始音
        // =========================

        startSound.currentTime = 0;
        (window.GameSE ? window.GameSE.playLocal(startSound) : startSound.play());


        // =========================
        // マップ画像などを読み込む
        // =========================

        return waitForGameAssets();

    })

    .then(function () {
        return synchronizeInitialGameState(maxTurns);
    })

    .then(function () {
        // Map assets are ready before the game screen and opening scene are shown.
        // Keep setup on the phone's native portrait layout, then scale the
        // complete playable UI from the desktop layout on mobile devices.
        window.GameViewport?.activate();
        window.gameOpeningComplete = false;
        showGameScreen(players, maxTurns);
        const isOnline = Boolean(window.onlineGame && window.onlineGame.isOnline);
        const square = window.mapData.find(function (entry) { return Number(entry.id) === Number(currentBossSquareId); });
        const canAdvance = function () {
            if (!isOnline) return true;
            const sync = window.onlineGame?.sync?.state;
            const active = sync?.players?.[sync.activePlayerIndex];
            const localId = window.onlineGame.playerId || window.onlineGame.socket?.id;
            return Boolean(active && localId && active.id === localId);
        };
        return window.BossOpening.show({ boss:BOSS_CONTENTS[currentBossId], square,
            squares:window.mapData, regionData:window.MapRegionData, overview:window.MapOverviewRasterData,
            lightweight:lightweightOpening,
            syncKey:isOnline ? `start:${currentBossId}:${currentBossSquareId}` : '', canAdvance,
            onComplete:function () {
                // 開始案内の間はBGMを流さず、最初のプレイヤー操作へ移る時点で開始する。
                window.gameOpeningComplete = true;
                const activeIndex = Number(window.onlineGame?.sync?.state?.activePlayerIndex ?? 0);
                const activePlayer = players[activeIndex] || players[0];
                window.centerCurrentPlayerOnMap?.("auto");
                window.MapAreaAudio?.updateForPlayer(activePlayer, { immediate:true });
                if (!window.MapAreaAudio) setupAdventureBGM();
                if (window.GameSE) window.GameSE.play('playerSwitch');
                else playPlayerSwitchingSound();
                window.startPonziTurn?.(activePlayer);
            } });
    })
    .catch(function (error) {

        console.error(
            "ゲーム開始時の読み込みに失敗しました。",
            error
        );


        alert(
            "ゲームの読み込みに失敗しました。\n" +
            "ページを再読み込みして、もう一度お試しください。"
        );

    });
            
        }
    );

}


// =========================
// ゲーム画面
// =========================

function showGameScreen(
    players,
    maxTurns
) {

    // A fresh game starts with the canonical magic ID order. Drag changes are
    // kept only for the current game and must not leak into the next one.
    window.resetBattleMagicOrders?.(players);

    const gameContainer =
        document.querySelector(
            ".game-container"
        );


    renderGameTemplate("mainGameTemplate", gameContainer);
    window.GameActionInput.reset();
    window.GameActionInput.watchPanels();
    activeKnockbackPresentation = null;
    const bossDestinationIcon = gameContainer.querySelector(".hud-destination-icon");
    if (bossDestinationIcon) bossDestinationIcon.src = BOSS_MAP_ICON_PATH;


    // =========================
    // ターン管理
    // =========================

    let currentPlayer = 0;
    let avatarCameraFocus;
    let remainingSteps = 0;
    let currentTurn = 1;
    let offlineGuidebook = null;
    let offlineGuidebookHistory = [];
    let offlineSpecialReward = null;
    let offlineImmunityExpiry = null;
    let offlineImmunityReady = null;
    let guidebookExpiryFocus = null;
    let specialRewardFocus = null;
    let guidebookDraft = null;
    const guidebookTurnFocusViews = ['offers', 'last-chance', 'expired'];
    let guidebookTurnFocus = null;
    let guidebookWithdrawalsSeen = 0;
    window.GuidebookUI.reset();
    const guidebookRequestButton = document.getElementById('guidebookRequestButton');
    const offlineGuidebookState = () => {
        if (offlineGuidebookHistory.length !== players.length) offlineGuidebookHistory = players.map(() => false);
        return {
            players, currentTurn, activePlayerIndex: currentPlayer, bossDefeatedCount,
            marketOutcomeAt18: window.OfflineDividends.marketOutcomeAt18?.() ?? null,
            marketEventTurn: window.OfflineDividends.marketEventTurn?.() ?? null,
            guidebook: offlineGuidebook, guidebookHistory: offlineGuidebookHistory,
            specialReward: offlineSpecialReward
        };
    };
    let activeHatatakiFlow = null;
    function hatatakiView(flow, readOnly = false) {
        const target = players[Number(flow?.targetIndex)];
        const actor = players[Number(flow?.actorIndex)];
        if (!target || !actor) return null;
        return {
            eventId:flow.eventId, actorIndex:Number(flow.actorIndex), targetIndex:Number(flow.targetIndex),
            actorIcon:getPlayerCharacterIcon(Number(flow.actorIndex)), targetIcon:getPlayerCharacterIcon(Number(flow.targetIndex)),
            targetName:target.name, destroyedItems:Array.isArray(flow.destroyedItems) ? flow.destroyedItems : [],
            status:flow.status || 'attack', evaded:Boolean(flow.evaded), busy:Boolean(flow.busy), readOnly,
            notice:flow.notice ? {
                icon:getPlayerCharacterIcon(flow.notice.subjectIndex),
                text:flow.notice.amount == null ? '攻略本が破壊されたため、売買イベントを中止しました。'
                    : `${players[flow.notice.subjectIndex]?.name || 'プレイヤー'}に ${formatG(flow.notice.amount)}G を返金しました。`
            } : null
        };
    }
    function renderHatatakiFlow(flow = activeHatatakiFlow) {
        const view = hatatakiView(flow, false);
        if (!view) return;
        window.HatatakiHakenUI?.render(view, {
            onAttack:() => actHatatakiFlow('attack'),
            onNext:() => actHatatakiFlow('next'),
            onEnd:() => actHatatakiFlow('end'),
            onNotice:() => actHatatakiFlow('acknowledge')
        });
    }
    function applyHatatakiView(flow, view) {
        if (!flow || !view) return;
        flow.targetIndex = Number(view.targetIndex);
        flow.destroyedItems = Array.isArray(view.destroyedItems) ? view.destroyedItems.map(String) : [];
        flow.status = view.status;
        flow.evaded = view.evaded === true;
        flow.notice = view.notice || null;
        flow.busy = false;
        renderHatatakiFlow(flow);
    }
    function playHatatakiSound(soundId, requestId) {
        const flow = activeHatatakiFlow;
        if (!flow) return;
        flow.playedSoundIds ||= new Set();
        const soundKey = String(requestId || `${Date.now()}`);
        if (flow.playedSoundIds.has(soundKey)) return;
        flow.playedSoundIds.add(soundKey);
        window.GameSE?.play?.(soundId, { eventId:`hatataki:${flow.eventId}:${soundKey}` })
            .catch(error => console.warn('[SE] 叩き派遣:', error));
    }
    function finishHatatakiFlow(flow, cancellation) {
        if (activeHatatakiFlow === flow) activeHatatakiFlow = null;
        window.HatatakiHakenUI?.hide();
        const actor = players[Number(flow.actorIndex)];
        if (!actor) return;
        if (!cancellation) { finishTurn(actor); return; }
        const refunds = Array.isArray(cancellation.refunds) ? cancellation.refunds : [];
        showEventPopup('攻略本', '攻略本が破壊されたため、売買イベントを中止しました。', function () {
            const showRefund = index => {
                const refund = refunds[index];
                if (!refund) { finishTurn(actor); return; }
                const message = document.createElement('span');
                message.textContent = `${players[refund.buyer]?.name || 'プレイヤー'}に ${formatG(refund.amount)}G を返金しました。`;
                showEventPopup('攻略本', message.innerHTML, () => showRefund(index + 1),
                    { subjectIndex:refund.buyer, sound:'moneyDisplay', hatatakiFrame:true });
            };
            showRefund(0);
        }, { subjectIndex:cancellation.ownerIndex, hatatakiFrame:true });
    }
    async function actHatatakiFlow(action) {
        const flow = activeHatatakiFlow;
        if (!flow || flow.busy || !ApprovedCommerce.canAct(players[Number(flow.actorIndex)])) return;
        flow.busy = true;
        renderHatatakiFlow(flow);
        if (flow.online) {
            const requestId = createOnlineSyncEventId(`hatataki-${action}`);
            try {
                const response = await window.onlineGame.sync.actHatataki(action, flow.eventId, requestId, flow.notice?.index);
                if (activeHatatakiFlow !== flow) return;
                if (!response?.ok || !response.state) throw new Error(response?.error || '叩き派遣の結果を確認できませんでした。');
                applyOnlineCanonicalState(response.state, `hatataki-${action}`, true);
                if (response.ended) { renderHatatakiRemote({ action:'close', eventId:flow.eventId }); return; }
                applyHatatakiView(flow, response.view);
            } catch (error) {
                if (activeHatatakiFlow !== flow) return;
                flow.busy = false;
                renderHatatakiFlow(flow);
                console.error('[online] 叩き派遣を進められません:', error);
                window.onlineGame.sync.recover(true);
            }
            return;
        }
        if (action === 'attack') {
            const targetResult = flow.offlineTargets.find(result => players.indexOf(result.player) === Number(flow.targetIndex));
            const result = destroyHatatakiHakenItem(targetResult);
            playHatatakiSound(result.evaded ? 'hatatakiEvade' : 'dispatch', `local-${flow.destroyedItems.length}-${flow.targetIndex}`);
            if (!result.evaded) {
                flow.destroyedItems.push(result.itemName);
                updatePlayerStatusUI(targetResult.player);
                if (Number(result.itemId) === GuidebookRules.ITEM_ID) {
                    flow.guidebookCancellation = GuidebookRules.clearIfConfiscated(offlineGuidebookState()) || flow.guidebookCancellation;
                    if (flow.guidebookCancellation?.refunds.length) players.forEach(updatePlayerStatusUI);
                }
            }
            flow.evaded = Boolean(result.evaded);
            const position = flow.offlineTargets.indexOf(targetResult);
            flow.status = result.done ? (position === flow.offlineTargets.length - 1 ? 'end' : 'advance') : 'attack';
            flow.busy = false;
            renderHatatakiFlow(flow);
            return;
        }
        if (action === 'next') {
            const next = flow.offlineTargets.find((result, index) => index === flow.targetPosition + 1);
            if (!next) { flow.busy = false; renderHatatakiFlow(flow); return; }
            flow.targetPosition++;
            flow.targetIndex = players.indexOf(next.player);
            flow.destroyedItems = [];
            flow.evaded = false;
            flow.status = 'attack';
            flow.busy = false;
            renderHatatakiFlow(flow);
            return;
        }
        if (action === 'end') finishHatatakiFlow(flow, flow.guidebookCancellation);
    }
    function renderHatatakiRemote(data) {
        if (!data) return;
        if (data.action === 'close' || data.visible === false) {
            if (!data.eventId || activeHatatakiFlow?.eventId === data.eventId) activeHatatakiFlow = null;
            window.HatatakiHakenUI?.hide();
            return;
        }
        if (!Number.isInteger(Number(data.actorIndex)) || !players[Number(data.targetIndex)]) return;
        const intro = document.getElementById('eventPopup');
        if (intro?.classList.contains('hatataki-announcement')) {
            intro.style.display = 'none';
            window.CommonAnnouncements?.render(intro, null);
        }
        const actorIndex = Number(data.actorIndex), localId = String(window.onlineGame?.playerId || window.onlineGame?.socket?.id || '');
        const isActor = isLocalOnlineTurn() && String(players[actorIndex]?.id || '') === localId;
        if (isActor) {
            if (!activeHatatakiFlow || activeHatatakiFlow.eventId !== data.eventId) {
                activeHatatakiFlow = { eventId:data.eventId, actorIndex, targetIndex:Number(data.targetIndex), online:true, actor:players[actorIndex], destroyedItems:[], status:'attack' };
            }
            applyHatatakiView(activeHatatakiFlow, data);
            return;
        }
        const view = hatatakiView({ ...data, eventId:data.eventId }, true);
        if (view) window.HatatakiHakenUI?.render(view);
    }
    window.useHatatakiHakenItem = async function (player) {
        const onlineSync = window.onlineGame?.isOnline ? window.onlineGame.sync : null;
        const eventId = createOnlineSyncEventId('hatataki-haken');
        if (onlineSync) {
            try {
                const response = await onlineSync.actHatataki('start', eventId, createOnlineSyncEventId('hatataki-start'));
                if (!response?.ok || !response.state || !response.view) throw new Error(response?.error || 'サーバーで使用結果を確認できませんでした。');
                applyOnlineCanonicalState(response.state, 'hatataki-start', true);
                renderHatatakiRemote(response.view);
            } catch (error) {
                console.error('[online] 叩き派遣を開始できません:', error);
                await onlineSync.recover(true);
                if (!activeHatatakiFlow) showEventPopup('叩き派遣を使用できません', error.message,
                    () => showInventoryPopup(player), { hatatakiFrame:true });
            }
            return;
        }
        const offlineTargets = useHatatakiHaken(player, players);
        if (!offlineTargets) { showInventoryPopup(player); return; }
        activeHatatakiFlow = {
            eventId, actorIndex:players.indexOf(player), targetIndex:players.indexOf(offlineTargets[0].player),
            targetPosition:0, online:false, offlineTargets, destroyedItems:[],
            status:'attack', evaded:false, busy:false, guidebookCancellation:null
        };
        renderHatatakiFlow(activeHatatakiFlow);
    };
    const guidebookState = () => window.onlineGame?.isOnline ? window.onlineGame.sync?.state : offlineGuidebookState();
    const guidebookTurnKey = state => state.currentTurn + ':' + state.activePlayerIndex;
    window.canReceiveGuidebook = () => GuidebookRules.canReceive(offlineGuidebookState());
    window.claimOfflineGuidebook = index => {
        const state = offlineGuidebookState();
        if (!GuidebookRules.claim(state, index)) return false;
        offlineGuidebook = state.guidebook;
        return true;
    };

    function renderGuidebook(state) {
        if (!state) return;
        const book = state.guidebook;
        const online = Boolean(window.onlineGame?.isOnline);
        if (!online) GuidebookRules.withdrawUnfunded(state);
        const active = Number(state.activePlayerIndex);
        const control = !online || (isLocalOnlineTurn() && active === currentPlayer);
        const turnKey = guidebookTurnKey(state);
        const inGame = !online || state.matchPhase === 'playing';
        const specialReward = state.specialReward;
        const expiryPending = inGame && (online ? state.disadvantageImmunityExpiry : offlineImmunityExpiry) === turnKey;
        const giftIsActive = inGame && !expiryPending && window.SpecialRewardRules.pending(specialReward);
        if (giftIsActive) {
            if (specialRewardFocus?.turnKey !== turnKey) {
                const focus = specialRewardFocus = { turnKey, ready: false };
                const instant = window.TurnHandoff?.isBlack() || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                centerPlayerOnMap(active, instant ? 'auto' : 'smooth', () => {
                    if (specialRewardFocus !== focus) return;
                    focus.ready = true;
                    renderGuidebook(guidebookState());
                });
            }
            if (!specialRewardFocus.ready) return;
            window.GuidebookUI.renderSpecialReward(specialReward, {
                players, active, icon: getPlayerCharacterIcon, control, turnKey,
                async dispatchGift(action, fields) {
                    if (online) {
                        const response = await window.onlineGame.sync.actSpecialReward({ action, turnKey, ...fields });
                        if (!response?.ok) throw new Error(response?.error || '特別アイテムを受け取れませんでした。');
                    } else {
                        const local = offlineGuidebookState();
                        if (!window.SpecialRewardRules.act(local, action, fields)) throw new Error('特別アイテムの状態を確認してください。');
                        offlineSpecialReward = local.specialReward;
                        renderGuidebook(local);
                        if (action === 'claim') window.setTimeout(() => {
                            if (!window.SpecialRewardRules.completeClaim(offlineGuidebookState())) return;
                            renderTurn();
                            renderPlayers();
                            if (offlineSpecialReward.status === 'complete') beginPlayerTurn(players[currentPlayer]);
                        }, window.SpecialRewardRules.CLAIM_DURATION_MS);
                    }
                }
            });
            return;
        }
        specialRewardFocus = null;
        window.GuidebookUI.renderSpecialReward(inGame && !expiryPending ? specialReward : null, { players, active, icon: getPlayerCharacterIcon, control, turnKey });
        if (!control || !inGame || guidebookDraft?.turnKey !== turnKey || book?.view) guidebookDraft = null;
        guidebookRequestButton.hidden = !inGame || !control || expiryPending || !GuidebookRules.canApply(state);
        guidebookRequestButton.disabled = guidebookRequestButton.hidden || Boolean(guidebookDraft)
            || state.diceResult != null || Boolean(diceMovementState.active) || Boolean(window.onlineRoundFlowPending)
            || Boolean(state.undergroundFlow || state.fukubukuro || state.bridgeMugging || window.PonziRules?.pending(state));
        const awaitingWallet = expiryPending && (online ? state.disadvantageImmunityWallet : offlineImmunityReady !== turnKey);
        const view = awaitingWallet ? null : expiryPending ? { kind: 'immunity-expired' } : inGame ? book?.view || guidebookDraft : null;
        const focusPlayer = guidebookTurnFocusViews.includes(view?.kind) ? active : null;
        if (focusPlayer == null) guidebookTurnFocus = null;
        else {
            if (guidebookTurnFocus?.turnKey !== turnKey || guidebookTurnFocus.kind !== view.kind) {
                const focus = guidebookTurnFocus = { turnKey, kind: view.kind, ready: false };
                refreshShortestPathToBoss();
                const endingTurn = view.kind === 'expired';
                const instant = endingTurn || window.TurnHandoff?.isBlack() || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                // Expiration is announced during turn-end processing. Use an
                // immediate, standards-based scroll here so AN02 is not shown
                // while the camera is still on the player who just acted.
                centerPlayerOnMap(focusPlayer, instant ? 'auto' : 'smooth', () => {
                    if (guidebookTurnFocus !== focus) return;
                    focus.ready = true;
                    renderGuidebook(guidebookState());
                }, endingTurn);
            }
            if (!guidebookTurnFocus.ready) return;
        }
        if (expiryPending && !awaitingWallet) {
            if (!guidebookExpiryFocus || guidebookExpiryFocus.turnKey !== turnKey) {
                const focus = guidebookExpiryFocus = { turnKey, ready:false };
                const instant = window.TurnHandoff?.isBlack() || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                centerPlayerOnMap(active, instant ? 'instant' : 'smooth', () => {
                    if (guidebookExpiryFocus !== focus) return;
                    focus.ready = true;
                    renderGuidebook(guidebookState());
                });
            }
            if (!guidebookExpiryFocus.ready) return;
        } else guidebookExpiryFocus = null;
        window.GuidebookUI.render(view, {
            players, active, book, icon: getPlayerCharacterIcon, control, online, turnKey,
            marketOutcomeAt18: online ? state.marketOutcomeAt18 : window.OfflineDividends.marketOutcomeAt18?.(),
            marketEventTurn: online ? state.marketEventTurn : window.OfflineDividends.marketEventTurn?.(),
            back() {
                guidebookDraft = null;
                renderGuidebook(guidebookState());
                showInventoryPopup(players[currentPlayer]);
            },
            async dispatch(action, fields) {
                if (expiryPending) {
                    if (online) {
                        const response = await window.onlineGame.sync.acknowledgeImmunityExpiry(turnKey);
                        if (!response?.ok) throw new Error(response?.error || '終了案内を確認できませんでした。');
                    } else {
                        offlineImmunityExpiry = null;
                        offlineImmunityReady = null;
                        renderGuidebook(guidebookState());
                        beginPlayerTurn(players[currentPlayer]);
                    }
                    return;
                }
                await actOnGuidebook(action, fields, turnKey);
            }
        });
        announceGuidebookWithdrawals(book);
    }
    function announceGuidebookWithdrawals(book) {
        const withdrawals = book?.withdrawals;
        if (!withdrawals || withdrawals.length <= guidebookWithdrawalsSeen) return;
        const unseen = withdrawals.slice(guidebookWithdrawalsSeen);
        guidebookWithdrawalsSeen = withdrawals.length;
        window.GuidebookUI.announceWithdrawals(unseen, players, getPlayerCharacterIcon);
    }
    async function actOnGuidebook(action, fields, turnKey) {
        if (window.onlineGame?.isOnline) {
            const reply = await window.onlineGame.sync.actGuidebook({ action, turnKey, ...fields });
            if (!reply?.ok) throw new Error(reply?.error || '攻略本の操作を確定できませんでした。');
            return;
        }
        const local = offlineGuidebookState();
        const previousView = local.guidebook?.view?.kind;
        if (!GuidebookRules.act(local, action, fields)) throw new Error('攻略本の状態または申請額を確認してください。');
        guidebookDraft = null;
        renderTurn();
        renderPlayers();
        if (previousView === 'expired') finishTurn(players[currentPlayer], true);
        else if (!local.guidebook.view && ['last-chance', 'rejected', 'sold'].includes(previousView)) beginPlayerTurn(players[currentPlayer]);
        else if (!local.guidebook.view && previousView === 'applied') refreshShortestPathToBoss();
    }
    let openingGuidebookOffer = false;
    guidebookRequestButton.onclick = async () => {
        const state = guidebookState();
        if (openingGuidebookOffer || !state || guidebookRequestButton.disabled || !GuidebookRules.canApply(state)) return;
        const action = window.GameActionInput.beginMenuAction('guidebook-request', guidebookTurnKey(state));
        if (!action) return;
        openingGuidebookOffer = true;
        try { await actOnGuidebook('offer', {}, guidebookTurnKey(state)); }
        catch (error) { showEventPopup('購入申請', error.message, () => {}, { sync: false }); }
        finally { openingGuidebookOffer = false; action.finish(); }
    };
    window.chooseGuidebook = player => {
        const state = guidebookState();
        if (!state?.guidebook || state.guidebook.view || state.guidebook.ownerIndex !== currentPlayer || player !== players[currentPlayer]) return;
        guidebookDraft = { kind: 'choice', turnKey: guidebookTurnKey(state) };
        syncOnlineScreenView('', player, 'close');
        renderGuidebook(state);
    };
    window.offlineBridgeMuggingPending = null;
    window.bridgeCollapseState = null;
    window.bridgeCollapseVisualState = null;
    window.bridgeCollapseRecoveryPending = null;
    window.bridgeCollapseRecoveryShownEventIds = new Set();
    window.nextDiceAllSixPlayerIds = new Set();
    function diceEffectPlayerKey(player) {
        const index = players.indexOf(player);
        return String(player?.id ?? `offline:${index}`);
    }
    function hasNextDiceAllSix(player) {
        return window.nextDiceAllSixPlayerIds instanceof Set
            && window.nextDiceAllSixPlayerIds.has(diceEffectPlayerKey(player));
    }
    function consumeNextDiceAllSix(player) {
        if (!hasNextDiceAllSix(player)) return false;
        window.nextDiceAllSixPlayerIds.delete(diceEffectPlayerKey(player));
        return true;
    }
    const bridgeCollapsePresented = new Set();

    async function presentBridgeCollapse(state, eventId) {
        const collapse = state?.bridgeCollapse;
        const key = String(eventId || collapse?.eventId || '');
        if (!collapse || !key || bridgeCollapsePresented.has(key)) return;
        const online = window.onlineGame?.isOnline;
        const localOwner = !online || String(collapse.ownerId) === String(window.onlineGame.playerId || window.onlineGame.socket?.id);
        const turnKey = `${currentTurn}:${currentPlayer}`;
        const action = localOwner && collapse.useTurnKey === turnKey
            ? window.GameActionInput.get('bridge') || window.GameActionInput.begin('bridge', turnKey) : null;
        bridgeCollapsePresented.add(key);
        if (bridgeCollapsePresented.size > 50) bridgeCollapsePresented.delete(bridgeCollapsePresented.values().next().value);

        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const animation = new Promise(resolve => {
            if (reducedMotion) { resolve(); return; }
            document.body.classList.add('bridge-collapse-shake');
            setTimeout(() => { document.body.classList.remove('bridge-collapse-shake'); resolve(); }, 3840);
        });
        const sound = window.GameSE
            ? window.GameSE.playAndWait('bridgeCollapse').catch(error => console.warn('[橋崩し] SEを再生できません:', error))
            : new Audio('sounds/橋崩し.mp3').play().catch(error => console.warn('[橋崩し] SEを再生できません:', error));
        await Promise.all([animation, sound]);

        window.bridgeCollapseVisualState = window.bridgeCollapseState || collapse;
        renderMap();
        window.GamePanels?.refresh();

        if (!action?.isCurrent()) return;
        const ownerIndex = Number.isInteger(Number(collapse.ownerIndex))
            && players[Number(collapse.ownerIndex)]
            && String(players[Number(collapse.ownerIndex)].id) === String(collapse.ownerId)
            ? Number(collapse.ownerIndex)
            : players.findIndex(candidate => String(candidate.id) === String(collapse.ownerId));
        const owner = ownerIndex >= 0 ? players[ownerIndex] : null;
        if (!owner) { action.finish(); return; }
        action.setPhase('notice');
        window.showEventPopup(
            '橋崩し',
            '全ての橋が崩壊した！<br>復旧まで3ターンかかる！',
            () => { action.setPhase('arrival'); finishTurn(owner); },
            { subjectIndex:ownerIndex, subjectPlayerId:collapse.ownerId, advanceAnywhere:true }
        );
    }

    async function useBridgeCollapseItem(player, inventoryIndex) {
        const pending = window.GameActionInput.get('bridge');
        if (pending && pending.phase !== 'waiting') return;
        if (player.underground) {
            pending?.finish();
            window.showEventPopup('アイテムを使用できません', '地下労働中は使用できません。', () => showInventoryPopup(player));
            return;
        }
        if (window.bridgeCollapseState) {
            pending?.finish();
            window.showEventPopup('橋崩しを使用できません', '橋崩しの効果中は再使用できません。', () => showInventoryPopup(player));
            return;
        }
        const action = pending
            || window.GameActionInput.begin('bridge', `${currentTurn}:${currentPlayer}`);
        if (!action || action.phase !== 'waiting') return;
        action.setPhase('resolving');
        const online = window.onlineGame?.isOnline && window.onlineGame.sync;
        const eventId = createOnlineSyncEventId('bridge-collapse');
        if (online) {
            try {
                const response = await online.useBridgeCollapse(eventId, action.turnKey);
                if (!action.isCurrent()) return;
                if (!response?.ok || !response.state) {
                    if (bridgeCollapsePresented.has(eventId)) return;
                    showLockedItemResult(action, player, '橋崩しを使用できません', response?.error || '橋崩しを使用できませんでした。');
                    return;
                }
                applyOnlineCanonicalState(response.state, 'bridge-collapse-use', true);
                await presentBridgeCollapse(response.state, eventId);
            } catch (error) {
                console.error('[橋崩し] 使用に失敗:', error);
                const applied = window.bridgeCollapseState?.eventId === eventId;
                showLockedItemResult(action, player, '橋崩し', applied ? '橋崩しの演出を表示できませんでした。' : '橋崩しを使用できませんでした。',
                    {}, applied ? () => finishTurn(player) : null);
            }
            return;
        }
        try {
            const index = Number.isInteger(inventoryIndex) ? inventoryIndex : findInventoryItemIndex(player, 27);
            if (index < 0 || Number(getInventoryItemId(player.inventory[index])) !== 27) { action.finish(); return; }
            player.inventory.splice(index, 1);
            const collapse = { ownerId:player.id, ownerIndex:players.indexOf(player), remainingActions:3, eventId, useTurnKey:action.turnKey };
            window.bridgeCollapseState = collapse;
            renderMap();
            window.GamePanels?.refresh();
            await presentBridgeCollapse({ bridgeCollapse:collapse }, eventId);
        } catch (error) {
            console.error('[橋崩し] 演出に失敗:', error);
            showLockedItemResult(action, player, '橋崩し', '橋崩しの演出を表示できませんでした。', {}, () => finishTurn(player));
        }
    }
    window.useBridgeCollapseItem = useBridgeCollapseItem;
    async function useSixShikatanItem(player, inventoryIndex) {
        const action = window.GameActionInput?.get('item-use');
        if (player.underground) {
            window.showEventPopup('アイテムを使用できません', '地下労働中は使用できません。', () => showInventoryPopup(player));
            return;
        }
        const online = window.onlineGame?.isOnline && window.onlineGame.sync;
        if (online) {
            try {
                const response = await online.useSixShikatan(createOnlineSyncEventId('six-shikatan'));
                if (!response?.ok || !response.state) {
                    window.showEventPopup('アイテムを使用できません', response?.error || '「6しか勝たん」を使用できませんでした。', () => showInventoryPopup(player));
                    return;
                }
                applyOnlineCanonicalState(response.state, 'six-shikatan-use', true);
                action?.finish();
                return;
            } catch (error) {
                console.error('[6しか勝たん] 使用に失敗:', error);
                window.showEventPopup('通信エラー', '「6しか勝たん」を使用できませんでした。', () => showInventoryPopup(player));
                return;
            }
        }
        const index = Number.isInteger(inventoryIndex) ? inventoryIndex : findInventoryItemIndex(player, 28);
        if (index < 0 || Number(getInventoryItemId(player.inventory[index])) !== 28) { action?.finish(); return; }
        player.inventory.splice(index, 1);
        window.nextDiceAllSixPlayerIds.add(diceEffectPlayerKey(player));
        updatePlayerStatusUI(player);
        renderPlayers();
        action?.finish();
    }
    window.useSixShikatanItem = useSixShikatanItem;
    function showLockedItemResult(action, player, title, message, options = {}, done = null) {
        if (!action.isCurrent()) return;
        action.setPhase('notice');
        window.showEventPopup(title, message, () => {
            if (!action.isCurrent()) return;
            if (done) { action.setPhase('arrival'); done(); return; }
            action.finish();
            showInventoryPopup(player);
        }, { ...options, advanceAnywhere:true });
    }
    async function useDisadvantageImmunityItem(player, inventoryIndex) {
        const pending = window.GameActionInput.get('immunity');
        if (pending && pending.phase !== 'waiting') return;
        if (player.underground) {
            pending?.finish();
            window.showEventPopup('アイテムを使用できません', '地下労働中は使用できません。', () => showInventoryPopup(player));
            return;
        }
        const index = Number.isInteger(inventoryIndex) ? inventoryIndex : findInventoryItemIndex(player, 31);
        if (index < 0 || Number(getInventoryItemId(player.inventory[index])) !== 31
            || !ApprovedCommerce.canAct(player) || player.itemSealedThisTurn) { pending?.finish(); return; }
        const action = pending
            || window.GameActionInput.begin('immunity', `${currentTurn}:${currentPlayer}`);
        if (!action || action.phase !== 'waiting') return;
        if (window.DisadvantageImmunityRules?.isActive(player)) {
            showLockedItemResult(action, player, '無敵の加護', '無敵の加護はすでに発動しています。');
            return;
        }
        action.setPhase('resolving');
        const online = window.onlineGame?.isOnline && window.onlineGame.sync;
        try {
            await window.GameSE?.playAndWait?.('immunity', { shared:true });
            if (!action.isCurrent()) return;
            if (online) {
                const response = await online.useDisadvantageImmunity(createOnlineSyncEventId('disadvantage-immunity'), action.turnKey);
                if (!action.isCurrent()) return;
                if (!response?.ok || !response.state) {
                    showLockedItemResult(action, player, 'アイテムを使用できません', response?.error || '「無敵の加護」を使用できませんでした。');
                    return;
                }
                applyOnlineCanonicalState(response.state, 'disadvantage-immunity-use', true);
            } else {
                if (Number(getInventoryItemId(player.inventory[index])) !== 31) {
                    showLockedItemResult(action, player, 'アイテムを使用できません', '「無敵の加護」を所持していません。');
                    return;
                }
                player.inventory.splice(index, 1);
                window.DisadvantageImmunityRules?.activate(player);
                player.disadvantageImmunityTurnKey = action.turnKey;
                updatePlayerStatusUI(player);
                renderMap();
                renderPlayers();
            }
            await new Promise(resolve => requestAnimationFrame(resolve));
            showLockedItemResult(action, player, '無敵の加護', '1ターン無敵になった！', { subjectIndex:players.indexOf(player) });
        } catch (error) {
            console.error('[無敵の加護] 使用に失敗:', error);
            showLockedItemResult(action, player, '通信エラー', '「無敵の加護」を使用できませんでした。');
        }
    }
    window.useDisadvantageImmunityItem = useDisadvantageImmunityItem;
    const duplicateItemResultEvents = new Set();
    function showDuplicateItemResult(player, result, requestId = null) {
        if (requestId) {
            if (duplicateItemResultEvents.has(requestId)) return;
            duplicateItemResultEvents.add(requestId);
            if (duplicateItemResultEvents.size > 100) duplicateItemResultEvents.delete(duplicateItemResultEvents.values().next().value);
        }
        const name = result.itemName;
        const safeName = name.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        window.DuplicateItemUI?.hide();
        window.showEventPopup('複製さん', `<strong>${safeName}</strong>を複製した！`, function () {
            if (!requestId) return;
            window.onlineGame.sync.completeDuplicateItem(requestId).then(response => {
                if (!response?.ok) throw new Error(response?.error || '結果表示を終了できませんでした。');
            }).catch(error => {
                console.warn('[複製さん] 結果表示の同期に失敗:', error);
                duplicateItemResultEvents.delete(requestId);
                window.onlineGame.sync.recover(true);
            });
        }, { subjectIndex:players.indexOf(player), sync:false, sound:'itemObtain', eventId:requestId, advanceAnywhere:true });
    }
    window.showDuplicateItemSelection = function (player, useIndex, observer = false, restoring = false) {
        const owner = !observer && (!window.onlineGame?.isOnline || isLocalOnlineTurn());
        if (!window.DuplicateItemUI) return;
        const online = owner && window.onlineGame?.isOnline ? window.onlineGame.sync : null;
        // A recovered selection is already open on the server.
        if (online && restoring) lastLocalScreenKey = null;
        const opening = online && !restoring
            ? syncOnlineScreenView('item-action', player, 'open', { itemId:32, stage:'duplicate', useIndex })
            : null;
        window.DuplicateItemUI.show({
            player,
            inventory:player.inventory,
            useIndex:Number(useIndex),
            observer:!owner,
            onBack:function () {
                if (!owner) return;
                window.DuplicateItemUI.hide();
                if (window.onlineGame?.isOnline) syncOnlineScreenView('', player, 'close');
                showInventoryPopup(player);
            },
            async onSelect(targetIndex, targetId) {
                if (!owner || !ApprovedCommerce.canAct(player) || player.itemSealedThisTurn || player.underground) return;
                try {
                    const inventory = player.inventory;
                    const used = inventory?.[useIndex], target = inventory?.[targetIndex];
                    if (used == null || target == null || useIndex === targetIndex
                        || Number(getInventoryItemId(used)) !== 32 || Number(getInventoryItemId(target)) !== targetId) {
                        throw new Error('所持品が変わりました。アイテム一覧から選び直してください。');
                    }
                    const item = ITEM_CONTENTS[targetId];
                    if (!isItemDuplicable(item)) throw new Error(ITEM_DUPLICATION_BLOCKED_MESSAGE);
                    if (online) {
                        const opened = await opening;
                        if (opened && !opened.ok) throw new Error(opened.error || '複製の選択画面を同期できませんでした。');
                        const requestId = createOnlineSyncEventId('duplicate-item');
                        const response = await online.useDuplicateItem(useIndex, targetIndex, targetId, requestId);
                        if (!response?.ok || !response.state || !response.result) throw new Error(response?.error || '複製を確定できませんでした。');
                        applyOnlineCanonicalState(response.state, 'duplicate-item-use', true);
                        updatePlayerStatusUI(player); renderPlayers();
                        showDuplicateItemResult(player, response.result, response.requestId || requestId);
                        return;
                    }
                    inventory.splice(useIndex, 1);
                    if (targetId === 32) inventory[targetIndex - (useIndex < targetIndex ? 1 : 0)] = targetId;
                    else addItem(player, targetId, currentTurn);
                    updatePlayerStatusUI(player); renderPlayers();
                    showDuplicateItemResult(player, { itemName:item.name });
                } catch (error) {
                    await new Promise(resolve => {
                        window.showEventPopup('複製さん', error.message || '複製を確定できませんでした。', resolve, {subjectIndex:players.indexOf(player)});
                    });
                }
            }
        });
    };
    let offlineFukubukuroEvent = null;
    function randomFukubukuroCards(){
        const pick=rank=>{const list=Object.entries(ITEM_CONTENTS).filter(([id,item])=>Number(id)!==15&&Number(item.rank)===rank).map(([id,item])=>({id:Number(id),name:String(item.name),rank}));
            for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;};
        return [...pick(1).slice(0,5),...pick(2).slice(0,1)];
    }
    function grantFukubukuroItems(player,ids){
        ids.forEach(id=>{const item=ITEM_CONTENTS[Number(id)];if(!item)return;
            if(item.category==='passive'&&String(item.effectDuration||'').endsWith('turn')){
                const duration=Number(String(item.effectDuration).replace('turn',''))||0;
                player.inventory.push({id:Number(id),acquiredTurn:Number(currentTurn)||1,remainingUses:duration});
            }else player.inventory.push(Number(id));
        });
        updatePlayerStatusUI(player);renderPlayers();
    }
    function showFukubukuroEvent(player,event){
        if(!event||!window.FukubukuroUI)return;
        const playerIndex=Number(event.playerIndex);
        const owner=!(window.onlineGame?.isOnline)||(isLocalOnlineTurn()&&String(player.id)===String(window.onlineGame.playerId||window.onlineGame.socket?.id));
        window.FukubukuroUI.show(event,player,{owner,playerIcon:getPlayerCharacterIcon(playerIndex),
            async onStart(){
                if(window.onlineGame?.isOnline){
                    const requestId=createOnlineSyncEventId('fukubukuro-roll');
                    const response=await window.onlineGame.sync.actFukubukuro('roll',event.eventId,requestId);
                    if(!response?.ok||!response.event)throw new Error(response?.error||'サイコロを開始できませんでした。');
                    applyOnlineCanonicalState(response.state,'fukubukuro-roll',true);
                    return response.event;
                }
                if(!offlineFukubukuroEvent||offlineFukubukuroEvent.eventId!==event.eventId||offlineFukubukuroEvent.status!=='ready')throw new Error('福袋のサイコロを開始できません。');
                offlineFukubukuroEvent={...offlineFukubukuroEvent,status:'rolling'};
                return offlineFukubukuroEvent;
            },
            async onStop(){
                if(window.onlineGame?.isOnline){
                    const requestId=createOnlineSyncEventId('fukubukuro-stop');
                    const response=await window.onlineGame.sync.actFukubukuro('stop',event.eventId,requestId);
                    if(!response?.ok||!response.event)throw new Error(response?.error||'抽選結果を確定できませんでした。');
                    applyOnlineCanonicalState(response.state,'fukubukuro-stop',true);
                    return response.event;
                }
                const rolls=Array.from({length:3},()=>Math.floor(Math.random()*6)+1);
                const receivedItemIds=rolls.map(face=>event.cards[face-1].id);
                grantFukubukuroItems(player,receivedItemIds);
                offlineFukubukuroEvent={...event,status:'result',rolls,receivedItemIds};
                return offlineFukubukuroEvent;
            },
            async onFinish(){
                if(window.onlineGame?.isOnline){
                    const response=await window.onlineGame.sync.actFukubukuro('finish',event.eventId,createOnlineSyncEventId('fukubukuro-finish'));
                    if(!response?.ok)throw new Error(response?.error||'福袋の結果を確定できませんでした。');
                    applyOnlineCanonicalState(response.state,'fukubukuro-finish',true);
                }else offlineFukubukuroEvent=null;
                window.FukubukuroUI.close();finishTurn(player);
            }
        });
    }
    async function useFukubukuroItem(player,inventoryIndex){
        if(player.underground||player.itemSealedThisTurn){showInventoryPopup(player);return;}
        const online=window.onlineGame?.isOnline&&window.onlineGame.sync;
        const eventId=createOnlineSyncEventId('fukubukuro');
        if(online){
            try{
                const response=await online.actFukubukuro('start',eventId,createOnlineSyncEventId('fukubukuro-start'));
                if(!response?.ok||!response.event)throw new Error(response?.error||'お楽しみ福袋を使用できませんでした。');
                applyOnlineCanonicalState(response.state,'fukubukuro-start',true);
                showFukubukuroEvent(player,response.event);
            }catch(error){console.error('[福袋] 使用に失敗:',error);showEventPopup('福袋を使用できません',error.message,()=>showInventoryPopup(player));}
            return;
        }
        const index=Number.isInteger(inventoryIndex)?inventoryIndex:findInventoryItemIndex(player,29);
        if(index<0||Number(getInventoryItemId(player.inventory[index]))!==29){showInventoryPopup(player);return;}
        player.inventory.splice(index,1);
        offlineFukubukuroEvent={eventId,cards:randomFukubukuroCards(),status:'ready',playerIndex:players.indexOf(player)};
        updatePlayerStatusUI(player);renderPlayers();
        showFukubukuroEvent(player,offlineFukubukuroEvent);
    }
    window.useFukubukuroItem=useFukubukuroItem;
    ApprovedCommerce.configure({players:()=>players,canAct:canLocalPurchaseAsset,sync:syncOnlineScreenView,
        finish:finishTurn,inventory:showInventoryPopup,event:(...args)=>window.showEventPopup(...args),apply:applyOnlineCanonicalState,
        turn:()=>currentTurn,saleId:()=>createOnlineSyncEventId('sale'),update:updatePlayerStatusUI,render:renderPlayers});

    let offlineUndergroundFlow = null;
    let offlineUndergroundTurnKey = null;
    let offlineItemSealCheckKey = null;
    let specialWarpInFlight = false;
    let completedUndergroundKey = null;

    const undergroundContext = {
        assets: ASSET_CONTENTS,
        shops: ASSET_BOXES,
        marketPrice,
        startSquare: mapData.find(square => square.type === "start").id,
        totalAssets: player => calculateTotalAssetValue(player)
    };

    function getOfflineUndergroundState() {
        return {
            players, currentTurn, activePlayerIndex: currentPlayer, undergroundFlow: offlineUndergroundFlow, bossCounterEnabled,
            marketExponent: currentMarketExponent(),
            assetOwners: Object.fromEntries(Object.entries(ASSET_CONTENTS).map(([id, asset]) => [id, asset.owner]))
        };
    }

    function applyOfflineUnderground(state) {
        offlineUndergroundFlow = state.undergroundFlow;
        GuidebookRules.clearIfConfiscated(offlineGuidebookState());
        Object.entries(state.assetOwners).forEach(([id, owner]) => { ASSET_CONTENTS[id].owner = owner; });
        renderTurn();
        renderPlayers();
        if (offlineUndergroundFlow?.stage === "reminder") {
            updateNextPlayerView();
            centerCurrentPlayerOnMap("auto");
        }
        const player = players[currentPlayer];
        if (!player.underground) window.MapAreaAudio?.updateForPlayer(player);
        if (["confiscated", "returned"].includes(offlineUndergroundFlow?.stage)) renderMap();
        if (offlineUndergroundFlow?.stage === "returnImmunityNotice") renderMap({ preserveCamera: true });
        if (offlineUndergroundFlow?.stage === "returned") updateNextPlayerView();
        window.UndergroundUI.render(state, true, request => {
            const current = getOfflineUndergroundState();
            if (!window.UndergroundRules.act(current, request, undergroundContext)) return;
            applyOfflineUnderground(current);
            if (current.undergroundFlow?.stage === "done") finishTurn(players[currentPlayer]);
            else if (request.stage === "reminder") beginPlayerTurn(players[currentPlayer]);
        });
    }

    window.renderOnlineUnderground = function (state) {
        if (state.disadvantageImmunityExpiry || state.guidebook?.view || window.SpecialRewardRules.pending(state.specialReward)) { window.UndergroundUI?.suspend(); return; }
        if (window.PonziRules?.pending(state) || window.PonziPresentation?.isOpen()) return;
        window.PonziPresentation?.closeObserver();
        const owner = isLocalOnlineTurn() && Number(state.activePlayerIndex) === Number(currentPlayer);
        window.UndergroundUI.render(state, owner, async request => {
            const result = await window.onlineGame.sync.actUnderground(request);
            if (!result?.ok) throw new Error(result?.error || "地下労働の操作を確定できませんでした。");
        });
        const flow = state.undergroundFlow;
        if (owner && state.matchPhase === "playing" && flow?.stage === "done" && completedUndergroundKey !== flow.turnKey) {
            completedUndergroundKey = flow.turnKey;
            setTimeout(() => {
                const latest = window.onlineGame.sync.state;
                if (isLocalOnlineTurn() && latest?.undergroundFlow?.turnKey === flow.turnKey && latest.undergroundFlow.stage === "done") {
                    window.completeOnlineTurn(players[currentPlayer]);
                }
            }, 100);
        }
    };

    // グローバルなオンライン同期処理から、画面内スコープの手番状態を
    // 安全に参照・更新できるようにする。
    window.getCurrentPlayerIndex = function () { return currentPlayer; };
    window.setOnlineTurnState = function (playerIndex, turnNumber) {
        if (Number.isInteger(Number(playerIndex))) currentPlayer = Number(playerIndex);
        if (Number.isFinite(Number(turnNumber))) currentTurn = Number(turnNumber);
        window.GameActionInput.syncTurn(`${currentTurn}:${currentPlayer}`);
    };
    window.getCurrentTurn = function () {
        return currentTurn;
    };
    window.updateWarpBossDistance = function (player) {
        const distance = getShortestDistanceToBoss(player.position);
        const value = document.getElementById('hudDestinationValue');
        const info = document.getElementById('destinationInfo');
        if (value) value.textContent = distance;
        if (info) info.dataset.distance = String(distance);
        fitHudDestinationLabels();
        refreshShortestPathToBoss();
    };

    // =========================
    // サイコロ移動状態
    // =========================
    // 今回のサイコロ移動中に通ったマスを記録します。
    // 直前に通った道を逆方向へ戻った場合は、
    // その1マス分だけ残り歩数を回復します。
    // =========================

    let diceMovementState = {

        active: false,

        // true when movement was initiated by a movement item rather than dice
        isItemMovement: false,

        player: null,

        startPosition: null,

        history: [],

        // サイコロを振った瞬間の総歩数
        // 「現在地に戻る」でここまで戻します。
        totalSteps: 0,

         // 強調マスをタップして
        // 自動移動している最中かどうか
        autoMoving: false,

        // =========================
        // サイコロを振った瞬間に確定した停止可能マスと、その経路
        // =========================
        
        syncViewEventId: null,
        syncViewSequence: 0

    };

    // showInventoryPopup is declared at the script's top level, outside this
    // game-start closure. Expose the active movement state for item handlers
    // that must start the same route-selection flow as a normal dice move.
    window.diceMovementState = diceMovementState;

    // =========================
    // サイコロ移動の強調マス用
    // クリックイベント管理
    // =========================
    // 同じマスに古いクリックイベントが
    // 蓄積しないように、登録したイベントを
    // 自分で解除できるよう管理します。
    const diceReachableClickHandlers =
        new Map();

    // =========================
// サイコロ移動中の残り歩数UI
// =========================
//
// 現在ターンのプレイヤーだけに表示します。
//
// UIの見た目はCSS側へ分離し、
// ここでは
// ・表示
// ・数字の更新
// ・非表示
// だけを担当します。
// =========================

// =========================================================
// サイコロ移動中の残り歩数UI
// =========================================================
//
// 現在ターンのプレイヤーの頭上に、
// 「🎲 3」のような小さな表示を出します。
//
// ・プレイヤーの子要素として生成
// ・プレイヤーと一緒に移動
// ・移動矢印より前面に表示
// ・見た目はCSS側で管理
//
// 今後UIを変更するときは、基本的に
// この関数とCSSだけを修正すればOKです。
// =========================================================


// =========================================================
// 残り歩数カウンターを取得 / 作成
// =========================================================

function ensureDiceMovementCounter() {
    return window.DiceMovementCounter.ensure();
}

function showDiceMovementCounter() {
    // Observers receive their remaining count from movement notifications.
    if (window.onlineGame && window.onlineGame.isOnline && !isLocalOnlineTurn()) return;
    if (!players[currentPlayer] || !diceMovementState.active || diceMovementState.donpiEventId || remainingSteps <= 0) {
        hideDiceMovementCounter();
        return;
    }
    window.DiceMovementCounter.show(Number(remainingSteps));
}

function updateDiceMovementCounter() {
    showDiceMovementCounter();
}

function hideDiceMovementCounter() {
    window.DiceMovementCounter.hide();
}

// 配当サイクル
const dividendCycle = DIVIDEND_CYCLE;

    // =========================
    // アイテムの移動アイテム使用処理
    // showGameScreen内の移動関数へ接続する
    // =========================

    window.useMoveItem = function (
        player,
        diceCount,
        itemId
    ) {

        // =========================
        // サイコロボタン、アイテムボタン無効化
        // =========================

        rouletteButton.disabled =   true;

        inventoryButton.disabled = true;

        const isOnline = Boolean(window.onlineGame?.isOnline && window.onlineGame.sync);
        const forceSix = !isOnline && consumeNextDiceAllSix(player);

           
        // =========================
        // 複数サイコロを振る
        // =========================

        showMultiDiceRoulette(
            diceCount,

            function (sum) {

                // =========================
                // 残りマス表示
                // =========================

                remainingSteps =
                    sum;

                renderTurn();


                // =========================
                // 移動アイテムは通常のサイコロ同期とは別経路で確定する。
                // サーバー側に通常のサイコロ結果がないため、専用フラグを付ける。
                diceMovementState.isItemMovement = true;

                // 移動開始
                // =========================

                movePlayer(
                    player,
                    sum
                );

            },
            itemId,
            forceSix
        );

    };

// =========================
// 魔法ステータス画面
// =========================

//ボタン音
buttonSound.currentTime = 0;
// Bootstrap runs independently on every client; do not relay its local sound.
(window.GameSE ? window.GameSE.playLocal(buttonSound) : buttonSound.play()).catch(function () {});

window.showMagicPopup = function (player) { ApprovedCommerce.showMagic(player); };

function closeOnlineDiceMovementView() {
    const sync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync
        ? window.onlineGame.sync
        : null;
    const eventId = diceMovementState && diceMovementState.syncViewEventId;
    if (sync && eventId) {
        sync.syncMovementView({ action: "close", eventId }).then(function (response) {
            if (!response || !response.ok) console.warn("[online] 移動表示を閉じられません:", response && response.error);
        });
    }
    diceMovementState.syncViewEventId = null;
    diceMovementState.syncViewSequence = 0;
}


// =========================
// 戦闘中 魔法選択画面
// =========================

window.showBattleMagicPopup = function (
    player,
    monster,
    battleState,
    onUseMagic
) {
    const popup =
        document.getElementById("battleMagicPopup");
    const magicList =
        document.getElementById("battleMagicList");
    const closeButton =
        document.getElementById("battleMagicCloseButton");

    magicList.replaceChildren();

    // 魔法を覚えていない場合
    if (player.magic.length === 0) {
        const emptyTemplate =
            document.getElementById("magicEmptyTemplate");

        magicList.appendChild(
            emptyTemplate.content.cloneNode(true)
        );
    }

    // 覚えている魔法を表示
    player.magic.forEach(function (magicId) {
        const magic = MAGIC_CONTENTS[magicId];

        if (!magic) {
            return;
        }

        const itemTemplate =
            document.getElementById("battleMagicItemTemplate");
        const magicElement =
            itemTemplate.content.firstElementChild.cloneNode(true);

        magicElement.querySelector(".battle-magic-item-name").textContent =
            magic.name;
        magicElement.querySelector(".battle-magic-item-effect").textContent =
            magic.effect;
        magicElement.querySelector(".battle-magic-item-cost").textContent =
            `💰 ${formatG(
                calculateMagicCost(
                    player,
                    magic,
                    battleState
                )
            )}G`;

        const useButton =
            magicElement.querySelector(".battle-magic-use-button");

        useButton.addEventListener("click", function () {
            if (onUseMagic) {
                onUseMagic(magic);
            }
        });

        magicList.appendChild(magicElement);
    });

    popup.style.display = "block";

    closeButton.onclick = function () {
        popup.style.display = "none";

        // 魔法ボタンを再び有効化
        const battleMagicButton =
            document.getElementById("battleMagicButton");

        if (battleMagicButton) {
            battleMagicButton.disabled = false;
        }
    };
};


// =========================
// 魔法ボタン
// =========================

document
    .getElementById(
        "magicButton"
    )
    .addEventListener(
        "click",
        function () {

            showMagicPopup(
                players[currentPlayer]
            );
//決定音
buttonSound.currentTime = 0;
playSharedSE(buttonSound)
        }
    );


    

// =========================
// 魔法画面を閉じる
// =========================

document
    .getElementById(
        "magicCloseButton"
    )
    .addEventListener(
        "click",
        function () {

            syncOnlineScreenView("", players[currentPlayer], "close");

            document
                .getElementById(
                    "magicPopup"
                )
                .style.display =
                    "none";

        }
    );

    // =========================
    // アイテムボタン
    // =========================

    document
        .getElementById(
            "inventoryButton"
        )
        .addEventListener(
            "click",
            function () {

                showInventoryPopup(
                    players[currentPlayer]
                );
//決定音
buttonSound.currentTime = 0;
playSharedSE(buttonSound)
            }
        );



    // =========================
    // アイテム画面を閉じる
    // =========================

    document
        .getElementById(
            "inventoryCloseButton"
        )
        .addEventListener(
            "click",
            function () {

                syncOnlineScreenView("", players[currentPlayer], "close");

                document
                    .getElementById(
                        "inventoryPopup"
                    )
                    .style.display =
                        "none";

            }
        );

    // =========================
    // その他メニュー
    // =========================

    const otherButton =
        document.getElementById(
            "otherButton"
        );

    const otherMenuPopup =
        document.getElementById(
            "otherMenuPopup"
        );

    const otherMenuCloseButton =
        document.getElementById(
            "otherMenuCloseButton"
        );

    const otherAssetButton =
        document.getElementById(
            "otherAssetButton"
        );

    const otherSoundButton =
        document.getElementById(
            "otherSoundButton"
        );

    if (otherButton) {

        otherButton.addEventListener(
            "click",
            function () {

                if (otherMenuPopup) {
                    otherMenuPopup.style.display = "block";
                }
                syncOnlineScreenView("other-menu", players[currentPlayer]);

                buttonSound.currentTime = 0;
                playSharedSE(buttonSound);

            }
        );

    }

    if (otherMenuCloseButton) {

        otherMenuCloseButton.addEventListener(
            "click",
            function () {

                if (otherMenuPopup) {
                    otherMenuPopup.style.display = "none";
                }
                syncOnlineScreenView("", players[currentPlayer], "close");

            }
        );

    }

    if (otherAssetButton) {

        otherAssetButton.addEventListener(
            "click",
            function () {

                if (otherMenuPopup) {
                    otherMenuPopup.style.display = "none";
                }
                syncOnlineScreenView("", players[currentPlayer], "close");

                showAssetPopup(
                    players[currentPlayer]
                );

            }
        );

    }

    if (otherSoundButton) {

        otherSoundButton.addEventListener(
            "click",
            function () {

                if (otherMenuPopup) {
                    otherMenuPopup.style.display = "none";
                }
                syncOnlineScreenView("", players[currentPlayer], "close");

                const soundPopup =
                    document.getElementById(
                        "soundSettingsPopup"
                    );

                if (soundPopup) {
                    soundPopup.style.display = "block";
                    window.GamePanels?.anchorFrame("soundSettingsPopup");
                }
                syncOnlineScreenView("sound-settings", players[currentPlayer]);

            }
        );

    }

    // =========================
    // マップ表示
    // =========================

    let renderedMobileMap;
    function renderMapPieces(mapBoard) {
        mapBoard.querySelectorAll(".player-piece").forEach(piece => piece.remove());
        const occupants = new Map();
        players.forEach((player, index) => {
            if (player.underground) return;
            const node = mapBoard.querySelector(`.map-node[data-square-id="${Number(player.position)}"]`);
            if (!node) return;
            if (!occupants.has(node)) occupants.set(node, []);
            occupants.get(node).push({ player, index });
        });
        for (const [node, group] of occupants) {
            const matrix = new DOMMatrix(getComputedStyle(node).transform);
            group.forEach(({ player, index }, seat) => {
                const piece = document.createElement("div");
                piece.className = "player-piece player-sprite " + (index === currentPlayer ? "player-piece-current" : "player-piece-other");
                piece.dataset.playerIndex = index;
                piece.classList.toggle(
                    "disadvantage-immunity-gold",
                    Boolean(window.DisadvantageImmunityRules?.isActive(player))
                );
                piece.setAttribute("aria-label", player.name);
                piece.title = player.name;
                piece.draggable = false;
                updatePlayerSprite(piece, index, player);
                piece.style.setProperty("margin-left", `${(seat - (group.length - 1) / 2) * 46}px`, "important");
                piece.style.setProperty("--piece-node-scale", Math.abs(matrix.a) || 1);
                node.appendChild(piece);
                if (index === currentPlayer && diceMovementState.active && !diceMovementState.donpiEventId && remainingSteps > 0) {
                    ensureDiceMovementCounter();
                }
            });
        }
    }

    function renderMap(options = {}) {
        const mapBoard =
            document.getElementById(
                "mapBoard"
            );


        const movingPlayer = Number.isInteger(options.movingPlayer) ? options.movingPlayer : null;
        const previousPiece = movingPlayer === null ? null : MapMovementPresentation.capture(mapBoard, movingPlayer);
        // Scenery and roads are static for this board. Keep their DOM and SVG
        // definitions instead of rebuilding thousands of island faces per step.
        const background = mapBoard.querySelector(':scope > .map-background');
        const existingRoads = mapBoard.querySelector(':scope > .map-lines');
        const existingObjects=mapBoard.querySelector(':scope > .map-workshop-objects');
        const reuseMobile = window.mobileRuntimeTuning === true && background?.classList.contains('map-static-background') &&
            renderedMobileMap?.board === mapBoard && renderedMobileMap.squares === mapData && renderedMobileMap.boss === currentBossSquareId;
        const bridgeClosed = Number(window.bridgeCollapseVisualState?.remainingActions) > 0;
        if (existingRoads && (reuseMobile || (window.mobilePerformanceEnabled !== false && movingPlayer !== null && mapBoard.querySelector(".map-node")))) {
            clearReachableHighlights();
            clearDiceMovementArrows();
            mapBoard.querySelectorAll(".observer-reachable-highlight, .square-detail-highlight").forEach(node => {
                node.classList.remove("observer-reachable-highlight", "square-detail-highlight");
            });
            renderMapPieces(mapBoard);
            window.MapDetailLevel.refreshPieces(mapBoard, getMapZoomUI());
            if (reuseMobile && renderedMobileMap.bridgeClosed !== bridgeClosed) {
                renderedMobileMap.bridgeClosed = bridgeClosed;
                window.MapRoadRenderer.setBridgeCollapse(existingRoads, mapData, window.bridgeCollapseVisualState);
            }
            if (movingPlayer !== null) return MapMovementPresentation.play(mapBoard, movingPlayer, previousPiece, options.movementSpeed || 1);
            drawShortestPathToBoss(existingRoads);
            if (!options.preserveCamera) centerCurrentPlayerOnMap();
            return;
        }
        for (const child of Array.from(mapBoard.children)) {
            if (child !== background && child !== existingRoads && child !== existingObjects) child.remove();
        }


        // =========================
        // マップ背景
        // =========================

        if (!background) mapBoard.appendChild(MapScene.createBackground(mapData));


        // =========================
        // 道を描くSVG
        // =========================

        const svg = existingRoads ||
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                "svg"
            );


        svg.classList.add(
            "map-lines"
        );


        svg.setAttribute(
         "viewBox",
         `0 0 ${mapBoard.clientWidth} ${mapBoard.clientHeight}`
        );


        svg.setAttribute(
            "preserveAspectRatio",
            "none"
        );


        // =========================
        // マス同士を線でつなぐ
        // =========================

        if (!existingRoads) window.MapRoadRenderer.draw(svg, mapData);
        window.MapRoadRenderer.setBridgeCollapse(svg, mapData, window.bridgeCollapseVisualState);

drawShortestPathToBoss(
    svg
);


if (!existingRoads) mapBoard.appendChild(
    svg
);


        // =========================
        // マスを配置
        // =========================

        mapData.forEach(
            function (square) {

                const node =
                    document.createElement(
                        "div"
                    );


                node.className =
                    "map-node";

                node.dataset.squareId = square.id;
                node.dataset.mapType = square.type;

// =========================
// マス詳細表示
// マスを右クリックしたときに表示
// =========================

node.addEventListener(
    "contextmenu",
    function (event) {

        // ブラウザ標準の右クリックメニューを抑止
        event.preventDefault();

        // 移動中はマス詳細を表示しない
        if (window.isSquareMovementInProgress) {
            return;
        }

        if (
            typeof window.showSquareDetail !==
            "function"
        ) {
            return;
        }

        // 表示中のマスをもう一度右クリックしたら詳細を閉じる
        if (node.classList.contains("square-detail-highlight")) {
            if (typeof window.hideSquareDetail === "function") {
                window.hideSquareDetail();
            }

            return;
        }

        // 以前のマスの緑色の強調を解除
        document
            .querySelectorAll(".map-node.square-detail-highlight")
            .forEach(function (node) {
                node.classList.remove("square-detail-highlight");
            });

        // 右クリックしたマスを取得
        const detailNode = document.querySelector(
            `.map-node[data-square-id="${square.id}"]`
        );

        // 右クリックしたマスを緑色に強調
        if (detailNode) {
            detailNode.classList.add("square-detail-highlight");
        }

        // マス詳細を表示
        window.showSquareDetail(square);

    }
);


// マスからカーソルが離れても詳細は閉じない。
// 詳細の終了タイミングは既存の処理に任せる。


    node.style.left =
    `${square.x}px`;


    node.style.top =
    `${square.y}px`;


// =========================
// マスのアイコン
// =========================
// マスの画像は type で決定します。
// ボスだけは monster type の中から選ばれた
// currentBossSquareId を優先して表示します。

const squareIcon =
    document.createElement(
        "div"
    );

squareIcon.className =
    "square-icon";

const isBossSquare =
    square.id === currentBossSquareId;

const iconPath =
    isBossSquare
        ? BOSS_MAP_ICON_PATH
        : MAP_TYPE_ICON_PATHS[square.type];

const fallbackIcon =
    isBossSquare
        ? "👹"
        : (MAP_TYPE_ICON_FALLBACKS[square.type] || square.icon || "❔");

squareIcon.dataset.lowDetailFallback = fallbackIcon;

if (isBossSquare) {

    node.classList.add(
        "boss-node"
    );

}

if (iconPath) {

    const iconImage =
        document.createElement(
            "img"
        );

    iconImage.className =
        "map-space-icon";

    iconImage.src =
        iconPath;

    iconImage.dataset.highQualitySrc = iconPath;

    iconImage.alt =
        square.name || fallbackIcon;

    iconImage.draggable = false;

    iconImage.addEventListener(
        "error",
        function () {

            iconImage.remove();
            squareIcon.textContent =
                fallbackIcon;

        },
        { once: true }
    );

    squareIcon.appendChild(
        iconImage
    );

    const lowDetailIcon = document.createElement("span");
    lowDetailIcon.className = "map-low-detail-icon";
    lowDetailIcon.textContent = fallbackIcon;
    squareIcon.appendChild(lowDetailIcon);

} else {

    squareIcon.textContent =
        fallbackIcon;

}

node.appendChild(
    squareIcon
);


                // =========================
                // マス番号
                // =========================

                const squareNumber =
                    document.createElement(
                        "div"
                    );


                squareNumber.className =
                    "square-number";


                squareNumber.textContent =
                    square.id;


                node.appendChild(
                    squareNumber
                );


                mapBoard.appendChild(
                    node
                );

            }
        );

        // =========================
        // 現在プレイヤーを中央へ
        // =========================

        renderMapPieces(mapBoard);
        window.MapDetailLevel.refresh(mapBoard, getMapZoomUI());
        renderedMobileMap = { board:mapBoard, squares:mapData, boss:currentBossSquareId, bridgeClosed };
        if (movingPlayer !== null) {
            return MapMovementPresentation.play(mapBoard, movingPlayer, previousPiece, options.movementSpeed || 1);
        }
        if (!options.preserveCamera) centerCurrentPlayerOnMap();

    }

if (typeof setupMapMouseDragUI === "function") setupMapMouseDragUI();
if (typeof setupMapMouseWheelZoomUI === "function") setupMapMouseWheelZoomUI();

// =========================
// 資産一覧画面
// =========================

function showAssetPopup(player) { ApprovedCommerce.showAssets(player); }

function canLocalPurchaseAsset(player) {
    if (!(window.onlineGame && window.onlineGame.isOnline)) return true;

    const socketId = window.onlineGame.socket && (window.onlineGame.playerId || window.onlineGame.socket.id);
    if (!socketId || !player || String(player.id) !== String(socketId)) return false;
    if (typeof isLocalOnlineTurn === "function" && !isLocalOnlineTurn()) return false;

    const playerIndex = Array.isArray(players) ? players.indexOf(player) : -1;
    const activePlayerIndex = typeof window.getCurrentPlayerIndex === "function"
        ? Number(window.getCurrentPlayerIndex())
        : Number(window.onlineGame.sync && window.onlineGame.sync.state && window.onlineGame.sync.state.activePlayerIndex);

    return Number.isInteger(playerIndex) && playerIndex >= 0
        && Number.isInteger(activePlayerIndex) && playerIndex === activePlayerIndex;
}

function showAssetPurchasePopup(player, assetIds, callback, suppressGreeting = false) {
    const playerIndex = players.indexOf(player);
    const previous = activeAssetPurchaseView;
    // State refreshes must retain the active player's turn-finish callback.
    const onClose = callback || (previous?.playerIndex === playerIndex ? previous.callback : null);
    activeAssetPurchaseView = {
        playerIndex,
        assetIds: assetIds.slice(),
        callback: onClose,
        suppressGreeting,
        pendingMonopolyEvents: previous?.playerIndex === playerIndex
            ? [...(previous.pendingMonopolyEvents || [])]
            : []
    };
    const square = mapData.find(entry => Number(entry.id) === Number(player.position));
    const branchNames = (square?.typeIds || []).map(id => ASSET_BOXES[id]?.name).filter(Boolean);
    const title = "資産店　" + branchNames.map(name=>name+"支店").join(" / ");
    const refresh = () => showAssetPurchasePopup(player, assetIds, onClose, suppressGreeting);
    AssetShopUI.render({
        player, playerIndex, title, canPurchase: canLocalPurchaseAsset(player),
        headerAction:{label:'売却画面へ',onClick:()=>ApprovedCommerce.showSales(player,'asset',()=>showAssetPurchasePopup(player,assetIds,onClose,true))},
        suppressGreeting,
        assets: assetIds.map(id => ASSET_CONTENTS[id] ? { ...ASSET_CONTENTS[id], id, price:marketPrice(ASSET_CONTENTS[id].price) } : null),
        ownerIcon: getPlayerCharacterIcon,
        onClose() {
            const pendingMonopolyEvents = activeAssetPurchaseView?.playerIndex === playerIndex
                ? (activeAssetPurchaseView.pendingMonopolyEvents || []).filter(event => ASSET_BOXES[event.shopId]?.contents.every(id => player.assets.includes(id)))
                : [];
            AssetShopUI.close();
            activeAssetPurchaseView = null;
            syncOnlineScreenView("", player, "close");
            const announceMonopoly = index => {
                if (index >= pendingMonopolyEvents.length) {
                    if (onClose) onClose();
                    return;
                }
                const result = pendingMonopolyEvents[index];
                showEventPopup(
                    "独占成立！",
                    `${player.name}が${result.shopName}支店の資産を独占した！<br>利回りが倍になった！`,
                    () => announceMonopoly(index + 1),
                    { subjectIndex: playerIndex }
                );
            };
            if (pendingMonopolyEvents.length) announceMonopoly(0);
            else if (onClose) onClose();
        },
        async onBuy(assetId, buyButton) {
            const asset=ASSET_CONTENTS[assetId];
            const price=marketPrice(asset?.price);
            if(!canLocalPurchaseAsset(player)||!asset||asset.owner!=null||player.money<price)return false;
            const sync=window.onlineGame?.isOnline?window.onlineGame.sync:null;
            let monopolyEvents=[];
            try {
                if(sync){const response=await sync.requestAssetPurchase(Number(assetId));
                    if(!response?.ok||!response.state){showEventPopup("購入できません",response?.error||"購入を確認できませんでした。",()=>{});return false;}
                    monopolyEvents=Array.isArray(response.monopolyEvents)?response.monopolyEvents:[];
                    applyOnlineCanonicalState(response.state,"asset-purchase");
                }else{
                    const previousOwners=Object.fromEntries(Object.entries(ASSET_CONTENTS).map(([id,entry])=>[id,entry.owner]));
                    player.money-=price;asset.owner=playerIndex;if(!player.assets)player.assets=[];
                    if(!player.assets.includes(assetId)){player.assets.push(assetId);DividendHistory.recordPurchase(player,assetId,currentTurn,price);}
                    monopolyEvents=window.AssetMonopolyRules?.newlyMonopolized(ASSET_BOXES,previousOwners,{...previousOwners,[assetId]:playerIndex},playerIndex)||[];
                }
                window.GameSE?.play?.('payment', {
                    shared: true,
                    eventId: createOnlineSyncEventId('asset-purchase-payment')
                }).catch(error => console.warn('[SE] 資産購入の支払い音を再生できません:', error));
                updatePlayerStatusUI(player);renderPlayers();
                if (monopolyEvents.length && activeAssetPurchaseView?.playerIndex === playerIndex) {
                    const pending = activeAssetPurchaseView.pendingMonopolyEvents;
                    pending.push(...monopolyEvents.filter(event => !pending.some(existing => existing.shopId === event.shopId)));
                }
                refresh();
                return true;
            }catch(error){console.error("[online] 資産購入に失敗:",error);showEventPopup("通信エラー","購入結果を確認できませんでした。",()=>{});return false;}
        }
    });
    syncOnlineScreenView("asset-purchase", player, "open", { panel: GamePanels.snapshot("assetPurchasePopup"), suppressGreeting });

}

 // =========================
// プレイヤー情報表示
// =========================

function renderPlayers() {

    const status =
        document.getElementById(
            "playerStatus"
        );


    const playerCardTemplate =
        document.getElementById("playerStatusCardTemplate");

    if (!playerCardTemplate || !playerCardTemplate.content.firstElementChild) {
        console.error("プレイヤー情報カードのテンプレートが見つかりません。");
        return;
    }

    status.replaceChildren();

    players.forEach(function (player, index) {
        const card =
            playerCardTemplate.content.firstElementChild.cloneNode(true);

        card.dataset.playerIndex = String(index);

        if (index === currentPlayer) {
            card.classList.add("current-player");
        }

        card.querySelector(".player-magic-power").textContent =
            `🔮${player.magicPower}`;

        card.querySelector(".player-money").textContent =
            `💰${formatG(player.money)}G`;
        const immunityStatus = card.querySelector(".player-immunity-status");
        if (immunityStatus) immunityStatus.hidden = !window.DisadvantageImmunityRules?.isActive(player);

        status.appendChild(card);
    });

 // =========================
// 現在プレイヤーを画面内へ自動スクロール
// =========================

const currentPlayerCard =
    status.querySelector(
        ".current-player"
    );

if (currentPlayerCard) {

    currentPlayerCard.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center"
    });

}

    // =========================
    // サウンド設定ボタン
    // =========================

    const soundSettingsTemplate =
        document.getElementById("soundSettingsButtonTemplate");

    if (soundSettingsTemplate && soundSettingsTemplate.content.firstElementChild) {
        status.appendChild(
            soundSettingsTemplate.content.firstElementChild.cloneNode(true)
        );
    }

// サウンド設定を開く

document.getElementById(
    "soundSettingsButton"
).onclick =
    function () {

        const popup =
            document.getElementById(
                "soundSettingsPopup"
            );

        popup.style.display =
            "block";
        window.GamePanels?.anchorFrame("soundSettingsPopup");
        syncOnlineScreenView("sound-settings", players[currentPlayer]);

    };

// サウンド設定を閉じる

document.getElementById(
    "soundSettingsCloseButton"
).onclick =

    function () {

        const popup =
            document.getElementById(
                "soundSettingsPopup"
            );

        popup.style.display =
            "none";
        window.GamePanels?.releaseFrame("soundSettingsPopup");
        syncOnlineScreenView("", players[currentPlayer], "close");

    };



   // =========================
// プレイヤーカードをタップしたら
// そのプレイヤーがいるマスを中央へ
// =========================

const playerCards =
    status.querySelectorAll(
        ".player-card"
    );


playerCards.forEach(
    function (card) {

        let lastTapTime = 0;


        card.addEventListener(
            "click",
            function () {

                const now =
                    Date.now();


                const isDoubleTap =
                    now - lastTapTime < 300;


                lastTapTime =
                    now;


                const playerIndex =
                    Number(
                        card.dataset.playerIndex
                    );


                const player =
                    players[playerIndex];


                if (!player) {
                    return;
                }


                // =========================
                // ダブルタップ
                // マップを100%に戻す
                // =========================

                if (isDoubleTap) {

    if (
        typeof setMapZoomUI ===
        "function"
    ) {

        setMapZoomUI(1);

    }

}


                // =========================
                // プレイヤーがいるマスを中央へ
                // =========================

                centerPlayerOnMap(
                    playerIndex
                );
                
            }
        );

    }
);


// =========================
// 👩 資産ボタン
// =========================

    const assetButtons =
        status.querySelectorAll(
            ".player-asset-button"
        );


    assetButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function (event) {

                    // カード全体のクリック処理を止める
                    event.stopPropagation();


                    const card =
                        button.closest(
                            ".player-card"
                        );


                    if (!card) {
                        return;
                    }


                    const playerIndex =
                        Number(
                            card.dataset.playerIndex
                        );


                    const player =
                        players[playerIndex];


                    if (!player) {
                        return;
                    }

                // 資産を持っていなければ何もしない
                if (
                    !player.assets ||
                    player.assets.length === 0
                ) {
                    return;
                }


                // 資産を持っている場合だけ一覧を表示

                    showAssetPopup(
                        player
                    );

                }
            );

        }
    );

}

window.renderPlayers = renderPlayers;
window.renderMap = renderMap;

// =========================
// プレイヤーステータス表示更新
// =========================

function positionHudMarketBadge() {
    const badge = document.querySelector('.game-hud > .hud-market-badge');
    const turnDisplay = document.getElementById('turnDisplay');
    const hud = turnDisplay?.closest('.game-hud');
    if (!badge || !turnDisplay || !hud) return;
    const turnRect = turnDisplay.getBoundingClientRect();
    const hudRect = hud.getBoundingClientRect();
    const style = getComputedStyle(hud);
    badge.style.left = `${turnRect.left - hudRect.left - parseFloat(style.borderLeftWidth || 0)}px`;
    badge.style.top = `${turnRect.bottom - hudRect.top - parseFloat(style.borderTopWidth || 0) + 4}px`;
    badge.style.width = `${turnRect.width}px`;
}
window.addEventListener('resize', positionHudMarketBadge, { passive:true });

function updatePlayerStatusUI(player) {

    if (!player) {
        return;
    }
    if (!window.onlineGame?.isOnline) {
        const state = offlineGuidebookState();
        if (GuidebookRules.withdrawUnfunded(state)) announceGuidebookWithdrawals(state.guidebook);
    }
    // =========================
    // 上部バナー：現在プレイヤーのみ
    // =========================

    if (player === players[currentPlayer]) {

        const hudGoldValue =
            document.getElementById(
                "hudGoldValue"
            );

        if (hudGoldValue) {

    window.GoldCounterUI.update(hudGoldValue, player.money, String(currentPlayer)+":"+String(player.id ?? player.characterId));

}

const hudMagicValue =
    document.getElementById(
        "hudMagicValue"
    );

        const hudPlayerAvatar = document.getElementById("hudPlayerAvatar");
        if (hudPlayerAvatar) {
            hudPlayerAvatar.classList.toggle(
                "disadvantage-immunity-gold",
                Boolean(window.DisadvantageImmunityRules?.isActive(player))
            );
        }

if (hudMagicValue) {

    hudMagicValue.textContent =
        formatG(player.magicPower);

}

    }


    
    // =========================
    // 戦闘画面
    // =========================

    const battlePopup =
        document.getElementById(
            "battlePopup"
        );

    const battlePlayerStats =
        document.getElementById(
            "battlePlayerStats"
        );

    if (
        player === players[currentPlayer] &&
        battlePopup &&
        battlePlayerStats &&
        battlePopup.style.display !== "none"
    ) {

        battlePlayerStats.replaceChildren(
            document.createTextNode(
                `💰${formatG(player.money)}G`
            ),
            document.createElement("br"),
            document.createTextNode(
                `🔮魔力 ${player.magicPower}`
            )
        );

    }

}


// =========================
// 現在のターン表示
// =========================

function renderTurn() {

    const turnDisplay =
        document.getElementById(
            "turnDisplay"
        );

    const currentPlayerInfo =
        document.getElementById(
            "currentPlayerInfo"
        );

    const player =
        players[currentPlayer];

    if (!player) {
        return;
    }


    // =========================
    // TURN
    // =========================

    if (turnDisplay) {

    const syncState = window.onlineGame?.isOnline ? window.onlineGame.sync?.state : null;
    const season = syncState
        ? syncState.marketKind
        : window.OfflineDividends?.marketKind?.();
    const exponent = Number(syncState
        ? syncState.marketExponent
        : window.OfflineDividends?.marketExponent?.()) || 0;
    const multiplier = 2 ** exponent;
    const percentageText = marketVariationLabel(exponent);
    turnDisplay.replaceChildren();
    const hud = turnDisplay.closest('.game-hud');
    hud?.querySelector('.hud-market-badge')?.remove();
    hud?.classList.remove('has-market-badge');
    const turnValue = document.createElement('span');
    turnValue.textContent = `Turn ${currentTurn}/${maxTurns}`;
    turnDisplay.append(turnValue);
    if ((season === 'boom' || season === 'crash') && percentageText !== '0％' && Math.abs(multiplier - 1) > 1e-9) {
        const badge = document.createElement('div');
        badge.className = 'hud-market-badge';
        badge.dataset.season = season;
        const label = document.createElement('span');
        label.className = 'hud-market-label';
        label.textContent = '価格変動中';
        const rate = document.createElement('strong');
        rate.className = 'hud-market-rate';
        rate.textContent = percentageText;
        badge.append(label, rate);
        hud?.append(badge);
        hud?.classList.add('has-market-badge');
        positionHudMarketBadge();
    }

}


    // =========================
    // プレイヤー名・キャラクター
    // =========================

    if (currentPlayerInfo) {

        const hudPlayerAvatar =
            document.getElementById(
                "hudPlayerAvatar"
            );

        const hudPlayerName =
            document.getElementById(
                "hudPlayerName"
            );

        updateHudPlayerAvatar(
            hudPlayerAvatar,
            currentPlayer
        );

        if (hudPlayerAvatar) {
            hudPlayerAvatar.setAttribute("aria-label", player.name);
        }

        updateHudPlayerName(
            hudPlayerName,
            player.name
        );

        // =========================
        // プレイヤー顔アイコンをタップ
        // 現在プレイヤーの位置へ戻ってから開始時の倍率に戻す
        // =========================

        if (hudPlayerAvatar) {

            hudPlayerAvatar.onclick = focusCurrentPlayerFromAvatar;

        }

        // =========================
        // プレイヤー名をタップ
        // 現在プレイヤーの位置へカメラを移動
        // =========================

        if (hudPlayerName) {

            hudPlayerName.onclick =
                function () {

                    centerPlayerOnMap(currentPlayer, 'smooth', null, true);

                };

        }

    }


    // =========================
    // プレイヤーステータス表示更新
    // =========================

    updatePlayerStatusUI(player);


// =========================
// サイコロ移動中の残り歩数UI
// =========================

updateDiceMovementCounter();


    // =========================
    // ボスマスまでの最短距離
    // =========================

    const destinationInfo =
        document.getElementById(
            "destinationInfo"
        );

    const hudDestinationValue =
        document.getElementById(
            "hudDestinationValue"
        );

    const bossDistance =
        getShortestDistanceToBoss(
            player.position
        );

  if (hudDestinationValue) {

    hudDestinationValue.textContent =
        bossDistance;

}

fitHudDestinationLabels();

    if (destinationInfo) {
        const underground = player.underground;
        destinationInfo.classList.toggle("ug-penica", Boolean(underground));
        let penica = destinationInfo.querySelector(".ug-penica-value");
        if (!penica) {
            penica = document.createElement("strong");
            penica.className = "ug-penica-value";
            destinationInfo.append(penica);
        }
        penica.hidden = !underground;
        if (underground) penica.textContent = Number(underground.penica).toLocaleString("ja-JP") + "ペニカ";

        destinationInfo.dataset.distance =
            String(bossDistance);

    }

    renderGuidebook(guidebookState());
}

    window.updatePlayerStatusUI =
    updatePlayerStatusUI;


    // =========================
    // 現在地から移動可能なマスを取得
    // =========================
    //
    // 桃鉄型：
    //
    // ① 現在地から出ている道
    //
    // ② 他のマスから現在地へ
    //    入っている道
    //
    // の両方を取得する。
    //
    // そのため前後どちらにも進める。
    // =========================

    function getConnectedOptions(
        position
    ) {

        const connected = [];


        // =========================
        // 現在地
        // =========================

        const currentSquare =
            mapData.find(
                function (square) {

                    return square.id ===
                        position;

                }
            );


        if (!currentSquare) {

            return connected;

        }


        // =========================
        // 現在地から出る道
        // =========================

        currentSquare.next.forEach(
            function (nextPosition) {

                if (window.BridgeCollapseRules?.isClosed(window.bridgeCollapseState, currentSquare.id, nextPosition)) return;

                if (
                    !connected.includes(
                        nextPosition
                    )
                ) {

                    connected.push(
                        nextPosition
                    );

                }

            }
        );


        // =========================
        // 現在地へ入ってくる道
        // =========================

        mapData.forEach(
            function (square) {

                    if (window.BridgeCollapseRules?.isClosed(window.bridgeCollapseState, square.id, position)) return;

                if (
                    square.next.includes(
                        position
                    )
                ) {

                    if (
                        !connected.includes(
                            square.id
                        )
                    ) {

                        connected.push(
                            square.id
                        );

                    }

                }

            }
        );


        return connected;

    }


    // =========================
    // 1マス移動
    // =========================

    function moveOneStep(
        player,
        nextPosition,
        speedMultiplier = 1
    ) {
        const movementTurnKey = currentTurn+':'+currentPlayer;

        const currentSquare =
            mapData.find(
                function (square) {
                    return square.id ===
                        player.position;
                }
            );

        const nextSquare =
            mapData.find(
                function (square) {
                    return square.id ===
                        nextPosition;
                }
            );

        // =========================
        // 移動方向を更新
        // =========================
        if (currentSquare && nextSquare) {

            const dx =
                nextSquare.x - currentSquare.x;

            const dy =
                nextSquare.y - currentSquare.y;

            if (Math.abs(dx) > Math.abs(dy)) {

                player.direction =
                    dx > 0 ? "right" : "left";

            } else if (dy !== 0) {

                player.direction =
                    dy > 0 ? "down" : "up";

            }

        }

            player.position =
            nextPosition;

        window.MapAreaAudio?.updateForPlayer(player);

        const movementAnimation = renderMap({ movingPlayer: players.indexOf(player), movementSpeed:speedMultiplier });

        renderPlayers();

        refreshShortestPathToBoss();

        if (diceMovementState && diceMovementState.active && window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync) {
            diceMovementState.syncStepSequence = Number(diceMovementState.syncStepSequence || 0) + 1;
            const stepIndex = diceMovementState.syncStepSequence;
            window.onlineGame.sync.requestMoveStep(Number(nextPosition), stepIndex, diceMovementState.isItemMovement ? "item" : "dice", Number(diceMovementState.startPosition), Number(remainingSteps), speedMultiplier).then(function (response) {
                if (!response || !response.ok) console.warn("[online] 移動中ステップが拒否されました:", response && response.error);
            }).catch(function (error) {
                console.error("[online] 移動中ステップの送信に失敗:", error);
            });
        }

        return Promise.resolve(movementAnimation).then(function () {
            if (movementTurnKey===currentTurn+':'+currentPlayer && currentSquare && nextSquare && Number(currentSquare.id)!==Number(nextSquare.id)) {
                window.GameSE?.play?.('squarePass').catch(error=>console.warn('[SE] 通過音を再生できません:',error));
            }
        });
    }

    // =========================
// サイコロの出目で
// 止まれるマスを取得
// =========================

function getReachableStopSquares(
    startPosition,
    steps,
    previousPosition = null
) {

    const results = new Map();

    const queue = [
        {
            position: startPosition,
            previousPosition,
            stepsUsed: 0,
            path: [startPosition]
        }
    ];

    const visited = new Set();


    while (
        queue.length > 0
    ) {

        const state =
            queue.shift();


        // =========================
        // 指定マス数に到達
        // =========================

        if (
            state.stepsUsed ===
            steps
        ) {

            if (
                !results.has(
                    state.position
                )
            ) {

                results.set(
                    state.position,
                    state.path
                );

            }

            continue;

        }


        // =========================
        // 現在地から行けるマス
        // =========================

        const options =
            getConnectedOptions(
                state.position
            );


        // =========================
        // 行ける場所がない
        // =========================

        if (
            options.length === 0
        ) {

            if (
                !results.has(
                    state.position
                )
            ) {

                results.set(
                    state.position,
                    state.path
                );

            }

            continue;

        }


        options.forEach(
            function (nextPosition) {

                // =========================
                // 直前のマスへ戻るのは禁止
                // =========================

                if (
                    nextPosition ===
                    state.previousPosition
                ) {

                    return;

                }


                const nextKey =
                    `${state.position}-${nextPosition}-${state.stepsUsed + 1}`;


                if (
                    visited.has(
                        nextKey
                    )
                ) {

                    return;

                }


                visited.add(
                    nextKey
                );


                queue.push({

                    position:
                        nextPosition,

                    previousPosition:
                        state.position,

                    stepsUsed:
                        state.stepsUsed + 1,

                    path:
                        [
                            ...state.path,
                            nextPosition
                        ]

                });

            }
        );

    }


    return results;

}

// Online state listeners live outside showGameScreen and need the screen-scoped renderer.
window.renderTurn = renderTurn;

// =========================
// サイコロ移動用
// 止まれるマスを取得
// =========================
// 今回のサイコロ移動では、
// 「来た道を戻る」ことが可能です。
// そのため通常の停止可能マス検索とは分けます。
// =========================

function clearDiceReachableClickHandlers() {

    diceReachableClickHandlers.forEach(
        function (handler, node) {

            node.removeEventListener(
                "click",
                handler
            );

        }
    );

    diceReachableClickHandlers.clear();

}

// =========================
// サイコロ移動中の
// 止まれるマスを強調表示
// =========================

function highlightDiceReachableSquares(
    player,
    steps
) {

    clearDiceReachableClickHandlers();
    clearReachableHighlights();


    if (
        !player ||
        !diceMovementState.active ||
        diceMovementState.player !== player ||
        diceMovementState.autoMoving
    ) {

        return;

    }


    const history = diceMovementState.history;
    const previousPosition = history.at(-2) ?? null;
    const prefix = history.slice(0, -1);
    const reachable = new Map();
    for (const [squareId, remainingPath] of getReachableStopSquares(player.position, steps, previousPosition)) {
        reachable.set(squareId, [...prefix, ...remainingPath]);
    }

    // =========================
    // 停止候補を強調表示
    // =========================

    reachable.forEach(
        function (path, squareId) {

            const node =
                document.querySelector(
                    `.map-node[data-square-id="${squareId}"]`
                );


            if (!node) {
                return;
            }

            node.classList.add("reachable-stop-highlight");


            // =========================
            // 強調された停止マスをタップ
            // =========================

           const clickHandler =
    function () {

        // =========================
        // マス詳細を閉じる
        // =========================

        if (
            typeof hideSquareDetail ===
            "function"
        ) {

            hideSquareDetail();

        }


        if (
            !diceMovementState.active ||
            diceMovementState.autoMoving ||
            diceMovementState.player !== player
        ) {
            return;
        }


                    // =========================
                    // 最終確認
                    // =========================
                    //
                    // 現在の移動履歴と
                    // 選択した経路が一致しているか確認します。
                    //

                    if (
                        !diceMovementState.history.every((position, index) => position === path[index])
                    ) {

                        return;

                    }


                    // =========================
                    // クリックイベント解除
                    // =========================

                    clearDiceReachableClickHandlers();


                    // =========================
                    // 矢印・強調表示を解除
                    // =========================

                    clearDiceMovementArrows();

                    clearReachableHighlights();


                    // =========================
                    // 選択した停止マスまで
                    // 自動移動
                    // =========================

                    moveDicePlayerToSquare(
                        player,
                        path
                    );

                };


            node.addEventListener(
                "click",
                clickHandler
            );


            diceReachableClickHandlers.set(
                node,
                clickHandler
            );

        }
    );


    return reachable;

}


// =========================
// 指定マス以内で
// 止まれるマスを取得
// =========================

function getReachableStopSquaresWithin(
    startPosition,
    maxSteps
) {

    const results =
        new Map();


    // =========================
    // 1〜maxStepsまで調べる
    // =========================

    for (
        let steps = 1;
        steps <= maxSteps;
        steps++
    ) {

        const reachable =
            getReachableStopSquares(
                startPosition,
                steps
            );


        reachable.forEach(
            function (path, squareId) {

                if (
                    !results.has(
                        squareId
                    )
                ) {

                    results.set(
                        squareId,
                        path
                    );

                }

            }
        );

    }


    return results;

}

// =========================
// 止まれるマスの強調を解除
// =========================

function clearReachableHighlights() {

    clearDiceReachableClickHandlers();

    document
        .querySelectorAll(
            ".map-node.reachable-stop-highlight"
        )
        .forEach(
            function (node) {

                node.classList.remove("reachable-stop-highlight");
            

            }
        );

}

// =========================
// 6マス以内の
// 停止可能マスを強調表示
// =========================

function highlightReachableSquaresWithin(
    player,
    maxSteps
) {

    const reachable =
        getReachableStopSquaresWithin(
            player.position,
            maxSteps
        );

    if (diceMovementState.isItemMovement && diceMovementState.player === player) {
        remainingSteps = Number(maxSteps);
        sendDiceMovementView("open", reachable, getConnectedOptions(player.position));
        renderTurn();
    }


    // =========================
    // 強調表示
    // =========================

    reachable.forEach(
        function (path, squareId) {

            const node =
                document.querySelector(
                    `.map-node[data-square-id="${squareId}"]`
                );


            if (!node) {
                return;
            }


            // =========================
            // 光らせる
            // =========================

            node.classList.add("reachable-stop-highlight");


            // =========================
            // タップ
            // =========================

           node.addEventListener(
    "click",
    function () {

        // =========================
        // マス詳細を閉じる
        // =========================

        if (
            typeof hideSquareDetail ===
            "function"
        ) {

            hideSquareDetail();

        }


        // =========================
        // 強調表示を解除
        // =========================

        clearReachableHighlights();


        // =========================
        // 分岐矢印を削除
        // =========================

        document
            .querySelectorAll(
                ".branch-arrow-map"
            )
            .forEach(
                function (element) {

                    element.remove();

                }
            );


        // =========================
        // 選択したマスへ移動
        // =========================

        if (diceMovementState.isItemMovement && diceMovementState.player === player) {
            sendDiceMovementView("close");
        }

        movePlayerToSquare(
            player,
            path
        );

    },
    {
        once: true
    }
);

        }
    );


    return reachable;

}

// =========================
// サイコロ移動で選択した停止マスまで
// 1マスずつ自動移動
// =========================
//
// 通常サイコロと複数サイコロアイテムは
// どちらも movePlayer() から同じ
// diceMovementState に入るため、
// この共通処理を利用します。
//
// どんぴ車で使っている movePlayerToSquare() とは
// 別関数にして、既存のどんぴ車の挙動を
// 変更しないようにします。
// =========================

function moveDicePlayerToSquare(
    player,
    path
) {

    if (
        !diceMovementState.active ||
        diceMovementState.player !== player ||
        !Array.isArray(path)
    ) {

        return;

    }


    const history =
        diceMovementState.history || [];


    // =========================
    // 現在の移動履歴と
    // 選択した経路が一致しているか確認
    // =========================

    if (
        history.length === 0 ||
        history[history.length - 1] !==
            player.position
    ) {

        return;

    }


    if (
        history.length >
        path.length
    ) {

        return;

    }


    for (
        let i = 0;
        i < history.length;
        i++
    ) {

        if (
            history[i] !==
            path[i]
        ) {

            return;

        }

    }


    // =========================
    // 自動移動開始
    // =========================

    closeOnlineDiceMovementView();

    diceMovementState.autoMoving =
        true;
    
    window.isSquareMovementInProgress = true;


    // =========================
    // 現在地より後ろだけを取得
    // =========================
    //
    // 例：
    //
    // 元のpath
    // [A, B, C, D]
    //
    // 現在地
    // B
    //
    // ↓
    //
    // [B, C, D]
    //
    const remainingPath =
        path.slice(
            history.length - 1
        );


    // =========================
    // すでに目的地の場合
    // =========================

    if (
        remainingPath.length <= 1
    ) {

        finishDiceMovement(
            player
        );

        return;

    }

window.isSquareMovementInProgress = true;


    let index = 1;


    function moveNext() {

        // =========================
        // 「現在地に戻る」が押された場合など、
        // 自動移動が中断されていたら終了
        // =========================

        if (
            !diceMovementState.active ||
            !diceMovementState.autoMoving ||
            diceMovementState.player !== player ||
            diceMovementState.history !== history
        ) {

            return;

        }

        // =========================
        // 移動完了
        // =========================

        if (
            index >=
            remainingPath.length
        ) {

            finishDiceMovement(
                player
            );

            return;

        }


        // =========================
        // 1マス移動
        // =========================

        const nextPosition = remainingPath[index];
        diceMovementState.history.push(nextPosition);

        index += 1;

        // =========================
        // 1マス移動した後の残り歩数
        // =========================

        remainingSteps =
            remainingPath.length - index;
        const animation = moveOneStep(player, nextPosition, 2);

        renderTurn();


        // =========================
        // 次のマスへ
        // =========================

        Promise.resolve(animation).then(moveNext);

    }


    moveNext();

}


// =========================
// 選択したマスまで自動移動
// =========================

function movePlayerToSquare(
    player,
    path
) {

    const donpiEventId = diceMovementState.isItemMovement && diceMovementState.player === player
        ? diceMovementState.donpiEventId
        : null;
    const onlineDonpi = Boolean(donpiEventId && window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync);
    window.isSquareMovementInProgress = true;

    let index = 1;


    function moveNext() {

        // =========================
        // 移動完了
        // =========================

            if (
            index >= path.length
        ) {

            window.isSquareMovementInProgress = false;

            remainingSteps = 0;

            renderTurn();

            document.getElementById(
                "choiceArea"
            ).replaceChildren();

            if (onlineDonpi) {
                const committedPath = path.map(Number);
                const action = window.GameActionInput?.get('item-use');
                diceMovementState.active = false;
                diceMovementState.isItemMovement = false;
                diceMovementState.player = null;
                diceMovementState.startPosition = null;
                diceMovementState.history = [];
                diceMovementState.autoMoving = false;
                diceMovementState.totalSteps = 0;
                diceMovementState.donpiEventId = null;
                window.onlineGame.sync.commitDonpiMove(committedPath, donpiEventId).then(function (response) {
                    if (!response || !response.ok || !response.state) {
                        console.error("[online] どんぴ車の到着を確定できません:", response && response.error);
                        return window.onlineGame.sync.requestState().then(function (snapshot) {
                            if (action && !action.isCurrent()) return;
                            if (snapshot?.ok && snapshot.state) {
                                applyOnlineCanonicalState(snapshot.state, "donpi-movement-recovery", true);
                                const restored = players.find(function (candidate) { return candidate && String(candidate.id) === String(player.id); });
                                if (restored) player.position = restored.position;
                                renderMap();
                                renderPlayers();
                                alert("どんぴ車の移動を同期できませんでした。状態を再取得しました。");
                            }
                        }).finally(() => action?.finish());
                    }
                    applyOnlineCanonicalState(response.state, "donpi-movement", true);
                    handleSquareEvent(player);
                }).catch(function (error) {
                    console.error("[online] どんぴ車の移動通信に失敗:", error);
                    action?.finish();
                    alert("どんぴ車の移動を同期できませんでした。画面の状態を確認してください。");
                });
                return;
            }

            if (!onlineDonpi && window.BridgeMuggingRules?.crossedBridge(path.map(Number))
                && window.BridgeMuggingRules.shouldOccur()) {
                window.offlineBridgeMuggingPending = {
                    player,
                    eventId:`offline-bridge-mugging:${currentTurn}:${currentPlayer}:${Date.now()}`,
                    fee:window.BridgeMuggingRules.feeForBossCount(bossDefeatedCount),
                    triggered:true,
                    lineIndex:0
                };
            }
            handleSquareEvent(
                player
            );

            return;

        }


        // =========================
        // 残りマス表示
        // =========================

        remainingSteps =
            path.length -
            index;

        renderTurn();


        // =========================
        // 1マス移動
        // =========================

        const animation=moveOneStep(
            player,
            path[index],
            2
        );


        index += 1;


        // =========================
        // 次のマスへ
        // =========================

        Promise.resolve(animation).then(moveNext);

    }


    moveNext();

}

// =========================
// 外部から移動処理を呼び出せるようにする
// =========================

window.highlightReachableSquaresWithin =
    function (
        player,
        maxSteps
    ) {

        return highlightReachableSquaresWithin(
            player,
            maxSteps
        );

    };


// =========================
// ボスマスまでの最短距離
// =========================

function getShortestDistanceToBoss(
    startPosition
) {

    if (
        currentBossSquareId === null ||
        currentBossSquareId === undefined
    ) {

        return 0;

    }


    if (
        startPosition ===
        currentBossSquareId
    ) {

        return 0;

    }


    const queue = [
        {
            position:
                startPosition,

            distance:
                0
        }
    ];


    const visited =
        new Set();

    visited.add(
        startPosition
    );


    while (
        queue.length > 0
    ) {

        const current =
            queue.shift();


        const options =
            getConnectedOptions(
                current.position
            );


        for (
            let i = 0;
            i < options.length;
            i++
        ) {

            const nextPosition =
                options[i];


            if (
                visited.has(
                    nextPosition
                )
            ) {

                continue;

            }


            if (
                nextPosition ===
                currentBossSquareId
            ) {

                return (
                    current.distance +
                    1
                );

            }


            visited.add(
                nextPosition
            );


            queue.push({

                position:
                    nextPosition,

                distance:
                    current.distance +
                    1

            });

        }

    }


    return 0;

}

// =========================
// ボスマスまでの最短ルートを取得
// =========================

function getShortestPathToBoss(
    startPosition
) {

    if (
        currentBossSquareId === null ||
        currentBossSquareId === undefined
    ) {

        return [];

    }

    // =========================
// 外部から最短ルートを取得できるようにする
// =========================

window.getShortestPathToBoss =
    function (
        startPosition
    ) {

        return getShortestPathToBoss(
            startPosition
        );

    };


    if (
        startPosition ===
        currentBossSquareId
    ) {

        return [
            startPosition
        ];

    }


    const queue = [
        startPosition
    ];


    const visited =
        new Set();

    visited.add(
        startPosition
    );


    const previous =
        new Map();


    while (
        queue.length > 0
    ) {

        const currentPosition =
            queue.shift();


        const options =
            getConnectedOptions(
                currentPosition
            );


        for (
            let i = 0;
            i < options.length;
            i++
        ) {

            const nextPosition =
                options[i];


            if (
                visited.has(
                    nextPosition
                )
            ) {

                continue;

            }


            visited.add(
                nextPosition
            );


            previous.set(
                nextPosition,
                currentPosition
            );


            // =========================
            // ボス到達
            // =========================

            if (
                nextPosition ===
                currentBossSquareId
            ) {

                const path = [];

                let position =
                    currentBossSquareId;


                path.push(
                    position
                );


                while (
                    position !==
                    startPosition
                ) {

                    position =
                        previous.get(
                            position
                        );


                    if (
                        position === undefined
                    ) {

                        return [];

                    }


                    path.push(
                        position
                    );

                }


                path.reverse();


                return path;

            }


            queue.push(
                nextPosition
            );

        }

    }


    return [];

}

// =========================
// ボスまでの最短ルートを
// マップ上に描画
// =========================

function drawShortestPathToBoss(svg) {
    if (!svg) return;
    const player = typeof currentPlayer === "number" && players && players[currentPlayer];
    const path = player ? getShortestPathToBoss(player.position) : [];
    window.MapRoadRenderer.setShortestPath(svg, path);
}

function refreshShortestPathToBoss() {
    const svg = document.querySelector("#mapBoard .map-lines");
    if (svg) drawShortestPathToBoss(svg);
}
// =========================
// refreshShortestPathToBoss
// inventory.js から呼び出せるように公開
// =========================

window.refreshShortestPathToBoss =
    function () {

        return refreshShortestPathToBoss();

    };

    // =========================
    // サイコロ移動中の矢印を削除
    // =========================

    function clearDiceMovementArrows() {

        document
            .querySelectorAll(
                ".dice-movement-arrow"
            )
            .forEach(
                function (element) {

                    element.remove();

                }
            );

    }

    // =========================
// 「現在地に戻る」ボタンを表示
// =========================

function showDiceMovementReturnButton() {

    const button =
        document.getElementById(
            "diceMovementReturnButton"
        );

    if (!button) {
        return;
    }

    if (
        !diceMovementState.active
    ) {

        button.style.display =
            "none";

        return;

    }

    button.style.display =
        "grid";

}


// =========================
// 「現在地に戻る」ボタンを非表示
// =========================

function hideDiceMovementReturnButton() {

    const button =
        document.getElementById(
            "diceMovementReturnButton"
        );

    if (!button) {
        return;
    }

    button.style.display =
        "none";

}


// =========================
// 「現在地に戻る」ボタンの処理
// =========================
//
// サイコロを振った瞬間の位置へ戻り、
// 同じ出目の歩数で移動をやり直します。
// =========================


function setupDiceMovementReturnButton() {

    const button =
        document.getElementById(
            "diceMovementReturnButton"
        );

    if (!button) {
        return;
    }

    button.onclick =
        function () {

            if (
                !diceMovementState.active
            ) {
                return;
            }

            const player =
                diceMovementState.player;

            const startPosition =
                diceMovementState.startPosition;

            const totalSteps =
                diceMovementState.totalSteps;

            if (
                !player ||
                startPosition === null ||
                startPosition === undefined ||
                totalSteps <= 0
            ) {
                return;
            }

            // =========================
            // 自動移動を中断
            // =========================

            diceMovementState.autoMoving =
                false;

            clearDiceMovementArrows();

            clearDiceReachableClickHandlers();

            clearReachableHighlights();

            // =========================
            // 出発地点へ戻す
            // =========================

            player.position =
                startPosition;

            // =========================
            // 移動履歴を出発地点だけに戻す
            // =========================

            diceMovementState.history = [
                startPosition
            ];

            // =========================
            // 残り歩数を最初の出目へ戻す
            // =========================

            remainingSteps =
                totalSteps;

            // =========================
            // マップ・プレイヤー・残り歩数を更新
            // =========================

            renderMap();

            renderPlayers();

            renderTurn();

            refreshShortestPathToBoss();

            // =========================
            // 改めて矢印と停止候補を表示
            // =========================

            showDiceMovementReturnButton();
            if (window.onlineGame?.isOnline && !diceMovementState.syncViewEventId) {
                diceMovementState.syncViewEventId = createOnlineSyncEventId("movement-view");
                diceMovementState.syncViewSequence = 0;
            }
            showDiceMovementArrows(true);

        };

}

// =========================
// サイコロ移動の終了
// =========================

function finishDiceMovement(
    player
) {
    // 移動履歴はリセット前に退避する。サーバーへ送るのは確定した経路のみ。
    const onlineMode = Boolean(
        window.onlineGame &&
        window.onlineGame.isOnline &&
        window.onlineGame.sync
    );
    const originalPosition = diceMovementState.startPosition;
    const confirmedPath = Array.isArray(diceMovementState.history)
        ? diceMovementState.history.slice()
        : [];
    const itemMovement = Boolean(diceMovementState.isItemMovement);

    if (!itemMovement) closeOnlineDiceMovementView();

    clearDiceMovementArrows();
    clearReachableHighlights();
    clearDiceReachableClickHandlers();

    diceMovementState.active = false;
    diceMovementState.isItemMovement = false;
    diceMovementState.player = null;
    diceMovementState.startPosition = null;
    diceMovementState.history = [];
    diceMovementState.autoMoving = false;
    diceMovementState.totalSteps = 0;

    window.isSquareMovementInProgress = false;

    hideDiceMovementReturnButton();
    hideDiceMovementCounter();
    remainingSteps = 0;

    if (typeof renderTurn === "function") {
        renderTurn();
    } else {
        console.warn("【警告】renderTurn が見つからないため、ターン表示更新をスキップしました。");
    }

    const choiceArea = document.getElementById("choiceArea");
    if (choiceArea) choiceArea.replaceChildren();

    const startSquare = originalPosition != null && Number.isInteger(Number(originalPosition))
        ? Number(originalPosition)
        : Number(player.position);
    const serverPath = confirmedPath.length >= 2 ? confirmedPath.map(Number)
        : itemMovement ? [startSquare, startSquare] : [startSquare];

    const resolveSquareEvent = function () {
        if (!itemMovement) window.GameActionInput?.get('dice')?.setPhase('arrival');
        handleSquareEvent(player);
    };

    if (!onlineMode) {
        if (window.BridgeMuggingRules?.crossedBridge(serverPath) && window.BridgeMuggingRules.shouldOccur()) {
            window.offlineBridgeMuggingPending = {
                player,
                eventId:`offline-bridge-mugging:${currentTurn}:${currentPlayer}:${Date.now()}`,
                fee:window.BridgeMuggingRules.feeForBossCount(bossDefeatedCount),
                triggered:true,
                lineIndex:0
            };
        }
        resolveSquareEvent();
        return;
    }

    // 通常のサイコロ移動とアイテム移動はサーバーで別々に検証する。
    // アイテム移動に通常の diceResult を要求すると、正当な移動でも拒否される。
    const action = !itemMovement && window.GameActionInput?.get('dice');
    if (action) {
        commitNormalDiceMove(action, player, serverPath, resolveSquareEvent);
        return;
    }
    const itemAction = itemMovement ? window.GameActionInput?.get('item-use') : null;
    const moveRequest = itemMovement && typeof window.onlineGame.sync.requestItemMove === "function"
        ? window.onlineGame.sync.requestItemMove(serverPath)
        : window.onlineGame.sync.requestMove(serverPath);
    moveRequest.then(function (response) {
        if (!response || !response.ok) {
            console.error("[online] 移動同期に失敗:", response && response.error);
            window.onlineGame.sync.requestState().then(function (snapshot) {
                if (snapshot && snapshot.ok && snapshot.state && Array.isArray(snapshot.state.players)) {
                    applyOnlinePlayersInPlace(snapshot.state.players);
                    const restored = window.players.find(function (candidate) {
                        return candidate && candidate.id === player.id;
                    });
                    if (restored) player.position = restored.position;
                    renderMap();
                    renderPlayers();
                }
            });
            alert(response && response.error || "移動の同期に失敗しました。画面の状態を確認してください。");
            itemAction?.finish();
            return;
        }
        if (response.state) applyOnlineCanonicalState(response.state, "movement-commit", true);
        resolveSquareEvent();
    }).catch(function (error) {
        console.error("[online] 移動同期に失敗:", error);
        alert("移動の同期に失敗しました。画面の状態を確認してください。");
        itemAction?.finish();
    });
}

async function commitNormalDiceMove(action, player, path, done) {
    if (!action.isCurrent()) return;
    action.setPhase('resolving');
    const sync = window.onlineGame.sync;
    try {
        const response = await sync.requestMove(path, action.turnKey);
        if (!action.isCurrent()) return;
        if (!response?.ok) {
            if (response?.restartMovement && Number.isInteger(response.state?.diceResult)) {
                applyOnlineCanonicalState(response.state, 'movement-retry', true);
                action.setPhase('notice');
                showEventPopup('移動を確認してください', response.error, () => {
                    if (action.isCurrent()) movePlayer(player, response.state.diceResult, { stepIndex: response.state.lastMovementStepIndex });
                }, { sync: false });
                return;
            }
            throw new Error(response?.error || '移動を確定できませんでした。');
        }
        if (response.state) applyOnlineCanonicalState(response.state, 'movement-commit', true);
    } catch (error) {
        if (!action.isCurrent()) return;
        action.setPhase('notice');
        showEventPopup('移動の通信エラー', '移動結果を確認できませんでした。「次へ」で再確認します。',
            () => commitNormalDiceMove(action, player, path, done), { sync: false });
        return;
    }
    done();
}

    // =========================
    // サイコロ移動の矢印を表示
    // =========================
    //
    // 現在地から1マスで移動できる
    // すべての方向を表示します。
    // サイコロ移動中は来た道を戻ることも
    // 選択できるようにします。
    // =========================

    function showDiceMovementArrows(reset = false) {

        clearDiceMovementArrows();

        if (
            !diceMovementState.active ||
            diceMovementState.autoMoving
        ) {
            return;
        }

        // =========================
        // 今回の残り歩数で
        // 最終的に止まれるマスを強調
        // =========================

        const reachableSquares = highlightDiceReachableSquares(
            diceMovementState.player,
            remainingSteps
        );

        const player =
            diceMovementState.player;

        const mapBoard =
            document.getElementById(
                "mapBoard"
            );

        if (!player || !mapBoard) {
            return;
        }

        const currentSquare =
            mapData.find(
                function (square) {

                    return square.id ===
                        player.position;

                }
            );

        if (!currentSquare) {
            return;
        }

        const options =
            getConnectedOptions(
                player.position
            );

        // =========================
        // 進める方向がない場合
        // =========================

        if (options.length === 0) {

            finishDiceMovement(
                player
            );

            return;

        }

        sendDiceMovementView("update", reachableSquares, options, reset);

        options.forEach(
            function (option) {

                const destination =
                    mapData.find(
                        function (square) {

                            return square.id ===
                                option;

                        }
                    );

                if (!destination) {
                    return;
                }

                // =========================
                // 矢印ボタン
                // =========================

                const arrow =
                    document.createElement(
                        "button"
                    );

                arrow.type =
                    "button";

                arrow.className =
                    "branch-arrow-map dice-movement-arrow";

                arrow.setAttribute(
                    "aria-label",
                    "この方向へ1マス進む"
                );

                // =========================
                // 画像矢印
                // =========================

                const arrowImage =
                    document.createElement(
                        "img"
                    );

                arrowImage.src =
                    DICE_MOVEMENT_ARROW_PATH;

                arrowImage.alt =
                    "進む";

                arrowImage.draggable =
                    false;

                arrow.appendChild(
                    arrowImage
                );

                // =========================
                // 方向計算
                // =========================
                // yajirushi.png は上向きなので、
                // 上方向を0度として回転させます。
                // =========================

                const placement=MapWorkshopScene.arrowPlacement(currentSquare,destination,options.map(id=>mapData.find(n=>n.id===id)).filter(Boolean));
                arrow.style.left=placement.x+'px';
                arrow.style.top=placement.y+'px';
                arrow.style.transform='translate(-50%, -50%) rotate('+placement.angle+'deg)';

                // =========================
                // 既存の分岐矢印CSSを
                // 画像矢印用に上書き
                // =========================

                // =========================
                // 矢印タップ
                // =========================

                arrow.addEventListener(
                    "click",
                    async function () {

                        if (
                            !diceMovementState.active
                        ) {
                            return;
                        }

                        if (
                            diceMovementState.player !==
                            player
                        ) {
                            return;
                        }

                        clearDiceMovementArrows();
                        clearReachableHighlights();

                        const history =
                            diceMovementState.history;

                        const previousPosition =
                            history.length >= 2
                                ? history[history.length - 2]
                                : null;

                        const isBacktracking =
                            option ===
                            previousPosition;

                        // =========================
// 移動履歴と残り歩数を先に更新
// =========================
//
// コマを移動させる前に、新しい残り歩数を確定します。
//

if (isBacktracking) {

    history.pop();

    remainingSteps +=
        1;

} else {

    history.push(
        option
    );

    remainingSteps -=
        1;

}


// =========================
// 1マス移動
// =========================

await moveOneStep(
    player,
    option
);

if (!diceMovementState.active || diceMovementState.player !== player || diceMovementState.history !== history || player.position !== option) return;


renderTurn();

                        // =========================
                        // 残り0なら移動終了
                        // =========================

                        if (
                            remainingSteps <= 0
                        ) {

                            finishDiceMovement(
                                player
                            );

                            return;

                        }

                        // =========================
                        // まだ移動できる場合
                        // =========================

                        showDiceMovementArrows();

                    }
                );

                mapBoard.appendChild(
                    arrow
                );

            }
        );

    }

    function sendDiceMovementView(action, reachableSquares, options, reset = false) {
        const sync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync
            ? window.onlineGame.sync
            : null;
        if (!sync || !diceMovementState.syncViewEventId) return;

        if (action === "close") {
            sync.syncMovementView({ action, eventId: diceMovementState.syncViewEventId }).then(function (response) {
                if (!response || !response.ok) console.warn("[online] 移動表示を閉じられません:", response && response.error);
            });
            diceMovementState.syncViewEventId = null;
            diceMovementState.syncViewSequence = 0;
            return;
        }

        const sequence = Number(diceMovementState.syncViewSequence || 0);
        const payload = {
            action: sequence === 0 ? "open" : "update",
            eventId: diceMovementState.syncViewEventId,
            sequence,
            ...(reset ? { reset: true } : {}),
            movementType: diceMovementState.isItemMovement ? "item" : "dice",
            showCounter: !diceMovementState.donpiEventId,
            playerIndex: Array.isArray(players) ? players.indexOf(diceMovementState.player) : -1,
            position: Number(diceMovementState.player && diceMovementState.player.position),
            remainingSteps: Number(remainingSteps),
            reachableSquares: Array.from(reachableSquares instanceof Map ? reachableSquares.keys() : []).map(Number),
            options: Array.isArray(options) ? options.map(Number) : []
        };
        diceMovementState.syncViewSequence = sequence + 1;
        sync.syncMovementView(payload).then(function (response) {
            if (!response || !response.ok) console.warn("[online] 移動可能マスを共有できません:", response && response.error);
        });
    }


    // =========================
    // プレイヤー移動
    // =========================
    //
    // サイコロを振った後は自動移動せず、
    // 矢印をタップして1マスずつ移動します。
    // =========================

    function movePlayer(
        player,
        diceNumber,
        recovery = null
    ) {

        clearReachableHighlights();
        clearDiceMovementArrows();

        diceMovementState.active =
            true;
        if (!diceMovementState.isItemMovement) window.GameActionInput?.get('dice')?.setPhase('move');

        if (window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync) {
            diceMovementState.syncViewEventId = createOnlineSyncEventId("movement-view");
            diceMovementState.syncViewSequence = 0;
        }

        // movePlayer is also used by movement items; preserve the flag set by
        // useMoveItem for this invocation and clear it only after completion.
        diceMovementState.player =
            player;

        diceMovementState.startPosition =
            player.position;
        if (recovery?.view) {
            diceMovementState.syncViewEventId = recovery.view.eventId;
            diceMovementState.syncViewSequence = recovery.view.sequence + 1;
        }

                diceMovementState.history = [
            player.position
        ];
        diceMovementState.syncStepSequence = recovery?.stepIndex || 0;

        diceMovementState.autoMoving =
            false;

        diceMovementState.totalSteps =
            diceNumber;

        remainingSteps =
            diceNumber;


        setupDiceMovementReturnButton();

        renderTurn();

        // =========================
        // 残り0の場合
        // =========================

        if (remainingSteps <= 0) {

            finishDiceMovement(
                player
            );

            return;

        }

        // =========================
        // 「現在地に戻る」を表示
        // =========================

        showDiceMovementReturnButton();

        // =========================
        // 進行方向を表示
        // =========================

        showDiceMovementArrows(Boolean(recovery));

    }

    // =========================
    // ルーレット　ちゃんとみてる？
    // =========================

    const rouletteButton =
        document.getElementById(
            "rouletteButton"
        );


    
inventoryButton.disabled =
    false;


    let onlineRemoteDiceStop = null;
    let onlineRemoteDiceCancel = null;

    // 相手が振り始めたらこちらの画面でもルーレットを開始し、
    // サーバーから確定結果が届いた時点で自動停止する。
    if (window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync) {
        window.onlineGame.sync.on("dice:rolling", function (data) {
            if (!data || String(data.playerId) === String(window.onlineGame.playerId || window.onlineGame.socket?.id)) return;
            if (remoteStepRevision) remoteStepRevision.clear();
            if (onlineRemoteDiceStop) return;
            rouletteButton.disabled = true;
            inventoryButton.disabled = true;
            onlineRemoteDiceStop = showDiceRoulette(null, function (result) {
                onlineRemoteDiceStop = null;
                if (Number.isInteger(Number(result))) {
                    remainingSteps = Number(result);
                    renderTurn();
                }
            }, { remote: true });
            onlineRemoteDiceCancel = onlineRemoteDiceStop && onlineRemoteDiceStop.cancel;
        });

        // サーバー確定状態を各クライアントのゲーム変数・UIへ反映する。
        let pendingHandoffState = null;
        let pendingHandoffTarget = null;
        function applyOnlineStatePayload(payload, options = {}) {
            if (!payload || !payload.state) return;
            if (activeKnockbackPresentation?.animating && activeKnockbackPresentation.turnKey ===
                `${payload.state.currentTurn}:${payload.state.activePlayerIndex}`) {
                activeKnockbackPresentation.latestState = payload.state;
                return;
            }
            const diceAction = window.GameActionInput.get('dice');
            if (payload.source === 'recovery' && diceAction?.phase === 'move' && diceMovementState.active
                && diceAction.turnKey === `${payload.state.currentTurn}:${payload.state.activePlayerIndex}`
                && payload.state.diceResult != null) return;
            const deferTurnView = options.deferTurnView === true;
            applyOnlineCanonicalState(payload.state, payload.source, false, { deferTurnView });
            if (payload.source === "recovery" && isLocalOnlineTurn()) window.PonziPresentation?.reconcile(payload.state);
            if (!deferTurnView) {
                applyingRemoteScreenView = true;
                try { window.GamePanels?.refresh(); } finally { applyingRemoteScreenView = false; }
            }
            // 資産購入画面を開いたまま相手が購入した場合、共有状態だけでなく
            // 一覧の所有者アイコン・購入可否も最新状態から描き直す。
            const assetPurchasePopup = document.getElementById("assetPurchasePopup");
            if (assetPurchasePopup && assetPurchasePopup.style.display === "block"
                && activeAssetPurchaseView && Array.isArray(activeAssetPurchaseView.assetIds)) {
                const assetPlayer = players[activeAssetPurchaseView.playerIndex];
                if (assetPlayer) {
                    applyingRemoteScreenView = true;
                    try {
                        showAssetPurchasePopup(assetPlayer, activeAssetPurchaseView.assetIds, undefined, activeAssetPurchaseView.suppressGreeting);
                    } finally {
                        applyingRemoteScreenView = false;
                    }
                }
            }
            // The server emits turn:update before its canonical snapshot.
            // Start effects only after that snapshot confirms this client owns
            // the turn; the per-turn key prevents duplicate execution.
            if (!deferTurnView && isLocalOnlineTurn()
                && Number(payload.state.activePlayerIndex) === Number(currentPlayer)) {
                beginPlayerTurn(players[currentPlayer]);
            }
        }
        window.onlineGame.sync.on("state", function (payload) {
            const state = payload?.state;
            if (window.TurnHandoff?.isActive() && pendingHandoffTarget && state
                && Number(state.activePlayerIndex) === pendingHandoffTarget.player
                && Number(state.currentTurn) === pendingHandoffTarget.turn) {
                pendingHandoffState = payload;
                return;
            }
            applyOnlineStatePayload(payload);
            if (state && state.fukubukuro) {
                const actor=players[Number(state.fukubukuro.playerIndex)];
                if(actor)showFukubukuroEvent(actor,state.fukubukuro);
            } else if (window.FukubukuroUI?.isOpen()) window.FukubukuroUI.close();
        });
        window.onlineGame.sync.on('sale:fade',function(payload){ApprovedCommerce.prepareRemoteSale(payload);});
        window.onlineGame.sync.on('bridge:collapse', function (payload) {
            if (!payload?.state?.bridgeCollapse) return;
            applyOnlineCanonicalState(payload.state, 'bridge-collapse-broadcast', true);
            window.GamePanels?.refresh();
            presentBridgeCollapse(payload.state, payload.eventId);
        });
        window.onlineGame.sync.on("item:warp", function (payload) {
            if (!payload || !Array.isArray(payload.moves) || !payload.state) return;
            if (Number(payload.itemId) === 23) {
                if (Number(payload.state.revision) >= window.onlineGame.sync.revision) playKnockback(payload);
                return;
            }
            if (Number(payload.itemId) === 14) {
                applyOnlineCanonicalState(payload.state, "item-warp-observer", true);
                if (typeof warpSound !== "undefined") {
                    warpSound.currentTime = 0;
                    (window.GameSE ? window.GameSE.playLocal(warpSound) : warpSound.play()).catch(function () {});
                }
                return;
            }
            playOnlineWarpMoves(payload, function () {
                applyOnlineCanonicalState(payload.state, "item-warp-observer", true);
            });
        });
        window.onlineGame.sync.on('recovery:after', function (frame) {
            if(frame?.state?.fukubukuro){
                const actor=players[Number(frame.state.fukubukuro.playerIndex)];
                if(actor)showFukubukuroEvent(actor,frame.state.fukubukuro);
            }
            if (!frame.observer) {
                const actor = players[frame.state.activePlayerIndex];
                const pending = frame.pendingDuplicateItem;
                const selection = frame.packets?.find(packet => packet.name === 'game:screen:sync')?.payload;
                const saleNotice = frame.packets?.find(packet => packet.name === 'game:sale:fade')?.payload;
                if (saleNotice) ApprovedCommerce.prepareRemoteSale(saleNotice);
                if (actor && pending) showDuplicateItemResult(actor, pending.result, pending.requestId);
                else if (actor && selection?.action === 'open' && selection.screenData?.itemId === 32 && !window.DuplicateItemUI?.isOpen()) {
                    window.showDuplicateItemSelection(actor, selection.screenData.useIndex, false, true);
                }
            }
            const action = frame.pendingSpecialItem;
            if (!frame.observer && action && !window.specialItemActionPending) {
                const player = players[Number(frame.state.activePlayerIndex)];
                window.specialItemActionPending = true;
                window.SpecialItemUI?.hide();
                if (Number(action.itemId) === 25) showSpecialItemScreen(player, 25, 'result');
                else if (Number(action.itemId) === 26) {
                    const targetIndex = Number(action.result?.targetIndex);
                    const target = players[targetIndex];
                    syncOnlineScreenView('', player, 'close');
                    const finish = () => { window.specialItemActionPending = false; finishTurn(player); };
                    if (action.result?.immunityBlocked && target) announceImmunityBlock('アイテム封じ', target, player, finish);
                    else showEventPopup('アイテム封じ', '3ターンアイテムを使用できなくなった！', finish, {subjectIndex:targetIndex,advanceAnywhere:true});
                }
            }
            const warp = frame.pendingWarp;
            const knockback = frame.pendingKnockback;
            if (knockback && !activeKnockbackPresentation && (!frame.observer || !knockback.animationComplete)) {
                playKnockback(knockback, !frame.observer);
            }
            if (frame.observer || !warp || Number(warp.itemId) !== 24 || specialWarpInFlight) return;
            const player = players[Number(warp.playerIndex)];
            const destination = SpecialItemRules.destinations.find(entry => entry.id === Number(warp.moves?.[0]?.toPosition));
            if (!player || !destination) return;
            specialWarpInFlight = true;
            window.onlineGame.sync.completeWarpItem(warp.requestId).then(function (response) {
                if (!response?.ok || !response.state) throw new Error(response?.error || 'ワープ結果を確認できませんでした。');
                applyOnlineCanonicalState(response.state, 'landmark-recovery', true);
                window.SpecialItemUI?.hide();
                syncOnlineScreenView('', player, 'close');
                showEventPopup('ランドマークワープ', `${destination.name}に到着！`, () => finishTurn(player), {subjectIndex:players.indexOf(player),advanceAnywhere:true});
            }).catch(error => console.error('[online] ランドマークワープの復旧に失敗:', error))
              .finally(() => { specialWarpInFlight = false; });
        });
        // 相手のマスイベントは表示だけ共有し、イベント効果のcallbackは実行しない。
        // OKボタンは各クライアントで個別に閉じられる。
        window.onlineGame.sync.on("ui:sync", function (data) {
            if (!data) return;
            if (data.variant === 'hatataki-haken') { renderHatatakiRemote(data); return; }
            if (data.variant === "treasure-bonus-banner") {
                const banner = document.getElementById("treasureBonusBanner");
                if (!banner) return;
                if (data.action === "close" || data.visible === false) {
                    banner.style.display = "none";
                    window.CommonAnnouncements?.render(banner, null);
                    document.body.classList.remove("treasure-bonus-moving", "treasure-bonus-dice");
                    document.getElementById("itemRoulette").style.display = "none";
                    document.getElementById("diceRoulette").style.display = "none";
                    window.DiceGameUI?.closeTreasureBonusPreview();
                    window.DiceGameUI?.closeRemoteTreasureBonus();
                    return;
                }
                if (data.visible !== true || typeof data.message !== "string") return;
                window.SlotPresentation?.clear();
                document.getElementById("itemRoulette").style.display = "block";
                if (data.recovery && typeof data.itemName === "string") {
                    document.getElementById("itemRouletteName").textContent = data.itemName;
                }
                banner.querySelector(".event-popup-title").textContent = "宝箱";
                banner.querySelector(".event-popup-message").textContent = data.message;
                window.CommonAnnouncements?.render(banner, data.announcement || {common:true, subjectIndex:Number(data.activePlayerIndex)},
                    {players, icon:getPlayerCharacterIcon, eventId:data.eventId});
                banner.classList.add("slot-arrival-announcement");
                banner.style.display = "block";
                document.body.classList.toggle("treasure-bonus-moving", ["moving", "dice", "result"].includes(data.stage));
                document.body.classList.add("treasure-bonus-dice");
                if (["challenge", "moving"].includes(data.stage)) window.DiceGameUI.showTreasureBonusPreview();
                return;
            }
            if (data.variant === 'bridge-mugging') {
                if (data.action === 'close' || data.visible === false) window.BridgeMuggingPresentation?.closeRemote(data.eventId);
                else if (data.visible === true) window.BridgeMuggingPresentation?.renderRemote(data);
                return;
            }
            const popup = document.getElementById("eventPopup");
            if (!popup) return;
            if (data.action === "close" || data.visible === false) {
                const wasBossDestination = popup.classList.contains("boss-destination-popup");
                popup.style.display = "none";
                window.CommonAnnouncements?.render(popup, null);
                popup.classList.remove("job-result-popup");
                popup.classList.remove("boss-destination-popup", "boss-counter-popup");
                const button = document.getElementById("eventPopupButton");
                if (button) button.disabled = false;
                if (wasBossDestination && (!bossVictoryBGM.paused || bossVictoryBGM.currentTime > 0)) {
                    stopAllBGM();
                    setupAdventureBGM();
                }
                return;
            }
            if (data.visible !== true || typeof data.title !== "string" || typeof data.message !== "string") return;
            if (data.message === "橋の復旧が完了した！") {
                window.bridgeCollapseRecoveryPending = null;
                if (data.eventId) window.bridgeCollapseRecoveryShownEventIds?.add(String(data.eventId));
                window.bridgeCollapseVisualState = null;
                renderMap();
                window.GamePanels?.refresh();
            }
            const title = popup.querySelector(".event-popup-title");
            const message = document.getElementById("eventPopupMessage");
            const button = document.getElementById("eventPopupButton");
            if (!title || !message || !button) return;
            title.textContent = data.title;
            window.setSafeRichContent(message, data.message);
            popup.classList.toggle("job-result-popup", data.variant === "job-result");
            popup.classList.toggle("boss-destination-popup", data.variant === "boss-destination");
            popup.classList.toggle("boss-counter-popup", data.variant === "boss-counter");
            button.textContent = "OK";
            // Shared result dialogs remain visible until the active player dismisses them.
            // The observer cannot advance or close the active player's event.
            button.disabled = true;
            button.onclick = null;
            popup.style.display = "block";
            window.CommonAnnouncements?.render(popup, data.announcement || null, {players,icon:getPlayerCharacterIcon,eventId:data.eventId});
            if (data.variant === "boss-counter") window.GameSE.playLocal(new Audio("sounds/戦闘/怪獣の足音.mp3")).catch(function () {});
            if (data.variant === "boss-destination") showBossDestinationPopup(null, true);
        });
        window.onlineGame.sync.on("scene:sync", renderRemoteOnlineScene);
        window.onlineGame.sync.on("screen:sync", function (data) {
            if (!data) return;
            if (data.screenType === "ponzi" && data.action === "open") {
                const syncedState = window.onlineGame.sync.state;
                const screenState = data.screenData?.state;
                const state = !syncedState || screenState?.revision > syncedState.revision ? screenState : syncedState;
                const localId = window.onlineGame.playerId || window.onlineGame.socket?.id;
                if (Number(data.playerIndex) === state?.activePlayerIndex
                    && state.players[state.activePlayerIndex]?.id !== localId && window.PonziRules.pending(state)) {
                    window.PonziPresentation.observe(state, data.screenData);
                }
                return;
            }
            if (data.action !== "close" && data.screenData?.panel && window.GamePanels?.remote(data.screenType, data.screenData.panel, Number(data.playerIndex))) return;
            const sharedScreenIds = ["shopPopup", "magicShopPopup", "powerShopPopup", "assetPopup", "assetPurchasePopup", "salePopup", "inventoryPopup", "magicPopup", "otherMenuPopup", "soundSettingsPopup", "lossNotePlayerPopup", "lostMagicPlayerPopup", "lostMagicSelectionPopup", "transferPlayerPopup", "transferTypePopup", "moneyTransferAmountPopup", "moneyTransferScreen", "darkSuumoAssetPopup"];
            if (data.action === "close") {
                closeLostMagic();
                window.DuplicateItemUI?.hide();
                window.PonziPresentation?.closeObserver();
                window.SpecialItemUI?.hide();
                remoteShopViewActive = false;
                sharedScreenIds.forEach(function (id) {
                    const popup = document.getElementById(id);
                    if (popup) popup.style.display = "none";
                });
                resetSharedShopCloseControls();
                document.body.classList.remove("magic-shop-dual-layout");
                return;
            }
            const shopPlayer = players[Number(data.playerIndex)];
            if (!shopPlayer) return;
            const localPlayerIndex = Number(currentPlayer);
            const screenPlayerIndex = Array.isArray(players) ? players.indexOf(shopPlayer) : -1;
            const isLocalActivePlayer = isLocalOnlineTurn()
                && Number.isInteger(localPlayerIndex)
                && screenPlayerIndex === localPlayerIndex
                && window.onlineGame && window.onlineGame.socket
                && String(shopPlayer.id) === String((window.onlineGame.playerId || window.onlineGame.socket.id));
            // A stale/late shared-screen message must not turn the active
            // player's own shop into a read-only spectator view.
            remoteShopViewActive = !isLocalActivePlayer;
            applyingRemoteScreenView = true;
            try {
                window.DuplicateItemUI?.hide();
                window.SpecialItemUI?.hide();
                sharedScreenIds.forEach(function (id) {
                    const popup = document.getElementById(id);
                    if (popup) popup.style.display = "none";
                });
                const silentShop = data.recovery || data.screenData?.suppressGreeting === true;
                if (data.screenType === "magic-menu" || data.screenType === "magic" || data.screenType === "power") ApprovedCommerce.showStore(shopPlayer,'magic',silentShop);
                else if (data.screenType === "magic-status") window.showMagicPopup(shopPlayer);
                else if (data.screenType === "item" || data.screenType === "item-list") ApprovedCommerce.showStore(shopPlayer,'item',silentShop);
                else if (data.screenType === "inventory") {
                    const inventoryPopup = document.getElementById("inventoryPopup");
                    if (inventoryPopup) inventoryPopup.style.display = "block";
                    try {
                        showInventoryPopup(shopPlayer);
                    } catch (error) {
                        console.error("[online] 観覧側のアイテム一覧描画に失敗:", error);
                    }
                    if (inventoryPopup) inventoryPopup.style.display = "block";
                }
                else if (data.screenType === "other-menu") {
                    const popup = document.getElementById("otherMenuPopup");
                    if (popup) popup.style.display = "block";
                }
                else if (data.screenType === "sound-settings") {
                    const popup = document.getElementById("soundSettingsPopup");
                    if (popup) { popup.style.display = "block"; window.GamePanels?.anchorFrame("soundSettingsPopup"); }
                }
                else if (data.screenType === "asset-list") showAssetPopup(shopPlayer);
                else if (data.screenType === "sale-list") ApprovedCommerce.showSales(shopPlayer,data.screenData?.category,()=>{},true);
                else if (data.screenType === "asset-purchase") {
                    const square = mapData.find(function (entry) { return Number(entry.id) === Number(shopPlayer.position); });
                    const assetIds = square ? (square.typeIds || []).flatMap(function (typeId) {
                        const box = ASSET_BOXES[typeId];
                        return box && Array.isArray(box.contents) ? box.contents : [];
                    }) : [];
                    showAssetPurchasePopup(shopPlayer, assetIds, undefined, silentShop);
                }
                else if (data.screenType === "special-item") {
                    showSpecialItemScreen(shopPlayer, data.screenData.itemId, data.screenData.stage, data.screenData.destination, true);
                }
                else if (data.screenType === "item-action") {
                    const view = data.screenData || {};
                    const targetPlayer = players[Number(view.targetIndex)];
                    if (Number(view.itemId) === 18) {
                        renderLostMagicRemote(shopPlayer, view, isLocalActivePlayer);
                    } else if (view.itemId === 32 && view.stage === "duplicate") {
                        if (!isLocalActivePlayer) window.showDuplicateItemSelection(shopPlayer, view.useIndex, true);
                    } else if (view.itemId === 13) {
                        showLossNotePlayerPopup(shopPlayer, view.stage, view.targetIndex, true);
                    } else if (view.itemId === 19) {
                        showMoneyTransferNewUI(shopPlayer, view.stage, view.targetIndex, view.type, view.amount, true);
                    } else if (view.itemId === 21) {
                        showItemTransferUI(shopPlayer, view.stage, view.targetIndex, view.type, true);
                    } else if (view.stage === "target") {
                        if (view.itemId === 22) showDarkSuumoPlayerPopup(shopPlayer);
                    } else if (targetPlayer && view.stage === "type") {
                        if (view.itemId === 19) showMoneyTransferTypePopup(shopPlayer, targetPlayer);
                        else showTransferTypePopup(shopPlayer, targetPlayer, {
                            title: "闇スーモ",
                            sendLabel: "🎁 贈与",
                            stealLabel: "💥 強奪",
                            onSelect: function () {},
                            onBack: function () {}
                        });
                    } else if (targetPlayer && view.stage === "amount") {
                        showMoneyTransferAmountPopup(shopPlayer, targetPlayer, view.type);
                    } else if (targetPlayer && view.stage === "assets") {
                        showDarkSuumoAssetPopup(shopPlayer, targetPlayer, view.type);
                    }
                }
                if (data.screenData?.panel) window.GamePanels?.remote(data.screenType, data.screenData.panel, Number(data.playerIndex));
                // Read-only shared view: disable every state-changing control and
                // replace close handlers so the observer cannot finish the turn.
                document.querySelectorAll(".magic-shop-buy-button, .shop-item-buy-button, .shop-purchase-button, .asset-purchase-button").forEach(function (button) {
                    // Re-rendered purchase buttons must remain usable only by the
                    // local player whose turn it is; observers stay read-only.
                    button.disabled = button.classList.contains("asset-purchase-button")
                        ? button.disabled || !isLocalActivePlayer
                        : !isLocalActivePlayer;
                });
                ["shopCloseButton", "shopCloseButton2", "magicShopCloseButton", "powerShopCloseButton", "assetCloseButton", "assetPurchaseCloseButton"].forEach(function (id) {
                    const button = document.getElementById(id);
                    if (!button) return;
                    button.disabled = !isLocalActivePlayer;
                    if (!isLocalActivePlayer) button.onclick = function () {};
                });
                if (!isLocalActivePlayer) {
                    sharedScreenIds.forEach(function (id) {
                        const popup = document.getElementById(id);
                        if (!popup) return;
                        popup.querySelectorAll("button, input, select, textarea").forEach(function (control) {
                            control.disabled = true;
                        });
                    });
                }
            } finally {
                applyingRemoteScreenView = false;
            }
        });
        let remoteMovementView = null;
        function clearRemoteMovementView(eventId) {
            if (eventId && remoteMovementView && remoteMovementView.eventId !== eventId) return;
            document.querySelectorAll(".map-node.observer-reachable-highlight").forEach(function (node) {
                node.classList.remove("observer-reachable-highlight", "reachable-stop-highlight");
            });
            document.querySelectorAll(".observer-dice-movement-arrow").forEach(function (arrow) { arrow.remove(); });
            document.querySelectorAll(".observer-dice-movement-counter").forEach(function (counter) { counter.remove(); });
            remoteMovementView = null;
        }
        function renderRemoteMovementCounter(playerIndex, position, steps) {
            window.DiceMovementCounter.show(Number(steps), true);
        }
        function renderRemoteMovementView(data) {
            if (!data || !data.eventId || !Array.isArray(data.reachableSquares) || !Array.isArray(data.options)) return;
            const viewerIsActive = isLocalOnlineTurn()
                && Number(currentPlayer) === Number(data.playerIndex);
            if (viewerIsActive) return;
            clearRemoteMovementView();
            if (data.reset === true) {
                const player = players[Number(data.playerIndex)];
                if (player) {
                    player.position = Number(data.position);
                    renderPlayers();
                    refreshShortestPathToBoss();
                }
            }
            remoteMovementView = { eventId: data.eventId, playerId: data.playerId, sequence: Number(data.sequence) || 0, data: data };
            if (data.showCounter !== false) {
                renderRemoteMovementCounter(data.playerIndex, data.position, data.remainingSteps);
            }
            data.reachableSquares.forEach(function (squareId) {
                const node = document.querySelector('.map-node[data-square-id="' + Number(squareId) + '"]');
                if (node) node.classList.add("reachable-stop-highlight", "observer-reachable-highlight");
            });
            const mapBoard = document.getElementById("mapBoard");
            const currentSquare = mapData.find(function (square) { return Number(square.id) === Number(data.position); });
            if (!mapBoard || !currentSquare) return;
            data.options.forEach(function (optionId) {
                const destination = mapData.find(function (square) { return Number(square.id) === Number(optionId); });
                if (!destination) return;
                const arrow = document.createElement("div");
                arrow.className = "branch-arrow-map dice-movement-arrow observer-dice-movement-arrow";
                arrow.setAttribute("aria-hidden", "true");
                arrow.style.pointerEvents = "none";
                const image = document.createElement("img");
                image.src = DICE_MOVEMENT_ARROW_PATH;
                image.alt = "";
                image.draggable = false;
                arrow.appendChild(image);
                const placement=MapWorkshopScene.arrowPlacement(currentSquare,destination,data.options.map(id=>mapData.find(n=>Number(n.id)===Number(id))).filter(Boolean));
                arrow.style.left=placement.x+'px';
                arrow.style.top=placement.y+'px';
                arrow.style.transform='translate(-50%, -50%) rotate('+placement.angle+'deg)';
                mapBoard.appendChild(arrow);
            });
        }
        window.onlineGame.sync.on("movement:view", function (data) {
            if (!data) return;
            if (data.action === "close") {
                clearRemoteMovementView(data.eventId);
                return;
            }
            // 手番側が出目を確認して移動選択に進んだら、観覧側も閉じる。
            window.DiceGameUI.confirmRemote();
            if (remoteMovementView && remoteMovementView.eventId === data.eventId
                && Number(data.sequence) <= remoteMovementView.sequence) return;
            renderRemoteMovementView(data);
        });
        const remoteRoulettes = { gold: null, item: null, multiDice: null };
        window.onlineGame.sync.on("recovery:before", function (frame) {
            if (!frame.observer && !frame.turnChanged) return;
            window.cancelTreasureBonusPresentation?.();
            document.body.classList.remove("treasure-bonus-moving", "treasure-bonus-dice");
            const treasureBanner = document.getElementById("treasureBonusBanner");
            if (treasureBanner) { treasureBanner.style.display = "none"; window.CommonAnnouncements?.render(treasureBanner, null); }
            window.DiceGameUI.cancelAll();
            window.DiceMovementCounter.hide();
            clearRemoteMovementView();
            if (onlineRemoteDiceCancel) onlineRemoteDiceCancel();
            onlineRemoteDiceCancel = null;
            onlineRemoteDiceStop = null;
            ["gold", "item", "multiDice"].forEach(function (type) {
                const roulette = remoteRoulettes[type];
                if (roulette) { clearInterval(roulette.interval); clearTimeout(roulette.hideTimer); if (roulette.slot && roulette.slot.cancel) roulette.slot.cancel(); }
                remoteRoulettes[type] = null;
            });
            ["eventPopup", "jobPopup", "diceRoulette", "goldRoulette", "itemRoulette", "multiDiceRoulette", "monsterChoicePopup"].forEach(function (id) {
                const popup = document.getElementById(id);
                if (popup) { popup.style.display = "none"; popup.classList.remove("spinning"); }
            });
            remoteOnlineSceneId = null;
            remoteOnlineSceneView = null;
            remoteShopViewActive = false;
            if (remoteOnlineJobVoice) {
                if (window.GameSE) window.GameSE.stop(remoteOnlineJobVoice); else remoteOnlineJobVoice.pause();
                remoteOnlineJobVoice = null;
            }
        });
        window.onlineGame.sync.on("recovery:after", function (frame) {
            if ('hatataki' in frame) renderHatatakiRemote(frame.hatataki || { action:'close' });
            if ('lostMagic' in frame) {
                const screen = frame.lostMagic;
                const actor = screen && players[screen.playerIndex];
                if (actor) renderLostMagicRemote(actor, screen.screenData, !frame.observer, true);
                else closeLostMagic();
            }
            if (!frame.observer && frame.state.matchPhase === 'playing') {
                const owner = players[Number(frame.state.activePlayerIndex)];
                const turnKey = `${frame.state.currentTurn}:${frame.state.activePlayerIndex}`;
                if (owner && frame.state.bridgeCollapse?.useTurnKey === turnKey) {
                    presentBridgeCollapse(frame.state, frame.state.bridgeCollapse.eventId);
                }
                if (owner && Number.isInteger(frame.state.diceResult)) {
                    const pendingRoll = window.GameActionInput.get('dice');
                    const action = pendingRoll?.phase === 'recovering' && pendingRoll.turnKey === turnKey
                        ? pendingRoll : window.GameActionInput.begin('dice', turnKey);
                    if (action && !frame.state.diceRevealed) showNormalDice(action, owner, frame.state.diceResult, window.onlineGame.sync);
                    if (action && frame.state.diceRevealed) {
                        const view = frame.packets?.find(packet => packet.name === 'game:movement:view' && packet.payload.action !== 'close');
                        movePlayer(owner, frame.state.diceResult, { view: view?.payload, stepIndex: frame.state.lastMovementStepIndex });
                    }
                }
            }
            const mugging=frame?.state?.bridgeMugging;
            if(!frame?.observer&&mugging?.status==='active'&&String(mugging.playerId)===String(players?.[Number(frame.state.activePlayerIndex)]?.id)){
                window.BridgeMuggingPresentation?.closeRemote(mugging.eventId);
                presentBridgeMugging(players[Number(frame.state.activePlayerIndex)],mugging,true,false);
            }
            if (frame.observer && frame.movementPosition != null) {
                const active = players[Number(frame.state.activePlayerIndex)];
                if (active) { active.position = Number(frame.movementPosition); renderPlayers(); }
            }
            refreshOnlineTurnControls();
        });
        function stopRemoteRoulette(type, value, multipleGet = false) {
            const state = remoteRoulettes[type];
            if (!state) return;
            clearInterval(state.interval);
            if (["gold", "item"].includes(type) && state.slot) {
                const finalText = type === "gold" ? `${formatG(Number(value))}G` : String(value);
                state.slot.stop(finalText, function () {
                    const roulette = document.getElementById(type === "gold" ? "goldRoulette" : "itemRoulette");
                    if (roulette) roulette.classList.remove("spinning");
                    if (type === "item" && multipleGet) { if (roulette) roulette.style.display = "block"; remoteRoulettes[type] = null; return; }
                    state.hideTimer = setTimeout(function () {
                        if (roulette) roulette.style.display = "none";
                        if (remoteRoulettes[type] === state) remoteRoulettes[type] = null;
                    }, 1000);
                });
                return;
            }
            if (type === "gold") {
                const number = document.getElementById("goldRouletteNumber");
                if (number) number.textContent = `${formatG(Number(value))}G`;
            } else if (type === "item") {
                const name = document.getElementById("itemRouletteName");
                if (name) name.textContent = String(value);
            }
            setTimeout(function () {
                const roulette = document.getElementById(type === "gold" ? "goldRoulette" : type === "item" ? "itemRoulette" : "multiDiceRoulette");
                if (roulette) { roulette.style.display = "none"; roulette.classList.remove("spinning"); }
                remoteRoulettes[type] = null;
            }, 650);
        }
        window.onlineGame.sync.on("roulette:sync", function (data) {
            if (!data || !["gold", "item", "multiDice", "treasureBonus"].includes(data.type)) return;
            const type = data.type;
            if (type === "treasureBonus") { window.DiceGameUI.remoteTreasureBonus(data); return; }
            if (type === "multiDice") {
                if (data.action === "start" && remoteStepRevision) remoteStepRevision.clear();
                window.DiceGameUI.remoteMulti(data);
                return;
            }
            const roulette = document.getElementById(type === "gold" ? "goldRoulette" : type === "item" ? "itemRoulette" : "multiDiceRoulette");
            const output = type === "gold" ? document.getElementById("goldRouletteNumber") : type === "item" ? document.getElementById("itemRouletteName") : document.getElementById("multiDiceNumbers");
            if (!roulette || !output) return;
            if (data.action === "start") {
                if (remoteRoulettes[type]) {
                    clearInterval(remoteRoulettes[type].interval);
                    clearTimeout(remoteRoulettes[type].hideTimer);
                }
                roulette.style.display = "block";
                roulette.classList.add("spinning");
                if (type === "gold") {
                    // 操作側と同じ縦型リールを使い、観覧側では停止操作を受け付けない。
                    roulette.onclick = null;
                    remoteRoulettes[type] = {
                        eventId: data.eventId,
                        slot: startVerticalSlot(roulette, output, getGoldSquareSlotValues()),
                        interval: null,
                        hideTimer: null
                    };
                    return;
                }
                if (type === "item") {
                    roulette.onclick = null;
                    const itemCandidates = Object.values(ITEM_CONTENTS || {}).filter(function (item) { return Number(item && item.rank) < 99; }).map(function (item) {
                        return item && item.name;
                    }).filter(Boolean);
                    remoteRoulettes[type] = {
                        eventId: data.eventId,
                        slot: startVerticalSlot(roulette, output, itemCandidates),
                        interval: null,
                        hideTimer: null
                    };
                    return;
                }
            } else if (data.action === "stop") {
                if (remoteRoulettes[type] && remoteRoulettes[type].eventId !== data.eventId) return;
                stopRemoteRoulette(type, data.value, data.multipleGet === true);
            }
        });
        window.onlineGame.sync.on("turn:update", function (data) {
            if (!data || !Number.isInteger(Number(data.activePlayerIndex))) return;
            const changed = Number(data.activePlayerIndex) !== Number(currentPlayer) || Number(data.currentTurn) !== Number(currentTurn);
            if (changed) {
                activeKnockbackPresentation = null;
                window.specialItemActionPending = false;
                window.DuplicateItemUI?.hide();
                closeLostMagic();
                renderHatatakiRemote({ action:'close' });
            }
            if (data.turnStartEffects?.bridgeCollapseRestored) {
                const eventId = String(data.turnStartEffects.bridgeCollapseRecoveryEventId || "");
                if (!eventId || !window.bridgeCollapseRecoveryShownEventIds?.has(eventId)) {
                    window.bridgeCollapseRecoveryPending = {
                        playerIndex:Number(data.activePlayerIndex),
                        currentTurn:Number(data.currentTurn),
                        eventId:eventId || null
                    };
                }
            }
            if (data.turnStartEffects) pendingOnlineTurnStartEffects = {
                playerIndex:Number(data.activePlayerIndex), currentTurn:Number(data.currentTurn),
                bossCounter:data.turnStartEffects.bossCounter || null,
                appliedEffects:Array.isArray(data.turnStartEffects.appliedEffects) ? data.turnStartEffects.appliedEffects : [],
                expiredItems:Array.isArray(data.turnStartEffects.expiredItems) ? data.turnStartEffects.expiredItems : []
            };
            const applyTurnUpdate = function () {
            window.DiceGameUI.cancelAll();
            window.DiceMovementCounter.hide();
            playPlayerSwitchingSound();

            lastLocalScreenKey = null;
            clearRemoteMovementView();
            if (typeof window.setOnlineTurnState === "function") {
                window.setOnlineTurnState(Number(data.activePlayerIndex), data.currentTurn);
            }
            if (isLocalOnlineTurn() && remoteShopViewActive) {
                ["shopPopup", "magicShopPopup", "powerShopPopup", "assetPopup", "assetPurchasePopup", "inventoryPopup", "magicPopup", "otherMenuPopup", "soundSettingsPopup"].forEach(function (id) {
                    const popup = document.getElementById(id);
                    if (popup) popup.style.display = "none";
                    if (id === "soundSettingsPopup") window.GamePanels?.releaseFrame(id);
                });
                remoteShopViewActive = false;
                document.body.classList.remove("magic-shop-dual-layout");
            }
            if (isLocalOnlineTurn()) resetSharedShopCloseControls();
            if (isLocalOnlineTurn() && remoteOnlineSceneId) {
                const scenePopup = document.getElementById("jobPopup");
                if (scenePopup) scenePopup.style.display = "none";
                remoteOnlineSceneId = null;
                remoteOnlineSceneView = null;
            }
            // The turn event and its following state snapshot arrive separately.
            // Apply the snapshot's data first, then rebuild the map and turn UI once.
            renderMap();
            renderPlayers();
            renderTurn();
            refreshShortestPathToBoss();
            applyingRemoteScreenView = true;
            try { window.GamePanels?.refresh(); } finally { applyingRemoteScreenView = false; }
            refreshOnlineTurnControls();
            if (isLocalOnlineTurn() && (!data.undergroundStage || data.turnStartEffects?.bridgeCollapseRestored)) {
                // Dice/inventory are disabled directly during another player's
                // roll; those locks are not owned by refreshOnlineTurnControls.
                // A confirmed turn update resets them for the newly active player.
                rouletteButton.disabled = false;
                inventoryButton.disabled = false;
                startNextPlayerTurn(players[currentPlayer]);
            }
            };
            if (!changed || !window.TurnHandoff) { applyTurnUpdate(); return; }
            pendingHandoffTarget = { player:Number(data.activePlayerIndex), turn:Number(data.currentTurn) };
            window.TurnHandoff.run(function () {
                const queued = pendingHandoffState;
                pendingHandoffState = null; pendingHandoffTarget = null;
                if (queued) applyOnlineStatePayload(queued, { deferTurnView:true });
                applyTurnUpdate();
            });
        });
        // 操作プレイヤーが矢印で1マス動かすたび、同じステップを即時配信する。
        let remoteStepRevision = new Map();
        let remoteMovementGeneration = 0;
        window.onlineGame.sync.on("recovery:before", function (frame) {
            if (frame.observer || frame.turnChanged) {
                remoteMovementGeneration++;
                remoteStepRevision.clear();
            }
        });
        window.onlineGame.sync.on("move:step", function (data) {
            if (!data) return;
            const remotePlayer = players.find(function (candidate) { return candidate && String(candidate.id) === String(data.playerId); }) || players[Number(data.playerIndex)];
            if (!remotePlayer) return;
            const key = String(data.playerId || data.playerIndex) + ":" + String(data.movementType || "dice");
            const previousStep = remoteStepRevision.get(key) || 0;
            if (Number(data.stepIndex) <= previousStep) return;
            remoteStepRevision.set(key, Number(data.stepIndex));
            moveOneStep(remotePlayer, Number(data.position), data.speedMultiplier === 2 ? 2 : 1);
            if (remoteMovementView && remoteMovementView.showCounter === false) {
                document.querySelectorAll(".observer-dice-movement-counter").forEach(function (counter) { counter.remove(); });
            } else {
                renderRemoteMovementCounter(data.playerIndex, data.position, data.remainingSteps);
            }
        });

        // 移動確定通知は相手側だけで受け取り、同じ経路を再生する。
        // 相手側ではマスイベントを発火させず、表示上の位置だけを更新する。
        window.onlineGame.sync.on("move:path", function (data) {
            if (!data || !Array.isArray(data.path) || data.path.length < 2) return;
            clearRemoteMovementView();
            // Socket IDでの照合を優先し、初期化タイミングなどでIDが
            // 一致しない場合はサーバーが通知したプレイヤー番号で照合する。
            const remotePlayer = players.find(function (candidate) {
                return candidate && String(candidate.id) === String(data.playerId);
            }) || (Number.isInteger(Number(data.playerIndex))
                ? players[Number(data.playerIndex)]
                : null);
            if (!remotePlayer) {
                console.error("[online] 移動プレイヤーを特定できません:", {
                    playerId: data.playerId,
                    playerIndex: data.playerIndex,
                    localPlayers: players.map(function (candidate) {
                        return candidate ? { id: candidate.id, name: candidate.name, position: candidate.position } : null;
                    })
                });
                return;
            }
            // ステップ同期ですでに到着している場合は、同じ経路を二重再生しない。
            if (Number(remotePlayer.position) === Number(data.position)) {
                refreshShortestPathToBoss();
                return;
            }
            // ステップ通知が一部欠落していても、現在位置以降だけを補完再生する。
            const pathStart = Number(data.path[0]);
            let pathIndex = data.path.findIndex(function (square) { return Number(square) === Number(remotePlayer.position); });
            if (pathIndex < 0) {
                console.warn("[online] 移動開始位置をサーバー経路に合わせます:", {
                    localPosition: remotePlayer.position,
                    pathStart: pathStart,
                    playerId: data.playerId
                });
                remotePlayer.position = pathStart;
                pathIndex = 0;
                renderMap();
                renderPlayers();
            }
            pathIndex += 1;
            const generation = remoteMovementGeneration;
            const playRemoteStep = function () {
                if (generation !== remoteMovementGeneration) return;
                if (pathIndex >= data.path.length) {
                    remotePlayer.position = Number(data.position);
                    renderMap();
                    renderPlayers();
                    refreshShortestPathToBoss();
                    return;
                }
                const animation=moveOneStep(remotePlayer, data.path[pathIndex], data.speedMultiplier === 2 ? 2 : 1);
                pathIndex += 1;
                Promise.resolve(animation).then(playRemoteStep);
            };
            playRemoteStep();
        });

        window.onlineGame.sync.on("dice:result", function (data) {
            if (!data || !Number.isInteger(Number(data.result))) return;
            const result = Number(data.result);

            if (String(data.playerId) === String(window.onlineGame.playerId || window.onlineGame.socket?.id)) return;

            rouletteButton.disabled = true;
            inventoryButton.disabled = true;

            // 通常は dice:rolling で開始済み。結果が先に届いた場合にも
            // 回転し続ける状態を残さないよう、確定結果で停止する。
            if (onlineRemoteDiceStop) {
                const stop = onlineRemoteDiceStop;
                onlineRemoteDiceStop = null;
                stop(result);
            } else {
                onlineRemoteDiceStop = showDiceRoulette(null, function (finalResult) {
                    onlineRemoteDiceStop = null;
                    remainingSteps = Number(finalResult);
                    renderTurn();
                }, { remote: true });
                onlineRemoteDiceCancel = onlineRemoteDiceStop && onlineRemoteDiceStop.cancel;
                const stop = onlineRemoteDiceStop;
                onlineRemoteDiceStop = null;
                stop(result);
            }
        });
    }

    refreshOnlineTurnControls();

    function showNormalDice(action, player, number, sync) {
        if (!action.isCurrent()) return;
        if (!Number.isInteger(number) || number < 1 || number > 6) {
            action.finish();
            alert('サイコロの結果を取得できませんでした。');
            return;
        }
        action.setPhase('dice');
        let revealRequest;
        const reveal = () => sync.revealDice(action.turnKey).catch(() => ({ ok: false }));
        const startMove = async () => {
            if (!action.isCurrent() || !['dice', 'notice'].includes(action.phase)) return;
            action.setPhase('resolving');
            const response = sync && await (revealRequest || reveal());
            if (!action.isCurrent()) return;
            if (sync && !response?.ok) {
                revealRequest = null;
                action.setPhase('notice');
                showEventPopup('サイコロの通信エラー', '出目を確認できませんでした。「次へ」で再確認します。', startMove, { sync: false });
                return;
            }
            movePlayer(player, number);
        };
        showDiceRoulette(number, startMove, sync ? { onStop() { revealRequest = reveal(); } } : {});
    }

    rouletteButton.addEventListener('click', async function (event) {
        if (window.UndergroundUI?.handleDiceButton()) { event.stopPropagation(); return; }
        if (window.onlineGame?.isOnline && !isLocalOnlineTurn()) return;
        const player = players[currentPlayer];
        if (!player || this.disabled || window.TurnHandoff?.isActive()) return;
        const action = window.GameActionInput.begin('dice', `${currentTurn}:${currentPlayer}`);
        if (!action) return;
        const sync = window.onlineGame?.isOnline ? window.onlineGame.sync : null;
        try {
            window.updateEncounterCondition?.();
            if (!sync) {
                const number = consumeNextDiceAllSix(player) ? 6 : Math.floor(Math.random() * 6) + 1;
                showNormalDice(action, player, number);
                return;
            }
            const response = await sync.requestDice(action.turnKey);
            if (!action.isCurrent()) return;
            if (!response?.ok) throw new Error(response?.error || 'サイコロを振れませんでした。');
            if (response.state) applyOnlineCanonicalState(response.state, 'dice-request', true);
            showNormalDice(action, player, Number(response.result), sync);
        } catch (error) {
            if (!action.isCurrent()) return;
            action.setPhase('recovering');
            await sync?.recover?.(true);
            if (!action.isCurrent() || action.phase !== 'recovering') return;
            action.setPhase('notice');
            showEventPopup('サイコロの通信エラー', error.message || 'サイコロの同期に失敗しました。',
                () => action.finish(), { sync: false });
        }
    });


// =========================
// イベントポップアップ表示
// =========================

window.showEventPopup = function (
    title,
    message,
    callback,
    displayOptions = {}
) {

    const popup =
        document.getElementById(
            "eventPopup"
        );
    if (popup.dataset) delete popup.dataset.onlineRoundSummaryKey;

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

        popupButton.textContent =
    "OK";
    // A new local announcement must not inherit a disabled observer/battle
    // button from an earlier screen. Remote mirrors are locked by ui:sync.
    const ownsPopup = displayOptions.readOnly !== true && (!(window.onlineGame && window.onlineGame.isOnline)
        || isLocalOnlineTurn()
        || (String(title || "") === "次の目的地が決定！" && bossDefeatedCount === 0));
    popupButton.disabled = !ownsPopup;
    if (popupButton.dataset) {
        delete popupButton.dataset.onlineTurnDisabled;
        delete popupButton.dataset.onlineTurnPreviousDisabled;
    }

    // =========================
    // 内容を設定
    // =========================

    popupTitle.textContent =
        title;

    window.setSafeRichContent(popupMessage, message);

    const sharedPopupEventId = displayOptions.eventId || createOnlineSyncEventId("popup");
    const announcement = window.CommonAnnouncements?.presentation(title, popupMessage.innerHTML, displayOptions,
        {players,activeIndex:Number(currentPlayer)}, popup) || null;
    window.CommonAnnouncements?.render(popup, announcement, {players,icon:getPlayerCharacterIcon,eventId:sharedPopupEventId});


    // =========================
    // ポップアップ表示
    // =========================

    popup.style.display = "block";

    // 初回のボス決定ポップアップは全クライアントで個別に表示・終了する。
    // 共有UIイベントで受信側のOKハンドラーが上書きされると、
    // 最初のプレイヤー以外が閉じられなくなるため、同期対象から除外する。
    const isInitialBossDestinationPopup = String(title || "") === "次の目的地が決定！" && bossDefeatedCount === 0;

    // マスイベントのポップアップ内容を他クライアントにも表示する。
    // 受信側は表示のみで、報酬付与などのcallbackは実行しない。
    if (displayOptions.sync !== false && !isInitialBossDestinationPopup && window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync && isLocalOnlineTurn()) {
        window.onlineGame.sync.syncUI({
            eventId: sharedPopupEventId,
            title: String(title || "イベント"),
            message: popupMessage.innerHTML,
            variant: popup.classList.contains("job-result-popup") ? "job-result"
                : popup.classList.contains("boss-destination-popup") ? "boss-destination"
                : popup.classList.contains("boss-counter-popup") ? "boss-counter" : "default",
            announcement
        }).then(function (response) {
            if (!response || !response.ok) console.warn("[online] イベント表示の同期に失敗:", response && response.error);
        });
    }

    // =========================
    // OKボタン
    // =========================

    let acknowledged = false;
    popupButton.onclick =
        function () {

            if (!ownsPopup || (announcement?.common && acknowledged && !popup.dataset.onlineRoundSummaryKey)) return;
            acknowledged = true;
            if(announcement?.common)window.GameSE?.play?.('confirm',{shared:true}).catch(error=>console.warn('[SE] 決定音を再生できません:',error));
            popup.style.display = "none";
            window.CommonAnnouncements?.render(popup, null);
            if (displayOptions.sync !== false && !isInitialBossDestinationPopup && window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync) {
                // The local overlay closes immediately. Server-side turn validation
                // decides whether this click may also dismiss the shared announcement.
                window.onlineGame.sync.syncUI({ eventId: sharedPopupEventId, action: "close" }).then(function (response) {
                    if (!response || !response.ok) console.warn("[online] 共通アナウンスの閉じる操作を同期できませんでした:", response && response.error);
                });
            }

            if (callback) callback();

        };

}


// =========================
// ゴールドルーレット
// =========================

// =========================================================
// 共通スロット演出
// 項目を縦に流し、クリック時に減速して停止する
// =========================================================

function startVerticalSlot(roulette, output, items) {
    const slot = window.VerticalSlot.start(roulette, output, items);
    window.SlotPresentation?.watch(roulette,{player:players[currentPlayer],icon:getPlayerCharacterIcon(currentPlayer)});
    return slot;
}


function showGoldRoulette(
    reward,
    callback
) {

    const onlineSync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync ? window.onlineGame.sync : null;
    const rouletteEventId = createOnlineSyncEventId("gold-roulette");
    if (onlineSync) onlineSync.syncRoulette({ eventId: rouletteEventId, type: "gold", action: "start" }).then(function (r) { if (!r || !r.ok) console.warn("[online] ゴールドルーレット開始を同期できません:", r && r.error); });
    let awardedGold = Number(reward) || 0;
    let authoritativeBalance = null;

    const roulette =
        document.getElementById(
            "goldRoulette"
        );

    const number =
        document.getElementById(
            "goldRouletteNumber"
        );


    // =========================
    // ルーレット回転中SE
    // 0～2秒をループ
    // =========================

    rouletteSound.pause();

rouletteSound.currentTime =
    0;

(window.GameSE ? window.GameSE.playLocal(rouletteSound, Infinity, { loopEnd: 2 }) : rouletteSound.play())
        .catch(function (error) {

            console.error(
                "ルーレット回転中SEの再生に失敗しました:",
                error
            );

        });


    // =========================
    // 表示
    // =========================

    roulette.style.display =
        "block";

    roulette.classList.add(
        "spinning"
    );


    // =========================
    // 縦型スロットを開始
    // =========================

    const slot = startVerticalSlot(roulette, number, getGoldSquareSlotValues());


    // =========================
    // 0～2秒ループ
    // =========================

    function loopDiceSound() {

    if (
        rouletteSound.currentTime >= 2
    ) {

        rouletteSound.currentTime =
            0;

    }

}


rouletteSound.addEventListener(
    "timeupdate",
    loopDiceSound
);


    // =========================
    // クリックで停止
    // =========================

    function stopRoulette() {
        roulette.onclick = null;


        rouletteSound.removeEventListener(
    "timeupdate",
    loopDiceSound
);


        // =========================
        // 回転中SE停止
        // =========================

        rouletteSound.pause();

        rouletteSound.currentTime = 0;

        const stopRequest = onlineSync
            ? onlineSync.syncRoulette({ eventId: rouletteEventId, type: "gold", action: "stop" })
            : Promise.resolve({ ok: true, value: awardedGold });

        stopRequest.then(function (response) {
            if (!response || !response.ok) {
                console.warn("[online] ゴールドルーレット結果を同期できません:", response && response.error);
                roulette.onclick = stopRoulette;
                rouletteSound.addEventListener("timeupdate", loopDiceSound);
                (window.GameSE ? window.GameSE.playLocal(rouletteSound, Infinity, { loopEnd: 2 }) : rouletteSound.play()).catch(function () {});
                return;
            }

            awardedGold = Number(response.value);
            if (!Number.isFinite(awardedGold)) awardedGold = 0;
            authoritativeBalance = Number.isFinite(Number(response.balance)) ? Number(response.balance) : null;

            // クリック直後に決定音を再生し、確定額まで減速して止める。
            let slotAnimationFinished = false;
            let stopSoundFinished = false;

            function finishWhenReady() {
                if (slotAnimationFinished && stopSoundFinished) finishGoldRoulette();
            }

            roulettestopSound.pause();
            roulettestopSound.currentTime = 0;
            roulettestopSound.onended = function () {
                roulettestopSound.onended = null;
                stopSoundFinished = true;
                finishWhenReady();
            };
            (window.GameSE ? window.GameSE.playLocal(roulettestopSound) : roulettestopSound.play()).catch(function (error) {
                console.error("ルーレット停止SEの再生に失敗しました:", error);
                stopSoundFinished = true;
                finishWhenReady();
            });

            slot.stop(`${formatG(awardedGold)}G`, function () {
                roulette.classList.remove("spinning");
                slotAnimationFinished = true;
                finishWhenReady();
            });
        });

    }


    // =========================
    // ルーレット終了
    // =========================

    function finishGoldRoulette() {

    setTimeout(function () {

        roulette.style.display =
            "none";


        const completion = onlineSync
            ? onlineSync.syncRoulette({ eventId: rouletteEventId, type: "gold", action: "complete" })
            : Promise.resolve({ ok: true });
        completion.then(function (response) {
            if (!response || !response.ok) {
                console.warn("[online] ゴールド反映タイミングの同期に失敗:", response && response.error);
            }
            if (callback) callback(awardedGold, authoritativeBalance);
        });

    }, 1000);

}


    roulette.onclick =
        stopRoulette;

}



// =========================
// サイコロルーレット演出
// =========================

function showDiceRoulette(result, callback, options = {}) {
    return window.DiceGameUI.single(result, callback, options);
}

// =========================
// 宝箱ルーレット開始
// =========================

function runTreasureBonusFlow(player, itemId, itemName, treasureEventId, onlineSync) {
    const banner = document.getElementById("treasureBonusBanner");
    const itemRoulette = document.getElementById("itemRoulette");
    const itemNameNode = document.getElementById("itemRouletteName");
    if (!banner || !itemRoulette || !itemNameNode) {
        showEventPopup("宝箱", "複数獲得の演出を表示できませんでした。", function () { finishTurn(player); });
        return;
    }
    const subjectIndex = players.indexOf(player);
    const uiEventId = createOnlineSyncEventId("treasure-bonus-banner");
    let stage = "challenge", transitionTimer = 0, roll = null, completed = false;
    const challenge = "複数ゲットのチャンス到来！";
    function render(message, itemCount = 0) {
        banner.querySelector(".event-popup-title").textContent = "宝箱";
        const body = banner.querySelector(".event-popup-message");
        body.textContent = message;
        const metadata = window.CommonAnnouncements?.presentation("宝箱", message,
            {subjectIndex, sound:itemCount>0?"itemObtain":undefined, soundCount:itemCount}, {players, activeIndex:subjectIndex}, banner) || {common:true, subjectIndex};
        window.CommonAnnouncements?.render(banner, metadata, {players, icon:getPlayerCharacterIcon, eventId:uiEventId});
        banner.classList.add("slot-arrival-announcement");
        banner.style.display = "block";
    }
    function sync(action, nextStage, message, itemCount = 0) {
        if (!onlineSync) return;
        onlineSync.syncUI({eventId:uiEventId, action, title:"宝箱", message:message || challenge,
            variant:"treasure-bonus-banner", stage:nextStage, announcement:{common:true, subjectIndex,...(itemCount>0?{sound:"itemObtain",...(itemCount>1?{soundCount:itemCount}:{})}:{})}})
            .then(response => { if (!response?.ok) console.warn("[online] 宝箱の追加獲得表示を同期できません:", response?.error); });
    }
    function cleanup(closeSync, preserveRoll = false) {
        if (completed) return;
        completed = true;
        clearTimeout(transitionTimer);
        document.removeEventListener("click", advance, true);
        document.body.classList.remove("treasure-bonus-moving", "treasure-bonus-dice");
        banner.style.display = "none";
        window.CommonAnnouncements?.render(banner, null);
        itemRoulette.style.display = "none";
        document.getElementById("diceRoulette").style.display = "none";
        window.DiceGameUI.closeTreasureBonusPreview();
        if (!preserveRoll && roll && !roll.closed) roll.cancel();
        if (closeSync && onlineSync) sync("close", null, "");
        if (window.cancelTreasureBonusPresentation) delete window.cancelTreasureBonusPresentation;
    }
    function failFlow(error) {
        cleanup(true);
        console.error("宝箱の複数獲得処理に失敗しました:", error);
        showEventPopup("宝箱の通信エラー", error?.message || "報酬を確定できませんでした。", function () { finishTurn(player); });
    }
    function advance(event) {
        if (completed || event.target.closest('[data-map-camera]')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (stage === "challenge") {
            stage = "moving";
            document.body.classList.add("treasure-bonus-moving");
            sync("update", "moving", challenge);
            stage = "move-animation";
            transitionTimer = setTimeout(function () { if (stage === "move-animation") stage = "move-ready"; }, 820);
            return;
        }
        if (stage === "move-animation") return;
        if (stage === "move-ready") {
            stage = "starting";
            sync("update", "dice", challenge);
            roll = window.DiceGameUI.treasureBonus(treasureEventId, function (count, response) {
                if (completed || !["rolling", "stopping"].includes(stage)) return;
                if (onlineSync) {
                    if (!response?.ok || !response.state) return failFlow(new Error(response?.error || "サーバーから獲得数を受け取れませんでした。"));
                    applyOnlineCanonicalState(response.state, "treasure-bonus-result", true);
                } else {
                    for (let i = 0; i < count; i++) addItem(player, itemId, currentTurn);
                }
                renderPlayers();
                updatePlayerStatusUI(player);
                const message = `${itemName}を${count}個ゲットした！`;
                render(message, count);
                stage = "result";
                sync("update", "result", message, count);
            }, failFlow);
            roll.ready.then(function (ready) { if (ready && !completed) stage = "rolling"; });
            return;
        }
        if (stage === "rolling") {
            stage = "stopping";
            roll?.stop();
            return;
        }
        if (stage === "result") {
            const finalRoll = roll;
            cleanup(true, true);
            if (finalRoll && !finalRoll.closed) finalRoll.confirm();
            finishTurn(player);
        }
    }

    window.SlotPresentation?.clear();
    itemRoulette.classList.remove("spinning");
    itemNameNode.textContent = itemName;
    itemRoulette.style.display = "block";
    document.body.classList.add("treasure-bonus-dice");
    window.DiceGameUI.showTreasureBonusPreview();
    render(challenge);
    if ([1, 2].includes(Number(itemId))) {
        window.GameSE?.play('multipleItems', {
            shared: true,
            eventId: 'treasure-multiple-items:' + (treasureEventId || uiEventId)
        })?.catch(error => console.warn('[SE] 宝箱の複数アイテム:', error));
    }
    sync("open", "challenge", challenge);
    window.cancelTreasureBonusPresentation = function () { cleanup(false); };
    document.addEventListener("click", advance, true);
}

function showItemRoulette(
    item,
    callback,
    treasureEventId = null
) {

    const onlineSync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync ? window.onlineGame.sync : null;
    const rouletteEventId = createOnlineSyncEventId("item-roulette");
    if (onlineSync) onlineSync.syncRoulette({ eventId: rouletteEventId, type: "item", action: "start", treasureEventId }).then(function (r) { if (!r || !r.ok) console.warn("[online] 宝箱ルーレット開始を同期できません:", r && r.error); });

    const roulette =
        document.getElementById(
            "itemRoulette"
        );

    const name =
        document.getElementById(
            "itemRouletteName"
        );


    // =========================
    // ルーレット回転中SE
    // 0～2秒をループ
    // =========================

    rouletteSound.pause();

rouletteSound.currentTime =
    0;

(window.GameSE ? window.GameSE.playLocal(rouletteSound, Infinity, { loopEnd: 2 }) : rouletteSound.play())
        .catch(function (error) {

            console.error(
                "ルーレット回転中SEの再生に失敗しました:",
                error
            );

        });


    // =========================
    // 表示
    // =========================

    roulette.style.display =
        "block";


    // =========================
    // 縦型スロットを開始
    // =========================

    const itemCandidates = Object.keys(ITEM_CONTENTS).filter(function (itemId) { return Number(ITEM_CONTENTS[itemId]?.rank) < 99; }).map(function (itemId) {
        return ITEM_CONTENTS[itemId].name;
    });
    const slot = startVerticalSlot(roulette, name, itemCandidates);


    // =========================
    // 0～2秒ループ
    // =========================

    function loopDiceSound() {

    if (
        rouletteSound.currentTime >= 2
    ) {

        rouletteSound.currentTime =
            0;

    }

}


rouletteSound.addEventListener(
    "timeupdate",
    loopDiceSound
);


    // =========================
    // クリックで停止
    // =========================

    let onlineStopResponse = onlineSync ? null : { ok: true, value: item && item.name };

    function stopRoulette() {

    if (onlineSync) {
        onlineSync.syncRoulette({ eventId: rouletteEventId, type: "item", action: "stop" }).then(function (response) {
            onlineStopResponse = response;
            if (response && response.ok && response.state) applyOnlineCanonicalState(response.state, "treasure-item");
            if (!response || !response.ok) console.warn("[online] 宝箱ルーレット結果を確定できません:", response && response.error);
            finishWhenReady();
        }).catch(function (error) {
            onlineStopResponse = { ok: false, error: error && error.message || "通信エラー" };
            finishWhenReady();
        });
    }


    roulette.onclick =
        null;


    rouletteSound.removeEventListener(
        "timeupdate",
        loopDiceSound
    );


    // =========================
    // 回転中SE停止
    // =========================

    rouletteSound.pause();

    rouletteSound.currentTime = 0;


    // =========================
    // SEと停止アニメーションの完了管理
    // =========================

    let slotAnimationFinished = false;
    let stopSoundFinished = false;
    let rouletteFinished = false;

    function finishWhenReady() {

        if (
            slotAnimationFinished &&
            stopSoundFinished &&
            onlineStopResponse &&
            !rouletteFinished
        ) {

            rouletteFinished = true;
            finishItemRoulette();

        }

    }


    // =========================
    // クリック直後に決定音を再生
    // =========================

    roulettestopSound.pause();
    roulettestopSound.currentTime = 0;
    roulettestopSound.onended = null;

    roulettestopSound.onended =
        function () {

            roulettestopSound.onended = null;

            stopSoundFinished = true;

            finishWhenReady();

        };

    (window.GameSE ? window.GameSE.playLocal(roulettestopSound) : roulettestopSound.play())
        .catch(function (error) {

            console.error(
                "ルーレット停止SEの再生に失敗しました:",
                error
            );

            roulettestopSound.onended = null;

            stopSoundFinished = true;

            finishWhenReady();

        });


    // =========================
    // 最終結果へ減速して停止
    // =========================

    slot.stop(
        item && item.name ? item.name : "宝箱アイテム",
        function () {

            slotAnimationFinished = true;

            finishWhenReady();

        }
    );

    return;

}


    // =========================
    // ルーレット終了
    // =========================

    function finishItemRoulette() {

    setTimeout(function () {

        roulette.style.display =
            "none";


        if (
            callback
        ) {

            callback(onlineStopResponse);

        }

    }, 1000);

}


    roulette.onclick =
        stopRoulette;



// =========================
    // 新バトルUIへ接続
    // =========================
    // game.js はゲーム進行を担当し、
    // 実際の通常モンスター戦UIは battle-ui.js に委譲します。
    // battle-ui.js は game.js 読み込み後に読み込まれるため、
    // 実行時には window.startMonsterBattle が新UI版になります。
    // =========================

    if (
        typeof window.startMonsterBattle === "function" &&
        window.startMonsterBattle !== startMonsterBattle
    ) {

        window.startMonsterBattle(
            player
        );

        return;

    }

    console.error(
        "新バトルUI（battle-ui.js）が読み込まれていません。"
    );

}

// =========================
// ボス挑戦確認
// =========================

function showBossChallengePopup(
    player,
    isRechallenge = false,
    onlineControls = null
) {

    if (!onlineControls && window.onlineGame && window.onlineGame.isOnline
        && Number(currentBossId) !== 9999 && typeof window.startOnlineBossEncounter === "function") {
        window.startOnlineBossEncounter(player, isRechallenge);
        return;
    }


    // =========================
    // ボス先着プレイヤーを記録
    // =========================

    if (
        !onlineControls && bossFirstPlayer === null
    ) {

       bossFirstPlayer =
    player;



bossCounterEnabled = true;

    }


    const popup =
        document.getElementById(
            "monsterChoicePopup"
        );

    const message =
        document.getElementById(
            "monsterChoiceMessage"
        );

    const fightButton =
        document.getElementById(
            "monsterFightButton"
        );

    const escapeButton =
        document.getElementById(
            "monsterEscapeButton"
        );


    // =========================
    // メッセージ
    // =========================

    message.textContent = isRechallenge
        ? "ボスに再挑戦しますか？"
        : "ボスマスへ到着した！ボスへ挑戦しますか？";
    const portrait = document.getElementById("bossGatePlayerIcon");
    if (portrait) portrait.src = getPlayerCharacterIcon(players.indexOf(player));


    // =========================
    // ボタン表示
    // =========================

    fightButton.disabled = Boolean(onlineControls && onlineControls.observer);
    escapeButton.disabled = Boolean(onlineControls && onlineControls.observer);


    // =========================
    // ポップアップ表示
    // =========================

    popup.style.display =
        "block";


    // =========================
    // 挑戦する
    // =========================

    fightButton.onclick =
        function () {

            if (onlineControls) {
                if (!onlineControls.observer) onlineControls.fight();
                return;
            }

            popup.style.display =
                "none";

            startBossBattle(
                player
            );

        };


    // =========================
    // 今回はやめる
    // =========================

    escapeButton.onclick =
    function () {

        if (onlineControls) {
            if (!onlineControls.observer) onlineControls.decline();
            return;
        }

        popup.style.display =
            "none";


        // =========================
        // 初回到着
        // =========================

        if (
            !isRechallenge
        ) {

            showEventPopup(
                "ボスから撤退",

                `
                ${player.name}は
                今回はボスへの挑戦を見送った。
                `,

                function () {

                    finishTurn(
                        player
                    );

                },
                {subjectIndex:players.indexOf(player)}
            );

            return;

        }


        // =========================
        // 再戦を見送る
        // =========================

        updateNextPlayerView();


        rouletteButton.disabled =
            false;

    };

}



// =========================
// マスイベント
// =========================

function handleSquareEvent(
    player,
    arrivalAnnounced = false
) {

console.log(
    "【停止マスイベント】",
    player.position,
    mapData.find(
        function (square) {
            return square.id === player.position;
        }
    )
);
    
    const currentSquare =
        mapData.find(
            function (square) {

                return square.id ===
                    player.position;

            }
        );


    if (
        !currentSquare
    ) {

        finishTurn(
            player
        );

        return;

    }

    if (['money', 'treasure', 'asset', 'shop', 'magic_shop'].includes(currentSquare.type)) {
        window.GameActionInput?.beginMenuAction('square-event', `${currentTurn}:${currentPlayer}`);
    }

    if (!arrivalAnnounced && Number(player.position) === Number(currentBossSquareId)) {
        window.GameSE?.play?.('squareArrival',{shared:true}).catch(error=>console.warn('[SE] 到着音を再生できません:',error));
    }
    if (!arrivalAnnounced && Number(player.position) !== Number(currentBossSquareId)) {
        const names = {start:'スタート',money:'お金',treasure:'宝箱',job:'バイト',asset:'資産',shop:'アイテム',magic_shop:'魔法',monster:'モンスター',worst:'最悪'};
        const name = names[currentSquare.type];
        if (name) {
            showEventPopup('', name+'マスに止まった！', function () { handleSquareEvent(player, true); }, {subjectIndex:players.indexOf(player),sound:'squareArrival'});
            return;
        }
    }

    switch (
        currentSquare.type
    ) {


// =========================
// スタートマス
// =========================

case "start":

    // =========================
    // 魔王マス
    // =========================

    if (
        player.position === currentBossSquareId &&
        currentBossId === 9999 &&
        typeof window.handleMaouArrival === "function"
    ) {

        window.handleMaouArrival(
            player
        );

        break;
    }


    // =========================
    // 通常のスタートマス
    // =========================

    finishTurn(
        player
    );

    break;

// =========================
// 資産マス
// =========================

case "asset": {

    const assetIds = [];

    (
        currentSquare.typeIds || []
    ).forEach(
        function (typeId) {

            const assetBox =
                ASSET_BOXES[typeId];

            if (!assetBox) {
                return;
            }

            (
                assetBox.contents || []
            ).forEach(
                function (assetId) {

                    assetIds.push(
                        assetId
                    );

                }
            );

        }
    );

    // 資産店の購入画面を直接表示
    showAssetShopIntroPopup(
        player,
        assetIds,
        function () {

            finishTurn(player);

        }
    );

    break;
}
        
       // =========================
        // お金マス
        // =========================

        case "money":

            // =========================
            // 獲得額を決定
            // =========================

            const isOnlineGame = Boolean(window.onlineGame && window.onlineGame.isOnline);
            const reward = isOnlineGame ? 0 : getRandomGoldReward();


            // =========================
            // ゴールドルーレット
            // =========================

            showGoldRoulette(
                reward,
                function (awardedGold, authoritativeBalance) {

                    // =========================
                    // ルーレット終了後にゴールドを加算
                    // =========================

                    player.money = authoritativeBalance === null
                        ? player.money + awardedGold
                        : authoritativeBalance;

                    updatePlayerStatusUI(player);


                    // プレイヤー表示更新
                    renderPlayers();


                    // =========================
                    // 結果ポップアップ
                    // =========================

                    showEventPopup(
                    "",
                    `💰 ${formatG(awardedGold)}G獲得！`,

                        function () {

                            finishTurn(
                                player
                            );

                        }, {sound:'moneyDisplay',subjectIndex:players.indexOf(player),advanceAnywhere:true}
                    );

                }
            );

            break;

        // =========================
        // ショップマス
        // =========================


    case "shop":

    showItemShopIntroPopup(player);

    break;


// =========================
// 魔法店マス
// =========================

case "magic_shop":

    showMagicShopIntroPopup(player);

    break;
// =========================
// モンスターマス
// =========================

case "monster":

    // =========================
    // ボスマスか確認
    // =========================

    if (
    player.position ===
    currentBossSquareId
) {

   // =========================
// 初めてボスマスへ到着した時
// ボスBGMへ切り替える
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

    showBossChallengePopup(
        player
    );

} else {

    startMonsterBattle(
        player
    );

}

    break;


        // =========================
        // バイトマス
        // =========================

        case "job":
    showJobPopup(
        player,
        currentSquare,
        currentTurn,
        function () {
            finishTurn(player);
        }
    );
    break;

case "worst":
    {
    const showWorstResult = function () { showEventPopup(
        "💀 最悪マス",
        window.DisadvantageImmunityRules?.isActive(player)
            ? `${player.name}は無敵の加護で最悪マスの効果を防いだ！`
            : `${player.name}は最悪のマスに止まってしまった……。<br><strong>所持ゴールドが0Gになった…</strong>`,
    function () { finishTurn(player); }
    , {subjectIndex:players.indexOf(player),sound:'ponziScam'}
    ); };
    const sync = window.onlineGame && window.onlineGame.isOnline ? window.onlineGame.sync : null;
    if (sync) {
        // Some item moves still use the compatibility state publication.
        // Confirm their final position before resolving this square event.
        window.publishOnlineGameState().then(function (published) {
            if (!published || !published.ok) throw new Error(published && published.error || "到着位置を同期できませんでした。");
            return sync.resolveWorstSquare();
        }).then(function (response) {
            if (!response || !response.ok || !response.state) throw new Error(response && response.error || "最悪マスの結果を確認できませんでした。");
            applyOnlineCanonicalState(response.state, "worst-square", true);
            showWorstResult();
        }).catch(function (error) {
            console.error("[online] 最悪マス:", error);
            showEventPopup("最悪マスの同期エラー", error.message, function () {});
        });
    } else {
        if (!window.DisadvantageImmunityRules?.isActive(player)) player.money = 0;
        updatePlayerStatusUI(player);
        renderPlayers();
        showWorstResult();
    }
    }

    break;

        // =========================
        // 宝箱ルーレット
        // =========================

case "treasure":

    // =========================
    // 宝箱BOXを取得
    // =========================

    const treasureBox =
        TREASURE_BOXES[
            currentSquare.treasureBoxId
        ];


    // =========================
    // 宝箱BOXが存在しない場合
    // =========================

    if (!treasureBox) {

        console.error(
            "宝箱BOXが見つかりません:",
            currentSquare.treasureBoxId
        );

        finishTurn(player);

        break;

    }
    const onlineTreasureSync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync
        ? window.onlineGame.sync
        : null;
    if (onlineTreasureSync) {
        const onlineTreasureEventId = createOnlineSyncEventId("treasure");
        onlineTreasureSync.resolveTreasure(onlineTreasureEventId).then(function (response) {
            if (!response || !response.ok || !response.reward) {
                showEventPopup("宝箱を開けられませんでした", response && response.error || "サーバーから結果を受け取れませんでした。", function () {
                    finishTurn(player);
                });
                return;
            }

            const reward = response.reward;
            const resolvedTreasureEventId = response.eventId || onlineTreasureEventId;
            const rewardContent = reward.category === "item"
                ? ITEM_CONTENTS[Number(reward.id)]
                : reward.category === "magic"
                    ? MAGIC_CONTENTS[Number(reward.id)]
                    : reward.category === "power"
                        ? POWER_CONTENTS[Number(reward.id)]
                        : null;
            if (!rewardContent) {
                showEventPopup("宝箱の結果を表示できません", "報酬データを確認できませんでした。", function () {
                    finishTurn(player);
                });
                return;
            }

            if (reward.category === "item" && response.completed) {
                applyOnlineCanonicalState(response.state, "treasure-replay");
                const bonusCount = response.bonusRollResult != null && Number.isInteger(Number(response.bonusRollResult))
                    ? Number(response.bonusRollResult) : 1;
                const resultMessage = bonusCount > 1
                    ? `<strong>${reward.name}</strong>を${bonusCount}個ゲットした！`
                    : `<strong>${reward.name}</strong>を手に入れた！`;
                showEventPopup("🎁 宝箱", resultMessage, function () {
                    finishTurn(player);
                }, {sound:"itemObtain", soundCount:bonusCount, advanceAnywhere:true});
                return;
            }

            if (reward.category !== "item") {
                applyOnlineCanonicalState(response.state, "treasure-reward");
                const message = reward.category === "power"
                    ? `<strong>${reward.effect}</strong>を獲得した！`
                    : `<strong>${reward.name}</strong>を手に入れた！`;
                showEventPopup("🎁 宝箱", message, function () {
                    finishTurn(player);
                }, {advanceAnywhere:true});
                return;
            }

            showItemRoulette(rewardContent, function (stopResponse) {
                if (!stopResponse || !stopResponse.ok) {
                    showEventPopup("宝箱の獲得に失敗しました", stopResponse && stopResponse.error || "サーバーでアイテムを確定できませんでした。", function () {
                        finishTurn(player);
                    });
                    return;
                }
                if (stopResponse.multipleGet === true) {
                    runTreasureBonusFlow(player, Number(reward.id), reward.name, resolvedTreasureEventId, onlineTreasureSync);
                    return;
                }
                showEventPopup("🎁 宝箱", `<strong>${reward.name}</strong>を手に入れた！`, function () {
                    finishTurn(player);
                }, {sound:"itemObtain", advanceAnywhere:true});
            }, resolvedTreasureEventId);
        }).catch(function (error) {
            console.error("[online] 宝箱の抽選に失敗しました:", error);
            showEventPopup("宝箱の同期に失敗しました", "サーバーから結果を受け取れませんでした。", function () {
                finishTurn(player);
            });
        });
        break;
    }


    // =========================
    // 宝箱ルーレット
    // =========================

    const randomTreasure = window.TreasureRules.drawReward({
        boxId: currentSquare.treasureBoxId,
        box: treasureBox,
        bossDefeatedCount,
        items: ITEM_CONTENTS,
        powers: POWER_CONTENTS,
        magic: MAGIC_CONTENTS
    });
    if (!randomTreasure) {
        console.error("宝箱に対応する報酬がありません:", currentSquare.treasureBoxId);
        finishTurn(player);
        break;
    }


    // =========================
// 宝箱contentsの獲得処理
// =========================

if (randomTreasure.category === "item") {

    const randomItem =
        randomTreasure.content;

    const multipleGet = window.TreasureRules.drawMultipleGet({
        itemId: randomTreasure.id, bossDefeatedCount
    });


    showItemRoulette(
        randomItem,

        function () {

            if (multipleGet) {
                runTreasureBonusFlow(player, Number(randomTreasure.id), randomItem.name, null, null);
                return;
            }

            addItem(
                player,
                randomTreasure.id,
                currentTurn
            );


            renderPlayers();


            showEventPopup(
                "🎁 宝箱",

                `<strong>${randomItem.name}</strong>を手に入れた！`,

                function () {

                    finishTurn(player);

                },
                {sound:"itemObtain", advanceAnywhere:true}
            );

        }
    );

    break;

}


// =========================
// 魔力
// =========================

if (randomTreasure.category === "power") {

    const power =
        randomTreasure.content;


    player.magicPower +=
        Number(
            power.effect.match(/\d+/)[0]
        );


    updatePlayerStatusUI(player);


    renderPlayers();


    showEventPopup(
        "🎁 宝箱",

        `<strong>${power.effect}</strong>を獲得した！`,

        function () {

            finishTurn(player);

        }, {advanceAnywhere:true}
    );

    break;

}

// =========================
// 魔法
// =========================

if (randomTreasure.category === "magic") {

    const magic =
        randomTreasure.content;


    player.magic.push(
        randomTreasure.id
    );


    renderPlayers();


    showEventPopup(
        "🎁 宝箱",

        `<strong>${magic.name}</strong>を手に入れた！`,

        function () {

            finishTurn(player);

        }, {advanceAnywhere:true}
    );

    break;

}

    }
    

}


// =========================
// ショップ
// =========================

function showShopPopup(player) { ApprovedCommerce.showStore(player,'item'); }

// オンライン共有ショップの表示状態。購入処理は操作プレイヤーだけが実行する。
let applyingRemoteScreenView = false;
let activeAssetPurchaseView = null;
let remoteShopViewActive = false;
let lastLocalScreenKey = null;
let remoteOnlineSceneId = null;
let remoteOnlineSceneView = null;
let remoteOnlineJobVoice = null;
let activeLocalOnlineSceneSync = null;
function syncOnlineScreenView(screenType, player, action = "open", screenData = null) {
    if (applyingRemoteScreenView || !(window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync)) return;
    const socketId = window.onlineGame.socket && (window.onlineGame.playerId || window.onlineGame.socket.id);
    const playerIndex = Array.isArray(players) ? players.indexOf(player) : -1;
    const ownsScreen = Boolean(socketId && player && String(player.id) === String(socketId)
        && isLocalOnlineTurn() && playerIndex === Number(currentPlayer));
    if (!ownsScreen) return;
    remoteShopViewActive = false;
    if (action !== "close") resetSharedShopCloseControls();
    if (action === "close" && activeLocalOnlineSceneSync) activeLocalOnlineSceneSync.close();
    const key = action === "close" ? "closed" : `${screenType}:${playerIndex}:${JSON.stringify(screenData || {})}`;
    if (key === lastLocalScreenKey) return;
    lastLocalScreenKey = key;
    return window.onlineGame.sync.syncScreen({ action, screenType, playerIndex, ...(screenData ? { screenData } : {}) }).then(function (response) {
        if (!response || !response.ok) {
            lastLocalScreenKey = null;
            console.warn("[online] 画面同期に失敗:", response && response.error);
        }
        return response;
    });
}
window.syncOnlineScreenView = syncOnlineScreenView;

function createOnlineSceneSync(sceneType, player, wage = null) {
    const sync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync
        ? window.onlineGame.sync
        : null;
    if (!sync) return { update: function () {}, close: function () {} };

    const playerIndex = Array.isArray(players) ? players.indexOf(player) : -1;
    const square = mapData.find(function (entry) { return Number(entry.id) === Number(player.position); });
    if (playerIndex < 0 || !square) return { update: function () {}, close: function () {} };

    const eventId = createOnlineSyncEventId(`scene-${sceneType}`);
    const base = {
        eventId,
        sceneType,
        playerIndex,
        squareId: Number(square.id),
        jobId: sceneType === "job" ? Number(square.jobId) : null,
        wage: sceneType === "job" ? Number(wage) : null
    };
    function send(payload) {
        return sync.syncScene(payload).then(function (response) {
            if (!response || !response.ok) console.warn("[online] 会話画面を同期できません:", response && response.error);
            return response;
        });
    }

    let closed = false;
    const sceneSync = {
        update: function (phase, lineIndex, outcome = null) {
            if (closed) return;
            return send({ ...base, action: "update", phase, lineIndex: Number(lineIndex), outcome });
        },
        close: function () {
            if (closed) return;
            closed = true;
            send({ eventId, action: "close" });
            if (activeLocalOnlineSceneSync === sceneSync) activeLocalOnlineSceneSync = null;
        }
    };
    activeLocalOnlineSceneSync = sceneSync;
    send({ ...base, action: "open", phase: "dialogue", lineIndex: -1 });
    return sceneSync;
}

function renderRemoteOnlineScene(data) {
    const popup = document.getElementById("jobPopup");
    if (!popup || !data) return;

    if (data.action === "close") {
        if (!data.recovery && remoteOnlineSceneId && data.eventId !== remoteOnlineSceneId) return;
        if (remoteOnlineJobVoice) {
            if (window.GameSE) window.GameSE.stop(remoteOnlineJobVoice); else remoteOnlineJobVoice.pause();
            remoteOnlineJobVoice.currentTime = 0;
            remoteOnlineJobVoice = null;
        }
        popup.style.display = "none";
        document.body.classList.remove("magic-shop-dual-layout");
        remoteOnlineSceneId = null;
        remoteOnlineSceneView = null;
        return;
    }

    const player = players[Number(data.playerIndex)];
    const square = mapData.find(function (entry) { return Number(entry.id) === Number(data.squareId); });
    if (!player || !square) return;

    if (remoteOnlineSceneId && data.eventId !== remoteOnlineSceneId && remoteOnlineJobVoice) {
        if (window.GameSE) window.GameSE.stop(remoteOnlineJobVoice); else remoteOnlineJobVoice.pause();
        remoteOnlineJobVoice.currentTime = 0;
        remoteOnlineJobVoice = null;
    }

    if (data.action === "open" || remoteOnlineSceneId !== data.eventId || !remoteOnlineSceneView) {
        const sceneData = data.sceneType === "job"
            ? getJobData(square.jobId)
            : data.sceneType === "magicShop"
                ? MAGIC_SHOP_SCENE_CONTENTS
                : data.sceneType === "itemShop"
                    ? SHOP_SCENE_CONTENTS
                    : data.sceneType === "assetShop"
                        ? ASSET_SCENE_CONTENTS
                        : null;
        const scene = setupScenePopup(player, sceneData);
        if (!scene) return;
        if (data.sceneType !== "job" && scene.choicePanel) scene.choicePanel.remove();
        remoteOnlineSceneId = data.eventId;
        remoteOnlineSceneView = scene;
        document.body.classList.remove("magic-shop-dual-layout");
    }

    const scene = remoteOnlineSceneView;
    if (data.sceneType === "job" && scene.wage && Number.isFinite(Number(data.wage))) {
        scene.wage.textContent = `報酬：${formatG(Number(data.wage))}G`;
        window.JobPresentation?.paintChoices(scene,Number(data.wage));
    }
    scene.popup.style.display = "block";

    // Voice follows the accepted line/outcome, not a local click. Repeated
    // snapshots do not replay it, and leaving the line stops the old voice.
    const voiceKey = `${data.phase}:${data.lineIndex}:${data.outcome || ""}`;
    if (data.sceneType === "job" && scene.lastOnlineVoiceKey !== voiceKey) {
        scene.lastOnlineVoiceKey = voiceKey;
        if (remoteOnlineJobVoice) {
            if (window.GameSE) window.GameSE.stop(remoteOnlineJobVoice); else remoteOnlineJobVoice.pause();
            remoteOnlineJobVoice = null;
        }
        const job = getJobData(square.jobId);
        const line = scene.dialogueLines[Number(data.lineIndex)];
        const voice = data.phase === "dialogue" && line && typeof line === "object" ? line.voice
            : data.phase === "result" && data.outcome === "refused" ? job?.refusalVoice : null;
        if (voice) {
            remoteOnlineJobVoice = new Audio(voice);
            (window.GameSE ? window.GameSE.playLocal(remoteOnlineJobVoice) : remoteOnlineJobVoice.play())
                .catch(error => console.warn("[online] バイト音声を再生できません:", error));
        }
    }

    // Mirror a job refusal as one semantic scene result. The observer uses its
    // local content catalog for both the expression image and refusal voice.
    if (data.sceneType === "job" && data.phase === "result" && data.outcome === "refused") {
        const jobData = getJobData(square.jobId);
        if (scene.staff && jobData && jobData.staffExpressions && jobData.staffExpressions.disappointed) {
            scene.staff.src = jobData.staffExpressions.disappointed;
        }
    }

    if ((data.phase === "choices" || data.phase === "result") && data.sceneType === "job") {
        scene.dialogueBox.style.display = "none";
        if (scene.choicePanel) {
            scene.choicePanel.hidden = false;
            scene.popup.querySelectorAll(".job-choices button, .job-choices input, .job-choices select, .job-choices [role='button']").forEach(function (control) {
                control.disabled = true;
            });
        }
        return;
    }

    scene.dialogueBox.style.display = "block";
    if (scene.choicePanel) scene.choicePanel.hidden = true;
    const line = scene.dialogueLines[Number(data.lineIndex)];
    scene.dialogueText.textContent = typeof line === "string" ? line : line?.text ?? "";
    // Keep the same visual prompt while leaving the observer without an advance listener.
    scene.dialogueNext.style.display = line || data.phase === "menu" ? "block" : "none";
    scene.dialogueNext.style.pointerEvents = "none";
}

// =========================
// 魔法店メインメニュー
// 魔法 / 魔力を選択
// =========================

function showMagicShopMainMenu(player) { ApprovedCommerce.showStore(player,'magic'); }
function showMagicShopPopup(player) { showMagicShopMainMenu(player); }
function showPowerShopPopup(player) { showMagicShopMainMenu(player); }
function showItemShopPopup(player) { ApprovedCommerce.showStore(player,'item'); }

// =========================
// 最終結果
// =========================

function showGameResult(serverRanking = null) {

    const online = Boolean(window.onlineGame?.isOnline);
    if (online && !Array.isArray(serverRanking)) {
        const state = window.onlineGame.sync && window.onlineGame.sync.state;
        if (!state || state.matchPhase !== "finished" || !Array.isArray(state.finalRanking)) return;
        serverRanking = state.finalRanking;
    }
    if (!online) window.OfflineDividends.resetMarket();

    window.GameActionInput?.reset();
    // 地下マップが前面に残らないよう、終了演出の表示前に閉じる。
    window.UndergroundUI?.suspend();
    window.GuidebookUI?.close();
    const guidebookRequest = document.getElementById('guidebookRequestButton');
    if (guidebookRequest) guidebookRequest.hidden = true;

    const resultPopup =
        document.getElementById("resultPopup");

    const resultRanking =
        document.getElementById("resultRanking");


// =========================
// 総資産の多い順に並べる
// =========================

const ranking = Array.isArray(serverRanking) ? serverRanking : players.map(function (player, playerIndex) {
    return { playerIndex, name: player.name, totalAsset: calculateTotalAssetValue(player) };
}).sort(function (a, b) { return b.totalAsset - a.totalAsset; });

    if (window.EndingPresentation) {
        const state = online ? window.onlineGame.sync.state : null;
        const participants = online ? state.players : players;
        const history = [...(online ? (state.wealthHistory || []) : (window.OfflineDividends?.history() || []))];
        const completed = online ? state.completedTurns : maxTurns;
        const totals = participants.map((player, index) => {
            const entry = ranking.find(item => item.playerIndex === index || (item.playerIndex == null && item.name === player.name));
            return entry ? entry.totalAsset : 0;
        });
        if (history.length && history[history.length - 1].turn === completed) history[history.length - 1] = { turn: completed, totals };
        else history.push({ turn: completed, totals });
        gameStarted = false;
        window.EndingPresentation.show(ranking, participants, history, online);
        return;
    }


    resultRanking.replaceChildren();


    // =========================
    // ランキング表示
    // =========================

    ranking.forEach(function (player, index) {

        let rankIcon;


        if (index === 0) {

            rankIcon = "🥇";

        } else if (index === 1) {

            rankIcon = "🥈";

        } else if (index === 2) {

            rankIcon = "🥉";

        } else {

            rankIcon = `${index + 1}位`;

        }


        const rankTemplate =
            document.getElementById("resultRankItemTemplate");
        const rankElement =
            rankTemplate.content.firstElementChild.cloneNode(true);

        rankElement.querySelector(".result-rank-name").textContent =
            `${rankIcon} ${player.name}`;
        rankElement.querySelector(".result-rank-money").textContent =
            `💰 ${formatG(player.totalAsset)}G`;


        resultRanking.appendChild(
            rankElement
        );

    });


    // =========================
    // 結果画面表示
    // =========================

    gameStarted = false;

    resultPopup.style.display =
        "block";


    // =========================
    // もう一度遊ぶ
    // =========================

    document.getElementById(
        "resultButton"
    ).disabled = false;
    document.getElementById(
        "resultButton"
    ).onclick = function () {

        location.reload();

    };

}

// =========================
// =========================
// 配当結果表示
// =========================

function showDividendPopup(
    dividendResults,
    callback,
    displayOptions = {}
) {

    const message =
        dividendResults
            .map(
                function (result) {

                    return `
                        <div class="dividend-result-row">

                            <span>
                                ${result.name}
                            </span>

                            <strong class="dividend-result-amount">
                                ＋${result.dividend.toLocaleString()}G
                            </strong>

                        </div>
                    `;

                }
            )
            .join("");


    showEventPopup(
        "📈 配当",

        `
            <div class="dividend-intro">
                資産から配当金を受け取りました！
            </div>

            ${message}
        `,

        function () {

            if (callback) {

                callback();

            }

        },
        displayOptions
    );


    // =========================
    // ボタンを「次へ」に変更
    // =========================

    const popupButton =
        document.getElementById(
            "eventPopupButton"
        );


    popupButton.textContent =
        "次へ";

}

// 総資産ランキングを表示
function showAssetRankingPopup(callback, serverRanking = null, displayOptions = {}) {
    const ranking = Array.isArray(serverRanking) ? serverRanking : players.map(function (player) {
        return {
            name: player.name,
            totalAsset: calculateTotalAssetValue(player)
        };
    }).sort(function (a, b) {
        return b.totalAsset - a.totalAsset;
    });

    const rankingHtml = `
        <div class="asset-ranking-grid">
            <div class="asset-ranking-heading asset-ranking-rank">順位</div>
            <div class="asset-ranking-heading">名前</div>
            <div class="asset-ranking-heading asset-ranking-total">総資産</div>

            ${ranking.map(function (result, index) {
                return `
                    <div class="asset-ranking-cell asset-ranking-rank">
                        ${index + 1}位
                    </div>

                    <div class="asset-ranking-cell">
                        ${result.name}
                    </div>

                    <div class="asset-ranking-cell asset-ranking-total">
                        ${formatG(result.totalAsset)}G
                    </div>
                `;
            }).join("")}
        </div>
    `;

    showEventPopup(
        "🏆 総資産ランキング",
        rankingHtml,
        function () {
            if (callback) callback();
        },
        displayOptions
    );

    const popupButton = document.getElementById("eventPopupButton");
    popupButton.textContent = "次へ";
}

// =========================
// 次プレイヤー開始時の
// 表示・カメラ・最短ルート更新
// =========================
//
// ターン切り替え時のUI更新を
// ここに統一する。
// =========================

let nextPlayerCameraRequest = 0;
function updateNextPlayerView() {

    const activePlayer = players[currentPlayer];
    if (activePlayer) preloadPlayerDirectionSprites(activePlayer);

    // ターン表示を更新
    renderTurn();

    // プレイヤー表示を更新
    renderPlayers();

    // Recenter after the HUD and player panels have finished their layout.
    // Do not route turn handoffs through centerCurrentPlayerOnMap's special
    // guidebook-view guard; that guard is for incidental refreshes only.
    const focusIndex = currentPlayer;
    const requestId = ++nextPlayerCameraRequest;
    const waitForCamera = window.TurnHandoff?.isBlack?.() === true;
    if (waitForCamera) {
        const cameraReady = new Promise(resolve => {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (requestId !== nextPlayerCameraRequest || focusIndex !== currentPlayer) {
                    resolve();
                    return;
                }
                centerPlayerOnMap(focusIndex, 'smooth', resolve, true);
            }));
        });
        window.TurnHandoff.waitFor(cameraReady);
    } else {
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (requestId !== nextPlayerCameraRequest || focusIndex !== currentPlayer) return;
            centerPlayerOnMap(focusIndex, 'smooth', null, true);
        }));
    }

    // 現在プレイヤーの最短ルートを再描画
    refreshShortestPathToBoss();

}
window.updateNextPlayerView = updateNextPlayerView;

let bridgeMuggingLaunchInFlight = false;
function presentBridgeMugging(player,event,online,handoffReady=false){
    const index=Array.isArray(players)?players.indexOf(player):-1;
    window.BridgeMuggingPresentation?.show(player,{
        eventId:event.eventId,
        triggered:Boolean(event.triggered),
        lineIndex:Number(event.lineIndex),
        fee:Number(event.fee)||window.BridgeMuggingRules.feeForBossCount(bossDefeatedCount),
        prevented:event.prevented === true,
        playerIndex:index,
        playerIcon:index>=0?getPlayerCharacterIcon(index):null,
        squares:mapData,
        regionData:window.MapRegionData,
        sync:online?window.onlineGame?.sync:null,
        applyState:applyOnlineCanonicalState,
        onMoneyChanged:function(changedPlayer){updatePlayerStatusUI(changedPlayer);renderPlayers();},
        onComplete:function(){finishTurn(player,handoffReady);}
    });
}

// =========================
// プレイヤー切り替えSE
// =========================

function playPlayerSwitchingSound() {

    if (window.GameSE) {
        window.GameSE.play('playerSwitch');
        return;
    }

    switchingSound.currentTime =
        0;

    switchingSound.play().catch(
        function (error) {

            console.warn(
                "【プレイヤー切り替えSE】再生失敗：",
                error
            );

        }
    );

}

// =========================
// ボスカウンター処理
// =========================

function buildBossCounterMessage(rows) {
    const escape = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
    const playersHtml = rows.map(function (row) {
        const name = `<span class="boss-counter-player-name">${escape(row.name)}</span>`;
        const result = row.reason
            ? `<span>${row.reason === "underground" ? "地下労働中" : row.reason === "job" ? "🛡️ バイト中は無効" : row.reason === "disadvantageImmunity" ? "🛡️ 無敵の加護で無効" : "🛡️ 免罪符により無効"}</span>`
            : `<span class="boss-counter-player-distance">距離${Number(row.distance)}マス</span><span class="boss-counter-player-damage">−${formatG(Number(row.damage))}G</span>`;
        return `<div class="boss-counter-player-row">${name}${result}</div>`;
    }).join("");
    return `<div class="boss-counter-image-wrap"><img src="${BOSS_MAP_ICON_PATH}" alt="ボス" class="boss-counter-popup-icon"></div>`
        + `<div>離れたマスに応じてダメージ！</div><div class="boss-counter-player-list">${playersHtml}</div>`;
}

function handleBossCounter(
    callback
) {

    // Normal bosses now apply the penalty once, after their defeat.
    if (!(window.onlineGame && window.onlineGame.isOnline) && Number(currentBossId) !== 9999) return false;
    if (window.onlineGame && window.onlineGame.isOnline && Number(currentBossId) !== 9999) return false;

if (
    bossCounterEnabled &&
    currentPlayer === 0
) {

    console.log(
        "👹 ボスカウンター発動"
    );
    const boss =
    BOSS_CONTENTS[currentBossId];

    const counterRows = [];


    players.forEach(
        function (targetPlayer) {
            if (targetPlayer.underground) return;

            if (window.DisadvantageImmunityRules?.isActive(targetPlayer)) {
                counterRows.push({ name:targetPlayer.name, reason:"disadvantageImmunity", distance:0, damage:0 });
                return;
            }

            // =========================
// ボスカウンター無効
// =========================

if (
    hasBossCounterImmunity(
        targetPlayer
    )
) {

    // =========================
    // バイト中による無効
    // =========================

    if (
        targetPlayer.jobTurnsRemaining > 0
    ) {

        counterRows.push({ name: targetPlayer.name, reason: "job", distance: 0, damage: 0 });

    }

    // =========================
    // アイテムによる無効
    // =========================

    else {

        counterRows.push({ name: targetPlayer.name, reason: "item", distance: 0, damage: 0 });

    }

    return;
}

            const distance =
                getShortestDistanceToBoss(
                    targetPlayer.position
                );

            const damage =
                distance * boss.counterDamage;


            console.log(
                "ボスカウンター:",
                targetPlayer.name,
                "現在地:",
                targetPlayer.position,
                "ボスまで:",
                distance,
                "マス",
                "ダメージ:",
                damage + "G"
            );


            if (
                damage > 0
            ) {

                targetPlayer.money -=
                    damage;

            }


            console.log(
                "ボスカウンターG減少:",
                targetPlayer.name,
                "-" + damage + "G",
                "残り:",
                targetPlayer.money + "G"
            );


           counterRows.push({ name: targetPlayer.name, distance, damage, reason: null });

        }
    );


    const counterMessage = buildBossCounterMessage(counterRows);

// =========================
// ボスカウンターSE
// =========================

const bossCounterSE =
    new Audio(
        "sounds/戦闘/怪獣の足音.mp3"
    );

bossCounterSE.currentTime = 0;

(window.GameSE ? window.GameSE.playLocal(bossCounterSE) : bossCounterSE.play()).catch(
    function (error) {

        console.warn(
            "【ボスカウンター】SE再生失敗：",
            error
        );

    }
);

const popup =
    document.getElementById(
        "eventPopup"
    );

if (popup) {
    popup.classList.add(
        "boss-counter-popup"
    );
}
   showEventPopup(
    "ボスカウンター発動！",
    counterMessage,
    function () {

    if (popup) {
        popup.classList.remove(
            "boss-counter-popup"
        );
    }

    renderPlayers();
    playPlayerSwitchingSound();
    if (callback) callback();

    }
);

return true;

}

    return false;
}

function showPassiveEffectAnnouncements(
    player,
    appliedEffects,
    expiredItems,
    callback
) {

    const announcements = [];

    // =========================
    // 発動したパッシブ効果
    // =========================

    appliedEffects.forEach(
        function (effect) {

            const gain =
                Number(effect.gain) || 0;

            if (gain > 0) {

                announcements.push({
                    title: "✨ パッシブ効果発動！",
                    message:
                        `${effect.itemName}の恩恵を受けた！ ` +
                        `<strong>${formatG(gain)}G</strong> ゲット！`
                });

            } else if (gain < 0) {

                announcements.push({
                    title: "💸 パッシブ効果発動！",
                    message:
                        `${effect.itemName}の効果で ` +
                        `<strong>${formatG(Math.abs(gain))}G</strong> 失った！`,
                    sound: Number(effect.itemId) === 15 ? "moneyLoss" : undefined
                });

            }

        }
    );

    // =========================
    // 効果が切れたアイテム
    // =========================

    expiredItems.forEach(
        function (item) {

            announcements.push({
                title: "⏰ 効果終了",
                message:
                    `<strong>${item.itemName}</strong>の効果が切れた！`
            });

        }
    );

    // =========================
    // アナウンスがない場合
    // =========================

    if (
        announcements.length === 0
    ) {

        if (callback) {
            callback();
        }

        return;
    }

    // =========================
    // 順番に表示
    // =========================

    let index = 0;

    function showNextAnnouncement() {

        if (
            index >=
            announcements.length
        ) {

            if (callback) {
                callback();
            }

            return;
        }

        const announcement =
            announcements[index];

        index += 1;

        showEventPopup(
            announcement.title,
            announcement.message,
            function () {
                showNextAnnouncement();
            },
            {subjectIndex: players.indexOf(player), sound: announcement.sound}
        );

    }

    showNextAnnouncement();
}

// =========================
// 次プレイヤーのターン開始
// =========================

let onlineTurnEndRequestInFlight = false;
let lastStartedOnlineTurnKey = null;
let pendingOnlineTurnStartEffects = null;
let walletAnnouncementsTurnKey = null;

function showTurnStartAnnouncements(player, appliedEffects, expiredItems, bossCounter, callback) {
    const continueTurn = function () { showPassiveEffectAnnouncements(player, appliedEffects, expiredItems, callback); };
    if (!bossCounter) { continueTurn(); return; }
    window.GameSE.playLocal(new Audio("sounds/戦闘/怪獣の足音.mp3")).catch(function () {});
    const popup = document.getElementById("eventPopup");
    if (popup) popup.classList.add("boss-counter-popup");
    showEventPopup("ボスカウンター発動！", buildBossCounterMessage(bossCounter), function () {
        if (popup) popup.classList.remove("boss-counter-popup");
        continueTurn();
    });
}

// ターン交代のサーバー確定を待ってから、次のターン開始効果を実行する。
// 手番外クライアントではパッシブ効果などのゲーム状態変更を実行しない。
function startNextPlayerTurn(player) {
    window.GameActionInput?.syncTurn(`${currentTurn}:${currentPlayer}`);
    if (window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync) {
        if (onlineTurnEndRequestInFlight) return;
        const socketId = window.onlineGame.socket && (window.onlineGame.playerId || window.onlineGame.socket.id);
        const canonical = window.onlineGame.sync.state;
        const canonicalActive = canonical && Array.isArray(canonical.players)
            ? canonical.players[Number(canonical.activePlayerIndex)]
            : null;

        if (socketId && canonicalActive && String(canonicalActive.id) === String(socketId)
            && Number(canonical.activePlayerIndex) !== Number(currentPlayer)) {
            onlineTurnEndRequestInFlight = true;
            // Flush gold and item changes before the server changes owner.
            // Otherwise a queued snapshot could arrive after this handoff and
            // be rejected as an out-of-turn mutation.
            window.publishOnlineGameState().then(function (published) {
                if (!published || !published.ok) throw new Error(published && published.error || "ターン終了前の状態を同期できませんでした。");
                return window.onlineGame.sync.endTurn();
            }).then(function (response) {
                onlineTurnEndRequestInFlight = false;
                if (!response || !response.ok) {
                    console.error("[online] ターン交代の同期に失敗:", response && response.error);
                    window.onlineGame.sync.requestState().then(function (snapshot) {
                        if (snapshot && snapshot.ok && snapshot.state) applyOnlineCanonicalState(snapshot.state, "turn-recovery");
                    });
                    return;
                }
                if (typeof window.setOnlineTurnState === "function") {
                    window.setOnlineTurnState(Number(response.activePlayerIndex), response.currentTurn);
                }
                if (response.turnStartEffects) {
                    if (response.turnStartEffects.bridgeCollapseRestored) {
                        const eventId = String(response.turnStartEffects.bridgeCollapseRecoveryEventId || "");
                        if (!eventId || !window.bridgeCollapseRecoveryShownEventIds?.has(eventId)) {
                            window.bridgeCollapseRecoveryPending = {
                                playerIndex:Number(response.activePlayerIndex),
                                currentTurn:Number(response.currentTurn),
                                eventId:eventId || null
                            };
                        }
                    }
                    pendingOnlineTurnStartEffects = {
                        playerIndex: Number(response.activePlayerIndex),
                        currentTurn: Number(response.currentTurn),
                        bossCounter: response.turnStartEffects.bossCounter || null,
                        appliedEffects: Array.isArray(response.turnStartEffects.appliedEffects) ? response.turnStartEffects.appliedEffects : [],
                        expiredItems: Array.isArray(response.turnStartEffects.expiredItems) ? response.turnStartEffects.expiredItems : []
                    };
                }
                refreshOnlineTurnControls();
                const nextPlayer = Array.isArray(players) ? players[Number(response.activePlayerIndex)] : null;
                if (nextPlayer && socketId && String(nextPlayer.id) === String(socketId)) {
                    beginPlayerTurn(nextPlayer);
                }
            }).catch(function (error) {
                onlineTurnEndRequestInFlight = false;
                console.error("[online] ターン交代要求に失敗:", error);
            });
            return;
        }

        // サーバー上の現在の手番が自分でなければ、状態変更を伴う
        // ターン開始処理は実行しない。自分の手番通知を受けた側が開始する。
        if (!socketId || !canonicalActive || String(canonicalActive.id) !== String(socketId)
            || Number(canonical.activePlayerIndex) !== Number(currentPlayer)) {
            refreshOnlineTurnControls();
            return;
        }
    }
    beginPlayerTurn(player);
}

let offlinePonzi = null;
let ponziCameraPendingKey = null;
window.startPonziTurn = function (player, done) {
    const rules = window.PonziRules;
    const presentation = window.PonziPresentation;
    if (!rules || !presentation || window.gameOpeningComplete === false || player !== players[currentPlayer]) return false;
    const online = window.onlineGame?.isOnline;
    const sync = online ? window.onlineGame.sync : null;
    if (online && (!isLocalOnlineTurn() || sync?.state?.activePlayerIndex !== currentPlayer || sync.state.matchPhase !== "playing")) return false;
    if (presentation.isOpen()) return true;

    const state = sync ? sync.state : { players, activePlayerIndex: currentPlayer, currentTurn, ponzi: offlinePonzi };
    if (!sync) {
        rules.prepare(state, calculateTotalAssetValue);
        offlinePonzi = state.ponzi;
    }
    if (!rules.pending(state)) return false;
    const playerIndex = players.indexOf(player);
    if (playerIndex < 0) return false;
    const cameraKey = `${state.currentTurn}:${playerIndex}`;
    if (ponziCameraPendingKey === cameraKey) return true;
    ponziCameraPendingKey = cameraKey;

    if (state.undergroundFlow) window.UndergroundUI?.suspend();
    if (!sync) {
        renderTurn();
        renderPlayers();
    }
    const openPresentation = () => {
        if (ponziCameraPendingKey !== cameraKey) return;
        ponziCameraPendingKey = null;
        if (player !== players[currentPlayer] || (sync && sync.state?.activePlayerIndex !== playerIndex)) return;
        presentation.open(state, {
        async submit(action, amount) {
            if (sync) {
                const response = await sync.actPonzi(action, amount, createOnlineSyncEventId("ponzi"));
                if (!response?.ok || !response.state) throw new Error(response?.error || "イベント操作を確定できませんでした。");
                return response.state;
            }
            const error = rules.act(state, action, amount);
            if (error) throw new Error(error);
            renderTurn();
            renderPlayers();
            return state;
        },
        sync: sync ? (action, data) => syncOnlineScreenView("ponzi", player, action, data) : undefined,
        done() {
            if (sync) window.renderOnlineUnderground?.(sync.state);
            done?.();
        }
        });
    };
    if (typeof window.centerPlayerOnMap === 'function') window.centerPlayerOnMap(playerIndex, 'smooth', openPresentation);
    else openPresentation();
    return true;
};

function beginPlayerTurn(player) {
    const online = window.onlineGame?.isOnline;
    const canonical = online ? window.onlineGame.sync?.state : null;
    if (online && (!isLocalOnlineTurn() || (canonical?.matchPhase && canonical.matchPhase !== 'playing'))) return;
    preloadPlayerDirectionSprites(player);
    const turnKey = `${currentTurn}:${currentPlayer}`;
    const expiringOffline = !online && player.disadvantageImmunityTurnKey && player.disadvantageImmunityTurnKey !== turnKey;
    const immunityPending = online ? canonical?.disadvantageImmunityExpiry === turnKey : Boolean(expiringOffline || offlineImmunityExpiry === turnKey);
    function showBridgeCollapseRecovery() {
        const pending = window.bridgeCollapseRecoveryPending;
        const playerIndex = players.indexOf(player);
        if (!pending || playerIndex < 0) return false;
        if (Number(pending.playerIndex) !== playerIndex || Number(pending.currentTurn) !== Number(currentTurn)) return false;
        const eventId = String(pending.eventId || "");
        if (eventId && window.bridgeCollapseRecoveryShownEventIds?.has(eventId)) {
            window.bridgeCollapseRecoveryPending = null;
            return false;
        }

        window.bridgeCollapseRecoveryPending = null;
        if (eventId) window.bridgeCollapseRecoveryShownEventIds?.add(eventId);
        window.bridgeCollapseVisualState = null;
        renderMap();
        window.GamePanels?.refresh();
        showEventPopup("", "橋の復旧が完了した！", function () {
            beginPlayerTurn(player);
        }, {subjectIndex:playerIndex});
        return true;
    }

    if (immunityPending && walletAnnouncementsTurnKey === turnKey) return;
    if (!immunityPending && online) {
        if (window.SpecialRewardRules.pending(canonical?.specialReward)) { renderGuidebook(canonical); return; }
        if (canonical?.guidebook?.view) { renderTurn(); return; }
        if (showBridgeCollapseRecovery()) return;
        if (window.startPonziTurn?.(player, () => beginPlayerTurn(player))) return;
        if (canonical?.undergroundFlow || player.underground) return;
        if (lastStartedOnlineTurnKey === turnKey) return;
        lastStartedOnlineTurnKey = turnKey;
    } else if (!immunityPending) {
        const guidebook = offlineGuidebookState();
        window.SpecialRewardRules.beginTurn(guidebook, calculateTotalAssetValue);
        offlineSpecialReward = guidebook.specialReward;
        GuidebookRules.beginTurn(guidebook);
        if (window.SpecialRewardRules.pending(guidebook.specialReward)) {
            window.UndergroundUI?.suspend();
            renderGuidebook(guidebook);
            return;
        }
        if (guidebook.guidebook?.view) {
            window.UndergroundUI?.suspend();
            renderTurn();
            return;
        }
        if (showBridgeCollapseRecovery()) return;
        if (window.startPonziTurn?.(player, () => beginPlayerTurn(player))) return;
        const state = getOfflineUndergroundState();
        if (offlineUndergroundTurnKey !== turnKey) {
            offlineUndergroundTurnKey = turnKey;
            if (offlineItemSealCheckKey !== turnKey) { SpecialItemRules.checkSeal(player); offlineItemSealCheckKey = turnKey; }
            window.UndergroundRules.startTurn(state);
            applyOfflineUnderground(state);
            if (state.undergroundFlow) return;
        }
    }

    window.MapAreaAudio?.updateForPlayer(player);

    inventoryButton.disabled =
        false;

    // =========================
    // ターン開始時のアイテム効果
    // =========================

    console.log(
        "【ターン開始時・アイテム効果チェック】",
        player.name,
        player.inventory,
        player.money
    );

    let appliedEffects = [];
    let expiredItems = [];
    let turnBossCounter = null;
    if (online) {
        const pending = immunityPending ? canonical.disadvantageImmunityWallet : pendingOnlineTurnStartEffects;
        if (pending && (immunityPending || (Number(pending.playerIndex) === Number(currentPlayer)
            && Number(pending.currentTurn) === Number(currentTurn)))) {
            appliedEffects = Array.isArray(pending.appliedEffects) ? pending.appliedEffects : [];
            expiredItems = Array.isArray(pending.expiredItems) ? pending.expiredItems : [];
            turnBossCounter = pending.bossCounter || null;
            pendingOnlineTurnStartEffects = null;
        }
        if (immunityPending) pendingOnlineTurnStartEffects = null;
    } else if (walletAnnouncementsTurnKey !== turnKey) {
        appliedEffects = applyTurnStartItemEffects(player);
        expiredItems = removeExpiredItems(player, currentTurn);
        if (expiringOffline) {
            if (window.DisadvantageImmunityRules?.clearAtTurnStart(player)) offlineImmunityExpiry = turnKey;
            delete player.disadvantageImmunityTurnKey;
            updatePlayerStatusUI(player);
            renderMap();
            renderPlayers();
        }
    }
    if (immunityPending) {
        walletAnnouncementsTurnKey = turnKey;
        rouletteButton.disabled = true;
        inventoryButton.disabled = true;
    }
// =========================
// パッシブ効果適用後
// プレイヤー表示を先に更新
// =========================

updateNextPlayerView();

showTurnStartAnnouncements(
    player,
    appliedEffects,
    expiredItems,
    turnBossCounter,
    function () {

        if (immunityPending) {
            if (online && canonical.disadvantageImmunityWallet) {
                const advance = async () => {
                    const response = await window.onlineGame.sync.showImmunityExpiry(turnKey);
                    if (!response?.ok) showEventPopup('通信エラー', response?.error || '終了案内を表示できませんでした。', advance, { sync:false });
                };
                advance();
            } else {
                if (!online) offlineImmunityReady = turnKey;
                renderGuidebook(guidebookState());
            }
            return;
        }

    // =========================
    // 次のプレイヤーが
    // 仕事中か確認
    // =========================

    if (
        player.jobTurnsRemaining > 0
    ) {

        const onlineJobSync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync
            ? window.onlineGame.sync
            : null;
        if (onlineJobSync) {
            onlineJobSync.advanceJob().then(function (response) {
                if (!response || !response.ok || !response.state) {
                    console.error("[online] バイト進行を確定できません:", response && response.error);
                    alert(response && response.error || "バイト報酬の同期に失敗しました。画面の状態を確認してください。");
                    return;
                }
                applyOnlineCanonicalState(response.state, "job-advance");
                updateNextPlayerView();
                if (response.paid) {
                    renderPlayers();
                    showEventPopup(
                        "💰 バイト終了！",
                        `${player.name}は<strong>${formatG(Number(response.reward))}G</strong>を獲得！`,
                        function () {
                            updateNextPlayerView();
                            rouletteButton.disabled = false;
                        }
                    );
                } else {
                    showEventPopup(
                        "💼 バイト中",
                        `${player.name}は現在バイト中です。<br>残り ${Number(response.state.players[currentPlayer].jobTurnsRemaining)} ターン`,
                        function () { finishTurn(player); }
                    );
                }
            }).catch(function (error) {
                console.error("[online] バイト進行の通信に失敗:", error);
                alert("バイト報酬の同期に失敗しました。画面の状態を確認してください。");
            });
            return;
        }

        player.jobTurnsRemaining -=
            1;

        updateNextPlayerView();

        // =========================
        // 仕事終了
        // =========================

        if (
            player.jobTurnsRemaining === 0
        ) {

            const reward =
                player.jobReward;

            player.money +=
                reward;

            updatePlayerStatusUI(
                player
            );

            player.jobReward =
                0;

            renderPlayers();

            showEventPopup(
                "💰 バイト終了！",

                `${player.name}は` +
                `<strong>${formatG(reward)}G</strong>を獲得！`,

                function () {

                    updateNextPlayerView();

                    rouletteButton.disabled =
                        false;

                }
            );

            return;

        }

        // =========================
        // まだ仕事中
        // =========================

        showEventPopup(
            "💼 バイト中",

            `${player.name}は現在バイト中です。<br>` +
            `残り ${player.jobTurnsRemaining} ターン`,

            function () {

                finishTurn(
                    player
                );

            }
        );

        return;

    }

    // =========================
    // 通常プレイヤー
    // =========================

    updateNextPlayerView();
    refreshShortestPathToBoss();

    // =========================
    // ボスマスにいる場合
    // 再戦確認
    // =========================

    if (
        player.position ===
        currentBossSquareId
    ) {

        showBossChallengePopup(
            player,
            true
        );

        return;

    }

    // =========================
    // ルーレット使用可能
    // =========================

    rouletteButton.disabled =
        false;

}

 );

}
// =========================
// ターン終了
// =========================

function finishTurn(
    player, handoffReady = false
) {

    const localOwnsTurn = !(window.onlineGame && window.onlineGame.isOnline)
        || (isLocalOnlineTurn() && player && window.onlineGame.socket
            && String(player.id) === String((window.onlineGame.playerId || window.onlineGame.socket.id)));
    if (remoteShopViewActive && !localOwnsTurn) {
        ["shopPopup", "magicShopPopup", "powerShopPopup"].forEach(function (id) {
            const popup = document.getElementById(id);
            if (popup) popup.style.display = "none";
        });
        return;
    }
    remoteShopViewActive = false;
    if (window.onlineGame && window.onlineGame.isOnline) {
        if (localOwnsTurn) {
            const mugging=window.onlineGame.sync?.state?.bridgeMugging;
            if (mugging&&String(mugging.playerId)===String(player?.id)) {
                if (window.BridgeMuggingPresentation?.isOpen()||bridgeMuggingLaunchInFlight) return;
                if (mugging.status==='awaitingArrival'&&!bridgeMuggingLaunchInFlight) {
                    bridgeMuggingLaunchInFlight=true;
                    window.onlineGame.sync.startBridgeMugging(mugging.eventId).then(function(response){
                        if(!response?.ok||!response.state)throw new Error(response?.error||'イベント状態を取得できませんでした。');
                        applyOnlineCanonicalState(response.state,'bridge-mugging-start',true);
                        if(response.state.bridgeMugging)presentBridgeMugging(player,response.state.bridgeMugging,true,handoffReady);
                    }).catch(function(error){
                        console.error('[オンライン] カツアゲイベントを開始できません:',error);
                        showEventPopup('通信エラー','カツアゲイベントの状態を取得できませんでした。通信を確認してください。',function(){});
                    }).finally(function(){bridgeMuggingLaunchInFlight=false;});
                    return;
                }
                if (mugging.status==='active') {
                    presentBridgeMugging(player,mugging,true,handoffReady);
                    return;
                }
                return;
            }
            window.completeOnlineTurn(player);
        }
        return;
    }
    const offlineMugging=window.offlineBridgeMuggingPending;
    if(offlineMugging&&offlineMugging.player===player){
        window.offlineBridgeMuggingPending=null;
        presentBridgeMugging(player,offlineMugging,false,handoffReady);
        return;
    }
    const settlement = getOfflineUndergroundState();
    const settlementComplete = window.UndergroundRules.endTurn(settlement);
    // Keep the completed flow as well: the visual handoff calls finishTurn
    // again, and must not settle the same player's debt a second time.
    offlineUndergroundFlow = settlement.undergroundFlow;
    if (!settlementComplete) {
        applyOfflineUnderground(settlement);
        return;
    }
    const guidebook = offlineGuidebookState();
    if (guidebook.guidebook?.view) return;
    if (!handoffReady && window.TurnHandoff) {
        window.TurnHandoff.run(() => finishTurn(player, true));
        return;
    }
    if (GuidebookRules.endTurn(guidebook)) {
        window.UndergroundUI?.suspend();
        renderTurn();
        renderPlayers();
        return;
    }
    const collapse = window.bridgeCollapseState;
    if (collapse && (collapse.ownerId != null
        ? String(collapse.ownerId) === String(player?.id)
        : Number(collapse.ownerIndex) === Number(currentPlayer))
        && collapse.useTurnKey !== `${currentTurn}:${currentPlayer}`) {
        collapse.remainingActions = Math.max(0, Number(collapse.remainingActions) - 1);
        if (collapse.remainingActions === 0) {
            window.bridgeCollapseState = null;
            window.bridgeCollapseRecoveryPending = {
                playerIndex:(currentPlayer + 1) % players.length,
                currentTurn:currentPlayer === players.length - 1 ? currentTurn + 1 : currentTurn,
                eventId:collapse.eventId || null
            };
        }
        renderMap();
        window.GamePanels?.refresh();
    }
    syncOnlineScreenView("", player, "close");
    if (window.publishOnlineGameState) {
        window.publishOnlineGameState().then(function (response) {
            if (!response || !response.ok) console.warn("[online] ターン終了時の状態同期に失敗:", response && response.error);
        });
    }

    console.log(
        "ターン終了！現在のプレイヤー:",
        currentPlayer
    );

        // =========================
    // ターン終了時にアイテムボタンを再有効化
    // =========================

    inventoryButton.disabled =
        false;


    // =========================
    // 全員のターンが終了したか
    // =========================

    if (
        currentPlayer ===
        players.length - 1
    ) {

        // =========================
        // 今終了したターン
        // =========================

        const completedTurn =
            currentTurn;


        // =========================
        // 次のターンへ
        // =========================

        if (completedTurn >= maxTurns) GuidebookRules.refundOffers(guidebook);
        window.OfflineDividends.recordRound(players, completedTurn);

        currentTurn +=
            1;


        // =========================
        // 配当タイミング
        // =========================

        if (completedTurn % dividendCycle === 0) {
            window.UndergroundUI.suspend();
            if (completedTurn >= maxTurns) {
                window.OfflineDividends.settleFinal(players, completedTurn);
                const finish = function () { showGameResult(); };
                if (window.TurnHandoff) window.TurnHandoff.run(finish); else finish();
                return;
            }
            window.OfflineDividends.show(players, completedTurn, function () {
                players.forEach(updatePlayerStatusUI);
                renderPlayers();
            }, function (closeDividend) {
                if (currentTurn > maxTurns) {
                    const finish = function () { closeDividend(); showGameResult(); };
                    if (window.TurnHandoff) window.TurnHandoff.run(finish); else finish();
                    return;
                }
                const advance = function () {
                    closeDividend();
                    currentPlayer = 0;
                    refreshOnlineTurnControls();
                    updateNextPlayerView();
                    if (handleBossCounter(function () { startNextPlayerTurn(players[currentPlayer]); })) return;
                    playPlayerSwitchingSound();
                    startNextPlayerTurn(players[currentPlayer]);
                };
                if (window.TurnHandoff) window.TurnHandoff.run(advance); else advance();
            }, maxTurns);
            return;
        }

// =========================
// 配当がない場合
// =========================

// =========================
// 最大ターン数終了
// =========================

if (
    currentTurn >
    maxTurns
) {

    showGameResult();

    return;

}


// =========================
// 次のプレイヤーへ
// =========================

currentPlayer =
    (
        currentPlayer + 1
    )
    %
    players.length;


// =========================
// ボスカウンター判定
// =========================

if (
    handleBossCounter(
        function () {

            startNextPlayerTurn(
                players[currentPlayer]
            );

        }
    )
) {

    return;

}



//SE:プレイヤー切り替え
playPlayerSwitchingSound();




        // =========================
        // 次のプレイヤー
        // =========================

       const nextPlayer =
    players[currentPlayer];

startNextPlayerTurn(
    nextPlayer
);

return;

    }


    // =========================
    // 次のプレイヤーへ
    // =========================

    currentPlayer =
        (
            currentPlayer + 1
        )
        %
        players.length;


//SE:プレイヤー切り替え
playPlayerSwitchingSound();


    const nextPlayer =
    players[currentPlayer];

startNextPlayerTurn(
    nextPlayer
);

}

// =========================
// 戦闘UI・ゲーム開始処理から呼び出すため公開
// =========================

window.showBossChallengePopup =
    showBossChallengePopup;

window.showDividendPopup = showDividendPopup;
window.showAssetRankingPopup = showAssetRankingPopup;
window.showGameResult = showGameResult;

window.showBossDestinationPopup =
    showBossDestinationPopup;

window.finishTurn =
    finishTurn;

window.centerCurrentPlayerOnMap =
    centerCurrentPlayerOnMap;

function focusCurrentPlayerFromAvatar() {
    avatarCameraFocus?.abort();
    const mapArea = document.querySelector('.game-screen .map-area');
    const mapBoard = document.getElementById('mapBoard');
    const playerIndex = currentPlayer;
    const position = players[playerIndex]?.position;
    const findSquare = () => mapArea?.querySelector(`.map-node[data-square-id="${position}"]`);
    const square = findSquare();
    if (!square || !mapBoard) return;

    window.settleMapZoomUI?.();
    const zoom = getMapZoomUI();
    const instant = window.TurnHandoff?.isBlack() || matchMedia('(prefers-reduced-motion: reduce)').matches;
    function centeredScroll(node) {
        const rect = node.getBoundingClientRect();
        const view = mapArea.getBoundingClientRect();
        const limits = MapScene.getCameraLimits();
        return {
            left: Math.max(limits.minLeft, Math.min(limits.maxLeft, mapArea.scrollLeft + rect.left + rect.width / 2 - view.left - view.width / 2)),
            top: Math.max(limits.minTop, Math.min(limits.maxTop, mapArea.scrollTop + rect.top + rect.height / 2 - view.top - view.height / 2))
        };
    }

    const focus = new AbortController();
    avatarCameraFocus = focus;
    let restoringZoom = false;
    function restoreZoom() {
        if (restoringZoom) return;
        restoringZoom = true;
        const targetSquare = findSquare();
        if (!targetSquare || playerIndex !== currentPlayer || position !== players[playerIndex]?.position || zoom !== getMapZoomUI()) {
            focus.abort();
            return;
        }
        if (!instant && window.animateMapZoomResetUI?.(targetSquare, focus)) return;

        focus.abort();
        window.resetMapZoomUI?.();
        mapArea.scrollTo({ ...centeredScroll(targetSquare), behavior: 'instant' });
    }

    const target = centeredScroll(square);
    const hasArrived = () => Math.abs(mapArea.scrollLeft - target.left) < 1 && Math.abs(mapArea.scrollTop - target.top) < 1;
    const listenerOptions = { signal: focus.signal };
    for (const event of ['wheel', 'pointerdown']) {
        mapArea.addEventListener(event, () => focus.abort(), listenerOptions);
    }
    if (hasArrived() || instant) {
        mapArea.scrollTo({ ...target, behavior: 'instant' });
        restoreZoom();
        return;
    }

    mapArea.addEventListener('scroll', () => { if (hasArrived()) restoreZoom(); }, { ...listenerOptions, passive: true });
    mapArea.scrollTo({ ...target, behavior: 'smooth' });
}

// =========================
// 指定プレイヤーのいるマスを
// マップ中央へ移動
// =========================

function centerPlayerOnMap(
    playerIndex,
    behavior = "smooth",
    onCentered,
    allowDuringMovement = false,
    movementWaitFrames = 0
) {

    avatarCameraFocus?.abort();
    const mapArea =
        document.querySelector(
            ".game-screen .map-area"
        );

    const mapBoard =
        document.getElementById(
            "mapBoard"
        );

    const player =
        players[playerIndex];

    if (
        !mapArea ||
        !mapBoard ||
        !player
    ) {
        onCentered?.();
        return;
    }


    // =========================
    // プレイヤーがいるマスを取得
    // =========================

    const mapNode =
        mapArea.querySelector(
            `.map-node[data-square-id="${player.position}"]`
        );

    if (!mapNode) {
        onCentered?.();
        return;
    }


    // =========================
    // 進行中のスクロールを解除
    // =========================

    mapArea.scrollTo({

        left:
            mapArea.scrollLeft,

        top:
            mapArea.scrollTop,

        behavior:
            "auto"

    });


    requestAnimationFrame(
        function () {
            if (!mapNode.isConnected) {
                onCentered?.();
                return;
            }
            if (!allowDuringMovement && MapMovementPresentation.isMoving(mapBoard)) {
                if (playerIndex === currentPlayer && movementWaitFrames < 90) {
                    requestAnimationFrame(() => centerPlayerOnMap(
                        playerIndex, behavior, onCentered, allowDuringMovement, movementWaitFrames + 1
                    ));
                } else {
                    onCentered?.();
                }
                return;
            }

            // Use the actual on-screen square position. This stays correct
            // across CSS zoom, mobile padding and scrollable board margins.
            const squareRect = mapNode.getBoundingClientRect();
            const viewRect = mapArea.getBoundingClientRect();
            const limits = window.MapScene?.getCameraLimits?.();
            const maxScrollLeft = Math.max(0, mapArea.scrollWidth - mapArea.clientWidth);
            const maxScrollTop = Math.max(0, mapArea.scrollHeight - mapArea.clientHeight);
            const targetScrollLeft = mapArea.scrollLeft + (squareRect.left + squareRect.width / 2
                - viewRect.left - viewRect.width / 2);
            const targetScrollTop = mapArea.scrollTop + (squareRect.top + squareRect.height / 2
                - viewRect.top - viewRect.height / 2);
            const finalScrollLeft = Math.max(limits?.minLeft ?? 0,
                Math.min(targetScrollLeft, limits?.maxLeft ?? maxScrollLeft));
            const finalScrollTop = Math.max(limits?.minTop ?? 0,
                Math.min(targetScrollTop, limits?.maxTop ?? maxScrollTop));

            // =========================
            // マス中央へ移動
            // =========================

            mapArea.scrollTo({

                left:
                    finalScrollLeft,

                top:
                    finalScrollTop,

                behavior:
                    behavior

            });
            if (onCentered) {
                const reached = () => Math.abs(mapArea.scrollLeft - finalScrollLeft) < 1
                    && Math.abs(mapArea.scrollTop - finalScrollTop) < 1;
                function report() {
                    clearTimeout(timeout);
                    mapArea.removeEventListener('scroll', onScroll);
                    onCentered();
                }
                function onScroll() { if (reached()) report(); }
                const timeout = setTimeout(() => {
                    mapArea.scrollTo({ left: finalScrollLeft, top: finalScrollTop, behavior: 'instant' });
                    report();
                }, 700);
                if (reached()) report();
                else mapArea.addEventListener('scroll', onScroll, { passive: true });
            }

        }
    );

}
// 指定プレイヤー用のカメラ移動関数を公開
window.centerPlayerOnMap = centerPlayerOnMap;

// =========================
// 現在プレイヤーを
// マップ中央へ
// =========================

function centerCurrentPlayerOnMap(
    behavior = "smooth"
) {
    const bookView = guidebookState()?.guidebook?.view?.kind;
    if (bookView === 'offer' || guidebookTurnFocusViews.includes(bookView)) return;

    centerPlayerOnMap(
        currentPlayer,
        window.TurnHandoff?.isBlack() ? "auto" : behavior
    );

}

// =========================
// 🎯 目的地をクリックしたら
// ボスマスを中央へ
// =========================

const destinationButton =
    document.querySelector(
        ".destination"
    );

if (destinationButton) {

    destinationButton.addEventListener(
        "click",
        function () {
            avatarCameraFocus?.abort();

            const mapArea =
                document.querySelector(
                    ".game-screen .map-area"
                );

            const bossNode =
                document.querySelector(
                    `.map-node[data-square-id="${currentBossSquareId}"]`
                );

            if (!mapArea || !bossNode) {
                return;
            }

            const mapRect =
                mapArea.getBoundingClientRect();

            const bossRect =
                bossNode.getBoundingClientRect();

            const mapCenterX =
                mapRect.left +
                mapRect.width / 2;

            const mapCenterY =
                mapRect.top +
                mapRect.height / 2;

            const bossCenterX =
                bossRect.left +
                bossRect.width / 2;

            const bossCenterY =
                bossRect.top +
                bossRect.height / 2;

            const scrollAmountX =
                bossCenterX -
                mapCenterX;

            const scrollAmountY =
                bossCenterY -
                mapCenterY;

            mapArea.scrollTo({

                left:
                    mapArea.scrollLeft +
                    scrollAmountX,

                top:
                    mapArea.scrollTop +
                    scrollAmountY,

                behavior:
                    "smooth"

            });

        }
    );

}

// =========================
// 初期表示
// =========================

// A new match starts slightly zoomed out, regardless of the previous map view.
window.resetMapZoomUI?.();

renderMap();

renderPlayers();

renderTurn();
const initialUndergroundState = window.onlineGame?.isOnline && window.onlineGame.sync?.state;
if (initialUndergroundState) window.renderOnlineUnderground(initialUndergroundState);
else window.UndergroundUI.render(getOfflineUndergroundState(), true, null);


// =========================
// ゲーム開始時
// プレイヤー1をマップ中央へ
// =========================

requestAnimationFrame(function () {

    centerCurrentPlayerOnMap("auto");

});



// =========================
// 共通シーンポップアップ初期化
// =========================

function setupScenePopup(
    player,
    sceneData,
    templateId = "jobPopupContentTemplate"
) {
    const popup = document.getElementById("jobPopup");
    const template = document.getElementById(templateId);

    if (!popup || !template) {
        console.error(
            "【シーンポップアップ】ポップアップまたはテンプレートが見つかりません。",
            { templateId }
        );
        return null;
    }

    if (!sceneData) {
        console.error(
            "【シーンポップアップ】シーンデータがありません。"
        );
        return null;
    }

    // Return the shared result element before replacing an earlier job scene.
    window.JobPresentation?.restoreResult();
    popup.classList.remove('job-approved-layout');
    // 画面を初期化
    popup.replaceChildren(
        template.content.cloneNode(true)
    );

    // 共通要素を取得
    const elements = {
        popup,
        background: popup.querySelector(".job-background"),
        staff: popup.querySelector(".job-staff"),
        name: popup.querySelector(".job-name"),
        dialogueText: popup.querySelector(".job-dialogue-text"),
        dialogueNext: popup.querySelector(".job-dialogue-next"),
        dialogueBox: popup.querySelector(".job-dialogue-box"),
        choicePanel: popup.querySelector(".job-choice-panel"),
        wage: popup.querySelector(".job-wage")
    };

    // 必須要素を確認
    const requiredElements = [
        "background",
        "staff",
        "name",
        "dialogueText",
        "dialogueNext",
        "dialogueBox"
    ];

    const missingElement = requiredElements.find(
        key => !elements[key]
    );

    if (missingElement) {
        console.error(
            "【シーンポップアップ】必要な要素が見つかりません。",
            missingElement
        );
        return null;
    }

    // 背景画像
    elements.background.style.display =
        sceneData.backgroundImage ? "block" : "none";

    if (sceneData.backgroundImage) {
        elements.background.src = sceneData.backgroundImage;
    } else {
        elements.background.removeAttribute("src");
    }

    // キャラクター画像
    elements.staff.style.display =
        sceneData.staffImage ? "block" : "none";

    if (sceneData.staffImage) {
        elements.staff.src = sceneData.staffImage;
    } else {
        elements.staff.removeAttribute("src");
    }

    // 名前
    elements.name.textContent = sceneData.name || "";

    // プレイヤー名
    const playerName =
        player.name ||
        player.playerName ||
        `プレイヤー${player.id ?? ""}`;

    // jobtext / dialogue のどちらにも対応
    const rawDialogue =
        sceneData.jobtext ?? sceneData.dialogue;

    const dialogueLines =
        typeof rawDialogue === "function"
            ? rawDialogue(playerName)
            : Array.isArray(rawDialogue)
                ? rawDialogue
                : [];

    return {
        ...elements,
        playerName,
        dialogueLines
    };
}

// =========================
// 共通シーン会話進行
// =========================

function startSceneDialogue(
    scene,
    {
        onLine,
        onComplete,
        autoStart = true
    } = {}
) {
    let dialogueIndex = 0;
    let completed = false;
    let stopPageAdvance;

    function advanceDialogue() {
        if (completed) return;
        if(dialogueIndex>0)window.GameSE?.play?.('confirm',{shared:true}).catch(error=>console.warn('[SE] 会話送り音を再生できません:',error));

        // すべてのセリフを表示したら終了
        if (dialogueIndex >= scene.dialogueLines.length) {
            completed = true;
            stopPageAdvance?.();

            scene.dialogueBox.removeEventListener(
                "click",
                advanceDialogue
            );

            if (typeof onComplete === "function") {
                onComplete();
            }

            return;
        }

        const line = scene.dialogueLines[dialogueIndex];
        dialogueIndex++;

        // セリフ表示は共通処理
        scene.dialogueText.textContent =
            typeof line === "string"
                ? line
                : line?.text ?? "";

        scene.dialogueNext.style.display = "block";

        // 音声再生など、個別の処理
        if (typeof onLine === "function") {
            onLine(line, dialogueIndex - 1);
        }
    }

    // クリックで次のセリフへ進む
    scene.dialogueBox.addEventListener(
        "click",
        advanceDialogue
    );
    stopPageAdvance = window.CommonAnnouncements?.bindPageAdvance(scene.dialogueBox, advanceDialogue);

    // 最初のセリフを表示
    if (autoStart) {
        advanceDialogue();
    }

    return {
        advance: advanceDialogue,

        destroy() {
            completed = true;
            stopPageAdvance?.();

            scene.dialogueBox.removeEventListener(
                "click",
                advanceDialogue
            );
        }
    };
}

// =========================
// 魔法店の会話シーン
// =========================

function showMagicShopIntroPopup(player) { showMagicShopMainMenu(player); }
function showItemShopIntroPopup(player) { showItemShopPopup(player); }

function showAssetShopIntroPopup(player, assetIds, finishCallback) {
    // Open the complete shop immediately; no intermediate dialogue scene.
    showAssetPurchasePopup(player, assetIds, finishCallback);
}

// =========================
// 報酬選択画面
// =========================

// =========================
// バイト内容表示
// =========================

// =========================
// バイトポップアップ
// =========================

function showJobPopup(
    player,
    square,
    turn,
    finishCallback
) {

    // バイト画面ではショップ購入用の店員レイアウトを解除する
    document.body.classList.remove(
        "magic-shop-dual-layout"
    );

    // =========================
    // バイトデータ取得
    // =========================

    const jobData = getJobData(square.jobId);

    if (!jobData) {
        console.error(
            "【バイトエラー】JOB_CONTENTSに存在しないjobIdです:",
            square.jobId
        );
        return;
    }

    const currentWage = getCurrentJobWage(jobData.unitPrice);

    // =========================
    // 共通ポップアップ初期化
    // =========================

    const scene = setupScenePopup(
        player,
        jobData
    );

    if (!scene) return;

    const {
        popup: jobPopup,
        staff,
        name: nameElement,
        dialogueText,
        dialogueNext,
        dialogueBox,
        choicePanel,
        wage: wageElement,
        playerName,
        dialogueLines
    } = scene;

    // 報酬表示
    if (wageElement) {
        wageElement.textContent =
            `報酬：${formatG(currentWage)}G`;
    }
    window.JobPresentation?.paintChoices(scene,currentWage);

    const sceneSync = createOnlineSceneSync("job", player, currentWage);

    let dialogueIndex = 0;

    
// =========================
// 会話音声
// =========================

let currentJobVoice = null;

function stopJobVoice() {
    if (currentJobVoice) {
        if (window.GameSE) window.GameSE.stop(currentJobVoice); else currentJobVoice.pause();
        currentJobVoice.currentTime = 0;
        currentJobVoice = null;
    }
}



    // =========================
    // 働く
    // =========================

    const jobWorkButton =
        jobPopup.querySelector("#jobWorkButton");

    jobWorkButton.onclick = function () {
         stopJobVoice();

        startJob(
            player,
            1,
            currentWage,
            function () {
                sceneSync.close();
                finishCallback();
            }
        );
    };

    // =========================
    // 働かない
    // =========================

    const jobNoneButton =
        jobPopup.querySelector(".job-none-button");

   
    
    jobNoneButton.onclick = function () {

        // 前のセリフ音声を停止
        stopJobVoice();

        // 断った時のボイスを再生
        if (jobData.refusalVoice) {
            currentJobVoice = new Audio(jobData.refusalVoice);

            (window.GameSE ? window.GameSE.playLocal(currentJobVoice) : currentJobVoice.play()).catch(function (error) {
                console.warn(
                    "断った時のボイスを再生できませんでした:",
                    jobData.refusalVoice,
                    error
                );
            });
        }
        // 店員を悲しみの表情に変更
        if (jobData.staffExpressions?.disappointed) {
            staff.src = jobData.staffExpressions.disappointed;
        }
        sceneSync.update("result", dialogueLines.length, "refused");

        // 結果ポップアップを前面に表示
        const eventPopup = document.getElementById("eventPopup");

        if (eventPopup) {
            eventPopup.classList.add("job-result-popup");
        }

        showEventPopup(
           "",
           window.JobPresentation.refusalResult(playerName),
            function () {
                sceneSync.close();
                if (eventPopup) {
                    eventPopup.classList.remove("job-result-popup");
                }

                jobPopup.style.display = "none";
                finishCallback();
            }
        );
    };



   // =========================
// 表示開始
// =========================

choicePanel.hidden = true;
jobPopup.style.display = "block";
dialogueBox.style.display = "block";

startSceneDialogue(scene, {
    onLine(line, lineIndex) {
        sceneSync.update("dialogue", lineIndex);
        // 前のセリフの音声を停止
        stopJobVoice();

        // 対応する音声があれば再生
        const voicePath =
            typeof line === "object" && line
                ? line.voice
                : null;

        if (voicePath) {
            currentJobVoice = new Audio(voicePath);

            (window.GameSE ? window.GameSE.playLocal(currentJobVoice) : currentJobVoice.play()).catch(function (error) {
                console.warn(
                    "バイト音声を再生できませんでした:",
                    voicePath,
                    error
                );
            });
        }
    },

    onComplete() {
        stopJobVoice();

        // 会話終了後に選択肢を表示
        dialogueBox.style.display = "none";
        choicePanel.hidden = false;
        sceneSync.update("choices", dialogueLines.length);
    }
});
}

// =========================
// バイト開始
// =========================

function startJob(
    player,
    turns,
    reward,
    finishCallback,
    serverConfirmed = false
) {

    const onlineJobSync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync
        ? window.onlineGame.sync
        : null;
    if (onlineJobSync && !serverConfirmed) {
        onlineJobSync.startJob().then(function (response) {
            if (!response || !response.ok || !response.state) {
                showEventPopup("バイトを開始できません", response && response.error || "バイトの同期に失敗しました。", function () {});
                return;
            }
            applyOnlineCanonicalState(response.state, "job-start");
            startJob(player, turns, Number(response.reward), finishCallback, true);
        }).catch(function (error) {
            console.error("[online] バイト開始の通信に失敗:", error);
            showEventPopup("通信エラー", "バイトを開始できませんでした。", function () {});
        });
        return;
    }

    if (Number(turns) === 1) {
        const turnKey = `${window.getCurrentTurn?.() ?? 0}:${window.getCurrentPlayerIndex?.() ?? 0}`;
        window.GameSE?.play('jobStart', {
            shared: true,
            eventId: `job-start:${player.id || player.name}:${turnKey}`
        })?.catch(error => console.warn('[SE] バイト開始:', error));
    }

    const jobPopup =
        document.getElementById(
            "jobPopup"
        );


    


    // =========================
    // 次の自分のターンから
    // 指定ターン数だけバイトする
    // =========================

   player.jobTurnsRemaining =
    turns + 1;
    
    player.jobReward =
        reward;


    // =========================
    // バイト開始
    // =========================

    
    const eventPopup = document.getElementById("eventPopup");

    if (eventPopup) {
        eventPopup.classList.add("job-result-popup");
    }

    showEventPopup(
        "バイト開始",
        window.JobPresentation.workResult(player.name,turns,reward),
        function () {
            if (eventPopup) {
                eventPopup.classList.remove("job-result-popup");
            }

            if (jobPopup) {
                jobPopup.style.display = "none";
            }

            finishCallback();
        }
    );


}

}

// =========================
// 報酬選択画面
// =========================

function showRewardPopup(player, callback, turn, monster, onlineBattleId = null) {
    return window.BattleRewardUI.show(player, callback, turn, monster, onlineBattleId);
}

function showMultiDiceRoulette(diceCount, callback, itemId, forceSix = false) {
    return window.DiceGameUI.multiple(Number(diceCount), callback, itemId, forceSix);
}

// =========================
// ゲーム中のページ離脱確認
// =========================

let gameStarted = false;

window.addEventListener("beforeunload", function (event) {

    if (!gameStarted) {
        return;
    }

    event.preventDefault();
    event.returnValue = true;
});

// =========================
// HUD：ボス距離ラベルの自動調整
// 「まであと」と「マス」を同じサイズで縮小
// 距離の数字は固定
// =========================

function fitHudDestinationLabels() {

    const destinationInfo =
        document.getElementById(
            "destinationInfo"
        );

    if (!destinationInfo) {
        return;
    }

    const labels =
        destinationInfo.querySelectorAll(
            ".hud-destination-label"
        );

    if (labels.length === 0) {
        return;
    }

    let fontSize = 20;

    labels.forEach(
        function (label) {

            label.style.fontSize =
                `${fontSize}px`;

        }
    );

    while (
        destinationInfo.scrollWidth >
        destinationInfo.clientWidth &&
        fontSize > 9
    ) {

        fontSize -= 1;

        labels.forEach(
            function (label) {

                label.style.fontSize =
                    `${fontSize}px`;

            }
        );

    }

}

// =========================
// ロスノート実行
// =========================

function announceImmunityBlock(itemName, target, usingPlayer, onNext = () => finishTurn(usingPlayer)) {
    const message = document.createElement('span');
    message.textContent = `${target.name}は無敵の加護で${itemName}の効果を防いだ！`;
    renderPlayers();
    showEventPopup(itemName, message.innerHTML, onNext, { subjectIndex: players.indexOf(target), advanceAnywhere:true });
}

function showLossNotePlayerPopup(usingPlayer, stage = "target", targetIndex = null, remote = false) {
    const closeScreen = function () {
        window.MoneyTransferUI?.close();
        syncOnlineScreenView("", usingPlayer, "close");
    };
    window.MoneyTransferUI?.show({
        players,
        actor: usingPlayer,
        itemName: ITEM_CONTENTS[13].name,
        description: "このノートに名前を書かれたものは、所持ゴールドを全て失う",
        stage,
        targetIndex,
        remote,
        icon: getPlayerCharacterIcon,
        onSound: function (sound) {
            window.GameSE?.play(sound, { shared: true }).catch(error => console.warn("[SE] ロスノート選択:", error));
        },
        onSync: function (nextStage, index) {
            const data = { itemId: 13, stage: nextStage };
            if (nextStage !== "target") data.targetIndex = Number(index);
            syncOnlineScreenView("item-action", usingPlayer, "open", data);
        },
        onExit: function () {
            closeScreen();
            showInventoryPopup(usingPlayer);
        },
        onSelectTarget: function (index, button) {
            const targetPlayer = players[index];
            if (!targetPlayer || !ApprovedCommerce.canAct(usingPlayer)) return;
            button.disabled = true;

            const requestId = createOnlineSyncEventId("loss-note");
            const onlineSync = window.onlineGame && window.onlineGame.isOnline ? window.onlineGame.sync : null;
            const perform = onlineSync
                ? window.publishOnlineGameState().then(function (published) {
                    if (!published || !published.ok) throw new Error(published && published.error || "状態を同期できませんでした。");
                    return onlineSync.useLossNote(index, requestId);
                })
                : Promise.resolve((function () {
                    const result = useLossNote(usingPlayer, targetPlayer, window.getCurrentTurn());
                    return { ok: Boolean(result), immunityBlocked: Boolean(result?.immunityBlocked) };
                })());

            perform.then(function (response) {
                if (!response || !response.ok) throw new Error(response && response.error || "ロスノートを使用できませんでした。");
                if (response.state) applyOnlineCanonicalState(response.state, "loss-note", true);
                closeScreen();
                if (response.immunityBlocked) {
                    announceImmunityBlock("ロスノート", targetPlayer, usingPlayer);
                    return;
                }
                lostSound.pause();
                lostSound.currentTime = 0;
                playSharedSE(lostSound).catch(function (error) { console.warn("ロスノートSE:", error); });
                showEventPopup("ロスノート", "所持ゴールドが0になった！", function () {
                    finishTurn(usingPlayer);
                }, { subjectIndex: index, advanceAnywhere:true });
            }).catch(function (error) {
                button.disabled = false;
                console.error("[online] ロスノート:", error);
                showEventPopup("ロスノートを使用できません", error.message, function () {});
            });
        }
    });
}


// =========================
// ロストマジック
// =========================

function actorIconForLostMagic(player) {
    const index = Array.isArray(players) ? players.indexOf(player) : -1;
    return index >= 0 ? getPlayerCharacterIcon(index) : '';
}

function lostMagicScreenData(flow, stage) {
    const screenData = { itemId:18, stage, flowId:flow.flowId };
    if (stage === 'magic') screenData.targetIndex = flow.targetIndex;
    return screenData;
}

function closeLostMagic() {
    window.activeLostMagicFlow = null;
    window.LostMagicUI?.hide();
}

function renderLostMagicTargets(flow, readOnly = false) {
    flow.stage = 'target';
    const targets = players.map((target, index) => ({ target, index }))
        .filter(({ target }) => target !== flow.actor)
        .map(({ target, index }) => ({ index, name:target.name, icon:getPlayerCharacterIcon(index), hasMagic:Array.isArray(target.magic) && target.magic.length > 0 }));
    window.LostMagicUI?.render({ stage:'targets', actorIcon:actorIconForLostMagic(flow.actor), targets, readOnly }, {
        onTarget:index => {
            if (flow.readOnly || flow.pending) return;
            const target = players[index];
            if (!target || target === flow.actor || !Array.isArray(target.magic) || !target.magic.length) return;
            flow.targetIndex = index;
            flow.originalMagicIds = target.magic.map(Number);
            renderLostMagicSelection(flow);
            syncOnlineScreenView('item-action', flow.actor, 'open', lostMagicScreenData(flow, 'magic'));
        },
        onBack:() => {
            if (flow.readOnly) return;
            closeLostMagic();
            syncOnlineScreenView('', flow.actor, 'close');
            showInventoryPopup(flow.actor);
        }
    });
}

function renderLostMagicSelection(flow, readOnly = false) {
    const target = players[Number(flow.targetIndex)];
    if (!target) return;
    flow.stage = 'magic';
    const magicIds = Array.isArray(flow.originalMagicIds) ? flow.originalMagicIds : (target.magic || []).map(Number);
    const magics = magicIds.map(id => {
        const magic = MAGIC_CONTENTS[Number(id)];
        return magic ? { id:Number(id), name:magic.name, icon:magic.icon || '', disabled:Boolean(readOnly || flow.pending),
            onLose:magicId => selectLostMagic(flow, magicId) } : null;
    }).filter(Boolean);
    window.LostMagicUI?.render({ stage:'magic', actorIcon:actorIconForLostMagic(flow.actor), targetName:target.name, magics, readOnly }, {
        onBack:() => {
            if (flow.readOnly || flow.pending) return;
            flow.targetIndex = null;
            flow.originalMagicIds = null;
            renderLostMagicTargets(flow);
            syncOnlineScreenView('item-action', flow.actor, 'open', lostMagicScreenData(flow, 'target'));
        }
    });
}

function renderLostMagicResult(flow, result, recovery = false) {
    const target = players[flow.targetIndex];
    if (!target) return;
    flow.pending = false;
    flow.stage = 'result';
    const { magicId, requestId, immunityBlocked } = result;
    const magic = MAGIC_CONTENTS[magicId];
    if (!magic) return;
    const magics = (result.originalMagicIds || flow.originalMagicIds || []).map(id => {
        const entry = MAGIC_CONTENTS[Number(id)];
        return entry ? { id:Number(id), name:entry.name, icon:entry.icon || '', disabled:true } : null;
    }).filter(Boolean);
    const onContinue = async () => {
        if (window.activeLostMagicFlow !== flow || flow.readOnly) return false;
        if (!requestId) {
            closeLostMagic();
            finishTurn(flow.actor);
            return true;
        }
        const sync = window.onlineGame.sync;
        try {
            const response = await sync.finishLostMagic(requestId);
            if (!response?.ok || !response.state) throw new Error(response?.error || '手番終了を確認できませんでした。');
            if (window.activeLostMagicFlow === flow) {
                applyOnlineCanonicalState(response.state, 'lost-magic-finish', true);
                closeLostMagic();
            }
            return true;
        } catch (error) {
            console.warn('[online] ロストマジック:', error);
            await sync.recover(true);
            return false;
        }
    };
    window.LostMagicUI?.render({
        stage:immunityBlocked ? 'blocked' : 'result', magicId, magicName:magic.name, magics, recovery,
        targetIcon:getPlayerCharacterIcon(flow.targetIndex),
        blockedText:`${target.name}は無敵の加護でロストマジックの効果を防いだ！`
    }, flow.readOnly ? {} : { onContinue });
}

async function selectLostMagic(flow, magicId) {
    if (flow.pending || flow.readOnly || flow.stage !== 'magic') return;
    const actor = flow.actor, target = players[Number(flow.targetIndex)];
    if (!target || !Array.isArray(target.magic) || !target.magic.some(id => Number(id) === Number(magicId))) return;
    flow.pending = true;
    document.querySelectorAll('.lost-magic-button').forEach(button => { button.disabled = true; });
    const onlineSync = window.onlineGame?.isOnline ? window.onlineGame.sync : null;
    if (onlineSync) {
        const requestId = createOnlineSyncEventId('item-18');
        try {
            const response = await onlineSync.useTargetedItem({ itemId:18, targetIndex:flow.targetIndex, magicId, requestId });
            if (!response?.ok || !response.state || !response.view) throw new Error(response?.error || '確定結果を取得できませんでした。');
            if (window.activeLostMagicFlow !== flow) return;
            applyOnlineCanonicalState(response.state, 'item-18', true);
            renderLostMagicResult(flow, response.view);
        } catch (error) {
            console.warn('[online] ロストマジック:', error);
            await onlineSync.recover(true);
            if (window.activeLostMagicFlow !== flow || flow.stage !== 'magic') return;
            flow.pending = false;
            flow.originalMagicIds = target.magic.map(Number);
            renderLostMagicSelection(flow);
        }
        return;
    }
    const result = useLostMagic(actor, target, magicId);
    if (!result) {
        flow.pending = false;
        renderLostMagicSelection(flow);
        return;
    }
    if (!result.immunityBlocked) playSharedSE(lostSound).catch(error => console.warn('ロストマジックSEの再生に失敗しました:', error));
    renderPlayers();
    renderLostMagicResult(flow, result);
}

function renderLostMagicRemote(player, screenData, isLocalActivePlayer, recovery = false) {
    const flowId = String(screenData?.flowId || 'remote-lost-magic');
    let flow = window.activeLostMagicFlow;
    if (!flow || flow.flowId !== flowId) {
        flow = { flowId, actor:player, targetIndex:null, pending:false, readOnly:!isLocalActivePlayer };
        window.activeLostMagicFlow = flow;
    }
    flow.actor = player;
    flow.readOnly = !isLocalActivePlayer;
    const stage = String(screenData?.stage || 'target');
    if (stage === 'intro') {
        flow.stage = 'intro';
        window.LostMagicUI?.render({ stage:'intro', actorIcon:actorIconForLostMagic(player), readOnly:!isLocalActivePlayer }, isLocalActivePlayer ? {
            onAdvance:() => {
                if (window.activeLostMagicFlow !== flow) return;
                renderLostMagicTargets(flow);
                syncOnlineScreenView('item-action', player, 'open', lostMagicScreenData(flow, 'target'));
            }
        } : {});
        return;
    }
    if (stage === 'target') { renderLostMagicTargets(flow, !isLocalActivePlayer); return; }
    flow.targetIndex = Number(screenData?.targetIndex);
    const target = players[flow.targetIndex];
    if (!target || target === player) return;
    if (stage === 'magic') {
        flow.pending = false;
        flow.originalMagicIds = (target.magic || []).map(Number);
        renderLostMagicSelection(flow, !isLocalActivePlayer);
        return;
    }
    if (stage === 'result') renderLostMagicResult(flow, screenData, recovery);
}

function showLostMagicPlayerPopup(usingPlayer) {
    const view = lostMagicScreenData({ flowId:createOnlineSyncEventId('lost-magic') }, 'intro');
    renderLostMagicRemote(usingPlayer, view, true);
    syncOnlineScreenView('item-action', usingPlayer, 'open', view);
    window.GameSE?.play?.('itemUse', { eventId:view.flowId, shared:true }).catch(error => console.warn('[SE] ロストマジック:', error));
}

// =========================
// 闇みずほ
// プレイヤー選択画面
// =========================

// =========================
// 共通
// 他プレイヤー選択画面
// =========================

function showTransferPlayerPopup(
    usingPlayer,
    options
) {

    let popup = getOrCreatePopupFromTemplate(
        "transferPlayerPopup",
        "transferPlayerPopupTemplate"
    );

    const title =
        popup.querySelector(
            ".item-action-title"
        );

    const description =
        popup.querySelector(
            ".item-action-description"
        );

    const playerList =
        popup.querySelector(
            ".transfer-player-list"
        );

    const backButton =
        popup.querySelector(
            ".transfer-player-back-button"
        );

    title.textContent =
        options.title;

    description.textContent =
        options.description;

    playerList.replaceChildren();

    // =========================
    // プレイヤー一覧
    // =========================

    players.forEach(
        function (targetPlayer) {

            if (
                targetPlayer ===
                usingPlayer
            ) {
                return;
            }

            const rowTemplate =
                document.getElementById("transferPlayerRowTemplate");

            const row =
                rowTemplate.content.firstElementChild.cloneNode(true);

            row.querySelector(".money-transfer-player-name").textContent =
                targetPlayer.name;

            const moneyDisplay =
                row.querySelector(".money-transfer-player-money");

            if (options.showMoney) {
                moneyDisplay.textContent =
                    `💰 ${formatG(targetPlayer.money)}G`;
            } else {
                moneyDisplay.remove();
            }

            const selectButton =
                row.querySelector(
                    ".money-transfer-player-select-button"
                );

            selectButton.addEventListener(
                "click",
                function () {

                    selectButton.disabled =
                        true;

                    popup.style.display =
                        "none";

                    options.onSelect(
                        targetPlayer
                    );

                }
            );

            playerList.appendChild(
                row
            );

        }
    );

    // =========================
    // 戻る
    // =========================

    backButton.onclick =
        function () {

            popup.style.display =
                "none";

            options.onBack();

        };

    popup.style.display =
        "block";

    const itemIdByTitle = { "闇みずほ": 19, "闇ヤマト": 21, "闇スーモ": 22 };
    const itemId = itemIdByTitle[options.title];
    if (itemId) syncOnlineScreenView("item-action", usingPlayer, "open", { itemId, stage: "target" });

}


// =========================
// 闇みずほ
// プレイヤー選択
// =========================

function showMoneyTransferNewUI(usingPlayer, stage = 'target', targetIndex = null, type = null, amount = null, remote = false) {
    if (!window.MoneyTransferUI) return;
    const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    window.MoneyTransferUI.show({
        players, actor: usingPlayer, stage, targetIndex, type, amount, remote,
        icon: getPlayerCharacterIcon,
        onSound: function (sound) { window.GameSE?.play(sound, {shared:true}).catch(error => console.warn('[SE] アイテム操作音:', error)); },
        onSync: function (nextStage, index, direction, value) {
            const data = { itemId: 19, stage: nextStage };
            if (nextStage !== 'target') data.targetIndex = Number(index);
            if (direction && ['amount','result'].includes(nextStage)) data.type = direction;
            if (value != null && ['amount','result'].includes(nextStage)) data.amount = Number(value);
            syncOnlineScreenView('item-action', usingPlayer, 'open', data);
        },
        onExit: function () { syncOnlineScreenView('', usingPlayer, 'close'); showInventoryPopup(usingPlayer); },
        onCommit: function (direction, value, button, index) {
            const target = players[index];
            if (!target || !ApprovedCommerce.canAct(usingPlayer)) return;
            const complete = function (result) {
                if (!result) { button.disabled = false; return; }
                if (result.immunityBlocked) {
                    window.MoneyTransferUI.close();
                    syncOnlineScreenView('', usingPlayer, 'close');
                    announceImmunityBlock("闇みずほ", target, usingPlayer);
                    return;
                }
                const actual = Number(result.amount);
                window.GameSE?.play('moneyDisplay', { shared: true }).catch(error => console.warn('[SE] 闇みずほ:', error));
                updatePlayerStatusUI(usingPlayer); updatePlayerStatusUI(target); renderPlayers();
                showMoneyTransferNewUI(usingPlayer, 'result', index, direction, actual);
                const from = direction === 'send' ? usingPlayer : target;
                const to = direction === 'send' ? target : usingPlayer;
                showEventPopup('闇みずほ', `${safe(from.name)}から${safe(to.name)}へ <strong>${formatG(actual)}G</strong>${direction === 'send' ? '送金した' : '強奪した'}！`, function () {
                    window.MoneyTransferUI.close();
                    syncOnlineScreenView('', usingPlayer, 'close');
                    finishTurn(usingPlayer);
                }, { subjectIndex: players.indexOf(usingPlayer) });
            };
            if (submitOnlineTargetedItem(19, { targetIndex:index, type:direction, amount:value }, button, complete)) return;
            complete(useMoneyTransfer(usingPlayer, target, direction === 'send' ? value : -value));
        }
    });
}

function showMoneyTransferPlayerPopup(
    usingPlayer
) {

    showTransferPlayerPopup(
        usingPlayer,
        {
            title:
                "闇みずほ",

            description:
                "送金・奪金するプレイヤーを選択",

            showMoney:
                true,

            onSelect:
                function (
                    targetPlayer
                ) {

                    showMoneyTransferTypePopup(
                        usingPlayer,
                        targetPlayer
                    );

                },

            onBack:
                function () {

                    showInventoryPopup(
                        usingPlayer
                    );

                }
        }
    );

}

// =========================
// 共通
// 送る / 奪う 選択画面
// =========================

function showTransferTypePopup(
    usingPlayer,
    targetPlayer,
    options
) {

    let popup = getOrCreatePopupFromTemplate(
        "transferTypePopup",
        "transferTypePopupTemplate"
    );

    const title =
        popup.querySelector(
            ".item-action-title"
        );

    const targetName =
        popup.querySelector(
            ".transfer-target-name"
        );

    const sendButton =
        popup.querySelector(
            '[data-type="send"]'
        );

    const stealButton =
        popup.querySelector(
            '[data-type="steal"]'
        );

    const backButton =
        popup.querySelector(
            ".transfer-type-back-button"
        );

    title.textContent =
        options.title;

    targetName.textContent =
        targetPlayer.name;

    sendButton.textContent =
        options.sendLabel;

    stealButton.textContent =
        options.stealLabel;

    // This popup is reused between online turns. An earlier observer view may
    // have disabled these controls, so restore them before wiring the active
    // player's handlers; the observer sync listener disables them again after
    // rendering its read-only copy.
    sendButton.disabled = false;
    stealButton.disabled = false;
    backButton.disabled = false;

    sendButton.onclick =
        function () {

            popup.style.display =
                "none";

            options.onSelect(
                "send"
            );

        };

    stealButton.onclick =
        function () {

            popup.style.display =
                "none";

            options.onSelect(
                "steal"
            );

        };

    backButton.onclick =
        function () {

            popup.style.display =
                "none";

            options.onBack();

        };

    popup.style.display =
        "block";
    const itemId = options.title === "闇みずほ" ? 19 : options.title === "闇ヤマト" ? 21 : options.title === "闇スーモ" ? 22 : null;
    if (itemId) syncOnlineScreenView("item-action", usingPlayer, "open", { itemId, stage: "type", targetIndex: players.indexOf(targetPlayer) });

}


// =========================
// 闇みずほ
// 送金 / 奪金 選択
// =========================

function showMoneyTransferTypePopup(
    usingPlayer,
    targetPlayer
) {

    showTransferTypePopup(
        usingPlayer,
        targetPlayer,
        {
            title:
                "闇みずほ",

            sendLabel:
                "💰 送金",

            stealLabel:
                "💸 奪金",

            onSelect:
                function (type) {

                    showMoneyTransferAmountPopup(
                        usingPlayer,
                        targetPlayer,
                        type
                    );

                },

            onBack:
                function () {

                    showMoneyTransferPlayerPopup(
                        usingPlayer
                    );

                }
        }
    );

}

// =========================
// 送金奪金
// 金額入力画面
// =========================

function showMoneyTransferAmountPopup(
    usingPlayer,
    targetPlayer,
    type
) {
    const announceResult = (title,message,next,options={}) => window.showEventPopup(title,message,next,{subjectIndex:players.indexOf(targetPlayer),...options});


    let popup = getOrCreatePopupFromTemplate(
        "moneyTransferAmountPopup",
        "moneyTransferAmountPopupTemplate"
    );

    const description =
        popup.querySelector(
            ".money-transfer-target-description"
        );

    const amountInput =
        popup.querySelector(
            ".money-transfer-amount-input"
        );

    const confirmButton =
        popup.querySelector(
            ".money-transfer-confirm-button"
        );

    const backButton =
        popup.querySelector(
            ".money-transfer-amount-back-button"
        );


    // =========================
    // 上限を決定
    // =========================

    const maxAmount =
        type === "send"
            ? Math.max(
                0,
                Number(
                    usingPlayer.money
                )
            )
            : Math.max(
                0,
                Number(
                    targetPlayer.money
                )
            );


    // =========================
    // 送金 / 奪金の表示
    // =========================

    if (
    type === "send"
) {

    description.textContent =
        `${targetPlayer.name}へ送金`;

    confirmButton.textContent =
        "送金する";

} else {

    description.textContent =
        `${targetPlayer.name}から奪金`;

    confirmButton.textContent =
        "奪う";

}

const targetMoney =
    popup.querySelector(
        ".amount-target-money"
    );

targetMoney.textContent =
    `💰 相手の所持G：${formatG(targetPlayer.money)}G`;


    // =========================
    // 金額入力欄
    // =========================

    amountInput.min =
        1000;

    amountInput.max =
        maxAmount;

    amountInput.step =
        1000;

    amountInput.value =
        maxAmount >= 1000
            ? 1000
            : 0;


    // =========================
    // 実行
    // =========================

    confirmButton.onclick =
        function () {

            const inputAmount =
                Number(
                    amountInput.value
                );


            // =========================
            // 金額チェック
            // =========================

            if (
                !Number.isFinite(
                    inputAmount
                ) ||
                inputAmount <= 0
            ) {

                return;

            }


            // 1,000G単位にする

            if (
                inputAmount % 1000 !== 0
            ) {

                announceResult(
                    "闇みずほ",
                    "金額は1,000G単位で入力してください。",
                    function () {}
                );

                return;

            }


            // =========================
            // 上限チェック
            // =========================

            if (
                inputAmount >
                maxAmount
            ) {

                announceResult(
                    "闇みずほ",
                    type === "send"
                        ? `所持Gは<strong>${formatG(usingPlayer.money)}G</strong>です。`
                        : `${targetPlayer.name}の所持Gは<strong>${formatG(targetPlayer.money)}G</strong>です。`,
                    function () {}
                );

                return;

            }


            // =========================
            // 送金 / 奪金
            // =========================

            const amount =
                type === "send"
                    ? inputAmount
                    : -inputAmount;


            const completeTransfer = function (result) {
            if (!result) return;


            // =========================
            // 画面を閉じる
            // =========================

            popup.style.display =
                "none";


            // =========================
            // SE
            // =========================

            sendSound.pause();

            sendSound.currentTime =
                0;

            playSharedSE(sendSound).catch(
                function (error) {

                    console.error(
                        "闇みずほSEの再生に失敗しました:",
                        error
                    );

                }
            );


            // =========================
            // プレイヤー表示更新
            // =========================

            updatePlayerStatusUI(
                usingPlayer
            );

            updatePlayerStatusUI(
                targetPlayer
            );

            renderPlayers();


            // =========================
            // 結果表示
            // =========================

            if (
                result.type ===
                "send"
            ) {

                announceResult(
                    "💰 送金",
                    `
                    ${targetPlayer.name}に
                    <br><br>

                    <strong>
                        ${formatG(result.amount)}G
                    </strong>

                    を送った！
                    `,
                    function () {
                        finishTurn(usingPlayer);
                    }
                );

                      } else {

                announceResult(
                    "💸 奪金",
                    `
                    ${targetPlayer.name}から
                    <br><br>

                    <strong>
                        ${formatG(result.amount)}G
                    </strong>

                    奪った！
                    `,
                    function () {
                        finishTurn(usingPlayer);
                    }
                );

            }
            };

            if (submitOnlineTargetedItem(19, {
                targetIndex: players.indexOf(targetPlayer),
                type,
                amount: inputAmount
            }, confirmButton, completeTransfer)) return;

            completeTransfer(useMoneyTransfer(usingPlayer, targetPlayer, amount));

        };


    // =========================
    // 戻る
    // =========================

    backButton.onclick =
        function () {

            popup.style.display =
                "none";

            showMoneyTransferTypePopup(
                usingPlayer,
                targetPlayer
            );

        };


    // =========================
    // 表示
    // =========================

    popup.style.display =
        "block";
    syncOnlineScreenView("item-action", usingPlayer, "open", { itemId: 19, stage: "amount", targetIndex: players.indexOf(targetPlayer), type });

}

// =========================
// アイテム画面
// =========================

function showSpecialItemScreen(player, itemId, stage, destination = null, observer = false) {
    const actorIndex = players.indexOf(player);
    const update = (nextStage, selected = null) => showSpecialItemScreen(player, itemId, nextStage, selected, observer);
    const hide = () => { window.SpecialItemUI.hide(); if (!observer) syncOnlineScreenView('', player, 'close'); };
    const consumeOffline = () => {
        const at = player.inventory.findIndex(entry => Number(getInventoryItemId(entry)) === itemId);
        if (at < 0 || player.itemSealedThisTurn || player.underground) return false;
        player.inventory.splice(at, 1); return true;
    };
    const finishEqualize = () => { hide(); window.specialItemActionPending = false; finishTurn(player); };
    window.SpecialItemUI.show({itemId, stage, destination, players, actorIndex, observer, icon:getPlayerCharacterIcon,
        onBack: () => { if (stage === 'destination') update('areas'); else { hide(); showInventoryPopup(player); } },
        onSelect: (value, button) => {
            if (observer || !ApprovedCommerce.canAct(player) || player.itemSealedThisTurn || player.underground) return;
            if (itemId === 24) return update('destination', value);
            const target = players[value];
            if (!target || target === player || target.underground) return;
            const blocked = window.DisadvantageImmunityRules?.isActive(target);
            const done = result => {
                hide();
                const finish = () => { window.specialItemActionPending = false; finishTurn(player); };
                if (result.immunityBlocked) announceImmunityBlock('アイテム封じ', target, player, finish);
                else showEventPopup('アイテム封じ', '3ターンアイテムを使用できなくなった！', finish, {subjectIndex:value,advanceAnywhere:true});
            };
            if (window.onlineGame?.isOnline) window.specialItemActionPending = true;
            if (submitOnlineTargetedItem(26, {targetIndex:value}, button, done)) return;
            if (!consumeOffline()) return;
            if (!blocked) target.itemSealChecks = 3;
            done({ immunityBlocked: blocked });
        },
        onExecute: (button, key) => {
            if (observer || !ApprovedCommerce.canAct(player) || player.itemSealedThisTurn || player.underground) return;
            if (itemId === 25 && stage === 'result') return finishEqualize();
            if (itemId === 25) {
                const done = () => { window.GameSE?.play?.('moneyDisplay', {shared:true}).catch(error=>console.warn('[SE] 平均化の金額音:',error)); updateNextPlayerView(); renderPlayers(); update('result'); };
                if (window.onlineGame?.isOnline) window.specialItemActionPending = true;
                if (submitOnlineTargetedItem(25, {}, button, done)) return;
                if (!consumeOffline()) return;
                SpecialItemRules.equalize(players); done(); return;
            }
            const entry = SpecialItemRules.destinations.find(row => row.key === key);
            const square = entry && mapData.find(row => Number(row.id) === entry.id && row.type === 'start');
            const reachable = BossBattleRules.reachableSquares(mapData, mapData.find(row => row.type === 'start')?.id);
            if (!square || !reachable.includes(square)) return;
            if (useOnlineWarpItem(player, 24, button, key)) return;
            if (!consumeOffline()) return;
            hide(); animateRandomWarp(player, square.id).then(() => showEventPopup('ランドマークワープ', `${entry.name}に到着！`, () => finishTurn(player), {subjectIndex:actorIndex}));
        }
    });
    if (!observer) syncOnlineScreenView('special-item', player, 'open', {itemId, stage, ...(destination ? {destination} : {})});
}


function showInventoryPopup(
    player
) {

    if (!player || typeof player !== "object") return;
    if (!Array.isArray(player.inventory)) player.inventory = [];

    const inventoryPopup =
        document.getElementById(
            "inventoryPopup"
        );

    if (inventoryPopup.style.display !== 'block' && ApprovedCommerce.canAct(player)) {
        window.GameActionInput?.get('item-use')?.finish();
    }

    function closeInventoryForAction() {
        inventoryPopup.style.display = "none";
        if (typeof window.syncOnlineScreenView === "function") {
            window.syncOnlineScreenView("", player, "close");
        }
    }


    const inventoryList =
        document.getElementById(
            "inventoryList"
        );

    // Show the shared panel before building rows. A malformed or stale item
    // entry on an observer must not make the entire screen appear missing.
    inventoryPopup.style.display = "block";


    // =========================
    // アイテム一覧を初期化
    // =========================

    inventoryList.replaceChildren();


    // =========================
    // アイテムがない場合
    // =========================

    if (
        player.inventory.length === 0
    ) {

        const emptyTemplate =
            document.getElementById("inventoryEmptyTemplate");

        inventoryList.appendChild(
            emptyTemplate.content.firstElementChild.cloneNode(true)
        );

    }


    // =========================
    // アイテムを表示
    // =========================

    player.inventory.forEach(
        function (inventoryData, inventoryIndex) {

            if (inventoryData == null) return;

            // =========================
            // 個体データ / 通常IDの両方に対応
            // =========================

            const itemId =
                getInventoryItemId(inventoryData);


            const item =
                ITEM_CONTENTS[itemId];


            if (!item) {

                return;

            }


            const isPassiveItem =
                item.category ===
                "passive";


            // =========================
            // アイテム項目
            // =========================

            const inventoryTemplate =
                document.getElementById(
                    isPassiveItem
                        ? "inventoryPassiveItemTemplate"
                        : "inventoryUsableItemTemplate"
                );

            if (!inventoryTemplate || !inventoryTemplate.content.firstElementChild) return;

            const itemElement =
                inventoryTemplate.content.firstElementChild.cloneNode(true);
            itemElement.dataset.inventoryIndex = inventoryIndex;

            itemElement.querySelector(".inventory-item-name").textContent =
                item.name;

            itemElement.querySelector(".inventory-item-effect").textContent =
                item.effect;

            if (isPassiveItem) {
                const passiveStatus =
                    itemElement.querySelector(".inventory-item-passive-status");

                const hasTurnDuration =
                    item.effectDuration &&
                    item.effectDuration.endsWith("turn") &&
                    typeof inventoryData === "object";

                passiveStatus.textContent = hasTurnDuration
                    ? `✨ 残り ${Math.max(
                        0,
                        Number(
                            inventoryData.remainingUses ??
                            item.effectDuration.replace("turn", "")
                        )
                    )}ターン`
                    : "✨ 持っているだけで効果発動";
            }


            // =========================
            // パッシブアイテムは
            // 「使う」処理を行わない
            // =========================

            if (
                isPassiveItem
            ) {

                inventoryList.appendChild(
                    itemElement
                );

                return;

            }


            // =========================
            // 「使う」ボタン
            // =========================

            const useButton =
                itemElement.querySelector(
                    ".inventory-item-use-button"
                );


            const executeItem = function () {
                if (!ApprovedCommerce.canAct(player)) return;
                if (Number(itemId) === 32) {
                    window.showDuplicateItemSelection?.(player, inventoryIndex);
                    return;
                }

                if (Number(itemId) === 27) {
                    window.useBridgeCollapseItem?.(player, inventoryIndex);
                    return;
                }

                if (Number(itemId) === 28) {
                    window.useSixShikatanItem?.(player, inventoryIndex);
                    return;
                }

                if (Number(itemId) === 31) {
                    window.useDisadvantageImmunityItem?.(player, inventoryIndex);
                    return;
                }

                if (Number(itemId) === 33) {
                    closeInventoryForAction();
                    const playerIndex = players.indexOf(player);
                    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                    centerPlayerOnMap(playerIndex, window.TurnHandoff?.isBlack() || reducedMotion ? 'auto' : 'smooth', () => {
                        window.GuidebookUI.showSecondBook(players, playerIndex, getPlayerCharacterIcon);
                    });
                    return;
                }

                if (Number(itemId) === 29) {
                    window.useFukubukuroItem?.(player, inventoryIndex);
                    return;
                }

                if ([24,25,26].includes(Number(itemId))) {
                    if (player.underground) { showEventPopup('アイテムを使用できません', '地下労働中は使用できません。', () => showInventoryPopup(player)); return; }
                    closeInventoryForAction();
                    showSpecialItemScreen(player, Number(itemId), Number(itemId) === 24 ? 'areas' : Number(itemId) === 25 ? 'preview' : 'target');
                    return;
                }


                
// =========================
// ロスノート
// =========================

if (
    Number(itemId) === 13
) {

    closeInventoryForAction();

    showLossNotePlayerPopup(
        player
    );

    return;

}

// =========================
// ロストマジック
// =========================

if (
    Number(itemId) === 18
) {

    closeInventoryForAction();

    showLostMagicPlayerPopup(
        player
    );

    return;

}

// =========================================================
// 叩き派遣
// クリックごとに1個ずつ破壊・表示する
// =========================================================

if (Number(itemId) === 17) {
    closeInventoryForAction();
    window.useHatatakiHakenItem(player);
    return;
}
// 近づきマス
// ボスまであと1マスの場所へ移動
// =========================

if (
    item.effectType ===
    "warpToBoss"
) {

    if (useOnlineWarpItem(player, 14, useButton)) return;

    const result =
        useWarpToBoss(
            player
        );


    // =========================
    // 使用できない場合
    // =========================

    if (!result) {

        showEventPopup(
            item.name,
            "すでにボスマスの近くにいるため、<br>" +
            `${item.name}は使用できません。`,
            function () {

                showInventoryPopup(
                    player
                );

            }
        );

        return;

    }


    // =========================
    // アイテム画面を閉じる
    // =========================

    closeInventoryForAction();


    
    // =========================
    // ボスの1マス手前への移動結果
    // =========================

    setTimeout(
        function () {

            window.CommonAnnouncements.showArrival(
                item.name,
                warpToBossAnnouncement(player),
                function () {

                    finishTurn(
                        player
                    );

                }
            );

        },
        1000
    );

    return;


}

// =========================
// 飛んできマス
// ランダムなマスへワープ
// =========================

if (
    item.effectType ===
    "warpToRandom"
) {

    if (useOnlineWarpItem(player, 20, useButton)) return;

    const result =
        useWarpToRandom(
            player
        );

    if (!result) {
        showInventoryPopup(player);
        return;
    }
    if (result.error) {
        showEventPopup(ITEM_CONTENTS[20]?.name || "飛んできマス", result.error, () => showInventoryPopup(player), {subjectIndex:players.indexOf(player)});
        return;
    }

    closeInventoryForAction();

    animateRandomWarp(
        player,
        result.position
    ).then(() => window.CommonAnnouncements.showArrival('飛んできマス', `${player.name}は<br>ランダムなマスへワープした！`,
        () => window.finishTurn(player)));

    return;
}


 // =========================
 // ふっとばしマス
 // =========================
if (Number(itemId) === 23) {
    useKnockbackItem(player, inventoryIndex);
    return;
}


// =========================
// 送金奪金
// =========================

if (
    Number(itemId) === 19
) {

    closeInventoryForAction();

    showMoneyTransferNewUI(
        player
    );

    return;

}


// =========================
// 闇ヤマト
// =========================

if (
    Number(itemId) === 21
) {

    closeInventoryForAction();

    showItemTransferUI(
        player
    );

    return;

}

// =========================
// 闇スーモ
// =========================

if (
    Number(itemId) === 22
) {

    closeInventoryForAction();

    showDarkSuumoPlayerPopup(player);

    return;

}

                    // =========================
                    // どんぴ車
                    // 6マス以内の好きなマスへ移動
                    // =========================

                    if (
                        Number(itemId) === 8
                    ) {

                        console.log(
                            `${item.name}を使用しました。`
                        );


                        const beginDonpiMovement = function (eventId) {
                            rouletteButton.disabled = true;
                            inventoryButton.disabled = true;
                            if (eventId) {
                                const movementState = window.diceMovementState;
                                movementState.active = true;
                                movementState.isItemMovement = true;
                                movementState.player = player;
                                movementState.startPosition = Number(player.position);
                                movementState.history = [Number(player.position)];
                                movementState.totalSteps = 6;
                                movementState.autoMoving = false;
                                movementState.syncStepSequence = 0;
                                movementState.donpiEventId = eventId;
                                movementState.syncViewEventId = eventId;
                                movementState.syncViewSequence = 0;
                            }
                            closeInventoryForAction();
                            window.highlightReachableSquaresWithin(player, 6);
                        };

                        const onlineSync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync
                            ? window.onlineGame.sync
                            : null;
                        if (onlineSync && typeof onlineSync.startDonpiMove === "function") {
                            const eventId = createOnlineSyncEventId("donpi-move");
                            useButton.disabled = true;
                            onlineSync.startDonpiMove(eventId).then(function (response) {
                                if (!response || !response.ok || !response.state) {
                                    useButton.disabled = false;
                                    showEventPopup("どんぴ車を使えません", response && response.error || "サーバーでアイテムを確認できませんでした。", () => showInventoryPopup(player));
                                    return;
                                }
                                applyOnlineCanonicalState(response.state, "donpi-start", true);
                                beginDonpiMovement(eventId);
                            }).catch(function (error) {
                                useButton.disabled = false;
                                console.error("[online] どんぴ車の使用を同期できません:", error);
                                showEventPopup("通信エラー", "どんぴ車を使用できませんでした。", () => showInventoryPopup(player));
                            });
                            return;
                        }

                        // Offline mode keeps the existing local consumption and route selection.
                        player.inventory.splice(inventoryIndex, 1);
                        beginDonpiMovement(null);


                        return;

                    }


                    // =========================
                    // 移動アイテムか確認
                    // =========================

                    if (
                        item.category !==
                        "move"
                    ) {

                        return;

                    }


                    // =========================
                    // サイコロの個数
                    // =========================

                    const diceCount =
                        Number(item.diceCount) || 1;

                    // =========================
                    // アイテムを1個消費
                    // =========================

                    player.inventory.splice(
                        inventoryIndex,
                        1
                    );


                    // =========================
                    // アイテム画面を閉じる
                    // =========================

                    closeInventoryForAction();


                    // =========================
                    // 通常移動
                    // =========================

                    if (
                        typeof window.useMoveItem !==
                        "function"
                    ) {

                        console.error(
                            "ゲーム画面の移動処理が準備されていません。"
                        );
                        showInventoryPopup(player);
                        return;

                    }


                    window.useMoveItem(
                        player,
                        diceCount,
                        itemId
                    );

                };
            let awaitingUse = false;
            useButton.addEventListener('click', function () {
                if (!ApprovedCommerce.canAct(player) || player.itemSealedThisTurn || awaitingUse || useButton.disabled) return;
                const hatataki = Number(itemId) === 17;
                if (hatataki && players.length < 2) {
                    closeInventoryForAction();
                    showEventPopup('叩き派遣', '叩き派遣の対象がいません。', () => showInventoryPopup(player), { hatatakiFrame:true });
                    return;
                }
                if (Number(itemId) === GuidebookRules.ITEM_ID) {
                    if (player.underground || !GuidebookRules.isBook(player.inventory[inventoryIndex])) return;
                    closeInventoryForAction();
                    window.chooseGuidebook(player);
                    return;
                }
                const turnKey = `${window.getCurrentTurn()}:${window.getCurrentPlayerIndex()}`;
                const kind = ({ 23: 'knockback', 27: 'bridge', 31: 'immunity' })[itemId];
                const usesMenuLock = (Number(itemId) >= 1 && Number(itemId) <= 8)
                    || [13, 14, 17, 18, 19, 20, 21, 22, 24, 25, 26, 28, 29].includes(Number(itemId));
                const action = kind ? window.GameActionInput.begin(kind, turnKey, 'notice')
                    : usesMenuLock ? window.GameActionInput.beginMenuAction('item-use', turnKey) : null;
                if ((kind || usesMenuLock) && !action) return;
                if (Number(itemId) === 18) { executeItem(); return; }
                awaitingUse = true;
                useButton.disabled = true;
                closeInventoryForAction();
                const safeName = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
                showEventPopup('アイテム使用', '<strong>'+safeName(item.name)+'</strong>を使った！', function () {
                    awaitingUse = false;
                    useButton.disabled = false;
                    // Announcing use neither consumes the item nor sends a gameplay request.
                    if (action && !action.isCurrent()) return;
                    if (!ApprovedCommerce.canAct(player) || player.itemSealedThisTurn || player.inventory[inventoryIndex] == null || Number(getInventoryItemId(player.inventory[inventoryIndex])) !== Number(itemId)) {
                        action?.finish();
                        return;
                    }
                    action?.setPhase('waiting');
                    executeItem();
                }, {subjectIndex:players.indexOf(player),itemUse:true,sound:'itemUse',hatatakiFrame:hatataki});
            });
            if (player.itemSealedThisTurn) { useButton.disabled = true; useButton.title = 'アイテム封じの効果中です。'; }


            inventoryList.appendChild(
                itemElement
            );

        }
    );


    ApprovedCommerce.upgradeInventory(player);

    // Render locally first so a network sync problem cannot prevent the
    // inventory screen from opening in either offline or online play.
    if (typeof window.syncOnlineScreenView === "function") {
        window.syncOnlineScreenView("inventory", player, "open", { panel: GamePanels.snapshot("inventoryPopup") });
    }

}


// =========================
// ランダムワープ演出
// =========================


 // =========================
 // 飛んできマス
 // ランダムワープ演出
 // =========================

function centerOnWarpPlayer(playerIndex) {
    return new Promise(resolve => {
        const timeout = setTimeout(resolve, 900);
        try {
            window.centerPlayerOnMap(playerIndex, 'smooth', () => { clearTimeout(timeout); resolve(); });
        } catch (error) {
            clearTimeout(timeout);
            console.warn('[ワープ] カメラを移動できません:', error);
            resolve();
        }
    });
}

async function playWarpMotion(piece, frames, easing) {
    if (!piece?.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let animation, timer;
    try {
        animation = piece.animate(frames, { duration: 700, easing, fill: 'forwards' });
        await Promise.race([animation.finished, new Promise(resolve => { timer = setTimeout(resolve, 1000); })]);
    } catch (error) {
        if (error?.name !== 'AbortError') console.warn('[ワープ] 演出を再生できません:', error);
    } finally {
        clearTimeout(timer);
        animation?.cancel();
    }
}

async function animateRandomWarp(player, targetPosition, isCurrent = () => true) {
    const playerIndex = window.players.indexOf(player);
    const pieceAt = position => document.querySelector(
        `.map-node[data-square-id="${position}"] .player-piece[data-player-index="${playerIndex}"]`);
    const piece = pieceAt(player.position);
    if (piece) {
        await centerOnWarpPlayer(playerIndex);
        if (!isCurrent()) return;
        if (typeof warpSound !== 'undefined') {
            try {
                warpSound.currentTime = 0;
                Promise.resolve((window.GameSE ? window.GameSE.playLocal(warpSound) : warpSound.play())).catch(() => {});
            } catch {}
        }
        await playWarpMotion(piece, [
            { translate: '0 0', scale: '1', opacity: 1 },
            { translate: '0 -120px', scale: '1.15', opacity: 1 },
            { translate: '0 -300px', scale: '.8', opacity: 0 }
        ], 'ease-in');
    }
    if (!isCurrent()) return;
    player.position = targetPosition;
    window.renderMap({ preserveCamera: true });
    window.renderPlayers();

    const landing = pieceAt(targetPosition);
    if (landing) landing.style.opacity = '0';
    try {
        await centerOnWarpPlayer(playerIndex);
        if (!isCurrent()) return;
        if (landing) landing.style.removeProperty('opacity');
        await playWarpMotion(landing, [
            { translate: '0 -350px', scale: '.8', opacity: 0 },
            { translate: '0 20px', scale: '1.05', opacity: 1 },
            { translate: '0 0', scale: '1', opacity: 1 }
        ], 'ease-out');
    } finally {
        landing?.style.removeProperty('opacity');
    }
    if (!isCurrent()) return;
    if (playerIndex === window.getCurrentPlayerIndex()) window.updateWarpBossDistance(player);
}

function playOnlineWarpMoves(payload, onComplete) {
    const moves = Array.isArray(payload.moves) ? payload.moves : [];
    if (!moves.length) { onComplete?.(); return; }
    if (payload.state) applyOnlineCanonicalState(payload.state, 'item-warp-start', true, { deferTurnView: true });
    for (const move of moves) {
        const player = window.players[Number(move.playerIndex)];
        if (player) player.position = Number(move.fromPosition);
    }
    window.renderMap({ preserveCamera: true });
    window.renderPlayers();
    (async () => {
        for (const move of moves) {
            const player = window.players[Number(move.playerIndex)];
            if (!player) continue;
            try { await animateRandomWarp(player, Number(move.toPosition)); }
            catch (error) {
                player.position = Number(move.toPosition);
                console.warn('[ワープ] 着地演出を省略:', error);
            }
        }
    })().catch(error => console.warn('[ワープ] 演出を最後まで表示できません:', error)).then(() => onComplete?.());
}

let activeKnockbackPresentation = null;

async function useKnockbackItem(player, inventoryIndex) {
    const action = window.GameActionInput.get('knockback');
    if (action?.phase !== 'waiting') return;
    action.setPhase('resolving');
    const sync = window.onlineGame?.isOnline ? window.onlineGame.sync : null;
    try {
        if (sync) {
            const requestId = createOnlineSyncEventId('knockback');
            const response = await sync.useWarpItem(23, requestId, null, action.turnKey);
            if (!action.isCurrent()) return;
            if (!response?.ok) {
                await sync.recover(true);
                if (!action.isCurrent() || activeKnockbackPresentation) return;
                throw new Error(response?.error || 'ワープ結果を確認できませんでした。');
            }
            await playKnockback(response, true);
        } else {
            const results = useWarpAllPlayersRandom(player, inventoryIndex);
            if (!results) throw new Error('ふっとばす対象または移動先が見つかりませんでした。');
            const moves = [], unaffected = [];
            for (const result of results) {
                const index = window.players.indexOf(result.player);
                if (result.unaffected) unaffected.push(index);
                else moves.push({ playerIndex: index, toPosition: result.position });
            }
            await playKnockback({ playerIndex: window.players.indexOf(player), moves, unaffected }, true);
        }
    } catch (error) {
        if (!action.isCurrent()) return;
        action.setPhase('notice');
        window.showEventPopup('ふっとばしマス', error.message, () => {
            action.finish();
            showInventoryPopup(player);
        }, { sync: false });
    }
}

async function playKnockback(payload, actor = false) {
    const turnKey = `${window.getCurrentTurn()}:${window.getCurrentPlayerIndex()}`;
    if (payload.turnKey && payload.turnKey !== turnKey) return;
    if (activeKnockbackPresentation) return;
    const action = actor && (window.GameActionInput.get('knockback') || window.GameActionInput.begin('knockback', turnKey));
    if (actor && !action) return;
    const run = activeKnockbackPresentation = { turnKey, animating: !payload.animationComplete };
    const isCurrent = () => activeKnockbackPresentation === run && (!actor || action.isCurrent());
    const player = window.players[Number(payload.playerIndex)];
    const sync = actor && payload.state ? window.onlineGame?.sync : null;
    if (actor) action.setPhase('resolving');

    if (run.animating) {
        if (payload.state) {
            applyOnlineCanonicalState(payload.state, 'knockback-start', true, { deferTurnView: true });
            for (const move of payload.moves) {
                const target = window.players[move.playerIndex];
                if (target) target.position = move.fromPosition;
            }
            window.renderMap({ preserveCamera: true });
            window.renderPlayers();
        }
        for (const move of payload.moves) {
            if (!isCurrent()) return;
            const target = window.players[move.playerIndex];
            if (!target) continue;
            try { await animateRandomWarp(target, move.toPosition, isCurrent); }
            catch (error) {
                console.warn('[ふっとばしマス] 着地演出を省略:', error);
                if (isCurrent()) target.position = move.toPosition;
            }
        }
    }
    if (!isCurrent()) return;
    run.animating = false;
    if (run.latestState) applyOnlineCanonicalState(run.latestState, 'knockback-state', true, { deferTurnView: true });
    window.renderMap({ preserveCamera: true });
    window.renderPlayers();
    await centerOnWarpPlayer(payload.playerIndex);
    if (!actor || !isCurrent()) return;

    const finishPresentation = async () => {
        if (!isCurrent()) return;
        action.setPhase('resolving');
        if (sync && !payload.animationComplete) {
            try {
                const response = await sync.completeWarpItem(payload.requestId);
                if (!isCurrent()) return;
                if (!response?.ok) throw new Error(response?.error);
                applyOnlineCanonicalState(response.state, 'knockback-complete', true);
            } catch (error) {
                if (!isCurrent()) return;
                action.setPhase('notice');
                window.showEventPopup('通信エラー', '「次へ」でふっとばした結果を再確認します。', finishPresentation, { sync: false });
                return;
            }
        }
        action.setPhase('notice');
        const unaffected = (payload.unaffected || []).filter(index => window.players[index]);
        let index = 0;
        function announceNext() {
            if (!isCurrent()) return;
            if (index < unaffected.length) {
                const subjectIndex = unaffected[index++];
                const name = window.players[subjectIndex].name.replace(/[&<>]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' })[character]);
                window.showEventPopup('', name + 'には効果がなかった。', announceNext, { subjectIndex, advanceAnywhere:true });
                return;
            }
            window.showEventPopup('ふっとばしマス', payload.moves.length ? 'みんなふっとんだ！' : 'ふっとんだ冒険者はいなかった。', () => {
                if (!isCurrent() || action.phase !== 'notice') return;
                if (!sync) activeKnockbackPresentation = null;
                action.setPhase('arrival');
                window.finishTurn(player);
            }, { sound: 'squareArrival', subjectIndex: payload.playerIndex, advanceAnywhere:true });
        }
        announceNext();
    };
    await finishPresentation();
}

function useOnlineWarpItem(player, itemId, useButton, destination = null) {
    const sync = window.onlineGame && window.onlineGame.isOnline && window.onlineGame.sync
        ? window.onlineGame.sync
        : null;
    if (!sync || typeof sync.useWarpItem !== "function") return false;
    const action = window.GameActionInput?.get('item-use');
    if (itemId === 24) specialWarpInFlight = true;

    if (useButton) useButton.disabled = true;
    const requestId = createOnlineSyncEventId(`warp-item-${Number(itemId)}`);
    sync.useWarpItem(Number(itemId), requestId, destination).then(function (response) {
        if (!response || !response.ok || !response.state) {
            if (itemId === 24) specialWarpInFlight = false;
            if (useButton) useButton.disabled = false;
            if (itemId === 24) { window.SpecialItemUI?.hide(); syncOnlineScreenView('', player, 'close'); }
            showEventPopup(ITEM_CONTENTS[itemId]?.name || "ワープ", response && response.error || "サーバーで使用結果を確認できませんでした。", () => showInventoryPopup(player));
            return;
        }

        window.SpecialItemUI?.hide();
        const inventoryPopup = document.getElementById("inventoryPopup");
        if (inventoryPopup) inventoryPopup.style.display = "none";
        if (typeof window.syncOnlineScreenView === "function") {
            window.syncOnlineScreenView("", player, "close");
        }
        const completeWarp = async function () {
            if (action && !action.isCurrent()) return;
            try {
                const completion = await sync.completeWarpItem(requestId);
                if (action && !action.isCurrent()) return;
                if (!completion?.ok || !completion.state) throw new Error(completion?.error || 'ワープ先を確定できませんでした。');
                applyOnlineCanonicalState(completion.state, "item-warp-complete", true);
                if (itemId === 24) specialWarpInFlight = false;
                const title = ITEM_CONTENTS[itemId].name;
                const message = itemId === 14
                    ? warpToBossAnnouncement(player)
                    : itemId === 20
                        ? `${player.name}は<br>ランダムなマスへワープした！`
                        : `${SpecialItemRules.destinations.find(entry => entry.key === destination)?.name || ''}に到着！`;
                window.showEventPopup(title, message, () => window.finishTurn(player), {sound:'squareArrival',subjectIndex:window.players.indexOf(player),advanceAnywhere:true});
            } catch (error) {
                if (action && !action.isCurrent()) return;
                console.error("[online] ワープ後の状態確定に失敗:", error);
                showEventPopup("通信エラー", "『次へ』でワープ後の状態を再確認します。", completeWarp, {sync:false});
            }
        };
        const rouletteControl = document.getElementById("rouletteButton");
        const inventoryControl = document.getElementById("inventoryButton");
        if (rouletteControl) rouletteControl.disabled = true;
        if (inventoryControl) inventoryControl.disabled = true;
        if (Number(itemId) === 14) {
            applyOnlineCanonicalState(response.state, "item-warp-instant", true);
            if (typeof warpSound !== "undefined") {
                warpSound.currentTime = 0;
                (window.GameSE ? window.GameSE.playLocal(warpSound) : warpSound.play()).catch(function () {});
            }
            completeWarp();
        } else {
            playOnlineWarpMoves(response, completeWarp);
        }
    }).catch(function (error) {
        if (itemId === 24) specialWarpInFlight = false;
        if (useButton) useButton.disabled = false;
        if (itemId === 24) { window.SpecialItemUI?.hide(); syncOnlineScreenView('', player, 'close'); }
        console.error(`[online] アイテム${Number(itemId)}の使用に失敗:`, error);
        showEventPopup("通信エラー", "ワープアイテムを使用できませんでした。", () => showInventoryPopup(player));
    });
    return true;
}

function warpToBossAnnouncement(player) {
    const name = String(player.name).replace(/[&<>]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' })[character]);
    return `<span class="an02-single-line">${name}はボスマスまであと1マスの場所へ移動した！</span>`;
}


// =========================================================
// 闇ヤマト
// アイテム選択画面
// =========================================================

function showItemTransferUI(usingPlayer, stage = 'target', targetIndex = null, type = null, remote = false) {
    window.MoneyTransferUI.show({
        players,
        actor: usingPlayer,
        itemName: ITEM_CONTENTS[21].name,
        stage,
        targetIndex,
        type,
        remote,
        icon: getPlayerCharacterIcon,
        getItems(source, direction) {
            const inventory = source.inventory || [];
            const usedIndex = direction === 'send' ? findInventoryItemIndex(source, 21) : -1;
            return inventory.flatMap((entry, index) => {
                if (entry == null || index === usedIndex) return [];
                const id = Number(getInventoryItemId(entry));
                const item = ITEM_CONTENTS[id];
                if (!item || Number(item.rank) >= 99) return [];
                return [{ index, id, name: item.name }];
            });
        },
        onSound(sound) {
            window.GameSE?.play(sound, { shared: true }).catch(error => console.warn('[SE] アイテム操作音:', error));
        },
        onSync(nextStage, index, direction) {
            const data = { itemId: 21, stage: nextStage };
            if (nextStage !== 'target') data.targetIndex = Number(index);
            if (nextStage === 'items') data.type = direction;
            syncOnlineScreenView('item-action', usingPlayer, 'open', data);
        },
        onExit() {
            syncOnlineScreenView('', usingPlayer, 'close');
            showInventoryPopup(usingPlayer);
        },
        onCommitItem(direction, index, entry, button) {
            const target = players[index];
            if (!target || !ApprovedCommerce.canAct(usingPlayer)) return;
            const source = direction === 'send' ? usingPlayer : target;
            const currentEntry = source.inventory?.[entry.index];
            if (currentEntry == null || Number(getInventoryItemId(currentEntry)) !== entry.id) {
                showItemTransferUI(usingPlayer, 'items', index, direction);
                return;
            }
            button.disabled = true;
            const complete = result => {
                if (!result) {
                    button.disabled = false;
                    return;
                }
                window.MoneyTransferUI.close();
                if (result.immunityBlocked) {
                    syncOnlineScreenView('', usingPlayer, 'close');
                    announceImmunityBlock("闇ヤマト", target, usingPlayer);
                    return;
                }
                window.GameSE?.play('transfer', { shared: true }).catch(error => console.warn('[SE] 闇ヤマト:', error));
                updatePlayerStatusUI(usingPlayer);
                updatePlayerStatusUI(target);
                renderPlayers();
                const resultName = ITEM_CONTENTS[result.transferredItemId ?? result.itemId]?.name || 'アイテム';
                const message = document.createElement('span');
                message.textContent = resultName + (result.type === 'send' ? 'を送付した！' : 'を奪った！');
                showEventPopup('闇ヤマト', message.innerHTML, () => finishTurn(usingPlayer), {
                    subjectIndex: players.indexOf(usingPlayer),
                    advanceAnywhere: true,
                    itemTransferResult: true
                });
            };
            if (submitOnlineTargetedItem(21, { targetIndex: index, type: direction, selectedIndex: entry.index }, button, complete)) return;
            complete(useItemTransfer(usingPlayer, target, entry.index, direction));
        }
    });
}


// ============================================================
// 闇スーモ
// プレイヤー選択
// ============================================================

function showDarkSuumoPlayerPopup(usingPlayer) {

    showTransferPlayerPopup(
        usingPlayer,
        {
            title: "闇スーモ",
            description: "資産を贈与・強奪するプレイヤーを選択",
            showMoney: false,

            onSelect: function (targetPlayer) {

                showTransferTypePopup(
                    usingPlayer,
                    targetPlayer,
                    {
                        title: "闇スーモ",
                        sendLabel: "🎁 贈与",
                        stealLabel: "💥 強奪",

                        onSelect: function (type) {

                            showDarkSuumoAssetPopup(
                                usingPlayer,
                                targetPlayer,
                                type
                            );

                        },

                        onBack: function () {

                            showDarkSuumoPlayerPopup(usingPlayer);

                        }
                    }
                );

            },

            onBack: function () {

                showInventoryPopup(usingPlayer);

            }
        }
    );

}


// ============================================================
// 闇スーモ
// 資産選択
// ============================================================

function showDarkSuumoAssetPopup(
    usingPlayer,
    targetPlayer,
    type
) {
    const announceResult = (title,message,next,options={}) => window.showEventPopup(title,message,next,{subjectIndex:players.indexOf(type === "send" ? targetPlayer : usingPlayer),advanceAnywhere:true,...options});


    let popup = getOrCreatePopupFromTemplate(
        "darkSuumoAssetPopup",
        "darkSuumoAssetPopupTemplate"
    );

    const assetList =
        popup.querySelector(".dark-suumo-asset-list");

    const playerName =
        popup.querySelector(".dark-suumo-player-name");

    const backButton =
        popup.querySelector(".dark-suumo-back-button");

    const sourcePlayer =
        type === "send"
            ? usingPlayer
            : targetPlayer;

    playerName.textContent = sourcePlayer.name;
    assetList.replaceChildren();

    const ownedAssets =
        (sourcePlayer.assets || [])
            .map(function (assetId) {

                return {
                    id: Number(assetId),
                    asset: ASSET_CONTENTS[assetId]
                };

            })
            .filter(function (entry) {

                return entry.asset &&
                    entry.asset.owner === players.indexOf(sourcePlayer);

            });

    if (ownedAssets.length === 0) {

        const emptyTemplate =
            document.getElementById("darkSuumoEmptyAssetTemplate");
        assetList.appendChild(
            emptyTemplate.content.firstElementChild.cloneNode(true)
        );

    }

    ownedAssets.forEach(function (entry) {

        const rowTemplate =
            document.getElementById("darkSuumoAssetItemTemplate");
        const row =
            rowTemplate.content.firstElementChild.cloneNode(true);
        row.querySelector(".inventory-item-name").textContent =
            entry.asset.name;
        row.querySelector(".inventory-item-effect").textContent =
            `${formatG(marketPrice(entry.asset.price))}G`;
        row.querySelector(".inventory-item-use-button").textContent =
            type === "send" ? "贈与" : "強奪";

        const transferButton = row.querySelector(".inventory-item-use-button");
        transferButton.onclick = function () {
                const completeAssetTransfer = function (result) {
                if (!result) return;

                popup.style.display = "none";

                if (result.immunityBlocked) {
                    syncOnlineScreenView('', usingPlayer, 'close');
                    announceImmunityBlock("闇スーモ", targetPlayer, usingPlayer);
                    return;
                }

                send2Sound.pause();
                send2Sound.currentTime = 0;

                playSharedSE(send2Sound).catch(function (error) {

                    console.error(
                        "闇スーモSEの再生に失敗しました:",
                        error
                    );

                });

                updatePlayerStatusUI(usingPlayer);
                updatePlayerStatusUI(targetPlayer);
                renderPlayers();

                announceResult(
                    type === "send"
                        ? "🎁 闇スーモ・贈与"
                        : "💥 闇スーモ・強奪",

                    `${sourcePlayer.name}の資産<br><br>` +
                    `<strong>${result.assetName}（${formatG(result.price)}G）</strong><br><br>` +
                    `${type === "send" ? targetPlayer.name : usingPlayer.name}` +
                    `に移転した！`,

                    function () {

                        finishTurn(usingPlayer);

                    }
                );
                };

                if (submitOnlineTargetedItem(22, {
                    targetIndex: players.indexOf(targetPlayer),
                    type,
                    assetId: entry.id
                }, transferButton, completeAssetTransfer)) return;

                completeAssetTransfer(useAssetTransfer(usingPlayer, targetPlayer, entry.id, type));
            };

        assetList.appendChild(row);

    });

    backButton.onclick = function () {

        popup.style.display = "none";

        showTransferTypePopup(
            usingPlayer,
            targetPlayer,
            {
                title: "闇スーモ",
                sendLabel: "🎁 贈与",
                stealLabel: "💥 強奪",

                onSelect: function (nextType) {

                    showDarkSuumoAssetPopup(
                        usingPlayer,
                        targetPlayer,
                        nextType
                    );

                },

                onBack: function () {

                    showDarkSuumoPlayerPopup(usingPlayer);

                }
            }
        );

    };

    popup.style.display = "block";
    syncOnlineScreenView("item-action", usingPlayer, "open", { itemId: 22, stage: "assets", targetIndex: players.indexOf(targetPlayer), type });

}
