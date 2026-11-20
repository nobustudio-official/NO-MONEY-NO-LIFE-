/* Spiffa's rapid, parallel light-bullet volley. The demo and production use this same renderer. */
(function (root) {
    "use strict";
    const effects = root.BattleEffects;
    if (!effects) return;

    effects.domEffects["spiffa-css"] = function ({ container, timing, startedAt, warm }) {
        if (warm) return null;
        const caster = container.querySelector("#battlePlayerBackImage");
        const target = container.querySelector("#battleNewMonsterImage");
        if (!caster || !target) return null;
        const popup = container.closest("#battleMainPopup");
        if (popup) popup.classList.add("battle-preview-spiffa-active");

        let layer = null;
        let stopped = false;
        let buildTimer = 0;
        let startRattleTimer = 0;
        let stopRattleTimer = 0;
        const startAt = Number(startedAt) || Date.now();

        function buildVolley() {
            buildTimer = 0;
            if (stopped || !container.isConnected) return;
            const field = container;
            const fieldBox = field.getBoundingClientRect();
            const casterBox = caster.getBoundingClientRect();
            const targetBox = target.getBoundingClientRect();
            if (!fieldBox.width || !casterBox.width || !targetBox.width) return;

            layer = root.document.createElement("div");
            layer.className = "battle-preview-spiffa-layer";
            layer.setAttribute("aria-hidden", "true");
            field.append(layer);

            const casterScale = caster.naturalWidth && caster.naturalHeight
                ? Math.min(casterBox.width / caster.naturalWidth, casterBox.height / caster.naturalHeight) : 1;
            const casterWidth = caster.naturalWidth ? caster.naturalWidth * casterScale : casterBox.width;
            const casterHeight = caster.naturalHeight ? caster.naturalHeight * casterScale : casterBox.height;
            const circleSize = Math.max(10, fieldBox.width * .025);
            const origin = {
                x: casterBox.left - fieldBox.left + (casterBox.width - casterWidth) / 2 + casterWidth * .84 + circleSize * .3,
                y: casterBox.bottom - fieldBox.top - casterHeight + casterHeight * .34 + circleSize * .5
            };
            const elapsed = Date.now() - startAt;
            const shotCount = 50;
            const shotCadence = [24, 30, 26, 31, 25, 29, 27, 30, 24, 31, 26, 27];
            const firstShotAt = timing.release + 200;
            const travelMs = 125;
            const radius = circleSize * 2.9;
            const targetLeft = targetBox.left - fieldBox.left;
            const targetTop = targetBox.top - fieldBox.top;
            const flightVector = {
                x: targetLeft + targetBox.width * .5 - origin.x,
                y: targetTop + targetBox.height * .47 - origin.y
            };
            const distance = Math.hypot(flightVector.x, flightVector.y);
            const bearing = Math.atan2(flightVector.y, flightVector.x) * 180 / Math.PI;

            let shotAt = firstShotAt;
            for (let i = 0; i < shotCount; i++) {
                // Scatter origins through the circle interior; the shared vector keeps all shots parallel.
                const angle = i * 2.399963229728653;
                const radial = Math.sqrt((i + .5) / shotCount) * .9;
                const localX = Math.cos(angle) * radius * .63 * radial;
                const localY = Math.sin(angle) * radius * radial;
                const startX = origin.x + Math.cos(-.3) * localX - Math.sin(-.3) * localY;
                const startY = origin.y + Math.sin(-.3) * localX + Math.cos(-.3) * localY;
                const endX = startX + flightVector.x;
                const endY = startY + flightVector.y;

                const shot = root.document.createElement("i");
                shot.className = "battle-preview-spiffa-shot";
                shot.style.left = `${startX}px`;
                shot.style.top = `${startY}px`;
                shot.style.width = `${distance}px`;
                shot.style.setProperty("--spiffa-angle", `${bearing}deg`);
                shot.style.animation = `battlePreviewSpiffaShot ${travelMs}ms cubic-bezier(.12,.78,.24,1) ${shotAt - elapsed}ms both`;
                layer.append(shot);

                const impact = root.document.createElement("i");
                impact.className = "battle-preview-spiffa-impact";
                impact.style.left = `${endX}px`;
                impact.style.top = `${endY}px`;
                impact.style.setProperty("--impact-hue", i % 4 === 0 ? "#fffef8" : "#fff3bf");
                impact.style.animation = `battlePreviewSpiffaImpact 155ms ease-out ${shotAt + travelMs - elapsed}ms both`;
                layer.append(impact);
                shotAt += shotCadence[i % shotCadence.length];
            }

            const firstImpactAt = firstShotAt + travelMs;
            const lastImpactAt = shotAt - shotCadence[(shotCount - 1) % shotCadence.length] + travelMs;
            startRattleTimer = root.setTimeout(() => target.classList.add("battle-preview-spiffa-rattled"), Math.max(0, startAt + firstImpactAt - Date.now()));
            stopRattleTimer = root.setTimeout(() => target.classList.remove("battle-preview-spiffa-rattled"), Math.max(0, startAt + lastImpactAt - Date.now() + 24));
        }

        buildTimer = root.setTimeout(buildVolley, Math.max(0, startAt + timing.release - Date.now()));
        return {
            update() {},
            stop() {
                stopped = true;
                root.clearTimeout(buildTimer);
                root.clearTimeout(startRattleTimer);
                root.clearTimeout(stopRattleTimer);
                target.classList.remove("battle-preview-spiffa-rattled");
                if (popup) popup.classList.remove("battle-preview-spiffa-active");
                if (layer) layer.remove();
            }
        };
    };
})(typeof window === "undefined" ? globalThis : window);
