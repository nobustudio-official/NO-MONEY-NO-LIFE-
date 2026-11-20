/* Shared spell presentation settings. Server reads timings; browsers register
   painters from battle-effects/. No renderer may calculate gameplay results. */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.BattleEffects = api;
})(typeof window === "undefined" ? globalThis : window, function (root) {
    "use strict";

    const spells = Object.freeze({
        fire: Object.freeze({ name: "ファイア", magicId: 1, revision: 9, effect: "fire", effectName: "渦巻く火球とちぎれる炎",
            motion: null, flightMs: 420, tailMs: 650, size: 100, direction: "forward", angleOffsetDeg: 0, color: "#ff913c",
            castingColor: "#ff5140", castingInk: "#ffb2a6" }),
        ice: Object.freeze({ name: "ブリザド", magicId: 2, revision: 9, effect: "ice-pillars", effectName: "突き上げる氷晶と命中時の浮き上がり",
            motion: null, flightMs: 110, tailMs: 960, size: 100, color: "#8edfff",
            impactProgress: .46, hitMotion: "launch-up", imageOpacity: .85 }),
        thunder: Object.freeze({ name: "サンダー", magicId: 3, revision: 8, effect: "thunder-css", effectName: "上空から急落し横幅が中央へ収束する落雷",
            motion: null, flightMs: 140, tailMs: 930, size: 100, color: "#ffd43d",
            castingColor: "#ffd43d", castingInk: "#fff39a", hitMotion: "shock-down" }),
        meteor: Object.freeze({ name: "メテオ", magicId: 5, revision: 1, effect: "meteor-image", effectName: "炎と岩が画面外上方から飛来し爆風を起こす",
            motion: null, flightMs: 800, tailMs: 640, release: 360, size: 100, color: "#9a5a2a",
            castingColor: "#9a5a2a", castingInk: "#e7be83" }),
        spiffa: Object.freeze({ name: "スピッファ", magicId: 8, revision: 1, effect: "spiffa-css", effectName: "魔法陣全域から放つ白銀の連続光弾",
            motion: null, flightMs: 1670, tailMs: 154, release: 300, size: 100, color: "#2b3138",
            castingColor: "#2b3138", castingInk: "#d7e0e5" }),
        tornado: Object.freeze({ name: "トルネード", magicId: 10, revision: 1, effect: "tornado-image", effectName: "緑光から出現し中ほどで揺れて飛ぶ竜巻",
            motion: null, flightMs: 1000, tailMs: 520, release: 300, size: 100, color: "#78e7a0",
            castingColor: "#78e7a0", castingInk: "#dcffe4" })
    });
    const appRoot = root.document?.currentScript?.src ? new URL(".", root.document.currentScript.src).href : "";
    const effects = {};
    const spellById = new Map(Object.values(spells).map(spell => [spell.magicId, spell]));
    const getSpell = magicId => spellById.get(Number(magicId)) || null;
    const prepared = new WeakMap();
    const domEffects = {}, sprites = {};
    let assetsReady = null;

    function preload() {
        if (!assetsReady && typeof root.Image === "function") {
            const image = sprites.iceEruption = new root.Image();
            const images = [{ image, src: new URL("images/effects/battle/blizzard-ice-eruption-v2.webp", appRoot || root.location?.href).href }];
            for (const [key, path] of [["meteorFlame", "images/effects/battle/meteor-flame.webp"], ["meteorRock", "images/effects/battle/meteor-rock.webp"]]) {
                images.push({ image: sprites[key] = new root.Image(), src: new URL(path, appRoot || root.location?.href).href });
            }
            images.push({ image: sprites.tornado = new root.Image(), src: new URL("images/effects/battle/tornado-vortex.webp", appRoot || root.location?.href).href });
            assetsReady = Promise.all(images.map(({ image: asset, src }) => new Promise(resolve => {
                asset.onload = () => {
                    if (typeof asset.decode === "function") asset.decode().catch(() => {}).then(resolve);
                    else resolve();
                };
                asset.onerror = () => resolve();
                asset.src = src;
            })));
        }
        return assetsReady || Promise.resolve();
    }

    function canvasLayers(popup) {
        return [".battle-effects-layer", ".battle-casting-layer", ".battle-projectile-layer"].map(selector => {
            const canvas = popup.querySelector(selector);
            return canvas && { canvas, ctx: canvas.getContext("2d") };
        }).filter(layer => layer && layer.ctx);
    }

    function clearLayers(layers) {
        for (const { canvas, ctx } of layers) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    function paintFrame(layers, scene, time, spell, timing, ratio) {
        const ctx = layers[0].ctx, casting = (layers[1] || layers[0]).ctx;
        const projectile = (layers[2] || layers[0]).ctx;
        for (const layer of layers) { layer.ctx.setTransform(ratio, 0, 0, ratio, 0, 0); layer.ctx.save(); }
        try {
            if (spell.effect !== "ice-pillars" && api.paint?.castingCircle) {
                api.paint.castingCircle(casting, scene.from, scene.unit * spell.size / 100, time,
                    timing, spell.tailMs, spell.castingColor || spell.color, spell.castingInk);
            }
            const painter = effects[spell.effect];
            if (painter) painter(spell.effect === "fire" && time < timing.impact ? projectile : ctx,
                scene, time, spell, timing, { casting, sprites });
        } finally { for (const layer of layers) layer.ctx.restore(); }
    }

    function getTiming(magicId) {
        const spell = getSpell(magicId);
        if (!spell) return null;
        const release = Number.isFinite(spell.release) ? spell.release : 460, impact = release + spell.flightMs;
        return { release, impact, duration: Math.max(1000, impact + spell.tailMs) };
    }

    // Exercise the real Canvas and every painter before the first attack.
    // All drawing is cleared synchronously, so warm-up never becomes visible.
    function warm(popup) {
        const canvas = popup.querySelector(".battle-effects-layer"), field = popup.querySelector(".battle-field");
        if (!canvas || !field) return;
        const bounds = field.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const ratio = Math.min(2, root.devicePixelRatio || 1);
        const width = Math.round(bounds.width * ratio), height = Math.round(bounds.height * ratio);
        const previous = prepared.get(canvas);
        if (previous && previous.width === width && previous.height === height) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const layers = canvasLayers(popup);
        for (const layer of layers) { layer.canvas.width = width; layer.canvas.height = height; }
        const scene = { width: bounds.width, height: bounds.height, unit: Math.max(10, bounds.width * .025),
            from: { x: bounds.width * .26, y: bounds.height * .65 },
            to: { x: bounds.width * .77, y: bounds.height * .43 },
            targetGround: { x: bounds.width * .77, y: bounds.height * .7 } };
        try {
            for (const spell of Object.values(spells)) {
                const timing = getTiming(spell.magicId);
                let dom = null;
                try {
                    if (domEffects[spell.effect]) dom = domEffects[spell.effect]({ container: field, spell, timing, scene, reduced: false, warm: true });
                    for (const time of [timing.release / 2, timing.release + spell.flightMs / 2, timing.impact + 60]) {
                        paintFrame(layers, scene, time, spell, timing, ratio);
                        if (dom) dom.update(time, scene);
                    }
                } finally { if (dom) dom.stop(); }
            }
            // Flush the initial drawing work while still on the encounter screen.
            ctx.getImageData(0, 0, 1, 1);
            prepared.set(canvas, { width, height });
        } catch (error) {
            console.error("[battle-effects] 描画の準備を省略しました:", error);
        } finally {
            clearLayers(layers);
        }
    }

    function prepare(popup) {
        warm(popup);
        return preload().then(() => {
            if (!popup.isConnected) return;
            prepared.delete(popup.querySelector(".battle-effects-layer"));
            warm(popup);
        });
    }

    function create(popup, options) {
        const spell = getSpell(options.magicId);
        if (!spell || (!effects[spell.effect] && !domEffects[spell.effect]) || typeof root.requestAnimationFrame !== "function") return null;
        const canvas = popup.querySelector(".battle-effects-layer");
        const field = popup.querySelector(".battle-field");
        if (!canvas || !field) return null;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        const actor = options.actor === "enemy" ? "enemy" : "player";
        const timing = { release: options.release, impact: options.impact, end: options.duration };
        const layers = canvasLayers(popup);
        let frameId = 0, stopped = false, ratio = 1, geometry = null, dom = null;

        function clear() {
            clearLayers(layers);
        }
        function stop() {
            stopped = true;
            root.cancelAnimationFrame(frameId);
            if (dom) dom.stop();
            clear();
        }
        function imageBox(actor, bounds) {
            const image = popup.querySelector(`[data-battle-actor="${actor}"] img`);
            if (!image) return null;
            const rect = image.getBoundingClientRect();
            if (!rect.width || !rect.height) return null;
            // The image elements use contain / center bottom. Aim at the drawn
            // sprite, rather than the unused transparent area of its element.
            const scale = image.naturalWidth && image.naturalHeight
                ? Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight) : 1;
            const width = image.naturalWidth ? image.naturalWidth * scale : rect.width;
            const height = image.naturalHeight ? image.naturalHeight * scale : rect.height;
            return { x: rect.left - bounds.left + (rect.width - width) / 2,
                y: rect.bottom - bounds.top - height, width, height };
        }
        function frame() {
            if (stopped) return;
            try {
                if (!popup.isConnected) { stop(); return; }
                const time = Date.now() - options.startedAt;
                if (time >= options.duration) { stop(); return; }
                const bounds = field.getBoundingClientRect();
                ratio = Math.min(2, root.devicePixelRatio || 1);
                const width = Math.round(bounds.width * ratio), height = Math.round(bounds.height * ratio);
                for (const layer of layers) {
                    if (layer.canvas.width !== width || layer.canvas.height !== height) { layer.canvas.width = width; layer.canvas.height = height; }
                }
                clear();
                if (!geometry || geometry.width !== bounds.width || geometry.height !== bounds.height) {
                    const player = imageBox("player", bounds), enemy = imageBox("enemy", bounds);
                    if (player && enemy) {
                        const from = actor === "player"
                            ? { x: player.x + player.width * .84, y: player.y + player.height * .34 }
                            : { x: enemy.x + enemy.width * .16, y: enemy.y + enemy.height * .34 };
                        const to = actor === "player"
                            ? { x: enemy.x + enemy.width * .5, y: enemy.y + enemy.height * .52 }
                            : { x: player.x + player.width * .5, y: player.y + player.height * .52 };
                        // Keep the impact point after a defeated sprite disappears
                        // and while the target recoils. Recalculate only on resize.
                        const target = actor === "player" ? enemy : player;
                        geometry = { width: bounds.width, height: bounds.height,
                            unit: Math.max(10, bounds.width * .025), from, to,
                            targetGround: { x: target.x + target.width * .5, y: target.y + target.height * .96 },
                            targetHead: { x: target.x + target.width * .5, y: target.y + target.height * .22 } };
                    }
                }
                if (time >= 0 && geometry && width && height) {
                    if (!dom && domEffects[spell.effect]) dom = domEffects[spell.effect]({ container: field, spell, timing, scene: geometry, reduced: false, startedAt: options.startedAt });
                    if (dom) dom.update(time, geometry);
                    paintFrame(layers, geometry, time, spell, timing, ratio);
                }
                frameId = root.requestAnimationFrame(frame);
            } catch (error) {
                // A missing/broken painter must never prevent the timed impact
                // or continuation managed independently by BattleMotion.
                console.error("[battle-effects] 描画を終了しました:", error);
                stop();
            }
        }
        frameId = root.requestAnimationFrame(frame);
        return { stop };
    }

    const api = { spells, effects, domEffects, sprites, getSpell, getTiming, preload, prepare, create };
    return api;
});
