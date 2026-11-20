/* Dark Chain rendering copied from the approved asset-shop battle demo. */
(function (root) {
    "use strict";
    const genericCircleSpellByMagicId = { 4: 1, 6: 1, 7: 1 };
    const genericCircleColorsByMagicId = {
        4: { color: "#963dff", ink: "#edc9ff" },
        6: { color: "#ff962e", ink: "#ffe3bd" },
        7: { color: "#5cf0ad", ink: "#dcfff0" }
    };
function drawReusableFireCircle(popup, magicId, timing, startedAt) {
        const canvas = popup.querySelector(".battle-casting-layer");
        const field = popup.querySelector(".battle-field");
        const image = popup.querySelector('[data-battle-actor="player"] img');
        const fire = window.BattleEffects.getSpell(genericCircleSpellByMagicId[magicId] || 1);
        const paintCircle = window.BattleEffects.paint?.castingCircle;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !field || !image || !fire || !paintCircle || !ctx) return () => {};

        let frame = 0;
        let stopped = false;
        function stop() {
            if (stopped) return;
            stopped = true;
            if (frame) window.cancelAnimationFrame(frame);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        function draw() {
            if (stopped) return;
            const bounds = field.getBoundingClientRect();
            const imageBounds = image.getBoundingClientRect();
            const ratio = Math.min(2, window.devicePixelRatio || 1);
            const width = Math.round(bounds.width * ratio);
            const height = Math.round(bounds.height * ratio);
            if (!width || !height || !imageBounds.width || !imageBounds.height) {
                frame = window.requestAnimationFrame(draw);
                return;
            }
            if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            ctx.clearRect(0, 0, bounds.width, bounds.height);
            const scale = image.naturalWidth && image.naturalHeight
                ? Math.min(imageBounds.width / image.naturalWidth, imageBounds.height / image.naturalHeight) : 1;
            const spriteWidth = image.naturalWidth ? image.naturalWidth * scale : imageBounds.width;
            const spriteHeight = image.naturalHeight ? image.naturalHeight * scale : imageBounds.height;
            const origin = {
                x: imageBounds.left - bounds.left + (imageBounds.width - spriteWidth) / 2 + spriteWidth * .84,
                y: imageBounds.bottom - bounds.top - spriteHeight + spriteHeight * .34
            };
            const time = Date.now() - startedAt;
            const circleColors = genericCircleColorsByMagicId[magicId] || fire;
            paintCircle(ctx, origin, Math.max(10, bounds.width * .025), time,
                { ...timing, end: timing.duration }, fire.tailMs,
                circleColors.color || fire.castingColor, circleColors.ink || fire.castingInk);
            if (time < timing.duration) frame = window.requestAnimationFrame(draw);
            else stop();
        }
        frame = window.requestAnimationFrame(draw);
        return stop;
    }

function playDarkChain(popup, duration) {
        const layer = popup.querySelector(".battle-preview-dark-chain-layer");
        const flightLayer = popup.querySelector(".battle-preview-dark-chain-flight-layer");
        const backLayer = popup.querySelector(".battle-preview-dark-chain-back-layer");
        const field = popup.querySelector(".battle-field");
        const caster = popup.querySelector("#battlePlayerBackImage");
        const target = popup.querySelector("#battleNewMonsterImage");
        const targetArea = popup.querySelector(".battle-monster-area");
        if (!layer || !flightLayer || !backLayer || !field || !caster || !target || !targetArea) return () => {};
        layer.replaceChildren();
        flightLayer.replaceChildren();
        backLayer.replaceChildren();
        const fieldBox = field.getBoundingClientRect();
        const casterBox = caster.getBoundingClientRect();
        const targetBox = target.getBoundingClientRect();
        const casterScale = caster.naturalWidth && caster.naturalHeight
            ? Math.min(casterBox.width / caster.naturalWidth, casterBox.height / caster.naturalHeight) : 1;
        const spriteWidth = caster.naturalWidth ? caster.naturalWidth * casterScale : casterBox.width;
        const spriteHeight = caster.naturalHeight ? caster.naturalHeight * casterScale : casterBox.height;
        const casterOriginX = casterBox.left - fieldBox.left + (casterBox.width - spriteWidth) / 2 + spriteWidth * .84;
        const casterOriginY = casterBox.bottom - fieldBox.top - spriteHeight + spriteHeight * .34;
        const magicCircleSize = Math.max(10, fieldBox.width * .025);
        const startX = casterOriginX + magicCircleSize * .95;
        const startY = casterOriginY + magicCircleSize * .5;
        const endX = targetBox.left - fieldBox.left + targetBox.width * .5;
        const endY = targetBox.top - fieldBox.top + targetBox.height * .62;
        const svgNS = "http://www.w3.org/2000/svg";
        let svgId = 0;
        const addPaint = svg => {
            const id = `battle-preview-chain-paint-${++svgId}`;
            const defs = document.createElementNS(svgNS, "defs");
            const metal = document.createElementNS(svgNS, "linearGradient");
            metal.id = `${id}-metal`;
            metal.setAttribute("x1", "0"); metal.setAttribute("y1", "0");
            metal.setAttribute("x2", ".25"); metal.setAttribute("y2", "1");
            [["0", "#f1d9ff"], [".12", "#a675c6"], [".3", "#392645"], [".48", "#17111d"],
                [".65", "#563b68"], [".78", "#d2a0f0"], [".9", "#2d1b3a"], ["1", "#120b18"]]
                .forEach(([offset, color]) => {
                    const stop = document.createElementNS(svgNS, "stop");
                    stop.setAttribute("offset", offset); stop.setAttribute("stop-color", color); metal.append(stop);
                });
            const aura = document.createElementNS(svgNS, "linearGradient");
            aura.id = `${id}-aura`;
            aura.setAttribute("x1", "0"); aura.setAttribute("y1", "0");
            aura.setAttribute("x2", "1"); aura.setAttribute("y2", "0");
            [["0", "#a832fa", ".08"], [".5", "#f250ff", ".72"], ["1", "#9d20ed", ".12"]]
                .forEach(([offset, color, opacity]) => {
                    const stop = document.createElementNS(svgNS, "stop");
                    stop.setAttribute("offset", offset); stop.setAttribute("stop-color", color);
                    stop.setAttribute("stop-opacity", opacity); aura.append(stop);
                });
            defs.append(metal, aura); svg.append(defs);
            return { metal: metal.id, aura: aura.id };
        };
        const createLink = (parent, x, y, angle, size = 1, paint, depth = "front") => {
            const group = document.createElementNS(svgNS, "g");
            group.setAttribute("transform", `translate(${x} ${y}) rotate(${angle}) scale(${size})`);
            if (depth === "back") group.setAttribute("opacity", ".72");
            const ring = document.createElementNS(svgNS, "path");
            ring.setAttribute("d", "M-22 0 C-22-8 -16-13 -7-13 H7 C16-13 22-8 22 0 C22 8 16 13 7 13 H-7 C-16 13 -22 8 -22 0 Z M-13 0 C-13-4 -10-6 -6-6 H6 C10-6 13-4 13 0 C13 4 10 6 6 6 H-6 C-10 6 -13 4 -13 0 Z");
            ring.setAttribute("fill", `url(#${paint.metal})`); ring.setAttribute("fill-rule", "evenodd");
            ring.setAttribute("stroke", "#1a0d24"); ring.setAttribute("stroke-width", "2.2");
            const innerRim = document.createElementNS(svgNS, "path");
            innerRim.setAttribute("d", "M-12 0 C-12-4 -9-5  -5-5 H5 C9-5 12-4 12 0");
            innerRim.setAttribute("fill", "none"); innerRim.setAttribute("stroke", "#dcaaff");
            innerRim.setAttribute("stroke-width", "1.35"); innerRim.setAttribute("opacity", ".8");
            const glint = document.createElementNS(svgNS, "path");
            glint.setAttribute("d", "M-16-8 C-10-13 -3-12 2-12"); glint.setAttribute("fill", "none");
            glint.setAttribute("stroke", "#fff0ff"); glint.setAttribute("stroke-width", "2.1");
            glint.setAttribute("stroke-linecap", "round"); glint.setAttribute("opacity", depth === "back" ? ".24" : ".88");
            group.append(ring, innerRim, glint); parent.append(group);
        };
        const flights = [];
        const laneOffsets = [0];
        const chainImpactDelay = 700;
        const chainImpactDuration = 520;
        const chainFadeDuration = 260;
        const chainFadeDelay = Math.max(0, chainImpactDelay + chainImpactDuration - chainFadeDuration);
        laneOffsets.forEach(lane => {
            const laneStartY = startY + lane * 23;
            const laneEndY = endY + lane * targetBox.height * .24;
            const dx = endX - startX, dy = laneEndY - laneStartY;
            const flight = document.createElement("div");
            flight.className = `battle-preview-dark-chain-flight lane-${lane + 2}`;
            flight.style.left = `${startX}px`;
            flight.style.top = `${laneStartY}px`;
            flight.style.width = `${Math.hypot(dx, dy)}px`;
            flight.style.setProperty("--chain-angle", `${Math.atan2(dy, dx)}rad`);
            flight.style.setProperty("--flight-delay", "70ms");
            flight.style.height = "62px";
            const length = Math.hypot(dx, dy);
            const flightSvg = document.createElementNS(svgNS, "svg");
            flightSvg.setAttribute("viewBox", `0 0 ${length} 62`);
            flightSvg.setAttribute("preserveAspectRatio", "none");
            flightSvg.classList.add("battle-preview-chain-svg");
            const paint = addPaint(flightSvg);
            const track = document.createElementNS(svgNS, "path");
            track.setAttribute("d", `M 0 31 H ${length}`); track.setAttribute("fill", "none");
            track.setAttribute("stroke", `url(#${paint.aura})`); track.setAttribute("stroke-width", "12"); track.setAttribute("stroke-linecap", "round");
            track.setAttribute("opacity", ".62");
            flightSvg.append(track);
            const count = Math.max(7, Math.ceil(length / 31));
            for (let i = 0; i < count; i++) {
                const progress = i / Math.max(1, count - 1);
                const x = 24 + progress * (length - 48);
                const perspectiveScale = (1 - progress * .34) * (lane === 0 ? 1 : .92);
                createLink(flightSvg, x, 31, i % 2 ? 42 : -8, perspectiveScale, paint);
            }
            flight.append(flightSvg);
            flights.push(flight);
        });

        const bindWidth = targetBox.width * 1.02, bindHeight = targetBox.height * .72;
        const bindLeft = endX - bindWidth / 2, bindTop = endY - bindHeight / 2;
        const backBind = document.createElement("div");
        backBind.className = "battle-preview-dark-chain-bind battle-preview-dark-chain-bind-back";
        const frontBind = document.createElement("div");
        frontBind.className = "battle-preview-dark-chain-bind battle-preview-dark-chain-bind-front";
        [backBind, frontBind].forEach(bind => {
            bind.style.left = `${bindLeft}px`; bind.style.top = `${bindTop}px`;
            bind.style.width = `${bindWidth}px`; bind.style.height = `${bindHeight}px`;
            bind.style.setProperty("--chain-impact-delay", `${chainImpactDelay}ms`);
            bind.style.setProperty("--chain-impact-duration", `${chainImpactDuration}ms`);
        });
        [layer, flightLayer, backLayer].forEach(chainLayer => {
            chainLayer.classList.add("battle-preview-chain-playing");
            chainLayer.style.setProperty("--chain-fade-delay", `${chainFadeDelay}ms`);
            chainLayer.style.setProperty("--chain-fade-duration", `${chainFadeDuration}ms`);
        });
        target.style.setProperty("--chain-impact-delay", `${chainImpactDelay}ms`);
        target.style.setProperty("--chain-impact-duration", `${chainImpactDuration}ms`);
        const makeWrapSvg = (bind, isBack) => {
            const svg = document.createElementNS(svgNS, "svg");
            svg.setAttribute("viewBox", `0 0 ${bindWidth} ${bindHeight}`);
            svg.classList.add("battle-preview-chain-svg", "battle-preview-dark-chain-bind-svg");
            const paint = addPaint(svg);
            const wrapWidth = bindWidth * .82, wrapHeight = bindHeight * .76;
            const centerX = bindWidth / 2, baseY = bindHeight * .5;
            for (let turn = 0; turn < 4; turn++) {
                const rx = wrapWidth * (.48 - turn * .012);
                const ry = wrapHeight * (.105 + turn * .012);
                const cy = baseY + (turn - 1.5) * wrapHeight * .2;
                const arc = document.createElementNS(svgNS, "g");
                arc.classList.add("battle-preview-chain-wrap-turn");
                arc.style.setProperty("--turn-delay", "320ms");
                const count = Math.max(7, Math.ceil(Math.PI * rx / 35));
                for (let i = 0; i < count; i++) {
                    const t = (i + .5) / count;
                    const angle = isBack ? Math.PI + t * Math.PI : t * Math.PI;
                    const x = centerX + rx * Math.cos(angle);
                    const y = cy + ry * Math.sin(angle);
                    const tangent = Math.atan2(ry * Math.cos(angle), -rx * Math.sin(angle)) * 180 / Math.PI;
                    createLink(arc, x, y, tangent + (i % 2 ? 66 : -4), isBack ? .9 : 1, paint, isBack ? "back" : "front");
                }
                svg.append(arc);
            }
            bind.append(svg);
        };
        makeWrapSvg(backBind, true);
        makeWrapSvg(frontBind, false);
        backLayer.append(backBind);
        flightLayer.append(...flights);
        layer.append(frontBind);
        targetArea.classList.add("battle-preview-chain-targeting");
        target.classList.add("battle-preview-chain-crush");
        const timer = window.setTimeout(() => {
            layer.replaceChildren();
            flightLayer.replaceChildren();
            backLayer.replaceChildren();
            layer.classList.remove("battle-preview-chain-playing");
            flightLayer.classList.remove("battle-preview-chain-playing");
            backLayer.classList.remove("battle-preview-chain-playing");
            targetArea.classList.remove("battle-preview-chain-targeting");
            target.classList.remove("battle-preview-chain-crush");
            target.style.removeProperty("--chain-impact-delay");
            target.style.removeProperty("--chain-impact-duration");
            layer.style.removeProperty("--chain-fade-delay");
            layer.style.removeProperty("--chain-fade-duration");
            flightLayer.style.removeProperty("--chain-fade-delay");
            flightLayer.style.removeProperty("--chain-fade-duration");
            backLayer.style.removeProperty("--chain-fade-delay");
            backLayer.style.removeProperty("--chain-fade-duration");
        }, duration + 120);
        return () => {
            window.clearTimeout(timer);
            layer.replaceChildren();
            flightLayer.replaceChildren();
            backLayer.replaceChildren();
            layer.classList.remove("battle-preview-chain-playing");
            flightLayer.classList.remove("battle-preview-chain-playing");
            backLayer.classList.remove("battle-preview-chain-playing");
            targetArea.classList.remove("battle-preview-chain-targeting");
            target.classList.remove("battle-preview-chain-crush");
            target.style.removeProperty("--chain-impact-delay");
            target.style.removeProperty("--chain-impact-duration");
            layer.style.removeProperty("--chain-fade-delay");
            layer.style.removeProperty("--chain-fade-duration");
            flightLayer.style.removeProperty("--chain-fade-delay");
            flightLayer.style.removeProperty("--chain-fade-duration");
            backLayer.style.removeProperty("--chain-fade-delay");
            backLayer.style.removeProperty("--chain-fade-duration");
        };
    }

    root.BattleDarkChain = { drawReusableFireCircle, playDarkChain };
})(typeof window === "undefined" ? globalThis : window);
