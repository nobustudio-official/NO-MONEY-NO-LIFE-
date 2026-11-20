/* Local round orchestration; rendering never pays dividends. */
(function () {
    'use strict';
    let state;
    window.OfflineDividends = {
        history() { return state?.wealthHistory || []; },
        marketExponent() { return state?.marketExponent ?? 0; },
        marketKind() { return state?.marketKind ?? 'normal'; },
        marketOutcomeAt18() { return state?.marketOutcomeAt18 ?? null; },
        marketEventTurn() { return state?.marketEventTurn ?? null; },
        resetMarket() { if (state) resetMarketSeason(state); },
        settleFinal(players, turn) {
            if (!state || state.players !== players) this.reset(players);
            state.currentTurn = turn;
            if (turn % DIVIDEND_CYCLE === 0 && state.lastDividendTurn !== turn) {
                players.forEach(player => { if (!player.underground) player.money += calculateAssetDividend(player); });
                state.lastDividendTurn = turn;
            }
            resetMarketSeason(state);
            DividendHistory.recordRound(state, turn);
            return state.wealthHistory[state.wealthHistory.length - 1];
        },
        setMarketEventTurnFromBossDefeat(turn) {
            if (!state || state.marketEventTurn != null) return state?.marketEventTurn ?? null;
            state.marketEventTurn = marketEventTurnForBossDefeat(turn);
            return state.marketEventTurn;
        },
        setMarketOutcomeAt18(value) { if (state && ['boom', 'crash'].includes(value) && !state.marketOutcomeAt18) state.marketOutcomeAt18 = value; },
        reset(players) {
            state = { players, currentTurn: 0, lastDividendTurn: 0, marketOutcomeAt18:null, marketEventTurn:null, wealthHistory: [] };
            this.resetMarket();
            DividendHistory.recordRound(state, 0);
        },
        recordRound(players, turn) {
            if (!state || state.players !== players) this.reset(players);
            state.currentTurn = turn;
            if (turn % DIVIDEND_CYCLE !== 0) DividendHistory.recordRound(state, turn);
        },
        show(players, turn, refresh, complete, maxTurns = turn) {
            if (!state || state.players !== players) this.reset(players);
            state.currentTurn = turn;
            const dividends = players.map((p, playerIndex) => ({ playerIndex, dividend: p.underground ? 0 : calculateAssetDividend(p) }));
            const summary = { eventId: `offline:${Date.now()}:${turn}`, completedTurn: turn,
                stage: 'announcement', startedAt: Date.now(), lastPlaceVoice: Math.random() < 0.1 ? '3-2' : '3-1' };
            let completing = false;
            function render() {
                const displayedStage = summary.stage;
                const next = () => {
                    if (summary.stage !== displayedStage || completing) return;
                    if (summary.stage === 'announcement') {
                        dividends.forEach(d => { players[d.playerIndex].money += d.dividend; });
                        DividendHistory.recordRound(state, turn);
                        summary.presentation = DividendHistory.presentation(state, state.lastDividendTurn, dividends);
                        state.lastDividendTurn = turn;
                        summary.stage = 'dividend'; refresh();
                    } else if (summary.stage === 'dividend') summary.stage = 'assets';
                    else if (summary.stage === 'assets') summary.stage = 'history';
                    else if (summary.stage === 'history') summary.stage = 'leader';
                    else if (summary.stage === 'leader') summary.stage = 'last';
                    else if (summary.stage === 'last') {
                        const season = advanceMarketSeason(state, turn, turn >= maxTurns);
                        summary.stage = season ? 'market' : 'closing';
                        if (season) {
                            summary.marketSeason = season;
                            refresh();
                        }
                    }
                    else if (summary.stage === 'market') summary.stage = 'closing';
                    else {
                        if (completing) return;
                        completing = true;
                        complete(() => { DividendPresentation.close(); DividendPresentation.stopMusic(); });
                        return;
                    }
                    summary.startedAt = Date.now(); render();
                };
                DividendPresentation.show(summary, false, next);
            }
            render();
        }
    };
})();
