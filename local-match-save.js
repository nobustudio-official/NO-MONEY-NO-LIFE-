/* Local matches only. Each record is an atomic, reconstructible checkpoint. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.LocalMatchSave = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
    'use strict';
    const VERSION = 1;
    const PHASES = new Set(['ready', 'turn-start', 'movement', 'arrival', 'finish-turn',
        'notice', 'store', 'asset-store', 'dividend', 'guidebook', 'underground', 'ponzi', 'fukubukuro', 'hatataki', 'mugging', 'boss-choice', 'ending']);
    const copy = value => JSON.parse(JSON.stringify(value));
    const finite = value => typeof value === 'number' && Number.isFinite(value);
    const integer = value => Number.isInteger(value) && value >= 0;

    function validate(record) {
        if (!record || typeof record !== 'object') throw new Error('保存データを読み取れませんでした。');
        if (record.version !== VERSION) throw new Error('この保存データの形式には対応していません。');
        if (!['unfinished', 'finished', 'discarded'].includes(record.status) || typeof record.gameId !== 'string'
            || !record.gameId || !integer(record.revision) || !finite(record.savedAt)) throw new Error('保存情報が壊れています。');
        if (record.status !== 'unfinished') return record;
        const s = record.state, step = record.step;
        if (!s || !step || !PHASES.has(step.phase) || !Array.isArray(s.players) || s.players.length < 1 || s.players.length > 8
            || !Number.isInteger(s.maxTurns) || s.maxTurns < 1 || s.maxTurns > 300
            || !Number.isInteger(s.currentTurn) || s.currentTurn < 1 || s.currentTurn > s.maxTurns + 1
            || !integer(s.currentPlayer) || s.currentPlayer >= s.players.length
            || !s.boss || !s.flows || !s.dividends || !s.assetOwners || !s.world) throw new Error('対戦の保存データが壊れています。');
        for (const p of s.players) {
            if (!p || typeof p.name !== 'string' || !finite(p.money) || !finite(p.magicPower)
                || !integer(p.position) || !integer(p.characterId) || !Array.isArray(p.inventory)
                || !Array.isArray(p.magic) || !Array.isArray(p.assets)
                || !p.magic.every(integer) || !p.assets.every(integer)
                || !p.inventory.every(item => integer(item) || item && integer(item.id))) throw new Error('プレイヤー情報が壊れています。');
        }
        if (!integer(s.boss.id) || !finite(s.boss.hp) || !integer(s.boss.defeatedCount)
            || !integer(s.boss.squareId) || !integer(s.remainingSteps)) throw new Error('ゲームの進行情報が壊れています。');
        for (const [id, owner] of Object.entries(s.assetOwners)) {
            if (!integer(Number(id)) || owner != null && (!integer(owner) || owner >= s.players.length
                || !s.players[owner].assets.some(asset => Number(asset) === Number(id)))) throw new Error('資産の所有情報が壊れています。');
        }
        for (let i = 0; i < s.players.length; i++) {
            if (s.players[i].assets.some(id => s.assetOwners[id] !== i)) throw new Error('資産の所有情報が一致しません。');
        }
        if (step.phase === 'notice' && (!step.details || !['ready', 'finish-turn'].includes(step.details.next))) throw new Error('イベントの再開地点が壊れています。');
        if (step.phase === 'movement' && (!s.movement || !Array.isArray(s.movement.history)
            || !s.movement.active || !integer(s.movement.totalSteps) || !s.movement.history.length
            || !s.movement.history.every(integer))) throw new Error('移動の保存情報が壊れています。');
        if (step.phase === 'store' && !['item', 'magic'].includes(step.details?.kind)) throw new Error('店舗の保存情報が壊れています。');
        if (step.phase === 'asset-store' && (!Array.isArray(step.details?.assetIds) || !step.details.assetIds.every(integer))) throw new Error('資産店の保存情報が壊れています。');
        for (const phase of ['underground', 'ponzi', 'mugging', 'hatataki']) {
            if (step.phase === phase && (!s.flows[phase] || typeof s.flows[phase] !== 'object')) throw new Error('イベントの保存情報が壊れています。');
        }
        if (step.phase === 'hatataki' && !Array.isArray(s.flows.hatataki.offlineTargets)) throw new Error('アイテムの保存情報が壊れています。');
        if (step.phase === 'fukubukuro' && (!s.flows.fukubukuro || !['ready', 'rolling', 'result'].includes(s.flows.fukubukuro.status)
            || !Array.isArray(s.flows.fukubukuro.cards) || s.flows.fukubukuro.cards.length !== 6)) throw new Error('福袋の保存情報が壊れています。');
        if (step.phase === 'dividend' && (!s.dividends.pending?.summary
            || !Array.isArray(s.dividends.pending.dividends)
            || !['announcement', 'dividend', 'assets', 'history', 'leader', 'last', 'market', 'closing'].includes(s.dividends.pending.summary.stage))) throw new Error('配当の保存情報が壊れています。');
        if (step.phase === 'ending') {
            const ending = s.flows.ending;
            if (!ending || typeof ending.eventId !== 'string' || !ending.eventId || !finite(ending.startedAt)
                || !integer(ending.step) || ending.step > 7 || !Array.isArray(ending.ranking)
                || ending.ranking.length !== s.players.length
                || !ending.ranking.every(row => row && integer(row.playerIndex) && row.playerIndex < s.players.length
                    && typeof row.name === 'string' && finite(row.totalAsset))
                || new Set(ending.ranking.map(row => row.playerIndex)).size !== s.players.length
                || !Array.isArray(ending.history) || !ending.history.length
                || !ending.history.every(point => point && integer(point.turn) && Array.isArray(point.totals)
                    && point.totals.length === s.players.length && point.totals.every(finite))) throw new Error('終了演出の保存情報が壊れています。');
        } else if (s.flows.ending) throw new Error('終了演出の再開地点が一致しません。');
        if (record.camera && (!finite(record.camera.zoom) || record.camera.zoom <= 0
            || !finite(record.camera.left) || !finite(record.camera.top))) throw new Error('カメラの保存情報が壊れています。');
        return record;
    }

    function indexedDBStore(indexedDB, { timeout = 5000 } = {}) {
        let database;
        function open() {
            if (database) return database;
            database = new Promise((resolve, reject) => {
                if (!indexedDB) { reject(new Error('このブラウザでは自動保存を利用できません。')); return; }
                const request = indexedDB.open('no-money-no-life-local', 1);
                const timer = setTimeout(() => reject(new Error('自動保存の準備が完了しませんでした。')), timeout);
                request.onupgradeneeded = () => {
                    if (!request.result.objectStoreNames.contains('matches')) request.result.createObjectStore('matches');
                };
                request.onsuccess = () => { clearTimeout(timer); request.result.onversionchange = () => { request.result.close(); database = null; }; resolve(request.result); };
                request.onerror = () => { clearTimeout(timer); reject(request.error); };
                request.onblocked = () => { clearTimeout(timer); reject(new Error('別の画面が保存先を使用中です。')); };
            });
            database.catch(() => { database = null; });
            return database;
        }
        async function transaction(mode, operation) {
            const db = await open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('matches', mode), store = tx.objectStore('matches');
                let result;
                const timer = setTimeout(() => { try { tx.abort(); } catch (_) {} reject(new Error('自動保存が時間内に完了しませんでした。')); }, timeout);
                tx.oncomplete = () => { clearTimeout(timer); resolve(result); };
                tx.onabort = tx.onerror = () => { clearTimeout(timer); reject(tx.error || new Error('端末への保存に失敗しました。')); };
                operation(store, value => { result = value; });
            });
        }
        return {
            read: () => transaction('readonly', (store, done) => { const q = store.get('active'); q.onsuccess = () => done(q.result || null); }),
            write: (record, replace = false) => transaction('readwrite', (store, done) => {
                const q = store.get('active');
                q.onsuccess = () => {
                    const previous = q.result;
                    // An older tab must never resurrect a finished/discarded/new match.
                    if (!replace && previous && (previous.gameId !== record.gameId || previous.status !== 'unfinished'
                        || previous.revision >= record.revision)) { done(false); return; }
                    store.put(record, 'active'); done(true);
                };
            })
        };
    }

    function controller({ store, online = () => false, now = Date.now, id = () => globalThis.crypto?.randomUUID?.() || `local:${Date.now()}:${Math.random()}`, onError = () => {} }) {
        let record = null, chain = Promise.resolve(), active = false;
        function enqueue(value, replace = false) {
            const frozen = copy(value);
            const task = chain.then(() => store.write(frozen, replace));
            chain = task.catch(error => { onError(error); return false; });
            return chain;
        }
        return {
            async read() { const saved = await store.read(); return saved ? validate(saved) : null; },
            start(state, step = { phase: 'ready' }, camera = null, saved = null) {
                if (online()) return Promise.resolve(false);
                active = true;
                record = saved ? copy(validate(saved)) : { version: VERSION, status: 'unfinished', gameId: id(), revision: 0, savedAt: now(), state: copy(state), step: copy(step), camera };
                if (saved) return Promise.resolve(true);
                validate(record);
                return enqueue(record, true);
            },
            checkpoint(state, step) {
                if (!active || online()) return Promise.resolve(false);
                // Late turn/menu callbacks cannot replace the final settled result.
                if (record.step.phase === 'ending' && step.phase !== 'ending') return Promise.resolve(false);
                const next = { ...record, state: copy(state), step: copy(step), interruptedAction: null, revision: record.revision + 1, savedAt: now() };
                validate(next);
                record = next;
                return enqueue(record);
            },
            camera(camera) {
                if (!active || online() || !record) return Promise.resolve(false);
                // Never sample live game state here: an animation may be halfway through a payment.
                const next = { ...record, camera: copy(camera), revision: record.revision + 1, savedAt: now() };
                validate(next);
                record = next;
                return enqueue(record);
            },
            pending(kind) {
                if (!active || online() || !record) return Promise.resolve(false);
                if (record.step.phase === 'ending') return Promise.resolve(false);
                record = { ...record, interruptedAction: String(kind), revision: record.revision + 1, savedAt: now() };
                return enqueue(record);
            },
            finish() {
                if (!active || online()) return Promise.resolve(false);
                active = false;
                record = { version: VERSION, gameId: record.gameId, revision: record.revision + 1, savedAt: now(), status: 'finished' };
                return enqueue(record);
            },
            discard() {
                if (online()) return Promise.resolve(false);
                active = false;
                record = { version: VERSION, gameId: id(), revision: 0, savedAt: now(), status: 'discarded' };
                return enqueue(record, true);
            },
            snapshot: () => record && copy(record),
            flush: () => chain
        };
    }
    return { VERSION, validate, copy, indexedDBStore, controller };
});
