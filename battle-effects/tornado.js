/* Tornado image choreography shared by the battle and the preview lab. */
(function (root) {
    "use strict";
    const effects = root.BattleEffects;
    if (!effects) return;

    effects.domEffects["tornado-image"] = function ({ container, timing, warm }) {
        if (warm) return null;
        const field = container;
        const caster = field.querySelector("#battlePlayerBackImage");
        const target = field.querySelector("#battleNewMonsterImage");
        if (!caster || !target) return null;

        const fieldBounds = field.getBoundingClientRect();
        const casterBounds = caster.getBoundingClientRect();
        const targetBounds = target.getBoundingClientRect();
        if (!fieldBounds.width || !casterBounds.width || !targetBounds.width) return null;

        const casterScale = caster.naturalWidth && caster.naturalHeight
            ? Math.min(casterBounds.width / caster.naturalWidth, casterBounds.height / caster.naturalHeight) : 1;
        const casterWidth = caster.naturalWidth ? caster.naturalWidth * casterScale : casterBounds.width;
        const casterHeight = caster.naturalHeight ? caster.naturalHeight * casterScale : casterBounds.height;
        const circleSize = Math.max(10, fieldBounds.width * .025);
        const from = {
            x: casterBounds.left - fieldBounds.left + (casterBounds.width - casterWidth) / 2 + casterWidth * .84 + circleSize * .3,
            y: casterBounds.bottom - fieldBounds.top - casterHeight + casterHeight * .34 + circleSize * .5
        };
        const to = {
            x: targetBounds.left - fieldBounds.left + targetBounds.width * .52,
            y: targetBounds.top - fieldBounds.top + targetBounds.height * .52
        };
        const flightMs = Math.max(1, timing.impact - timing.release);
        const fadeMs = 520;
        const tornadoHeight = Math.min(fieldBounds.height * .95, targetBounds.height * 1.45);
        const tornadoWidth = tornadoHeight * 2 / 3;
        const popup = field.closest("#battleMainPopup, #nmnl-ivory-battle");

        const layer = root.document.createElement("div");
        layer.className = "bt-tornado-layer";
        layer.setAttribute("aria-hidden", "true");

        const source = root.document.createElement("i");
        source.className = "bt-tornado-source";
        source.style.left = `${from.x}px`;
        source.style.top = `${from.y}px`;

        const tornado = root.document.createElement("div");
        tornado.className = "bt-tornado-sprite";
        tornado.style.left = `${from.x}px`;
        tornado.style.top = `${from.y}px`;
        tornado.style.width = `${tornadoWidth}px`;
        tornado.style.height = `${tornadoHeight}px`;
        tornado.style.transform = "translate(-50%, -50%) translate(0, 0) scale(.03)";

        const dx = to.x - from.x, dy = to.y - from.y;
        const totalMs = flightMs + fadeMs;
        const midOffset = flightMs * .5 / totalMs;
        const hitOffset = flightMs / totalMs;
        const fade160Offset = (flightMs + 160) / totalMs;
        const fade360Offset = (flightMs + 360) / totalMs;
        const atPoint = (x, y, scale) => `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;

        const body = root.document.createElement("div");
        body.className = "bt-tornado-body";
        body.style.animationDuration = `${flightMs}ms`;

        const image = root.document.createElement("img");
        image.className = "bt-tornado-image";
        image.src = effects.sprites.tornado?.src || "images/effects/battle/tornado-vortex.webp";
        image.alt = "";
        image.draggable = false;
        const flow = root.document.createElement("i");
        flow.className = "bt-tornado-flow";
        body.append(image, flow);
        tornado.append(body);

        const impact = root.document.createElement("i");
        impact.className = "bt-tornado-impact";
        impact.style.left = `${to.x}px`;
        impact.style.top = `${to.y}px`;
        layer.append(source, tornado, impact);
        field.append(layer);
        if (popup) popup.classList.add("bt-tornado-active");

        const travel = tornado.animate([
            { opacity: 0, transform: atPoint(0, 0, .03), offset: 0 },
            { opacity: .95, offset: .02 },
            { opacity: 1, transform: atPoint(dx * .5, dy * .5, .6), offset: midOffset },
            { opacity: 1, transform: atPoint(dx, dy, 1), offset: hitOffset },
            { opacity: .76, transform: atPoint(dx, dy, 1), offset: fade160Offset },
            { opacity: .34, transform: atPoint(dx, dy, 1), offset: fade360Offset },
            { opacity: 0, transform: atPoint(dx, dy, 1), offset: 1 }
        ], { duration: totalMs, fill: "forwards", easing: "linear" });
        travel.pause();
        travel.currentTime = 0;

        const tracks = [
            { animation: source.getAnimations()[0], delay: 0 },
            { animation: body.getAnimations()[0], delay: 0 },
            { animation: flow.getAnimations()[0], delay: 0 },
            { animation: impact.getAnimations()[0], delay: flightMs }
        ].filter(track => track.animation);
        tracks.forEach(({ animation }) => { animation.pause(); animation.currentTime = 0; });
        let lift = null;
        if (typeof target.animate === "function") {
            lift = target.animate([
                { transform: "translate(0, 0) rotate(0)" },
                { transform: "translate(0, -38px) rotate(-4deg)", offset: .14 },
                { transform: "translate(3px, -58px) rotate(6deg)", offset: .30 },
                { transform: "translate(2px, -18px) rotate(3deg)", offset: .60 },
                { transform: "translate(0, 3px) rotate(-1deg)", offset: .82 },
                { transform: "translate(0, 0) rotate(0)" }
            ], { duration: 520, fill: "both", easing: "linear" });
            lift.pause();
            lift.currentTime = 0;
        }

        let stopped = false;
        function update(time) {
            if (stopped) return;
            const sinceRelease = Math.max(0, time - timing.release);
            travel.currentTime = sinceRelease;
            tracks.forEach(({ animation, delay }) => {
                animation.currentTime = Math.max(0, sinceRelease - delay);
            });
            if (lift) lift.currentTime = Math.max(0, Math.min(520, time - timing.impact));
        }
        function stop() {
            if (stopped) return;
            stopped = true;
            travel.cancel();
            tracks.forEach(({ animation }) => animation.cancel());
            if (lift) lift.cancel();
            if (popup) popup.classList.remove("bt-tornado-active");
            layer.remove();
        }
        return { update, stop };
    };
})(typeof window === "undefined" ? globalThis : window);
