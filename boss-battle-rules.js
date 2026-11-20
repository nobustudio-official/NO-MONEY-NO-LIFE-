// Rules shared by the server and the existing offline battle presentation.
(function (root, factory) {
    const rules = factory(typeof module === 'object' && module.exports ? require('./economy').marketPrice : marketPrice);
    if (typeof module === "object" && module.exports) module.exports = rules;
    if (root) root.BossBattleRules = rules;
})(typeof window !== "undefined" ? window : null, function (marketPrice) {
    "use strict";
    const DAMAGE_MULTIPLIER = 10;

    function reachableSquares(squares, originId) {
        const byId = new Map(squares.map(square => [Number(square.id), square]));
        const origin = byId.get(Number(originId));
        if (!origin) return [];
        const visited = new Set([Number(origin.id)]), queue = [origin];
        for (let i = 0; i < queue.length; i++) {
            for (const id of queue[i].next || []) {
                const next = byId.get(Number(id));
                if (next && !visited.has(Number(next.id))) { visited.add(Number(next.id)); queue.push(next); }
            }
        }
        return squares.filter(square => visited.has(Number(square.id)));
    }
    function distanceBetween(squares, fromId, toId) {
        const rows = Array.isArray(squares) ? squares : [];
        const from = Number(fromId), to = Number(toId);
        const byId = new Map(rows.map(square => [Number(square.id), square]));
        if (!byId.has(from) || !byId.has(to)) return null;
        if (from === to) return 0;

        // Map links represent roads between spaces. Count the shortest road
        // distance without treating the stored next direction as a one-way road.
        const neighbors = new Map(rows.map(square => [Number(square.id), new Set()]));
        rows.forEach(square => {
            const id = Number(square.id);
            (square.next || []).forEach(nextId => {
                const next = Number(nextId);
                if (!neighbors.has(id) || !neighbors.has(next)) return;
                neighbors.get(id).add(next);
                neighbors.get(next).add(id);
            });
        });

        const distances = new Map([[from, 0]]);
        const queue = [from];
        for (let index = 0; index < queue.length; index++) {
            const current = queue[index];
            const distance = distances.get(current);
            for (const next of neighbors.get(current) || []) {
                if (distances.has(next)) continue;
                if (next === to) return distance + 1;
                distances.set(next, distance + 1);
                queue.push(next);
            }
        }
        return null;
    }
    function reachableBossSquares(squares, originId, excludedId = null) {
        return reachableSquares(squares, originId).filter(square => square.type === 'monster'
            && (excludedId == null || Number(square.id) !== Number(excludedId)));
    }

    function nextBossCandidates(squares, originId, excludedId, players = [], regionData = null, regionAt = null) {
        let candidates = reachableBossSquares(squares, originId, excludedId);
        const origin = (squares || []).find(square => Number(square.id) === Number(originId));
        const originRegion = origin && typeof regionAt === 'function'
            ? regionAt(regionData, Number(origin.x), Number(origin.y))?.id
            : null;
        if (originRegion) {
            candidates = candidates.filter(square => {
                const region = regionAt(regionData, Number(square.x), Number(square.y));
                return region && region.id !== originRegion;
            });
        }

        const distantCandidates = candidates.filter(square => (players || []).every(player => {
            const distance = player?.position == null ? null : distanceBetween(squares, player.position, square.id);
            return distance !== null && distance >= 13;
        }));
        return distantCandidates.length ? distantCandidates : candidates;
    }

    function encounter(state, bosses, battleId, isRechallenge) {
        const playerIndex = Number(state.activePlayerIndex);
        const player = state.players[playerIndex];
        const boss = bosses[state.currentBossId];
        if (!boss || boss.specialBoss || Number(state.currentBossId) === 9999) throw new Error("通常ボスのデータがありません。");
        if (Number(player.position) !== Number(state.currentBossSquareId)) throw new Error("現在のボスマスに到着していません。");
        if (Number(state.currentBossHP) <= 0) throw new Error("このボスはすでに討伐されています。");
        if (!state.players[state.bossFirstPlayerIndex]) state.bossFirstPlayerIndex = playerIndex;
        state.bossCounterEnabled = true;
        return {
            battleId, playerIndex, kind: "boss", isRechallenge: Boolean(isRechallenge),
            monster: { ...boss, id: Number(state.currentBossId) }, monsterHP: Number(state.currentBossHP),
            battleStartGold: Number(player.money), round: 1, phase: "bossChallenge",
            magicPowerRate: 1, enemyAttackRate: 1, selectedMagicId: null,
            lastDamage: 0, endWithReward: false, lastAction: null, message: ""
        };
    }

    function rewards(state, boss, killerIndex) {
        const firstIndex = Number(state.bossFirstPlayerIndex);
        const exponent = state.marketExponent ?? 0;
        const bonus = marketPrice(Number(boss.reward) || 0, exponent);
        const damageAwards = state.players.map((player, playerIndex) => ({
            playerIndex, name: player.name, value: marketPrice((Number(player.bossDamage) || 0) * DAMAGE_MULTIPLIER, exponent)
        }));
        return {
            first: state.players[firstIndex] ? { playerIndex: firstIndex, name: state.players[firstIndex].name, value: bonus } : null,
            damageAwards,
            defeat: { playerIndex: killerIndex, name: state.players[killerIndex].name, value: bonus }
        };
    }

    function payRewards(state, awards) {
        if (state.bossRewardGiven) return false;
        const payments = [...awards.damageAwards, awards.defeat, ...(awards.first ? [awards.first] : [])];
        payments.forEach(award => {
            const player = state.players[award.playerIndex];
            player.money = Number(player.money) + award.value;
        });
        state.bossRewardGiven = true;
        return true;
    }

    function nextBoss(state, bosses, squares, random = Math.random, regionData = null, regionAt = null) {
        const ids = Object.keys(bosses).map(Number).filter(id => id !== 9999 && !bosses[id].specialBoss).sort((a, b) => a - b);
        const currentIndex = ids.indexOf(Number(state.currentBossId));
        const nextId = ids[Math.min(currentIndex + 1, ids.length - 1)];
        const candidates = nextBossCandidates(squares, state.currentBossSquareId, state.currentBossSquareId,
            state.players, regionData, regionAt);
        if (!nextId || !candidates.length) throw new Error("次のボスの出現場所を決められません。");
        state.previousBossSquareId = state.currentBossSquareId;
        state.currentBossSquareId = candidates[Math.floor(random() * candidates.length)].id;
        state.currentBossId = nextId;
        state.currentBossHP = Number(bosses[nextId].hp);
        state.bossFirstPlayerIndex = -1;
        state.bossRewardGiven = false;
        state.bossCounterEnabled = false;
    }

    function counter(state, bosses, squares, items) {
        const boss = bosses[state.currentBossId];
        if (!state.bossCounterEnabled || Number(state.activePlayerIndex) !== 0 || !boss || Number(state.currentBossId) === 9999) return null;
        const graph = new Map(squares.map(square => [Number(square.id), new Set()]));
        squares.forEach(square => (square.next || []).forEach(next => {
            if (!graph.has(Number(next))) return;
            graph.get(Number(square.id)).add(Number(next));
            graph.get(Number(next)).add(Number(square.id));
        }));
        const distances = new Map([[Number(state.currentBossSquareId), 0]]);
        const queue = [Number(state.currentBossSquareId)];
        for (let i = 0; i < queue.length; i += 1) {
            for (const next of graph.get(queue[i]) || []) {
                if (distances.has(next)) continue;
                distances.set(next, distances.get(queue[i]) + 1);
                queue.push(next);
            }
        }
        return state.players.map(player => {
            if (player.underground) return { name: player.name, distance: 0, damage: 0, reason: 'underground' };
            const job = Number(player.jobTurnsRemaining) > 0;
            const immune = (player.inventory || []).some(entry => entry && typeof entry === "object" && items[entry.id]?.effectType === "bossCounterImmunity");
            const reason = job ? "job" : immune ? "item" : null;
            const distance = distances.get(Number(player.position)) || 0;
            const damage = reason ? 0 : distance * Number(boss.counterDamage || 0);
            player.money = Number(player.money) - damage;
            return { name: player.name, distance, damage, reason };
        });
    }

    return { DAMAGE_MULTIPLIER, encounter, rewards, payRewards, nextBoss, counter, reachableSquares, distanceBetween, reachableBossSquares, nextBossCandidates };
});
