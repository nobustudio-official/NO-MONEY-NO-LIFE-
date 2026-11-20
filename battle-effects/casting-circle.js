/* Approved Blizzard circle, reused unchanged in shape for every lab spell. */
(function (effects) {
  'use strict';
  const p = effects.paint;
  p.castingCircle = function (ctx, origin, size, time, timing, tailMs, color, ink = '#effeff') {
    const appear = p.phase(time, 20, 160);
    const end = timing.end ?? timing.impact + tailMs;
    // All spells share the approved Blizzard fade window, ending with the hit FX.
    const fadeMs = Math.min(end, 960 * .72);
    const opacity = appear * (1 - p.phase(time, end - fadeMs, fadeMs));
    if (opacity <= 0) return;
    ctx.save(); ctx.translate(origin.x + size * .3, origin.y + size * .5);
    ctx.rotate(-.3); ctx.scale(.63, 1);
    const radius = size * (2.55 + appear * .45);
    ctx.globalAlpha = opacity;
    p.glow(ctx, 0, 0, radius * 1.4, color, .54);
    ctx.rotate(time * .0011); ctx.strokeStyle = ink;
    ctx.shadowColor = color; ctx.shadowBlur = size * .95;
    ctx.lineWidth = Math.max(1.3, size * .09);
    for (const scale of [1, .87, .61]) {
      ctx.beginPath(); ctx.arc(0, 0, radius * scale, 0, Math.PI * 2); ctx.stroke();
    }
    for (let triangle = 0; triangle < 2; triangle++) {
      ctx.beginPath();
      for (let point = 0; point < 3; point++) {
        const angle = point * Math.PI * 2 / 3 - Math.PI / 2 + triangle * Math.PI;
        const x = Math.cos(angle) * radius * .61, y = Math.sin(angle) * radius * .61;
        point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (let mark = 0; mark < 12; mark++) {
      ctx.save(); ctx.rotate(mark * Math.PI / 6);
      ctx.beginPath(); ctx.moveTo(0, -radius * .96); ctx.lineTo(0, -radius * .89);
      ctx.moveTo(-size * .09, -radius * .81); ctx.lineTo(size * .09, -radius * .77);
      ctx.lineTo(-size * .09, -radius * .73); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  };
})(window.BattleEffects);
