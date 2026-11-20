/* Shared whole-sprite choreography. Rendering never changes gameplay values. */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.BattleMotion = api;
})(typeof window === "undefined" ? globalThis : window, function (root) {
    "use strict";

    const effects = root.BattleEffects || (typeof require === "function" ? require("./battle-effects") : null);

    const timings = Object.freeze({ player: { duration: 1000, impact: 460 }, enemy: { duration: 860, impact: 330 } });
    const darkChainTiming = Object.freeze({ duration: 1500, impact: 790, release: 500 });

    function timingFor(magicId, actor = "player") {
        if (actor === "player" && Number(magicId) === 4) return darkChainTiming;
        if (actor === "player" && effects) return effects.getTiming(magicId) || timings.player;
        return timings[actor] || timings.player;
    }
    const playerSprites = Object.freeze({
        1: "戦士", 2: "めぐみ", 3: "聖職者", 4: "剣士", 5: "騎士", 6: "魔術師",
        8: "看護師", 9: "獣人", 10: "エルフ", 11: "義賊"
    });

    function playerSprite(characterId) {
        const name = playerSprites[Number(characterId)];
        return name ? { name, src: `images/characters/player/back/${name}-back.webp` } : null;
    }

    function createCue(battle, requestId, before, now = Date.now()) {
        const actor = battle.lastAction === "castMagic" ? "player" : battle.lastAction === "enemyCounter" ? "enemy" : null;
        if (!actor || (actor === "player" && battle.phase === "waitDefeat")) return null;
        return {
            id: requestId, sequence: battle.actionSequence, actor,
            magicId: actor === "player" ? battle.selectedMagicId : null,
            damage: Math.max(0, Number(actor === "player" ? battle.lastDamage : battle.lastEnemyDamage) || 0),
            startedAt: now + 120, ...timingFor(actor === "player" ? battle.selectedMagicId : null, actor), before
        };
    }

    function create(popup) {
        let current = null, destroyed = false;
        const seen = new Set();
        const sounds = new Set();
        const reduced = () => Boolean(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
        const actionNode = actor => popup.querySelector(`[data-battle-actor="${actor}"] .battle-combatant-action`);
        const imageNode = actor => popup.querySelector(`[data-battle-actor="${actor}"] img`);

        function cancel() {
            sounds.forEach(sound => {
                if (root.GameSE) root.GameSE.stop(sound); else { sound.pause(); sound.currentTime = 0; }
            });
            sounds.clear();
            if (current) current.finish(true);
        }

        function playSound(src) {
            if (destroyed || !src || typeof root.Audio !== "function") return;
            const sound = new root.Audio(src);
            sounds.add(sound);
            const release = () => sounds.delete(sound);
            sound.addEventListener("ended", release, { once: true });
            sound.addEventListener("error", release, { once: true });
            (root.GameSE ? root.GameSE.playLocal(sound) : sound.play()).catch(release);
        }

        function play(options) {
            if (destroyed || (options.id && seen.has(options.id))) return Promise.resolve({ skipped: true });
            cancel();
            if (options.id) {
                seen.add(options.id);
                if (seen.size > 150) seen.delete(seen.values().next().value);
            }
            const actor = options.actor === "enemy" ? "enemy" : "player";
            const spellTiming = Number(options.magicId) === 4 && actor === "player"
                ? darkChainTiming : effects && effects.getTiming(options.magicId);
            const defaults = spellTiming || timings[actor];
            const duration = Number(options.duration) || defaults.duration;
            const impact = Number(options.impact) || defaults.impact;
            const spell = effects && effects.getSpell(options.magicId);
            const release = Number.isFinite(options.release) ? options.release
                : Math.max(0, impact - (spell ? spell.flightMs : 0));
            const start = Number(options.startedAt) || Date.now();
            const elapsed = Date.now() - start;
            const animations = [], timers = [], damageLabels = [];
            let resolve, effectPlayer = null, finished = false, impacted = false;
            const promise = new Promise(done => { resolve = done; });
            const job = { finish };
            current = job;
            popup.classList.add("battle-motion-playing");
            if (actor === "enemy") popup.classList.add("battle-enemy-acting");

            function animate(node, frames, ms, offset = elapsed, easing = "ease-in-out") {
                if (!node || typeof node.animate !== "function") return;
                try {
                    const animation = node.animate(frames, { duration: ms, fill: "both", easing });
                    animation.currentTime = Math.max(0, offset);
                    if (offset < 0) { animation.pause(); timers.push(root.setTimeout(() => { if (!finished) animation.play(); }, -offset)); }
                    animations.push(animation);
                } catch (error) { /* Timer-driven completion also works without Web Animations. */ }
            }

            function at(time, callback) {
                const wait = start + time - Date.now();
                if (wait <= 0) callback();
                else timers.push(root.setTimeout(() => { if (!finished) callback(); }, wait));
            }

            function applyImpact() {
                if (impacted || finished) return;
                impacted = true;
                try {
                    if (typeof options.onImpact === "function") options.onImpact();
                    if (finished) return;
                    const damage = typeof options.damage === "function" ? options.damage() : options.damage;
                    if (Number(damage) > 0) {
                        const target = actor === "player" ? "enemy" : "player";
                        const direction = target === "enemy" ? 1 : -1;
                        const hitElapsed = Math.max(0, Date.now() - start - impact);
                        const label = popup.querySelector(`[data-battle-damage="${target}"]`);
                        const image = imageNode(target);
                        if (label && image && typeof image.getBoundingClientRect === "function" && hitElapsed < duration - impact) {
                            const field = label.parentElement.getBoundingClientRect();
                            const bounds = image.getBoundingClientRect();
                            label.textContent = `−${Math.floor(Number(damage)).toLocaleString("ja-JP")}${target === "player" ? "G" : ""}`;
                            label.style.left = `${bounds.left - field.left + bounds.width / 2}px`;
                            label.style.top = `${bounds.top - field.top + bounds.height * .4}px`;
                            label.classList.add("is-visible");
                            damageLabels.push(label);
                            animate(label, [
                                { opacity: 1, transform: "translate(-50%, -50%)" },
                                { opacity: 1, transform: "translate(-50%, calc(-50% - 14px))", offset: .72 },
                                { opacity: 0, transform: "translate(-50%, calc(-50% - 24px))" }
                            ], duration - impact, hitElapsed);
                        }
                        const hitMotion = effects && effects.getSpell(options.magicId)?.hitMotion;
                        let hitDuration = duration - impact, hitEasing = "ease-in-out";
                        let hitFrames = [
                            { transform: "translate(0, 0) rotate(0deg)" },
                            { transform: `translate(${direction * 18}px, 3px) rotate(${direction * 5}deg)`, offset: .22 },
                            { transform: `translate(${direction * 7}px, 1px) rotate(${direction * 2}deg)`, offset: .55 },
                            { transform: "translate(0, 0) rotate(0deg)" }
                        ];
                        if (hitMotion === "launch-up") {
                            const unit = Math.max(10, (popup.querySelector(".battle-field")?.getBoundingClientRect().width || 400) * .025);
                            const lift = unit * 1.6, kick = unit * .65 * direction;
                            hitDuration = 520; hitEasing = "linear";
                            hitFrames = [
                                { transform: "translate(0,0) rotate(0deg)" },
                                { transform: `translate(${kick * .3}px,${-lift * .8}px) rotate(-4deg)`, offset: .14 },
                                { transform: `translate(${kick}px,${-lift}px) rotate(6deg)`, offset: .3 },
                                { transform: `translate(${kick * .7}px,${-lift * .25}px) rotate(2deg)`, offset: .6 },
                                { transform: "translate(0,2px) rotate(-1deg)", offset: .82 },
                                { transform: "translate(0,0) rotate(0deg)" }
                            ];
                        } else if (hitMotion === "shock-down") {
                            hitDuration = 480; hitEasing = "linear";
                            hitFrames = [
                                { transform: "translate(0,0) rotate(0deg)" },
                                { transform: "translate(-4px,9px) rotate(-3deg)", offset: .12 },
                                { transform: "translate(5px,6px) rotate(3deg)", offset: .25 },
                                { transform: "translate(-3px,3px) rotate(-2deg)", offset: .4 },
                                { transform: "translate(2px,0) rotate(1deg)", offset: .6 },
                                { transform: "translate(0,0) rotate(0deg)" }
                            ];
                        }
                        if (!reduced()) animate(actionNode(target), hitFrames, hitDuration, hitElapsed, hitEasing);
                        animate(imageNode(target), reduced() ? [{ opacity: 1 }, { opacity: .55 }, { opacity: 1 }] : [
                            { opacity: 1 }, { opacity: .25, offset: .15 }, { opacity: 1, offset: .32 },
                            { opacity: .25, offset: .48 }, { opacity: 1, offset: .66 }, { opacity: .45, offset: .80 }, { opacity: 1 }
                        ], duration - impact, hitElapsed);
                    }
                } catch (error) {
                    console.error("[battle-motion] 演出の反映に失敗:", error);
                    finish(true);
                }
            }

            function finish(cancelled) {
                if (finished) return;
                finished = true;
                timers.forEach(timer => root.clearTimeout(timer));
                animations.forEach(animation => animation.cancel());
                if (effectPlayer) effectPlayer.stop();
                damageLabels.forEach(label => { label.classList.remove("is-visible"); label.textContent = ""; });
                if (current === job) {
                    current = null;
                    popup.classList.remove("battle-motion-playing");
                    popup.classList.remove("battle-enemy-acting");
                }
                try { if (typeof options.onFinish === "function") options.onFinish({ cancelled: Boolean(cancelled) }); }
                finally { resolve({ cancelled: Boolean(cancelled) }); }
            }

            if (!reduced() && elapsed < duration) {
                const frames = actor === "player" ? [
                    { transform: "translate(0,0) rotate(0deg)" },
                    { transform: "translate(-7px,2px) rotate(-4deg)", offset: .32 },
                    { transform: "translate(13px,-3px) rotate(4deg)", offset: .50 },
                    { transform: "translate(6px,0) rotate(1deg)", offset: .72 },
                    { transform: "translate(0,0) rotate(0deg)" }
                ] : [
                    { transform: "translate(0,0) rotate(0deg)" },
                    { transform: "translate(5px,-1px) rotate(2deg)", offset: .18 },
                    { transform: "translate(-29px,10px) rotate(-4deg)", offset: .39 },
                    { transform: "translate(-10px,3px) rotate(-1deg)", offset: .68 },
                    { transform: "translate(0,0) rotate(0deg)" }
                ];
                animate(actionNode(actor), frames, timings[actor].duration);
            }
            if (!reduced() && elapsed < duration && effects) {
                try { effectPlayer = effects.create(popup, { ...options, actor, duration, impact, release, startedAt: start }); }
                catch (error) { console.error("[battle-effects] 演出を開始できません:", error); }
            }
            at(impact, applyImpact);
            if (!finished) at(duration, () => finish(false));
            return promise;
        }

        return { play, playSound, cancel, destroy() { destroyed = true; cancel(); seen.clear(); } };
    }

    return { timings, timingFor, playerSprite, createCue, create };
});
