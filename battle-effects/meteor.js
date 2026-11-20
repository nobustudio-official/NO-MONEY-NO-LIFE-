/* Shared meteor presentation. Geometry and animation time come from BattleEffects. */
(function (root) {
    "use strict";
    const effects = root.BattleEffects;
    if (!effects) return;

    effects.domEffects["meteor-image"] = function ({ container, timing, scene }) {
        const layer = document.createElement("div");
        layer.className = "bm-layer";
        layer.setAttribute("aria-hidden", "true");

        const flight = document.createElement("div");
        flight.className = "bm-flight";
        const fire = document.createElement("img");
        fire.className = "bm-fire";
        fire.alt = "";
        const rock = document.createElement("img");
        rock.className = "bm-rock";
        rock.alt = "";
        flight.append(fire, rock);
        layer.append(flight);

        const blast = document.createElement("div");
        blast.className = "bm-blast";
        const flash = document.createElement("i");
        flash.className = "bm-flash";
        const shockwave = document.createElement("i");
        shockwave.className = "bm-shockwave";
        blast.append(flash, shockwave);
        const rays = [];
        for (let i = 0; i < 12; i++) {
            const ray = document.createElement("i");
            ray.className = "bm-ray";
            ray.style.setProperty("--ray-angle", `${i * 30 + (i % 2 ? 7 : -5)}deg`);
            ray.style.setProperty("--ray-length", `${Math.max(52, scene.width * (.055 + (i % 4) * .012))}px`);
            rays.push(ray);
            blast.append(ray);
        }
        layer.append(blast);
        container.append(layer);

        const target = container.querySelector("#battleNewMonsterImage");
        const fieldBox = container.getBoundingClientRect();
        const targetBox = target?.getBoundingClientRect();
        const width = Math.min(fieldBox.width * .54, Math.max(260, (targetBox?.width || fieldBox.width * .4) * 1.48));
        const height = width * (1024 / 1536);
        // Artwork is already oriented tail-first: the rock anchor leads the flight.
        const rockAnchor = { x: width * .77, y: height * .74 };
        const start = { x: fieldBox.width * .18, y: -fieldBox.height * .17 };
        const end = targetBox ? {
            x: targetBox.left - fieldBox.left + targetBox.width * .51,
            y: targetBox.top - fieldBox.top + targetBox.height * .56
        } : scene.to;
        flight.style.width = `${width}px`;
        flight.style.height = `${height}px`;
        fire.src = effects.sprites.meteorFlame?.src || "images/effects/battle/meteor-flame.webp";
        rock.src = effects.sprites.meteorRock?.src || "images/effects/battle/meteor-rock.webp";
        blast.style.background = `radial-gradient(circle at ${end.x}px ${end.y}px, #fffce8 0, #fff0a8 2.2%, #ffb746 4%, #ff6a28 8%, #f14b1b14 22%, transparent 34%)`;
        flash.style.left = shockwave.style.left = `${end.x}px`;
        flash.style.top = shockwave.style.top = `${end.y}px`;
        rays.forEach(ray => { ray.style.left = `${end.x}px`; ray.style.top = `${end.y}px`; });

        let recoil = null;
        let stopped = false;
        const clamp = value => Math.max(0, Math.min(1, value));
        const mix = (a, b, t) => a + (b - a) * t;
        function recoilFrames() {
            return [
                { transform: "translate(0,0) rotate(0deg) scale(1)", offset: 0 },
                { transform: "translate(0,0) rotate(0deg) scale(1)", offset: .09 },
                { transform: "translate(10px,-7px) rotate(4deg) scale(.95)", offset: .25 },
                { transform: "translate(24px,-15px) rotate(8deg) scale(.88)", offset: .43 },
                { transform: "translate(15px,-9px) rotate(5deg) scale(.92)", offset: .67 },
                { transform: "translate(5px,-2px) rotate(-2deg) scale(.98)", offset: .84 },
                { transform: "translate(0,0) rotate(0deg) scale(1)", offset: 1 }
            ];
        }
        function update(time) {
            if (stopped) return;
            const progress = clamp((time - timing.release) / Math.max(1, timing.impact - timing.release));
            const middleProgress = clamp(progress / .78);
            const scale = progress < .78 ? mix(.48, .86, middleProgress) : mix(.86, 1, (progress - .78) / .22);
            const rotation = progress < .78 ? mix(-9, -3, middleProgress) : mix(-3, 0, (progress - .78) / .22);
            const x = mix(start.x, end.x, progress), y = mix(start.y, end.y, progress);
            flight.style.left = `${x - rockAnchor.x}px`;
            flight.style.top = `${y - rockAnchor.y}px`;
            flight.style.opacity = time < timing.release ? "0" : "1";
            flight.style.transform = `rotate(${rotation}deg) scale(${scale})`;
            const age = time - timing.impact;
            if (age < 0) {
                fire.style.opacity = rock.style.opacity = "1";
                blast.style.opacity = "0";
                return;
            }
            if (!recoil && target && typeof target.animate === "function") {
                recoil = target.animate(recoilFrames(), { duration: 570, fill: "both", easing: "cubic-bezier(.16,.72,.23,1)" });
            }
            if (recoil) { recoil.pause(); recoil.currentTime = Math.min(570, Math.max(0, age)); }
            fire.style.opacity = String(1 - clamp(age / 230));
            rock.style.opacity = String(1 - clamp(age / 520));
            const blastProgress = clamp(age / 480);
            blast.style.opacity = String(age < 300 ? .9 + .1 * clamp(age / 100) : 1 - clamp((age - 300) / 180));
            flash.style.opacity = String(age < 74 ? age / 74 : 1 - clamp((age - 74) / 406));
            flash.style.transform = `translate(-50%,-50%) scale(${age < 74 ? mix(.08, 1.2, age / 74) : mix(1.2, 3.35, clamp((age - 74) / 406))})`;
            shockwave.style.opacity = String(.95 * (1 - blastProgress));
            shockwave.style.transform = `translate(-50%,-50%) scale(${mix(.18, 4.8, blastProgress)})`;
            rays.forEach((ray, index) => {
                const rayAge = Math.max(0, age - (index % 3) * 16);
                const rayProgress = clamp(rayAge / 430);
                ray.style.opacity = String(rayAge < 77 ? rayAge / 77 : 1 - rayProgress);
                ray.style.transform = `translate(-50%,-50%) rotate(var(--ray-angle)) translateX(${parseFloat(ray.style.getPropertyValue("--ray-length")) * rayProgress}px) scaleX(${mix(.12, 1.2, rayProgress)})`;
            });
        }
        function stop() {
            stopped = true;
            if (recoil) recoil.cancel();
            layer.remove();
        }
        return { update, stop };
    };
})(typeof window === "undefined" ? globalThis : window);
