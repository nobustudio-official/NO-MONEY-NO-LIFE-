// 資産・配当など、ゲーム内の経済計算を担当します。

// 配当周期の共通設定。変更後はサーバー再起動＋各ブラウザーの再読み込みが必要。
// 購入集計は直前の配当ターンを基準にする。
const DIVIDEND_CYCLE = 6;
const OUTCOME_MARKET_TURN = 18;
const RANDOM_MARKET_START_TURN = 24;
function marketEventTurnForBossDefeat(defeatTurn) {
    const turn = Math.max(1, Math.floor(Number(defeatTurn) || 1));
    if (turn <= 9) return 12;
    return 12 + 6 * Math.ceil((turn - 9) / DIVIDEND_CYCLE);
}

function isMarketSeasonTurn(completedTurn, firstEventTurn) {
    const turn = Math.floor(Number(completedTurn) || 0);
    const first = Math.floor(Number(firstEventTurn) || 0);
    return first > 0 && turn >= first && (turn - first) % DIVIDEND_CYCLE === 0;
}

function currentMarketExponent() {
    if (typeof window === 'undefined') return 0;
    return (window.onlineGame?.isOnline ? window.onlineGame.sync?.state?.marketExponent : window.OfflineDividends?.marketExponent?.()) ?? 0;
}

function drawMarketSeason(previous = 0, roll = Math.random(), forceNormal = false, excludedKind = null) {
    if (forceNormal) return { kind: 'normal', exponent: 0 };
    let kind = roll < 0.2 ? 'boom' : roll < 0.4 ? 'crash' : 'normal';
    // 残った通常価格と反対の変動の抽選比率（60:20）を維持する。
    if (excludedKind === 'boom') kind = roll < 0.25 ? 'crash' : 'normal';
    if (excludedKind === 'crash') kind = roll < 0.25 ? 'boom' : 'normal';
    const inflationStep = Math.log2(1.5);
    return { kind, exponent: kind === 'normal' ? 0 : previous + (kind === 'boom' ? inflationStep : -1) };
}

function drawScheduledMarketSeason(previous, completedTurn, random = Math.random, outcomeAt18 = null, firstEventTurn = OUTCOME_MARKET_TURN, excludedKind = null) {
    const turn = Math.max(0, Math.floor(Number(completedTurn) || 0));
    const first = Math.max(0, Math.floor(Number(firstEventTurn) || 0));
    if (turn === first && ['boom', 'crash'].includes(outcomeAt18)) {
        return { kind: outcomeAt18, exponent: outcomeAt18 === 'boom' ? Math.log2(1.5) : -1 };
    }
    if (!isMarketSeasonTurn(turn, first)) return { kind: 'normal', exponent: 0 };
    return drawMarketSeason(previous, random(), false, excludedKind);
}

function resetMarketSeason(state) {
    state.marketExponent = 0;
    state.marketKind = 'normal';
    state.marketStreak = 0;
}

function advanceMarketSeason(state, completedTurn, isFinal, random = Math.random) {
    const previousExponent = Number(state.marketExponent) || 0;
    const previousKind = state.marketKind ?? (previousExponent > 0 ? 'boom' : previousExponent < 0 ? 'crash' : 'normal');
    if (isFinal) {
        resetMarketSeason(state);
        return previousKind !== 'normal' || previousExponent !== 0 ? { kind: 'normal', exponent: 0 } : null;
    }

    const firstEventTurn = Number(state.marketEventTurn) || 0;
    if (!isMarketSeasonTurn(completedTurn, firstEventTurn)) return null;
    if (completedTurn === firstEventTurn && !['boom', 'crash'].includes(state.marketOutcomeAt18)) {
        state.marketOutcomeAt18 = random() < 0.5 ? 'crash' : 'boom';
    }
    const previousStreak = previousKind === 'normal' ? 0 : Number(state.marketStreak) || 1;
    const excludedKind = previousStreak >= 2 ? previousKind : null;
    const season = drawScheduledMarketSeason(previousExponent, completedTurn, random, state.marketOutcomeAt18, firstEventTurn, excludedKind);
    state.marketExponent = season.exponent;
    state.marketKind = season.kind;
    state.marketStreak = season.kind === 'normal' ? 0 : season.kind === previousKind ? previousStreak + 1 : 1;
    return season.kind === 'normal' && previousKind === 'normal' ? null : season;
}

function marketPrice(base, exponent = currentMarketExponent()) {
    const value = Number(base) * 2 ** exponent;
    if (Number(exponent) === 0) return Math.floor(value);

    const tens = value / 10;
    // 倍率の浮動小数点誤差で、10Gちょうどの値をさらに切り捨てない。
    const tolerance = Math.abs(tens) * Number.EPSILON * 16;
    return Math.floor(tens + tolerance) * 10;
}

function marketVariationLabel(exponent = currentMarketExponent()) {
    const percentage = Math.round((2 ** Number(exponent || 0) - 1) * 1000) / 10;
    if (percentage > 0) return `＋${percentage}％`;
    if (percentage < 0) return `−${Math.abs(percentage)}％`;
    return '0％';
}

function compareAssetPurchaseOrder(a, b) {
    return a.price - b.price || b.yield - a.yield;
}

function marketSeasonMessage(season) {
    return season?.kind === 'boom'
        ? '急激なインフレが発生しました！次の配当終了までの間、報酬や資産など、ほとんどの価格が50％上昇します！'
        : season?.kind === 'crash'
            ? '急激なデフレが発生しました！次の配当終了までの間、報酬や資産など、ほとんどの価格が50％減少します！'
            : '物価が安定しました。あらゆる価格は通常値に戻りました。';
}
function marketSeasonSound(season) { return season?.kind === 'normal' ? 'marketStable' : 'marketChange'; }

function canSellItem(item) {
    return Boolean(item && item.sellable !== false && Number(item.price) > 0);
}
const ASSET_SHOPS = typeof module !== "undefined" && module.exports
    ? require('./data').ASSET_BOXES
    : (typeof ASSET_BOXES !== 'undefined' ? ASSET_BOXES : {});

function calculateJobWage(baseWage, bossDefeatedCount, exponent = currentMarketExponent()) {
    const bossCount = Math.min(5, Math.max(0, Number(bossDefeatedCount) || 0));
    const wagePercent = 100 + 20 * bossCount;
    return Math.ceil(Number(baseWage) * wagePercent * 2 ** exponent / 10000) * 100;
}

// Market changes apply to the normal payout after its boss-progression rounding.
function calculateGoldSquareReward(base, progressionMultiplier, exponent = currentMarketExponent()) {
    const reward = Math.floor((Number(base) * progressionMultiplier + 1e-7) / 100) * 100;
    return marketPrice(reward, exponent);
}

function calculateMonsterGoldReward(base, progressionMultiplier, exponent = currentMarketExponent()) {
    const reward = Math.floor(Number(base) * progressionMultiplier / 10) * 10;
    return marketPrice(reward, exponent);
}

function monopolizedAssetIds(player, shopBoxes = ASSET_SHOPS) {
    const owned = new Set((player?.assets || []).map(Number));
    const result = new Set();
    Object.values(shopBoxes || {}).forEach(function (shop) {
        const contents = Array.isArray(shop?.contents) ? [...new Set(shop.contents.map(Number))] : [];
        if (contents.length && contents.every(id => owned.has(id))) contents.forEach(id => result.add(id));
    });
    return result;
}

function calculateAssetDividend(player, assetContents = ASSET_CONTENTS, shopBoxes = ASSET_SHOPS, exponent = currentMarketExponent()) {
    if (!player.assets || player.assets.length === 0) {
        return 0;
    }

    let dividend = 0;
    const monopoly = monopolizedAssetIds(player, shopBoxes);

    player.assets.forEach(function (assetId) {
        const asset = assetContents[assetId];

        if (!asset) {
            return;
        }

        dividend += asset.price * (asset.yield / 100) * (monopoly.has(Number(assetId)) ? 2 : 1);
    });

    return marketPrice(dividend, exponent);
}

function calculateAssetHoldings(player, assetContents = ASSET_CONTENTS, shopBoxes = ASSET_SHOPS, exponent = currentMarketExponent()) {
    let assetValue = 0;
    let weightedYield = 0;
    const monopoly = monopolizedAssetIds(player, shopBoxes);

    if (player.assets && player.assets.length > 0) {
        player.assets.forEach(function (assetId) {
            const asset = assetContents[assetId];

            if (asset) {
                assetValue += asset.price;
                weightedYield += asset.price * asset.yield * (monopoly.has(Number(assetId)) ? 2 : 1);
            }
        });
    }

    return { value: marketPrice(assetValue, exponent), weightedAverageYield: assetValue > 0 ? weightedYield / assetValue : null };
}

function calculateTotalAssetValue(player, assetContents = ASSET_CONTENTS, exponent = currentMarketExponent()) {
    return player.money + calculateAssetHoldings(player, assetContents, ASSET_SHOPS, exponent).value;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { DIVIDEND_CYCLE, OUTCOME_MARKET_TURN, RANDOM_MARKET_START_TURN, marketEventTurnForBossDefeat, isMarketSeasonTurn, drawMarketSeason, drawScheduledMarketSeason, resetMarketSeason, advanceMarketSeason, marketSeasonMessage, marketSeasonSound, marketPrice, marketVariationLabel, canSellItem, calculateJobWage, calculateGoldSquareReward, calculateMonsterGoldReward, monopolizedAssetIds, calculateAssetDividend, calculateTotalAssetValue, calculateAssetHoldings };
}
