/* Fire study 7. All shapes are animated paths; no flattened image or icon is used.
   Local +X is the direction of travel. Reversing source/target rotates the entire
   silhouette, including the trailing tongues and detached embers. */
(function (demo) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = n => Math.max(0, Math.min(1, n));
  const polar = (r, a) => ({ x: r * Math.cos(a), y: r * Math.sin(a) });

  function contour(ctx, points) {
    ctx.beginPath();
    const last = points[points.length - 1], first = points[0];
    ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
    ctx.closePath();
  }

  // Hand-shaped tongues retain the reference's sharp tips and concave gaps.
  // A shared smooth warp animates every layer, including its control points.
  const TAILS = [
    { colors: ['#d91d12', '#ff4208'], path: [
      ['M', -.4, -.64], ['C', -.88, -.94, -1.13, -.69, -1.48, -.81],
      ['C', -1.2, -.63, -1.38, -.52, -1.65, -.58],
      ['C', -1.91, -.6, -2.1, -.39, -2.4, -.33],
      ['C', -2.09, -.35, -2.06, -.18, -1.85, -.13],
      ['C', -2.13, -.1, -2.18, .11, -2.48, .2],
      ['C', -2.05, .18, -1.91, .37, -1.59, .24],
      ['C', -1.84, .53, -1.5, .52, -1.73, .74],
      ['C', -1.27, .7, -1.24, .3, -.9, .35],
      ['C', -.68, .49, -.63, .76, -.36, .72] ] },
    { colors: ['#f6380d', '#ff9e0c'], path: [
      ['M', -.46, -.46], ['C', -.85, -.61, -1.05, -.33, -1.36, -.41],
      ['C', -1.56, -.48, -1.84, -.34, -2.1, -.3],
      ['C', -1.75, -.27, -1.86, -.03, -1.4, -.12],
      ['C', -1.64, .03, -1.72, .24, -1.96, .25],
      ['C', -1.59, .38, -1.24, .07, -.93, .18],
      ['C', -.7, .24, -.73, .49, -.46, .52] ] },
    { colors: ['#ff7a0a', '#ffe244'], path: [
      ['M', -.43, -.19], ['C', -.93, -.33, -1.11, -.02, -1.54, -.14],
      ['C', -1.28, .06, -1.02, -.01, -.84, .13],
      ['C', -.66, .28, -.57, .34, -.38, .24] ] },
    { colors: ['#d92313', '#fb370a'], path: [
      ['M', -4.5, .66], ['C', -4.12, .54, -4.1, .26, -3.81, .28],
      ['C', -3.47, .34, -3.37, -.09, -2.97, .02],
      ['C', -3.2, .12, -2.93, .22, -2.7, .14],
      ['C', -2.87, .41, -3.1, .39, -3.14, .58],
      ['C', -2.98, .59, -2.89, .56, -2.74, .5],
      ['C', -2.99, .81, -3.25, .75, -3.45, .6],
      ['C', -3.66, .79, -3.84, .56, -4.05, .62] ] },
    { colors: ['#f3340c', '#ff7909'], path: [
      ['M', -4.1, .56], ['C', -3.7, .51, -3.66, .3, -3.42, .27],
      ['C', -3.29, .25, -3.15, .16, -3.03, .18],
      ['C', -3.5, .41, -3.36, .6, -3.77, .56],
      ['C', -3.94, .5, -3.98, .6, -4.1, .56] ] },
    { colors: ['#ff5c09', '#ffae17'], path: [
      ['M', -3.83, .46], ['C', -3.57, .38, -3.49, .29, -3.25, .3],
      ['C', -3.44, .34, -3.49, .46, -3.83, .46] ] }
  ];
  function trailingFlames(ctx, t) {
    for (const layer of TAILS) {
      ctx.beginPath();
      for (const command of layer.path) {
        const values = [];
        for (let i = 1; i < command.length; i += 2) {
          const x = command[i], y = command[i + 1];
          const flexibility = Math.min(2.7, Math.max(0, -x - .6));
          values.push(x, y + Math.sin(x * 3.3 + t * 8) * .055 * flexibility);
        }
        if (command[0] === 'M') ctx.moveTo(...values); else ctx.bezierCurveTo(...values);
      }
      ctx.closePath();
      const fill = ctx.createLinearGradient(-4.5, .2, -.45, -.2);
      layer.colors.forEach((color, i) => fill.addColorStop(i / (layer.colors.length - 1), color));
      ctx.fillStyle = fill; ctx.fill();
    }
  }

  // A curved flame-shaped facet swept around the spherical core.
  function curl(ctx, radius, angle, sweep, width, color, hotColor = color) {
    const outside = [], inside = [];
    for (let j = 0; j <= 22; j++) {
      const s = j / 22, a = angle + sweep * s;
      const r = radius * (1 - .34 * s), w = width * Math.pow(Math.sin(Math.PI * s), .8);
      outside.push(polar(r + w, a));
      inside.push(polar(r - w * .65, a - .07 * Math.sin(Math.PI * s)));
    }
    contour(ctx, outside.concat(inside.reverse()));
    const start = polar(radius, angle), end = polar(radius * .6, angle + sweep);
    const fill = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    fill.addColorStop(0, color); fill.addColorStop(1, hotColor);
    ctx.fillStyle = fill; ctx.fill();
  }

  function ember(ctx, x, y, length, tilt, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.globalAlpha *= alpha;
    ctx.beginPath(); ctx.moveTo(-length, 0);
    ctx.bezierCurveTo(-length * .2, -length * .2, length * .12, -length * .52, length * .6, -length * .1);
    ctx.bezierCurveTo(length * .85, length * .13, length * .12, length * .34, -length, 0);
    ctx.fillStyle = '#f33212'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-length * .45, .01);
    ctx.quadraticCurveTo(length * .1, -length * .23, length * .4, -length * .08);
    ctx.quadraticCurveTo(length * .03, length * .14, -length * .45, .01);
    ctx.fillStyle = '#ff9a13'; ctx.fill(); ctx.restore();
  }

  function fireHead(ctx, t) {
    // Orange curls break the circular silhouette. The brightest shapes sit inside.
    for (let i = 0; i < 13; i++) {
      const a = i * 2.39996 + .1 * Math.sin(t * 3.1 + i * 1.7);
      curl(ctx, 1.02 + .05 * Math.sin(i * 3), a, .6 + .3 * Math.sin(i), .08 + .04 * Math.sin(i * 1.7), i % 3 ? '#ff7807' : '#ed3d08', '#ffaf0e');
    }
    const boundary = [];
    for (let j = 0; j < 80; j++) {
      const a = j * TAU / 80;
      boundary.push(polar(1 + .025 * Math.sin(a * 7 + t * 4) + .017 * Math.sin(a * 13 - t * 5), a));
    }
    contour(ctx, boundary);
    const body = ctx.createRadialGradient(.32, -.26, .06, .02, 0, 1.1);
    body.addColorStop(0, '#fff9a2'); body.addColorStop(.25, '#ffec4a');
    body.addColorStop(.56, '#ffc719'); body.addColorStop(.82, '#ff8b07'); body.addColorStop(1, '#f35306');
    ctx.fillStyle = body; ctx.fill();
    ctx.save(); ctx.clip();
    const orange = ['#f56b06', '#ff9a06', '#ffb807', '#ff8606'];
    for (let i = 0; i < 22; i++) {
      const a = i * 2.39996 + .16 * Math.sin(t * 3.5 + i * 1.2);
      ctx.save(); ctx.translate(.1 * Math.sin(i * 4), .1 * Math.cos(i * 2));
      curl(ctx, .84 + .16 * Math.sin(i * 2.4), a, (i % 4 ? 1 : -1) * (.72 + .3 * Math.sin(i)), .07 + .04 * (1 + Math.sin(i * 3.7)), orange[i % orange.length], '#ffce23');
      ctx.restore();
    }
    const yellow = ['#ffe32b', '#ffed50', '#ffd224', '#fff374'];
    for (let i = 0; i < 15; i++) {
      const a = i * 2.39996 - .18 * Math.sin(t * 2.9 + i * .9);
      curl(ctx, .58 + .17 * Math.sin(i * 2.7), a, (i % 3 ? 1 : -1) * (1 + .3 * Math.sin(i * 1.8)), .085 + .03 * Math.cos(i), yellow[i % yellow.length], '#fff48b');
    }
    // Irregular hot flame patches replace the former glossy oval highlight.
    for (const patch of [{ x: .34, y: -.25, r: .24, phase: 0 }, { x: -.04, y: .08, r: .19, phase: 2.1 }]) {
      const points = [];
      for (let j = 0; j < 28; j++) {
        const a = j * TAU / 28;
        const r = patch.r * (1 + .2 * Math.sin(a * 3 + t * 4 + patch.phase) + .1 * Math.sin(a * 5 - t * 3));
        points.push({ x: patch.x + Math.cos(a) * r, y: patch.y + Math.sin(a) * r });
      }
      contour(ctx, points); ctx.fillStyle = patch.phase ? '#fff38b' : '#fffbb5'; ctx.fill();
    }
    ctx.restore();
    // Fine yellow sweeps connect the core to its moving outer skin.
    for (let i = 0; i < 5; i++) curl(ctx, .96, i * 1.34 + .1 * Math.sin(t * 3 + i), .7, .045, '#ffd72d');
  }

  function projectile(ctx, radius, t, tailGrowth) {
    ctx.save(); ctx.scale(radius, radius);
    const halo = ctx.createRadialGradient(0, 0, .6, 0, 0, 1.55);
    halo.addColorStop(0, '#ffbe382f'); halo.addColorStop(.65, '#ff8b181c'); halo.addColorStop(1, '#ff6b0000');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 1.55, 0, TAU); ctx.fill();

    ctx.save(); ctx.scale(tailGrowth, 1);
    trailingFlames(ctx, t);
    for (let i = 0; i < 10; i++) {
      const drift = (t * .56 + i * .173) % 1;
      const x = -1.25 - drift * 3.1;
      const y = (i % 2 ? 1 : -1) * (.35 + .55 * demo.paint.noise(i + 6))
        + .12 * Math.sin(t * 6 + i * 2);
      ember(ctx, x, y, .11 + .1 * demo.paint.noise(i + 23), .12 * Math.sin(t * 5 + i), .85 * Math.sin(Math.PI * drift));
    }
    ctx.restore();
    fireHead(ctx, t);
    ctx.restore();
  }

  demo.effects.fire = function (ctx, scene, time, spell, timing) {
    const p = demo.paint, unit = scene.unit * spell.size / 100;
    const reverse = spell.direction === 'reverse';
    const source = reverse ? scene.to : scene.from, target = reverse ? scene.from : scene.to;
    const angle = Math.atan2(target.y - source.y, target.x - source.x) + (spell.angleOffsetDeg || 0) * Math.PI / 180;
    const t = time / 1000;
    if (time < timing.release) {
      const charge = p.phase(time, 50, timing.release - 50);
      p.glow(ctx, source.x, source.y, unit * (1 + charge), '#ff941b', charge * .65);
      return;
    }
    if (time < timing.impact) {
      const progress = p.phase(time, timing.release, spell.flightMs);
      const pos = p.point(source, target, progress);
      const radius = unit * 2.18 * (1 + .018 * Math.sin(t * 24));
      const traveled = Math.hypot(target.x - source.x, target.y - source.y) * progress;
      ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(angle);
      ctx.globalAlpha *= clamp((time - timing.release) / 55);
      projectile(ctx, radius, t, Math.max(.1, Math.min(1, traveled / (radius * 4.15))));
      ctx.restore();
      return;
    }
    const hit = p.phase(time, timing.impact, spell.tailMs), spread = 1 - (1 - hit) ** 3;
    p.glow(ctx, target.x, target.y, unit * (3 + spread * 2), '#ff8a14', (1 - hit) * .7);
    ctx.save(); ctx.translate(target.x, target.y); ctx.rotate(angle);
    ctx.scale(unit, unit);
    for (let i = 0; i < 21; i++) {
      const a = p.noise(i + 1) * TAU, distance = (1 + p.noise(i + 50) * 5) * spread;
      ember(ctx, Math.cos(a) * distance, Math.sin(a) * distance + hit * hit, .2 + p.noise(i + 70) * .32, a, 1 - hit);
    }
    ctx.restore();
  };
})(window.BattleEffects);

