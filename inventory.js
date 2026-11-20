// 所持品配列は、IDだけの形式と個体データ形式の両方を扱う。
function getInventoryItemId(inventoryData) {
    return typeof inventoryData === "object"
        ? inventoryData.id
        : Number(inventoryData);
}

function findInventoryItemIndex(player, itemId) {
    return player.inventory.findIndex(
        function (inventoryData) {
            return Number(getInventoryItemId(inventoryData)) === Number(itemId);
        }
    );
}

// 旧ローカル処理の同期バリア。通常オンラインでは所持品自体を送信しない。
function publishInventoryState() {
    if (typeof window !== "undefined" && typeof window.publishOnlineGameState === "function") {
        if (window.onlineGame && window.onlineGame.sync && !window.onlineGame.sync.state) return;
        window.publishOnlineGameState().then(function (response) {
            if (!response || !response.ok) console.warn("[online] 所持品同期に失敗:", response && response.error);
        });
    }
}

// =========================================================
// アイテムを追加
// =========================================================
//
// 通常の「使う」アイテムは ID のまま保存。
// 持っているだけで効果があるアイテムは
// { id, acquiredTurn } の個体データとして保存する。
// =========================================================

function addItem(
    player,
    itemId,
    acquiredTurn = 1
) {

    if (!player.inventory) {

        player.inventory = [];

    }


    const numericItemId =
        Number(itemId);


    const item =
        ITEM_CONTENTS[
            numericItemId
        ];


    if (!item) {

        console.error(
            "アイテムCONTENTSが見つかりません:",
            numericItemId
        );

        return;

    }


    // =========================
    // 持っているだけで効果がある
    // パッシブアイテム
    // =========================

        if (
        item.category ===
        "passive"
    ) {

        const duration =
            item.effectDuration &&
            item.effectDuration.endsWith("turn")
                ? Number(
                    item.effectDuration.replace(
                        "turn",
                        ""
                    )
                )
                : null;

        player.inventory.push({

            id:
                numericItemId,

            acquiredTurn:
                acquiredTurn,

            remainingUses:
                duration

        });
        publishInventoryState();

        return;

    }


    // =========================
    // 通常アイテム
    // =========================

    player.inventory.push(
        numericItemId
    );
    publishInventoryState();

}


// =========================================================
// 複数のアイテムを追加
// =========================================================

function addItems(
    player,
    itemIds,
    acquiredTurn = 1
) {

    itemIds.forEach(
        function (itemId) {

            addItem(
                player,
                itemId,
                acquiredTurn
            );

        }
    );

}


// =========================================================
// 期限切れアイテムを削除
// =========================================================

function removeExpiredItems(
    player,
    currentTurn
) {

    const expiredItems = [];

    if (
        !player.inventory ||
        player.inventory.length === 0
    ) {

        return expiredItems;

    }

    player.inventory =
        player.inventory.filter(
            function (inventoryData) {

                // =========================
                // 通常アイテムはそのまま残す
                // =========================

                if (
                    typeof inventoryData !==
                    "object"
                ) {

                    return true;

                }

                const item =
                    ITEM_CONTENTS[
                        inventoryData.id
                    ];

                // データが存在しないアイテムは残す
                if (!item) {

                    return true;

                }

                // パッシブアイテム以外は対象外
                if (
                    item.category !==
                    "passive"
                ) {

                    return true;

                }

                // 永続効果は残す
                if (
                    item.effectDuration ===
                    "permanent"
                ) {

                    return true;

                }

                // ターン制限がないアイテムは残す
                if (
                    !item.effectDuration ||
                    !item.effectDuration.endsWith("turn")
                ) {

                    return true;

                }

                // =========================
                // 残り発動回数が0なら削除
                // =========================

                if (
                    Number(inventoryData.remainingUses) <= 0
                ) {

                    expiredItems.push({

                        itemId:
                            Number(inventoryData.id),

                        itemName:
                            item.name

                    });

                    return false;

                }

                return true;

            }
        );

    publishInventoryState();

    return expiredItems;

}


// =========================================================
// ターン開始時のアイテム効果
// =========================================================

function applyTurnStartItemEffects(
    player
) {

    const appliedEffects = [];

    if (
        !player.inventory ||
        player.inventory.length === 0
    ) {

        return appliedEffects;

    }

    player.inventory.forEach(
        function (inventoryData) {

            // =========================
            // パッシブアイテムだけ処理
            // =========================

            if (
                typeof inventoryData !==
                "object"
            ) {

                return;

            }

            const item =
                ITEM_CONTENTS[
                    inventoryData.id
                ];

            if (!item) {

                return;

            }

            if (
                item.category !==
                "passive"
            ) {

                return;

            }

            // =========================
            // ターン制限がある場合
            // 残り発動回数を初期化
            // =========================

            if (
                item.effectDuration &&
                item.effectDuration.endsWith("turn")
            ) {

                const duration =
                    Number(
                        item.effectDuration.replace(
                            "turn",
                            ""
                        )
                    );

                // 古い個体データにも対応
                if (
                    inventoryData.remainingUses === undefined ||
                    inventoryData.remainingUses === null
                ) {

                    inventoryData.remainingUses =
                        duration;

                }

                // 発動回数が残っていない場合は
                // 効果を発動しない
                if (
                    Number(inventoryData.remainingUses) <= 0
                ) {

                    return;

                }

            }

            // =========================
            // ターン開始時のG効果
            // =========================

            if (
                item.effectType ===
                "goldGain"
            ) {

                const gain =
                    Number(item.effectValue) || 0;

                // ① ゴールドを増減
                player.money =
                    Number(player.money) + gain;

                // ② アナウンス用データを保存
                appliedEffects.push({

                    itemId:
                        Number(inventoryData.id),

                    itemName:
                        item.name,

                    gain:
                        gain

                });

                if (gain > 0) {

                    console.log(
                        `${player.name}：${item.name}の効果で ${gain}G獲得`
                    );

                } else if (gain < 0) {

                    console.log(
                        `${player.name}：${item.name}の効果で ${Math.abs(gain)}G減少`
                    );

                }

            }

 
// =========================
// ③ ターン開始時に残りターンを減らす
// =========================

if (
    item.effectDuration &&
    item.effectDuration.endsWith("turn") &&
    (
        item.effectType === "goldGain" ||
        item.effectType === "bossCounterImmunity" ||
        item.effectType === "punishmentImmunity"
    )
) {

    inventoryData.remainingUses -= 1;
    publishInventoryState();

}


        }
    );

    return appliedEffects;

}


// =========================
// アイテムの効果値を取得
// =========================

function getItemEffect(
    player,
    effectType
) {

    let totalValue = 0;


    if (
        !player.inventory
    ) {

        return totalValue;

    }


    player.inventory.forEach(
        function (inventoryData) {

            // =========================
            // パッシブアイテムだけ対象
            // =========================

            if (
                typeof inventoryData !==
                "object"
            ) {

                return;

            }


            const item =
                ITEM_CONTENTS[
                    inventoryData.id
                ];


            if (!item) {

                return;

            }


            if (
                item.category !==
                "passive"
            ) {

                return;

            }


            if (
                item.effectType ===
                effectType
            ) {

                totalValue +=
                    item.effectValue || 0;

            }

        }
    );


    return totalValue;

}

// ============================================================
// ロスノート使用処理
// ============================================================
function useLossNote(
    usingPlayer,
    targetPlayer,
    currentTurn
) {

    // ロスノートを所持しているか確認
    const inventoryIndex =
        findInventoryItemIndex(usingPlayer, 13);

    // ロスノートを持っていなければ使用不可
    if (inventoryIndex === -1) {
        return null;
    }

    // ロスノートを消費
    usingPlayer.inventory.splice(
        inventoryIndex,
        1
    );
    if (window.DisadvantageImmunityRules?.isActive(targetPlayer)) return { targetPlayer, immunityBlocked:true };
    // The common death flow handles grants, liquidation, and relocation.
    targetPlayer.money = 0;
    return { targetPlayer: targetPlayer };

}

// ============================================================
// 叩き派遣使用処理
// ============================================================

function useHatatakiHaken(
    usingPlayer,
    allPlayers
) {

    const targetPlayers = allPlayers.filter(target => target !== usingPlayer);
    if (!targetPlayers.length) return null;

    // 叩き派遣を所持しているか確認
    const inventoryIndex =
        findInventoryItemIndex(usingPlayer, 17);

    // 持っていなければ使用不可
    if (inventoryIndex === -1) {

        return null;

    }

    // 叩き派遣を消費
    usingPlayer.inventory.splice(
        inventoryIndex,
        1
    );
    publishInventoryState();

    // Destruction is committed by the per-click action. Keep each target's
    // allowance here so the visible sequence and inventory mutations happen
    // one item at a time.
    const results = targetPlayers.map(function (targetPlayer) {
        return {
            player: targetPlayer,
            lostItems: [],
            remainingCount: null,
            immunityBlocked: window.DisadvantageImmunityRules?.isActive(targetPlayer) === true,
            done: false
        };
    });

    return results;
}

function destroyHatatakiHakenItem(targetResult) {
    if (!targetResult || targetResult.done) return { done: true, evaded: true };
    if (targetResult.immunityBlocked) {
        targetResult.done = true;
        return { done: true, evaded: true };
    }
    const target = targetResult.player;
    if (!Array.isArray(target?.inventory)) target.inventory = [];
    if (targetResult.remainingCount === null) {
        targetResult.remainingCount = Math.min(Math.floor(Math.random() * 6), target.inventory.length);
    }
    if (targetResult.remainingCount <= 0 || !target.inventory.length) {
        targetResult.done = true;
        return { done: true, evaded: true };
    }
    const removed = target.inventory.splice(Math.floor(Math.random() * target.inventory.length), 1)[0];
    if (removed === undefined) {
        targetResult.done = true;
        return { done: true, evaded: true };
    }
    const itemId = getInventoryItemId(removed);
    const item = ITEM_CONTENTS[itemId];
    const itemName = String(item?.name || 'アイテム');
    targetResult.lostItems.push(itemName);
    targetResult.remainingCount = Math.max(0, targetResult.remainingCount - 1);
    targetResult.done = targetResult.remainingCount === 0 || target.inventory.length === 0;
    publishInventoryState();
    return { done: targetResult.done, evaded: false, itemId, itemName };
}

// ============================================================
// 近づきマス使用処理
// ============================================================

function useWarpToBoss(
    player
) {

    // =========================
    // 近づきマスを所持しているか確認
    // =========================

    const inventoryIndex =
        findInventoryItemIndex(player, 14);


    // =========================
    // 持っていなければ使用不可
    // =========================

    if (
        inventoryIndex === -1
    ) {

        return null;

    }


// =========================
// 現在地からボスまでの
// 最短ルートを取得
// =========================

if (
    typeof window.getShortestPathToBoss !==
    "function"
) {
    console.error(
        "最短ルート取得処理が準備されていません。"
    );
    return null;

}

const path =
    window.getShortestPathToBoss(
        player.position
    );


    // =========================
    // 最短ルートが存在しない
    // =========================

    if (
        !path ||
        path.length < 2
    ) {

        return null;

    }


    // =========================
    // ボスまであと1マスの場合
    // =========================
    //
    // path:
    //
    // [現在地, ボス]
    //
    // この場合はすでに目的地なので
    // 使用不可
    // =========================

    if (
        path.length === 2
    ) {

        return null;

    }


    // =========================
    // ボスの1マス手前を取得
    // =========================
    //
    // 例：
    //
    // [現在地, A, B, C, ボス]
    //
    // ↓
    //
    // path[path.length - 2]
    //
    // = C
    // =========================

    const warpPosition =
        path[
            path.length - 2
        ];


    // =========================
    // アイテムを1個消費
    // =========================

    player.inventory.splice(
        inventoryIndex,
        1
    );
    publishInventoryState();


    // =========================
    // プレイヤーをワープ
    // =========================

    player.position =
        warpPosition;

    // =========================
// 瞬間移動SE
// =========================

if (
    typeof warpSound !== "undefined"
) {

    warpSound.currentTime = 0;

    warpSound
        .play()
        .catch(
            function (error) {

                console.warn(
                    "【瞬間移動SE】再生失敗：",
                    error
                );

            }
        );

}

    // =========================
    // 移動履歴をリセット
    // =========================

    movementPath = [];


    // =========================
    // マップ・プレイヤー表示更新
    // =========================

    renderMap();
    renderPlayers();


    // =========================
    // 最短ルートを更新
    // =========================

     refreshShortestPathToBoss();


    // =========================
    // 結果を返す
    // =========================

    return {
        warpPosition:
            warpPosition
    };

}

// ============================================================
// ロストマジック使用処理
// ============================================================
function useLostMagic(
    usingPlayer,
    targetPlayer,
    magicId
) {

    // ロストマジックを所持しているか確認
    const inventoryIndex =
        findInventoryItemIndex(usingPlayer, 18);

    // ロストマジックを持っていなければ使用不可
    if (inventoryIndex === -1) {
        return null;
    }

    // 対象の魔法を確認
    const magicIndex =
        targetPlayer.magic.findIndex(
            function (id) {

                return Number(id) ===
                    Number(magicId);

            }
        );

    // 魔法が見つからなければ使用不可
    if (magicIndex === -1) {
        return null;
    }

    // ロストマジックを消費
    usingPlayer.inventory.splice(
        inventoryIndex,
        1
    );
    publishInventoryState();

    if (window.DisadvantageImmunityRules?.isActive(targetPlayer)) return { magicId:Number(magicId), immunityBlocked:true };

    // 魔法を消失
    targetPlayer.magic.splice(
        magicIndex,
        1
    );
    publishInventoryState();

    // 消失した魔法を返す
    return {
        magicId: Number(magicId)
    };
}

// ============================================================
// ID:19 送金奪金 使用処理
// ============================================================
function useMoneyTransfer(
    usingPlayer,
    targetPlayer,
    amount
) {

    // =========================
    // 送金奪金を所持しているか確認
    // =========================

    const inventoryIndex =
        findInventoryItemIndex(usingPlayer, 19);

    if (
        inventoryIndex === -1
    ) {
        return null;
    }


    // =========================
    // 金額を数値化
    // =========================

    amount =
        Number(amount);


    // 0Gは使用不可
    if (
        !Number.isFinite(amount) ||
        amount === 0
    ) {
        return null;
    }

    // 闇みずほは送り元の所持金の半分まで、1000G単位で移動できる。
    const sourceMoney = amount > 0 ? Number(usingPlayer.money) : Number(targetPlayer.money);
    const limit = Math.floor(Math.max(0, sourceMoney || 0) / 2000) * 1000;
    if (!Number.isSafeInteger(amount) || Math.abs(amount) % 1000 !== 0 || Math.abs(amount) > limit) return null;


    // =========================
    // 送金
    // =========================

    if (
        amount > 0
    ) {

        // 自分の所持Gを上限にする

        const transferAmount =
            Math.min(
                amount,
                usingPlayer.money
            );

        if (
            transferAmount <= 0
        ) {
            return null;
        }

        usingPlayer.money -=
            transferAmount;

        targetPlayer.money +=
            transferAmount;


        // アイテム消費

        usingPlayer.inventory.splice(
            inventoryIndex,
            1
        );
    publishInventoryState();


        return {
            type: "send",
            amount: transferAmount
        };

    }


    // =========================
    // 奪金
    // =========================

    if (window.DisadvantageImmunityRules?.isActive(targetPlayer)) {
        usingPlayer.inventory.splice(inventoryIndex, 1);
        publishInventoryState();
        return { type:"steal", amount:0, immunityBlocked:true };
    }

    const stealAmount =
        Math.min(
            Math.abs(amount),
            targetPlayer.money
        );

    if (
        stealAmount <= 0
    ) {
        return null;
    }

    targetPlayer.money -=
        stealAmount;

    usingPlayer.money +=
        stealAmount;


    // アイテム消費

    usingPlayer.inventory.splice(
        inventoryIndex,
        1
    );
    publishInventoryState();


    return {
        type: "steal",
        amount: stealAmount
    };

}

// ============================================================
// ID:20 飛んできマス使用処理
// マップ上のランダムなマスへワープ
// ============================================================
function useWarpToRandom(
    player
) {

    // 飛んできマスを所持しているか確認
    const inventoryIndex =
        findInventoryItemIndex(player, 20);

    // 飛んできマスを持っていなければ使用不可ssss
    if (inventoryIndex === -1) {
        return null;
    }

    // mapDataからランダムなマスを選択
    if (
        !Array.isArray(mapData) ||
        mapData.length === 0
    ) {
        return null;
    }

    const playableSquares = BossBattleRules.reachableSquares(mapData, mapData.find(square => square.type === 'start')?.id);
    if (!playableSquares.length) return null;
    const candidates = MapRegionRules.destinations(player, mapData, MapRegionData, playableSquares)
        .filter(square => {
            const distance = BossBattleRules.distanceBetween(mapData, player.position, square.id);
            return Number.isFinite(distance) && distance >= 10;
        });
    if (!candidates.length) return { error: '現在地から10マス以上離れた移動先がないため、アイテムは使用できません。' };
    const randomSquare = candidates[Math.floor(Math.random() * candidates.length)];

    if (!randomSquare) {
        return null;
    }

    // 飛んできマスを消費
    player.inventory.splice(
        inventoryIndex,
        1
    );
    publishInventoryState();

    return {
        position: randomSquare.id
    };
}


 // ============================================================
 // ID:23 ふっとばしマス使用処理
 // 自分以外の全プレイヤーをランダムなマスへ移動
 // ============================================================

function useWarpAllPlayersRandom(player, selectedIndex = findInventoryItemIndex(player, 23)) {

    // ふっとばしマスを所持しているか確認
    if (selectedIndex < 0 || Number(getInventoryItemId(player.inventory[selectedIndex] ?? 0)) !== 23) {
        return null;
    }

    // マップを確認
    if (
        !Array.isArray(mapData) ||
        mapData.length === 0
    ) {
        return null;
    }

    const playableSquares = BossBattleRules.reachableSquares(mapData, mapData.find(square => square.type === 'start')?.id);
    if (!playableSquares.length) return null;
    // 自分以外のプレイヤーの移動先を決定
    const targets =
        players
            .filter(function (targetPlayer) {
                return targetPlayer !== player;
            })
            .map(function (targetPlayer) {

                if (targetPlayer.underground || window.DisadvantageImmunityRules?.isActive(targetPlayer)) return { player: targetPlayer, unaffected: true };
                return {
                    player: targetPlayer,
                    candidates: MapRegionRules.destinations(targetPlayer, mapData, MapRegionData, playableSquares)
                };

            });

    if (!targets.length || targets.some(target => !target.unaffected && !target.candidates.length)) return null;
    targets.forEach(target => {
        if (target.unaffected) return;
        target.position = target.candidates[Math.floor(Math.random() * target.candidates.length)].id;
        delete target.candidates;
        if (target.player.jobTurnsRemaining > 0) {
            target.player.jobTurnsRemaining = 0;
            target.player.jobReward = 0;
        }
    });

    // アイテムを消費
    player.inventory.splice(
        selectedIndex,
        1
    );
    publishInventoryState();

    return targets;
}


// =========================================================
// 闇ヤマト
// アイテムを送付 / 強奪
// =========================================================

function useItemTransfer(
    usingPlayer,
    targetPlayer,
    inventoryIndex,
    type
) {

    // =========================
    // 闇ヤマト自身を探す
    // =========================

    const transferItemIndex =
        findInventoryItemIndex(usingPlayer, 21);

    if (
        transferItemIndex === -1
    ) {
        return null;
    }


    // =========================
    // 渡す
    // =========================

    if (
        type === "send"
    ) {

        const itemIndex =
            Number(inventoryIndex);

        if (
            !Number.isInteger(itemIndex) ||
            itemIndex < 0 ||
            itemIndex >= usingPlayer.inventory.length ||
            itemIndex === transferItemIndex
        ) {
            return null;
        }
        if (window.GuidebookRules?.isBook(usingPlayer.inventory[itemIndex])) return null;


      // 選択したアイテム

const sentItem =
    usingPlayer.inventory.splice(
        itemIndex,
        1
    )[0];


if (
    sentItem === undefined
) {
    return null;
}


// 闇ヤマトを消費

usingPlayer.inventory.splice(
    transferItemIndex > itemIndex
        ? transferItemIndex - 1
        : transferItemIndex,
    1
);


// 相手へ追加

targetPlayer.inventory.push(
    sentItem
);
    publishInventoryState();

        return {
            type: "send",
            itemId:
                typeof sentItem === "object"
                    ? Number(sentItem.id)
                    : Number(sentItem)
        };

    }


    // =========================
    // 奪う
    // =========================

    if (
        type === "steal"
    ) {

        if (window.DisadvantageImmunityRules?.isActive(targetPlayer)) {
            usingPlayer.inventory.splice(transferItemIndex, 1);
            publishInventoryState();
            return { type:"steal", immunityBlocked:true };
        }

        const itemIndex =
            Number(inventoryIndex);

        if (
            !Number.isInteger(itemIndex) ||
            itemIndex < 0 ||
            itemIndex >= targetPlayer.inventory.length
        ) {
            return null;
        }


        // 選択したアイテム

        const stolenItem =
            targetPlayer.inventory[
                itemIndex
            ];
        if (window.GuidebookRules?.isBook(stolenItem)) return null;


        // 闇ヤマトを消費

        usingPlayer.inventory.splice(
            transferItemIndex,
            1
        );
    publishInventoryState();


        // 相手からアイテムを削除

        targetPlayer.inventory.splice(
            itemIndex,
            1
        );
    publishInventoryState();


        // 自分のインベントリへ追加

        usingPlayer.inventory.push(
            stolenItem
        );
    publishInventoryState();


        return {
            type: "steal",
            itemId:
                typeof stolenItem === "object"
                    ? Number(stolenItem.id)
                    : Number(stolenItem)
        };

    }


    return null;

}

// ============================================================
// 闇スーモ
// 資産を贈与 / 強奪
// ============================================================

function useAssetTransfer(
    usingPlayer,
    targetPlayer,
    assetId,
    type
) {

    // 闇スーモを所持しているか確認
    const inventoryIndex =
        findInventoryItemIndex(usingPlayer, 22);

    if (inventoryIndex === -1) {
        return null;
    }

    if (type === "steal" && window.DisadvantageImmunityRules?.isActive(targetPlayer)) {
        usingPlayer.inventory.splice(inventoryIndex, 1);
        publishInventoryState();
        return { type:"steal", immunityBlocked:true };
    }

    const sourcePlayer =
        type === "send"
            ? usingPlayer
            : targetPlayer;

    const destinationPlayer =
        type === "send"
            ? targetPlayer
            : usingPlayer;

    const sourcePlayerIndex =
        players.indexOf(sourcePlayer);

    const destinationPlayerIndex =
        players.indexOf(destinationPlayer);

    const numericAssetId =
        Number(assetId);

    const asset =
        ASSET_CONTENTS[numericAssetId];

    // 対象資産の所有者を確認
    if (
        !asset ||
        asset.owner !== sourcePlayerIndex ||
        !sourcePlayer.assets ||
        !sourcePlayer.assets.some(
            function (ownedAssetId) {
                return Number(ownedAssetId) === numericAssetId;
            }
        )
    ) {
        return null;
    }

    // 所有者情報を更新
    asset.owner = destinationPlayerIndex;

    // 移転元から資産を削除
    sourcePlayer.assets =
        sourcePlayer.assets.filter(
            function (ownedAssetId) {
                return Number(ownedAssetId) !== numericAssetId;
            }
        );

    // 移転先に資産を追加
    if (!destinationPlayer.assets) {
        destinationPlayer.assets = [];
    }

    if (
        !destinationPlayer.assets.some(
            function (ownedAssetId) {
                return Number(ownedAssetId) === numericAssetId;
            }
        )
    ) {
        destinationPlayer.assets.push(numericAssetId);
        window.DividendHistory?.recordTransfer(destinationPlayer, numericAssetId);
    }

    // 闇スーモを消費
    usingPlayer.inventory.splice(
        inventoryIndex,
        1
    );
    publishInventoryState();

    return {
        type: type,
        assetId: numericAssetId,
        assetName: asset.name,
        price: marketPrice(asset.price)
    };

}
