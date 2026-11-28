(function (root, factory) {
    const rules = factory();
    if (typeof module === 'object' && module.exports) module.exports = rules;
    else root.UndergroundRules = rules;
})(globalThis, function () {
    'use strict';

    const track = [[0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[4,2],[4,3],[4,4],[3,4],[2,4],[1,4],[0,4],[0,3],[0,2],[0,1]];
    track.push([2,1],[1,2],[2,2],[3,2],[2,3]);
    const neighbors = (position, previous = null) => {
        const point = track[position];
        if (!point) return [];
        return track.flatMap(([x,y], index) => index !== previous && Math.abs(x-point[0]) + Math.abs(y-point[1]) === 1 ? [index] : []);
    };
    function reachableRoutes(position, previous, steps) {
        let paths = [{ position, previous, route: [] }];
        for (let i = 0; i < steps; i++) {
            paths = paths.flatMap(path => neighbors(path.position, path.previous)
                .map(next => ({ position: next, previous: path.position, route: [...path.route, next] })));
        }
        const routes = new Map();
        for (const path of paths) {
            if (!routes.has(path.position)) routes.set(path.position, path.route);
        }
        return routes;
    }
    function reachable(position, previous, steps) {
        return [...reachableRoutes(position, previous, steps).keys()];
    }
    function movementHistory(flow, mine) {
        // Older checkpoints know only the last edge. Preserve that undo without
        // inventing an unknown starting square for a full movement reset.
        if (!Array.isArray(flow.moveHistory)) flow.moveHistory = flow.previousPosition == null
            ? [mine.position] : [flow.previousPosition, mine.position];
        return flow.moveHistory;
    }
    function canResetMove(flow) {
        return Array.isArray(flow?.moveHistory) && flow.moveHistory.length > 1
            && flow.moveHistory.length === flow.move - flow.remaining + 1;
    }
    function moveTo(flow, mine, target) {
        const history = movementHistory(flow, mine);
        flow.moveFrom = mine.position;
        if (target === history.at(-2)) { history.pop(); flow.remaining++; }
        else { history.push(target); flow.remaining--; }
        flow.previousPosition = history.at(-2) ?? null;
        mine.position = target;
        const from = track[flow.moveFrom], to = track[target];
        mine.direction = to[0] > from[0] ? 'right' : to[0] < from[0] ? 'left' : to[1] > from[1] ? 'down' : 'up';
        setStage(flow, 'moving');
    }
    const amounts = Array.from({ length: 8 }, (_, index) => (index + 2) * 10000);
    const amountWeights = [10, 10, 20, 30, 15, 5, 5, 5];
    const stake = 50000;
    const challengeThreshold = 110000;
    const threshold = 500000;
    const key = state => state.currentTurn + ':' + state.activePlayerIndex;
    const pick = (values, random) => values[Math.floor(random() * values.length)];
    const die = random => 1 + Math.floor(random() * 6);
    const total = dice => dice.reduce((sum, face) => sum + face, 0);
    function holdsMonopolizedBranch(player, shops) {
        const owned = new Set((player?.assets || []).map(Number));
        return Object.values(shops || {}).some(shop => Array.isArray(shop?.contents)
            && shop.contents.length > 0 && shop.contents.every(id => owned.has(Number(id))));
    }
    function rollPlayerDice(random) {
        // Uniformly choose from the 216 ordinary three-die outcomes except 6-6-6.
        let outcome = Math.min(214, Math.floor(random() * 215));
        const dice = [];
        for (let index = 0; index < 3; index++) {
            dice.push(outcome % 6 + 1);
            outcome = Math.floor(outcome / 6);
        }
        return dice;
    }
    const ownsImmunity = player => (player.inventory || []).some(item => Number(item?.id) === 12 && item.remainingUses > 0);

    function drawPenica(random = Math.random) {
        let roll = random() * 100;
        for (const [index, weight] of amountWeights.entries()) {
            if (roll < weight) return amounts[index];
            roll -= weight;
        }
        return amounts[amounts.length - 1];
    }

    function setStage(flow, stage) {
        flow.stage = stage;
        flow.step++;
    }

    function makeFlow(state, stage) {
        return state.undergroundFlow = { turnKey: key(state), step: (state.undergroundFlow?.step || 0) + 1, stage, playerIndex: state.activePlayerIndex };
    }

    function startTurn(state) {
        const player = state.players[state.activePlayerIndex];
        state.undergroundFlow = null;
        if (player.underground) {
            player.underground.turns++;
            makeFlow(state, 'roll');
        } else if (player.debtTurns > 0) {
            makeFlow(state, 'reminder');
        }
    }

    function selectAsset(state, index, context, lastStore, random) {
        const player = state.players[index];
        const held = (player.assets || []).map(Number).filter(id => Number(context.assets[id]?.price) > 0);
        const shops = Object.entries(context.shops).map(([id, shop]) => ({ id, contents: (shop.contents || []).map(Number) }));
        const owned = new Set(held);
        const protectedIds = new Set(shops.filter(shop => shop.contents.length && shop.contents.every(id => owned.has(id))).flatMap(shop => shop.contents));
        const unprotected = held.filter(id => !protectedIds.has(id));
        const pool = unprotected.length ? unprotected : held;
        if (!pool.length) return null;
        const previous = shops.find(shop => shop.id === lastStore);
        const sameShop = previous ? pool.filter(id => previous.contents.includes(id)) : [];
        const id = pick(sameShop.length ? sameShop : pool, random);
        const asset = context.assets[id];
        const basePrice = Number(asset.price);
        let paidPrice = player.assetAcquisitionPrices?.[id];
        if (paidPrice === undefined) {
            for (const purchase of player.purchaseHistory || []) {
                if (Number(purchase?.assetId) === id) paidPrice = purchase.price;
            }
        }
        const price = Number.isFinite(paidPrice) && paidPrice >= 0 ? paidPrice : basePrice;
        const payout = context.marketPrice?.(basePrice / 2, state.marketExponent ?? 0) ?? Math.floor(basePrice / 2);
        return { id, name: asset.name, price, payout, store: shops.find(shop => shop.contents.includes(id))?.id };
    }

    function applyNextSale(state, flow, context, random) {
        const player = state.players[flow.playerIndex];
        if (player.money >= 0) return setStage(flow, 'solvent');
        const asset = selectAsset(state, flow.playerIndex, context, flow.lastStore, random);
        if (!asset) return setStage(flow, 'unsold');
        flow.sales.push(asset);
        flow.lastStore = asset.store;
        player.assets = player.assets.filter(id => Number(id) !== asset.id);
        state.assetOwners[asset.id] = null;
        player.money += asset.payout;
        setStage(flow, 'sale');
    }

    function nextSettlement(state, flow) {
        if (flow.queue.length) {
            flow.playerIndex = flow.queue.shift();
            flow.sales = [];
            flow.lastStore = null;
            return setStage(flow, 'selling');
        }
        const player = state.players[state.activePlayerIndex];
        flow.playerIndex = state.activePlayerIndex;
        if (flow.hadDebt) {
            if (player.money >= 0) {
                player.debtTurns = 0;
                return setStage(flow, 'repaid');
            }
            if (--player.debtTurns === 0) {
                player.money = 0;
                return setStage(flow, 'default');
            }
        }
        setStage(flow, 'done');
    }

    function endTurn(state) {
        if (state.undergroundFlow?.turnKey === key(state)) return state.undergroundFlow.stage === 'done';
        const player = state.players[state.activePlayerIndex];
        const queue = state.players.flatMap((candidate, index) =>
            candidate.money < 0 && !candidate.underground && !candidate.debtTurns ? [index] : []);
        if (!queue.length && !player.debtTurns) return true;
        const flow = makeFlow(state, 'settlement');
        flow.queue = queue;
        flow.hadDebt = player.debtTurns > 0;
        nextSettlement(state, flow);
        return flow.stage === 'done';
    }

    function finishWork(flow, player) {
        const mine = player.underground;
        if (mine.penica >= threshold) {
            return finishMineTurn(flow, mine, 'release');
        }
        if (player.undergroundForemanSetCompleted) {
            return finishMineTurn(flow, mine);
        }
        if (mine.penica >= challengeThreshold) {
            if (!mine.introduced) {
                mine.introduced = true;
                flow.page = 0;
                return setStage(flow, 'foreman');
            }
            return setStage(flow, 'offer');
        }
        finishMineTurn(flow, mine);
    }

    function finishMineTurn(flow, mine, nextStage = 'done') {
        if (flow.memoPickupPending && !mine.memo) {
            flow.memoPickupPending = false;
            flow.afterMemo = nextStage;
            delete mine.memoTile;
            delete mine.memoGlowStartedAt;
            flow.page = 0;
            return setStage(flow, 'memo');
        }
        setStage(flow, nextStage);
    }

    function foremanReward(state, player, context) {
        const firstPlaceAssets = Math.max(0, ...state.players.map(candidate => context.totalAssets(candidate,state)));
        const undergroundAssets = context.totalAssets(player,state);
        // Equivalent to (firstPlaceAssets * 0.8 - undergroundAssets) * 10,
        // keeping the G-to-penica conversion exact for integer G balances.
        return Math.max(1000000, firstPlaceAssets * 8 - undergroundAssets * 10);
    }

    function act(state, request, context, random = Math.random) {
        const flow = state.undergroundFlow;
        if (!flow || request.turnKey !== key(state) || request.step !== flow.step || request.stage !== flow.stage) return false;
        const player = state.players[flow.playerIndex];
        const mine = player.underground;
        const action = request.action;
        if (flow.stage === 'returnImmunity') {
            if (action !== 'immunitySoundComplete') return false;
            player.disadvantageImmunityActive = true;
            player.disadvantageImmunityTurnKey = key(state);
            setStage(flow, 'returnImmunityNotice');
            return true;
        }
        if (flow.stage === 'offer') {
            if (action === 'decline') setStage(flow, 'declined');
            else if (action === 'challenge' && mine.penica >= challengeThreshold) {
                mine.penica -= stake;
                flow.retry = true;
                flow.playerDice = flow.foremanDice = null;
                setStage(flow, 'paid');
            } else return false;
            return true;
        }
        if (flow.stage === 'choose' && /^destination:\d+$/.test(action)) {
            const route = reachableRoutes(mine.position, flow.previousPosition ?? null, flow.remaining).get(Number(action.slice('destination:'.length)));
            if (!route?.length) return false;
            const [first, ...remaining] = route;
            if (remaining.length) flow.route = remaining;
            moveTo(flow, mine, first);
            return true;
        }
        if (flow.stage === 'choose' && action === 'resetMove') {
            if (!canResetMove(flow)) return false;
            flow.moveFrom = mine.position;
            mine.position = flow.moveHistory[0];
            flow.moveHistory = [mine.position];
            flow.remaining = flow.move;
            flow.previousPosition = null;
            delete flow.route;
            setStage(flow, 'moving');
            return true;
        }
        if (flow.stage === 'choose' && (action === 'clockwise' || action === 'counterclockwise' || /^target:\d+$/.test(action))) {
            const choices = neighbors(mine.position);
            const ringTarget = (mine.position + (action === 'clockwise' ? 1 : 15)) % 16;
            const target = action.startsWith('target:') ? Number(action.slice(7)) : ringTarget;
            if (!choices.includes(target) || flow.remaining <= 0) return false;
            moveTo(flow, mine, target);
            return true;
        }
        if (action !== 'next') return false;
        switch (flow.stage) {
        case 'reminder': state.undergroundFlow = null; break;
        case 'selling': case 'sale': applyNextSale(state, flow, context, random); break;
        case 'unsold': player.debtTurns = 3; setStage(flow, 'debt'); break;
        case 'solvent': case 'debt': nextSettlement(state, flow); break;
        case 'repaid': setStage(flow, 'done'); break;
        case 'default': setStage(flow, 'labour'); break;
        case 'labour':
            player.underground = { penica: 0, position: 0, turns: 0 };
            player.inventory = [];
            player.jobTurnsRemaining = player.jobReward = 0;
            player.skipTurn = false;
            setStage(flow, 'confiscated');
            break;
        case 'confiscated': flow.page = 0; setStage(flow, 'guard'); break;
        case 'guard':
            if (++flow.page === 4) setStage(flow, 'done');
            else setStage(flow, 'guard');
            break;
        case 'roll':
            setStage(flow, 'rolling');
            break;
        case 'rolling':
            flow.move = die(random);
            flow.remaining = flow.move;
            flow.previousPosition = null;
            flow.moveHistory = [mine.position];
            delete flow.route;
            setStage(flow, 'diceResult');
            break;
        case 'diceResult': setStage(flow, 'choose'); break;
        case 'moving':
            if (flow.route?.length) {
                moveTo(flow, mine, flow.route.shift());
                if (!flow.route.length) delete flow.route;
            } else setStage(flow, flow.remaining ? 'choose' : 'slot');
            break;
        case 'slot': flow.amount = drawPenica(random); setStage(flow, 'slotStop'); break;
        case 'slotStop': mine.penica += flow.amount; setStage(flow, 'earned'); break;
        case 'earned':
            flow.memoPickupPending = !mine.memo && mine.memoTile === mine.position;
            finishWork(flow, player);
            break;
        case 'foreman':
            if (++flow.page === 6) setStage(flow, 'offer');
            else setStage(flow, 'foreman');
            break;
        case 'declined':
            if (mine.hasLost && mine.turns > (mine.lostAtTurn ?? -1) && !mine.memo && mine.memoTile == null) {
                mine.memoTile = (mine.position < 16 ? mine.position + 2 + Math.floor(random() * 4) : Math.floor(random() * 16)) % 16;
                mine.memoGlowStartedAt = Date.now();
            }
            finishMineTurn(flow, mine);
            break;
        case 'paid': setStage(flow, 'duel'); break;
        case 'duel': setStage(flow, 'playerRolling'); break;
        case 'playerRolling':
            flow.playerDice = rollPlayerDice(random);
            setStage(flow, 'playerResult');
            break;
        case 'playerResult': {
            const candidates = [];
            const score = total(flow.playerDice);
            for (let a = 4; a <= 6; a++) for (let b = 4; b <= 6; b++) for (let c = 4; c <= 6; c++) {
                if (a + b + c >= 15 && a + b + c > score) candidates.push([a,b,c]);
            }
            flow.foremanDice = pick(candidates, random);
            setStage(flow, 'foremanRolling');
            break;
        }
        case 'foremanRolling':
            if (mine.memo) {
                flow.amount = foremanReward(state, player, context);
                flow.victory = true;
                setStage(flow, 'interrupt');
            } else setStage(flow, 'duelResult');
            break;
        case 'duelResult':
            if (mine.memo) {
                flow.amount = foremanReward(state, player, context);
                flow.victory = true;
                setStage(flow, 'cheat');
            } else {
                mine.hasLost = true;
                mine.lostAtTurn = mine.turns;
                setStage(flow, 'lostTaunt');
            }
            break;
        case 'lostTaunt': setStage(flow, 'lost'); break;
        case 'lost':
            if (mine.penica >= challengeThreshold) setStage(flow, 'offer');
            else finishMineTurn(flow, mine);
            break;
        case 'memo':
            if (++flow.page === 1) mine.memo = true;
            setStage(flow, flow.page === 4 ? flow.afterMemo || 'done' : 'memo');
            break;
        case 'interrupt': setStage(flow, 'cheat'); break;
        case 'cheat': flow.page = 0; setStage(flow, 'confession'); break;
        case 'confession':
            if (++flow.page >= 5) setStage(flow, 'exposed');
            else setStage(flow, 'confession');
            break;
        case 'exposed': mine.penica += flow.amount; setStage(flow, 'won'); break;
        case 'won': finishMineTurn(flow, mine, 'release'); break;
        case 'release':
            if (!flow.releaseFinal) { flow.releaseFinal = true; setStage(flow, 'release'); break; }
            flow.amount = Math.floor(mine.penica / 10);
            player.money = flow.amount;
            player.position = context.startSquare;
            player.direction = 'down';
            flow.memoDropped = Boolean(mine.memo);
            if (flow.victory) player.undergroundForemanSetCompleted = true;
            player.underground = null;
            flow.returnItems = [1];
            flow.returnItemIndex = 0;
            player.undergroundReturned = true;
            setStage(flow, 'returned');
            break;
        case 'returned':
            if (flow.memoDropped) { setStage(flow, 'memoDropped'); break; }
            // Fall through to the first return item when there is no memo to announce.
        case 'memoDropped':
        case 'returnItem': {
            const id = flow.returnItems?.[flow.returnItemIndex++];
            if (!id) {
                setStage(flow, flow.victory ? 'returnImmunity' : 'done');
                break;
            }
            player.inventory.push(id === 12 ? { id:12, acquiredTurn:state.currentTurn, remainingUses:6 } : id);
            flow.returnItem = id;
            setStage(flow, 'returnItem');
            break;
        }
        case 'returnImmunityNotice': setStage(flow, 'done'); break;
        default: return false;
        }
        return true;
    }

    return { act, startTurn, endTurn, track, neighbors, reachable, canResetMove, amounts, drawPenica, stake, total, ownsImmunity, holdsMonopolizedBranch };
});
