(function (root, factory) {
    const rules = factory();
    if (typeof module === 'object' && module.exports) module.exports = rules;
    else root.EndingRaceRules = rules;
})(globalThis, function () {
    'use strict';
    const pauseDuration = 2.4;
    const historyDuration = 12, historyDistance = .4, historySpread = .05;
    // Match the demo's 0.14 viewport-width/second base pace even through the
    // slowest history segment. A longer course preserves the fixed finish times.
    const courseLengthInViews = .14 * historyDuration / (historyDistance - historySpread);

    // One pause per distinct final total. Entries retain player order, while
    // groups are ordered by wealth; equal totals share a finish and a rank.
    function createSchedule(totals) {
        const ordered = totals.map((total, playerIndex) => ({ total:Number(total), playerIndex }))
            .sort((a, b) => b.total - a.total || a.playerIndex - b.playerIndex);
        const high = ordered[0]?.total ?? 0, low = ordered.at(-1)?.total ?? high;
        const entries = [], groups = [];
        ordered.forEach((entry, index) => {
            let group = groups.at(-1);
            if (!group || group.total !== entry.total) {
                const runningTime = high === low ? 20 : 20 + 3 * (high - entry.total) / (high - low);
                group = { total:entry.total, rank:index + 1, playerIndices:[],
                    finishTime:runningTime, wallFinishTime:runningTime + groups.length * pauseDuration };
                groups.push(group);
            }
            group.playerIndices.push(entry.playerIndex);
            entries[entry.playerIndex] = { ...entry, rank:group.rank, groupIndex:groups.length - 1,
                finishTime:group.finishTime, wallFinishTime:group.wallFinishTime };
        });
        return { entries, groups, duration:(groups.at(-1)?.wallFinishTime ?? 0) + pauseDuration };
    }

    function scheduleFor(value) {
        // A count remains convenient for evenly spaced fixtures. Production
        // supplies actual final totals, including ties and negative balances.
        if (typeof value === 'number') return createSchedule(Array.from({length:value}, (_, index) => value - index));
        return Array.isArray(value) ? createSchedule(value) : value;
    }

    function finishTime(index, input) {
        return scheduleFor(input).entries[index].finishTime;
    }

    function wallFinishTime(index, input) {
        return scheduleFor(input).entries[index].wallFinishTime;
    }

    function duration(input) {
        return scheduleFor(input).duration;
    }

    function sample(elapsed, input) {
        const schedule = scheduleFor(input);
        let finishedCount = 0;
        let spotlightRank = -1;
        let spotlightElapsed = 0;
        for (let rank = 0; rank < schedule.groups.length; rank++) {
            const crossing = schedule.groups[rank].wallFinishTime;
            if (elapsed >= crossing + pauseDuration) finishedCount++;
            else if (elapsed >= crossing) {
                spotlightRank = rank;
                spotlightElapsed = elapsed - crossing;
                break;
            } else break;
        }
        return { finishedCount, spotlightRank, spotlightElapsed,
            runningTime:Math.max(0, elapsed - finishedCount * pauseDuration - spotlightElapsed) };
    }

    // Integrate modest speed changes from the real asset history. The normalized
    // distance always reaches the finish at the assigned running time.
    function createMotion(history) {
        const changes = history.slice(1).map((value, index) => Number(value) - Number(history[index]));
        if (!changes.length) return progress => Math.max(0, Math.min(1, progress));
        const largestChange = Math.max(1, ...changes.map(Math.abs));
        const weights = changes.map(change => 1 + .12 * change / largestChange);
        const cumulative = [0];
        weights.forEach(weight => cumulative.push(cumulative.at(-1) + weight));
        return progress => {
            const position = Math.max(0, Math.min(1, progress)) * weights.length;
            const segment = Math.min(weights.length - 1, Math.floor(position));
            return (cumulative[segment] + weights[segment] * (position - segment)) / cumulative.at(-1);
        };
    }

    // Replay the actual history together, so relative positions at each history
    // point agree with the chart. Leave the final stretch for the fixed finishes.
    function createRaceMotion(histories) {
        const count = Math.max(1, ...histories.map(history => history.length));
        const segments = Math.max(1, count - 1), amplitude = historySpread / segments;
        const points = Array.from({length:count}, (_, point) => {
            const values = histories.map(history => Number(history[point] ?? history.at(-1) ?? 0));
            const low = Math.min(...values), range = Math.max(...values) - low;
            const progress = point / segments;
            return values.map(value => historyDistance * progress + amplitude * Math.min(1, progress * segments) * (range ? (value - low) / range : .5));
        });
        return (index, runningTime, finishAt) => {
            if (count < 2) return Math.max(0, Math.min(1, runningTime / finishAt));
            if (runningTime >= historyDuration) {
                const start = points.at(-1)[index];
                return start + (1 - start) * Math.max(0, Math.min(1, (runningTime - historyDuration) / (finishAt - historyDuration)));
            }
            const position = Math.max(0, runningTime / historyDuration) * segments;
            const point = Math.min(segments - 1, Math.floor(position));
            return points[point][index] + (points[point + 1][index] - points[point][index]) * (position - point);
        };
    }

    return Object.freeze({ pauseDuration, courseLengthInViews, createSchedule, finishTime, wallFinishTime, duration, sample, createMotion, createRaceMotion });
});
