/* Approved Blizzard revision 9, shared by the game and the lab.
   Frost begins with the casting motion; all ice grows from the target's feet. */
(function (effects) {
  'use strict';
  const p = effects.paint;

  function frost(ctx, ground, size, spread, opacity, color) {
    if (spread <= 0 || opacity <= 0) return;
    ctx.save(); ctx.translate(ground.x, ground.y);
    ctx.scale(1, .32); ctx.globalAlpha = opacity;
    const radius = size * (1 + spread * 2.4);
    const light = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    light.addColorStop(0, '#d9f7ff'); light.addColorStop(.42, color);
    light.addColorStop(1, 'transparent');
    ctx.fillStyle = light; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    // Irregular ground cracks, deliberately no radial magic-circle outline.
    ctx.strokeStyle = '#e7fbff'; ctx.lineWidth = 1.7;
    for (let index = 0; index < 9; index++) {
      const angle = index * Math.PI * 2 / 9 + .11;
      const length = radius * (.64 + p.noise(index + 30) * .28);
      ctx.save(); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(length * .38, size * .18);
      ctx.lineTo(length * .62, -size * .12); ctx.lineTo(length, size * .08);
      ctx.moveTo(length * .62, -size * .12);
      ctx.lineTo(length * .67, -size * .48); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }

  function iceEruption(ctx, scene, ground, size, growth, opacity, sprite) {
    if (growth <= 0 || opacity <= 0 || !sprite?.complete || !sprite.naturalWidth) return;
    // A fast upward stroke, a hard stop, then a tiny settling movement.
    const rise = growth < .8 ? growth / .8 * 1.035 : 1 + .035 * ((1 - growth) / .2) ** 2;
    const height = size * 10, width = height * sprite.naturalWidth / sprite.naturalHeight;
    ctx.save();
    // Translate the intact illustration upward through a fixed ground line.
    // Keeping its scale fixed avoids stretching the accepted crystal design.
    ctx.beginPath(); ctx.rect(0, 0, scene.width, ground.y + size * .05); ctx.clip();
    ctx.globalAlpha = opacity; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sprite, ground.x - width / 2, ground.y - height * rise, width, height);
    ctx.restore();
  }

  function coldMist(ctx, ground, size, time, release, fade, color, foreground = false) {
    if (time < release || fade <= 0) return;
    const spread = p.phase(time, release, 340);
    const opacity = ((1 - spread) * .38 + .12) * fade * (foreground ? .7 : 1);
    ctx.save(); ctx.translate(ground.x, ground.y - size * .04);
    for (let cloud = -2; cloud <= 2; cloud++) {
      ctx.save(); ctx.translate(cloud * size * (.7 + spread * .95), -Math.abs(cloud) * size * .06);
      ctx.scale(1.5 + spread * .5, foreground ? .18 : .35);
      p.glow(ctx, 0, 0, size * (1.2 + spread * .7), color, opacity);
      ctx.restore();
    }
    ctx.restore();
  }

  function hitFlash(ctx, ground, size, time, impact) {
    const flash = p.phase(time, impact, 110);
    if (time < impact || flash >= 1) return;
    const x = ground.x, y = ground.y - size * 5.3;
    p.glow(ctx, x, y, size * (2.3 + flash), '#d7faff', (1 - flash) * .95);
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = 1 - flash;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.4, size * .12);
    ctx.shadowColor = '#c8f6ff'; ctx.shadowBlur = size * .5;
    for (let ray = 0; ray < 8; ray++) {
      ctx.save(); ctx.rotate(ray * Math.PI / 4);
      ctx.beginPath(); ctx.moveTo(size * .15, 0);
      ctx.lineTo(size * (ray % 2 ? .9 : 1.6) * (1 + flash * .3), 0); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }

  effects.effects['ice-pillars'] = function (ctx, scene, time, spell, timing, layers = {}) {
    if (time < 0 || time >= timing.impact + spell.tailMs) return;
    const size = scene.unit * spell.size / 100;
    const ground = scene.targetGround || { x: scene.to.x, y: scene.to.y + size * 3 };
    const charge = p.phase(time, 30, Math.max(1, timing.release - 30));
    const afterHit = p.phase(time, timing.impact, spell.tailMs);
    const fade = 1 - p.clamp((afterHit - .28) / .72);
    p.castingCircle(layers.casting || ctx, scene.from, size, time, timing, spell.tailMs, spell.color);
    frost(ctx, ground, size, charge, charge * fade * .72, spell.color);
    if (time < timing.release) return;
    coldMist(ctx, ground, size, time, timing.release, fade, spell.color);
    // Impact is an early contact cue, independent of the end of the rise.
    const riseDuration = (timing.impact - timing.release) / (spell.impactProgress || 1);
    const rise = p.phase(time, timing.release, riseDuration);
    iceEruption(ctx, scene, ground, size, rise, fade * p.clamp(spell.imageOpacity ?? 1), layers.sprites?.iceEruption);
    coldMist(ctx, ground, size, time, timing.release, fade, '#e0f9ff', true);
    hitFlash(ctx, ground, size, time, timing.impact);
  };
})(window.BattleEffects);
