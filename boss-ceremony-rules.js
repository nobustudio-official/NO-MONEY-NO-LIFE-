// Calculations shared by the future offline and server-controlled boss ceremony.
(function (root, factory) {
    const rules = factory();
    if (typeof module === "object" && module.exports) module.exports = rules;
    if (root) root.BossCeremonyRules = rules;
})(typeof window !== "undefined" ? window : null, function () {
    "use strict";

    function aggregateRewards(awards, playerCount) {
        if (!awards || !Number.isInteger(playerCount) || playerCount < 1) {
            throw new Error("ボス報酬のプレイヤー情報が不正です。");
        }
        const totals = Array(playerCount).fill(0);
        for (const row of [awards.first, ...(awards.damageAwards || []), awards.defeat]) {
            if (!row) continue;
            const index = Number(row.playerIndex);
            const value = Number(row.value);
            if (!Number.isInteger(index) || index < 0 || index >= playerCount || !Number.isSafeInteger(value) || value < 0) {
                throw new Error("ボス報酬が不正です。");
            }
            totals[index] += value;
            if (!Number.isSafeInteger(totals[index])) throw new Error("ボス報酬の合計が大きすぎます。");
        }
        return totals.map((amount, playerIndex) => ({ playerIndex, amount })).filter(row => row.amount > 0);
    }

    // Graph distance is measured from the defeated boss, not the new boss.
    function farthestPlayer(squares, players, bossSquareId, killerIndex) {
        if (!Number.isInteger(killerIndex) || killerIndex < 0 || killerIndex >= players.length) {
            throw new Error("討伐者が不正です。");
        }
        const graph = new Map(squares.map(square => [Number(square.id), new Set()]));
        for (const square of squares) {
            for (const next of square.next || []) {
                const from = graph.get(Number(square.id));
                const to = graph.get(Number(next));
                if (from && to) { from.add(Number(next)); to.add(Number(square.id)); }
            }
        }
        const start = Number(bossSquareId);
        if (!graph.has(start)) throw new Error("ボスマスが見つかりません。");
        const distances = new Map([[start, 0]]);
        const queue = [start];
        for (let i = 0; i < queue.length; i++) {
            for (const next of graph.get(queue[i])) {
                if (distances.has(next)) continue;
                distances.set(next, distances.get(queue[i]) + 1);
                queue.push(next);
            }
        }
        let result = null;
        for (let offset = 1; offset < players.length; offset++) {
            const playerIndex = (killerIndex + offset) % players.length;
            if (players[playerIndex].underground) continue;
            const distance = distances.get(Number(players[playerIndex].position));
            if (distance === undefined) throw new Error("プレイヤーまでの経路が見つかりません。");
            // On a tie, the player whose next turn comes later takes priority.
            if (!result || distance >= result.distance) result = { playerIndex, distance };
        }
        return result;
    }

    function minimumPenaltyAmount(bossDefeatedCount = 0) {
        if (!Number.isSafeInteger(bossDefeatedCount) || bossDefeatedCount < 0) {
            throw new Error("お仕置きのボス撃破数が不正です。");
        }
        if (bossDefeatedCount === 0) return 0;
        return 30000 + 20000 * (bossDefeatedCount - 1);
    }

    function penaltyBreakdown(distance, multiplier, die, bossDefeatedCount = 0) {
        if (!Number.isSafeInteger(distance) || distance < 0 || !Number.isSafeInteger(multiplier) || multiplier < 0 || !Number.isInteger(die) || die < 1 || die > 6) {
            throw new Error("お仕置きの計算値が不正です。");
        }
        const normalAmount = distance * multiplier * die;
        if (!Number.isSafeInteger(normalAmount)) throw new Error("お仕置き額が大きすぎます。");
        const minimumAmount = distance > 0 ? minimumPenaltyAmount(bossDefeatedCount) : 0;
        const amount = Math.max(normalAmount, minimumAmount);
        return { normalAmount, minimumAmount, additionalAmount:amount - normalAmount, amount };
    }

    function penaltyAmount(distance, multiplier, die, bossDefeatedCount = 0) {
        return penaltyBreakdown(distance, multiplier, die, bossDefeatedCount).amount;
    }

    // The server must check the caller's identity before passing its player index.
    // A claim is stored with the ceremony so retries cannot pay twice.
    function claimReward(players, claims, playerIndex) {
        if (!Array.isArray(players) || !Array.isArray(claims) || !Number.isInteger(playerIndex)) {
            throw new Error("報酬受取の情報が不正です。");
        }
        const claim = claims.find(entry => entry.playerIndex === playerIndex);
        const player = players[playerIndex];
        if (!claim || !player) throw new Error("この報酬を受け取る権利がありません。");
        if (claim.claimed) return false;
        const balance = Number(player.money);
        if (!Number.isSafeInteger(balance) || !Number.isSafeInteger(claim.amount) || claim.amount <= 0) {
            throw new Error("報酬または所持金が不正です。");
        }
        player.money = balance + claim.amount;
        claim.claimed = true;
        return true;
    }

    return Object.freeze({ aggregateRewards, farthestPlayer, minimumPenaltyAmount, penaltyBreakdown, penaltyAmount, claimReward });
});
