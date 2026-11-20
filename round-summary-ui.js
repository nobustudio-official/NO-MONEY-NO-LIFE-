// Render server-confirmed round settlements through the existing game UI.
// This module never calculates or pays dividends and never changes ownership.
(function () {
    'use strict';
    const online = window.onlineGame;
    const sync = online && online.sync;
    if (!sync) return;
    let viewKey = null;
    let endingTurn = false;
    let previousPhase = null;
    let transitionPending = false;
    let pendingState = null;
    let closeAtBlack = false;
    const advancing = new Set();

    function refreshControls() {
        if (typeof window.refreshOnlineTurnControls === 'function') window.refreshOnlineTurnControls();
    }

    function clearSummaryPopup() {
        if (window.DividendPresentation) window.DividendPresentation.close();
        const popup = document.getElementById('eventPopup');
        if (!popup || !popup.dataset.onlineRoundSummaryKey) return;
        popup.style.display = 'none';
        delete popup.dataset.onlineRoundSummaryKey;
    }

    function advance(summary, expectedKey) {
        if (advancing.has(expectedKey) || String(summary.ownerId) !== String((online.playerId || online.socket.id))) return;
        advancing.add(expectedKey);
        const button = document.getElementById('eventPopupButton');
        if (button) button.disabled = true;
        return sync.advanceRound({ eventId: summary.eventId, stage: summary.stage, requestId: `${expectedKey}:next` }).then(function (response) {
            if (!response || !response.ok) throw new Error(response && response.error || '結果画面を進められませんでした。');
        }).catch(function (error) {
            if (window.DividendPresentation) {
                viewKey = null;
                renderState({ state: sync.state });
                return;
            }
            console.error('[online] 配当・ランキングの進行:', error);
            if (viewKey === expectedKey && button) {
                const popup = document.getElementById('eventPopup');
                if (popup) popup.style.display = 'block';
                button.textContent = '再試行';
                button.disabled = false;
            }
        }).finally(function () { advancing.delete(expectedKey); });
    }

    function renderState(payload) {
        const state = payload && payload.state;
        if (!online.isOnline || !state) return;
        const phase = state.matchPhase || 'playing';
        if (transitionPending) { pendingState = state; return; }
        const enteringSummary = phase === 'roundSummary' && previousPhase !== 'roundSummary';
        const enteringFinal = phase === 'finished' && previousPhase !== 'finished';
        if ((enteringSummary || enteringFinal) && previousPhase !== null && window.TurnHandoff && !window.TurnHandoff.isBlack()) {
            transitionPending = true;
            pendingState = state;
            const started = window.TurnHandoff.run(function () {
                const latest = pendingState;
                pendingState = null;
                transitionPending = false;
                previousPhase = phase;
                renderState({ state: latest });
            });
            if (!started) {
                setTimeout(function () {
                    const latest = pendingState;
                    pendingState = null;
                    transitionPending = false;
                    if (latest) renderState({ state: latest });
                }, 300);
            }
            return;
        }
        previousPhase = phase;
        if (state.matchPhase === 'finished') {
            const key = `finished:${state.completedTurns}`;
            if (viewKey === key) return;
            clearSummaryPopup();
            if (window.DividendPresentation) window.DividendPresentation.stopMusic();
            viewKey = key;
            window.showGameResult(state.finalRanking);
            refreshControls();
            return;
        }
        const summary = state.matchPhase === 'roundSummary' ? state.roundSummary : null;
        if (!summary) {
            if (!closeAtBlack) {
                clearSummaryPopup();
                if (window.DividendPresentation) window.DividendPresentation.stopMusic();
            }
            viewKey = null;
            return;
        }
        const key = `${summary.eventId}:${summary.stage}`;
        if (viewKey === key) return;
        viewKey = key;
        const popup = document.getElementById('eventPopup');
        if (popup) popup.classList.remove('boss-reward-popup', 'boss-reward-complete-popup', 'boss-counter-popup', 'boss-destination-popup', 'job-result-popup');
        const options = { sync: false, readOnly: String(summary.ownerId) !== String((online.playerId || online.socket.id)) };
        const next = function () { return advance(summary, key); };
        if (popup?.dataset.onlineRoundSummaryKey && window.DividendPresentation) {
            popup.style.display = 'none';
            delete popup.dataset.onlineRoundSummaryKey;
            window.CommonAnnouncements?.render(popup, null);
        }
        if (window.DividendPresentation) {
            window.DividendPresentation.show(summary, options.readOnly, next);
            refreshControls();
            return;
        }
        if (summary.stage === 'dividend') window.showDividendPopup(summary.dividends, next, options);
        else window.showAssetRankingPopup(next, summary.ranking, options);
        if (popup) popup.dataset.onlineRoundSummaryKey = key;
        refreshControls();
    }

    window.completeOnlineTurn = function (player) {
        const state = sync.state;
        if (!online.isOnline || !state || endingTurn || String(player.id) !== String((online.playerId || online.socket.id))) return;
        if (state.matchPhase && state.matchPhase !== 'playing') { renderState({ state }); return; }
        const owner = state.players[Number(state.activePlayerIndex)];
        if (!owner || String(owner.id) !== String((online.playerId || online.socket.id))) return;
        const turnKey = `${state.currentTurn}:${state.activePlayerIndex}`;
        endingTurn = true;
        window.onlineRoundFlowPending = true;
        refreshControls();
        if (typeof window.syncOnlineScreenView === 'function') window.syncOnlineScreenView('', player, 'close');
        window.publishOnlineGameState().then(function (published) {
            if (!published || !published.ok) throw new Error(published && published.error || 'ターン終了前の状態を同期できませんでした。');
            return sync.endTurn({ turnKey, requestId: `end:${state.roomCode}:${turnKey}` });
        }).then(function (response) {
            if (!response || !response.ok) throw new Error(response && response.error || 'ターンを終了できませんでした。');
        }).catch(function (error) {
            console.error('[online] ターン終了:', error);
            const latest = sync.state;
            if (latest && `${latest.currentTurn}:${latest.activePlayerIndex}` === turnKey
                && (!latest.matchPhase || latest.matchPhase === 'playing')) {
                if (latest.undergroundFlow?.stage === 'done' && latest.players[latest.activePlayerIndex]?.underground
                    && window.UndergroundUI) {
                    window.UndergroundUI.turnEndFailed(error.message, () => window.completeOnlineTurn(player));
                    return;
                }
                window.showEventPopup('ターン終了の通信エラー', error.message, function () {
                    window.completeOnlineTurn(player);
                }, { sync: false });
            }
        }).finally(function () {
            endingTurn = false;
            window.onlineRoundFlowPending = false;
            refreshControls();
        });
    };

    sync.on('recovery:before', function (frame) {
        if (['roundSummary', 'finished'].includes(frame.state?.matchPhase)) viewKey = null;
    });
    sync.on('turn:update', function () {
        if (previousPhase !== 'roundSummary' || !window.TurnHandoff) return;
        closeAtBlack = window.TurnHandoff.onBlack(function () {
            clearSummaryPopup();
            if (window.DividendPresentation) window.DividendPresentation.stopMusic();
            closeAtBlack = false;
        });
    });
    sync.on('state', renderState);
})();
