(function (root, factory) {
    const rules = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = rules;
    else root.GuidebookRules = rules;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const ITEM_ID = 30, MIN_PRICE = 30000, PRICE_STEP = 5000, TURNS = 3, REQUEST_TURNS = 2;
    const isBook = entry => Number(typeof entry === 'object' ? entry?.id : entry) === ITEM_ID;
    const bookIndex = player => (player?.inventory || []).findIndex(isBook);
    const turnKey = state => state.currentTurn + ':' + state.activePlayerIndex;
    const remainingTurns = book => book?.remaining ? Math.max(...book.remaining) : null;
    const maxPrice = player => Math.floor(Number(player.money) / PRICE_STEP) * PRICE_STEP;
    const canReceive = state => state.bossDefeatedCount === 1 && !state.guidebook;
    const hasOffer = (book, index) => book?.offers?.some(offer => offer.buyer === index);

    function claim(state, index) {
        const player = state.players[index];
        if (!player || !canReceive(state) || bookIndex(player) >= 0) return false;
        (player.inventory ||= []).push(ITEM_ID);
        if (Array.isArray(state.guidebookHistory)) state.guidebookHistory[index] = true;
        state.guidebook = { ownerIndex: index, remaining: null, offers: [], view: null, lastEndedTurn: null };
        return true;
    }

    function canApply(state) {
        const book = state.guidebook, index = state.activePlayerIndex;
        return Boolean(book?.requestRemaining?.[index] > 0 && book.ownerIndex != null && book.ownerIndex !== index
            && !book.view && !hasOffer(book, index) && !state.players[index]?.underground
            && !state.players[index]?.skipTurn && !state.players[index]?.jobTurnsRemaining);
    }

    function refundOffers(state, accepted = null) {
        const book = state.guidebook;
        if (!book?.offers.length) return 0;
        let refundedCount = 0;
        for (const offer of book.offers) {
            if (offer !== accepted && offer.prepaid) {
                state.players[offer.buyer].money += offer.amount;
                refundedCount += 1;
            }
        }
        book.offers = [];
        return refundedCount;
    }

    function clearIfConfiscated(state) {
        const book = state.guidebook;
        if (book?.ownerIndex == null || bookIndex(state.players[book.ownerIndex]) >= 0) return null;
        const cancellation = book.remaining ? {
            ownerIndex: book.ownerIndex,
            refunds: book.offers.filter(offer => offer.prepaid).map(offer => ({ buyer: offer.buyer, amount: offer.amount }))
        } : null;
        book.ownerIndex = null;
        refundOffers(state);
        book.remaining = null;
        book.requestRemaining = null;
        book.view = null;
        return cancellation;
    }

    function withdrawUnfunded(state) {
        const book = state.guidebook;
        if (!book?.offers.length) return false;
        const withdrawn = book.offers.filter(offer => !offer.prepaid && state.players[offer.buyer].money < offer.amount);
        if (!withdrawn.length) return false;
        (book.withdrawals ||= []).push(...withdrawn.map(offer => offer.buyer));
        book.offers = book.offers.filter(offer => !withdrawn.includes(offer));
        if (book.view?.kind === 'offers' && !book.offers.length) book.view = null;
        return true;
    }

    function beginTurn(state) {
        const book = state.guidebook;
        if (!book || book.view) return;
        const index = Number(state.activePlayerIndex), player = state.players[index];
        if (book.ownerIndex === index && book.offers.length) {
            book.view = { kind: 'offers' };
            return;
        }
        const key = turnKey(state);
        if (book.ownerIndex !== index && book.requestRemaining?.[index] === 1
            && book.lastChanceTurnKey !== key && !hasOffer(book, index)
            && !player?.underground && !player?.skipTurn && !player?.jobTurnsRemaining) {
            book.lastChanceTurnKey = key;
            book.view = { kind: 'last-chance' };
        }
    }

    function endTurn(state) {
        const book = state.guidebook;
        if (!book?.remaining || book.ownerIndex == null || book.lastEndedTurn === turnKey(state)) return false;
        book.lastEndedTurn = turnKey(state);
        book.remaining[state.activePlayerIndex] = Math.max(0, book.remaining[state.activePlayerIndex] - 1);
        if (book.requestRemaining) book.requestRemaining[state.activePlayerIndex] = Math.max(0, Number(book.requestRemaining[state.activePlayerIndex]) - 1);
        if (remainingTurns(book) > 0) return false;
        const owner = book.ownerIndex, index = bookIndex(state.players[owner]);
        if (index >= 0) state.players[owner].inventory.splice(index, 1);
        book.ownerIndex = null;
        refundOffers(state);
        book.view = { kind: 'expired', owner };
        return true;
    }

    function act(state, action, payload = {}) {
        const book = state.guidebook, index = state.activePlayerIndex, player = state.players[index];
        if (!book || !player) return false;
        const view = book.view;
        if (action === 'read') {
            if (view || book.ownerIndex !== index || bookIndex(player) < 0 || player.itemSealedThisTurn || player.underground) return false;
            book.view = { kind: 'reading' };
        } else if (action === 'offer') {
            if (!canApply(state)) return false;
            book.view = { kind: 'offer' };
        } else if (action === 'cancelOffer') {
            if (view?.kind !== 'offer') return false;
            book.view = null;
        } else if (action === 'apply') {
            const { amount } = payload;
            if (view?.kind !== 'offer' || !Number.isSafeInteger(amount) || amount < MIN_PRICE
                || amount > maxPrice(player) || amount % PRICE_STEP !== 0) return false;
            player.money -= amount;
            book.offers.push({ buyer: index, amount, prepaid: true });
            book.view = { kind: 'applied', amount };
        } else if (action === 'sell' || action === 'reject') {
            if (view?.kind !== 'offers' || book.ownerIndex !== index) return false;
            if (action === 'sell') {
                const offer = book.offers.find(row => row.buyer === payload.buyer);
                const buyer = offer && state.players[offer.buyer], item = bookIndex(player);
                if (!buyer || item < 0 || (!offer.prepaid && buyer.money < offer.amount)) return false;
                player.money += offer.amount;
                if (!offer.prepaid) buyer.money -= offer.amount;
                player.inventory.splice(item, 1);
                (buyer.inventory ||= []).push(ITEM_ID);
                if (Array.isArray(state.guidebookHistory)) state.guidebookHistory[offer.buyer] = true;
                book.ownerIndex = offer.buyer;
                const refundedCount = refundOffers(state, offer);
                book.view = { kind: 'sold', seller: index, buyer: offer.buyer, amount: offer.amount, refundedCount, page: 0 };
            } else {
                const refundedCount = refundOffers(state);
                book.view = { kind: 'rejected', refundedCount, page: 0 };
            }
        } else if (action === 'next') {
            if (!view || payload.view !== view.kind || view.kind === 'offer' || view.kind === 'offers'
                || (view.kind === 'sold' && payload.page !== view.page)) return false;
            if (view.kind === 'reading' && !book.remaining) {
                book.remaining = state.players.map(() => TURNS);
                book.requestRemaining = state.players.map(() => REQUEST_TURNS);
                book.view = { kind: 'intro' };
            } else if (view.kind === 'sold' && view.page === 0) view.page = 1;
            else if (view.kind === 'sold' && view.page === 1 && Number(view.refundedCount) > 0) view.page = 2;
            else if (view.kind === 'rejected' && view.page === 0 && Number(view.refundedCount) > 0) view.page = 1;
            else book.view = null;
        } else return false;
        return true;
    }

    return Object.freeze({ ITEM_ID, MIN_PRICE, PRICE_STEP, REQUEST_TURNS, isBook, canReceive, claim, canApply,
        remainingTurns, maxPrice, clearIfConfiscated, withdrawUnfunded, refundOffers, beginTurn, endTurn, act });
});
