/* Browser lifecycle, resume choice and debounced camera checkpoints. No online saves. */
(function () {
    'use strict';
    let warned = false, session = null;
    function warn(error) {
        console.warn('[local save]', error);
        if (warned) return;
        warned = true;
        const note = document.createElement('div');
        note.setAttribute('role', 'status');
        note.textContent = '自動保存を利用できません。プレイは続けられますが、再読み込みすると進行が失われる場合があります。';
        note.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:100000;padding:10px;background:#382b16;color:white;font-size:14px';
        const close = document.createElement('button'); close.textContent = '閉じる'; close.onclick = () => note.remove(); note.append(close);
        document.body.append(note);
    }
    const saves = LocalMatchSave.controller({ store: LocalMatchSave.indexedDBStore(window.indexedDB),
        online: () => Boolean(window.onlineGame?.isOnline), onError: warn });
    function camera() {
        // The empty board's temporary coordinates must not replace the saved camera.
        if (document.querySelector('.game-container')?.inert) return null;
        const area = document.querySelector('.game-screen .map-area');
        return area ? { zoom: window.getMapZoomUI?.() ?? 0.8, left: area.scrollLeft, top: area.scrollTop } : null;
    }
    function choose(title, message, canResume) {
        const overlay = document.createElement('div'); overlay.className = 'local-resume-overlay';
        overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', title);
        overlay.style.cssText = 'position:fixed;inset:0;z-index:100001;display:grid;place-items:center;background:#000b;color:#fff';
        const box = document.createElement('div'); box.style.cssText = 'background:#203140;padding:24px;border:2px solid #d8b65f;border-radius:12px;max-width:440px;margin:20px';
        const heading = document.createElement('h2'); heading.textContent = title;
        const text = document.createElement('p'); text.textContent = message; box.append(heading, text); overlay.append(box); document.body.append(overlay);
        return new Promise(resolve => {
            for (const [label, value] of [...(canResume ? [['続きから再開', true]] : []), ['新しいゲーム', false]]) {
                const button = document.createElement('button'); button.textContent = label; button.style.cssText = 'padding:12px;margin:6px;font-size:16px';
                button.className = 'local-resume-button ' + (value ? 'local-resume-continue' : 'title-screen__setup-back');
                button.onclick = () => { overlay.remove(); resolve(value); }; box.append(button);
            }
            box.querySelector('button')?.focus();
        });
    }
    async function boot(resume) {
        const loading = document.createElement('div');
        loading.style.cssText = 'position:fixed;inset:0;z-index:100001;background:#101923;display:grid;place-items:center;color:white';
        loading.textContent = '保存データを確認しています…'; document.body.append(loading);
        let saved;
        try { saved = await saves.read(); }
        catch (error) {
            loading.remove();
            await choose('保存データから再開できません', error.message || '保存先を利用できません。', false);
            await saves.discard(); return;
        }
        loading.remove();
        if (!saved || saved.status !== 'unfinished' || window.onlineGame?.isOnline) return;
        const progress = saved.step.phase === 'ending' ? '終了演出の続き' : `${saved.state.currentTurn}ターン目・${saved.state.players[saved.state.currentPlayer].name}の手番`;
        const message = `${progress}\n最終保存：${new Date(saved.savedAt).toLocaleString('ja-JP')}`;
        if (!await choose('前回のゲームを再開しますか？', message, true)) { await saves.discard(); return; }
        try { await resume(saved); }
        catch (error) {
            console.error('[local resume]', error);
            await choose('保存データから再開できません', 'ゲームの状態を復元できませんでした。新しいゲームを開始できます。', false);
            await saves.discard(); window.location.reload();
        }
    }
    function attach(adapter, saved = null) {
        session?.dispose();
        let disposed = false, timer = 0;
        const area = document.querySelector('.game-screen .map-area');
        const checkpoint = (phase, details = {}) => {
            if (disposed || window.onlineGame?.isOnline) return;
            try { return saves.checkpoint(adapter.capture(), { phase, details }); }
            catch (error) { warn(error); }
        };
        const settled = () => {
            clearTimeout(timer);
            timer = window.setTimeout(() => { timer = 0; if (!disposed && camera()) saves.camera(camera()); }, 300);
        };
        area?.addEventListener('scroll', settled, { passive: true });
        // These are supplementary flushes of the last safe state, not live-state snapshots.
        const hide = () => { if (timer && camera()) { clearTimeout(timer); timer = 0; saves.camera(camera()); } };
        const visibility = () => { if (document.visibilityState === 'hidden') hide(); };
        window.addEventListener('pagehide', hide); document.addEventListener('visibilitychange', visibility);
        session = {
            checkpoint, pending: kind => saves.pending(kind), cameraChanged: settled,
            finish: () => { disposed = true; clearTimeout(timer); return saves.finish(); },
            flush: () => saves.flush(), snapshot: () => saves.snapshot(),
            dispose() { disposed = true; clearTimeout(timer); area?.removeEventListener('scroll', settled); window.removeEventListener('pagehide', hide); document.removeEventListener('visibilitychange', visibility); }
        };
        saves.start(adapter.capture(), { phase: 'ready', details: {} }, camera(), saved);
        window.localMatchSession = session;
        return session;
    }
    window.LocalMatchRecovery = { boot, attach, discard: () => saves.discard(), flush: () => saves.flush() };
})();
