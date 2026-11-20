(function (demo) {
  const clamp = n => Math.max(0, Math.min(1, n));
  demo.paint = {
    clamp,
    phase: (time, start, duration) => clamp((time - start) / Math.max(1, duration)),
    noise: n => { const value = Math.sin(n * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); },
    point(from, to, p, arc = 0) {
      return { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p - Math.sin(p * Math.PI) * arc };
    },
    glow(ctx, x, y, radius, color, alpha = 1) {
      if (radius <= 0 || alpha <= 0) return;
      ctx.save(); ctx.globalAlpha = alpha;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, '#fffbea'); gradient.addColorStop(.15, color); gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    },
    ring(ctx, x, y, radius, color, alpha, width = 2) {
      if (radius <= 0 || alpha <= 0) return;
      ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.beginPath(); ctx.ellipse(x, y, radius, radius * .55, -.1, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    },
    crystal(ctx, x, y, radius, angle, color, alpha = 1) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = alpha;
      ctx.fillStyle = color; ctx.strokeStyle = '#f2fcff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -radius); ctx.lineTo(radius * .4, 0); ctx.lineTo(0, radius * .65); ctx.lineTo(-radius * .4, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -radius); ctx.lineTo(0, radius * .65); ctx.stroke(); ctx.restore();
    }
  };
})(window.BattleEffects);
