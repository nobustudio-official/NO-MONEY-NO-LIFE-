/* Display selection only. Never calculates dividends or changes ownership. */
(function (root, factory) {
  const rules = factory();
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else root.DividendSelection = rules;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  function selectFeaturedPurchase(purchases, previousDividendTurn, completedTurn) {
    return (purchases || []).reduce((best, purchase) => {
      if (purchase.turn <= previousDividendTurn || purchase.turn > completedTurn) return best;
      if (!best) return purchase;
      for (const key of ['price', 'yield', 'turn', 'sequence']) {
        const difference = Number(purchase[key] || 0) - Number(best[key] || 0);
        if (difference !== 0) return difference > 0 ? purchase : best;
      }
      return best;
    }, null);
  }
  return { selectFeaturedPurchase };
});
