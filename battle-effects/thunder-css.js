/* A DOM painter driven by the game/server clock or the lab's virtual clock.
   CSS owns all thunder shapes, colors, glows and animation keyframes. */
(function (effects) {
  'use strict';
  const factories = effects.domEffects = effects.domEffects || {};
  factories['thunder-css'] = function ({ container, spell, timing, scene, reduced }) {
    const layer = document.createElement('div');
    layer.className = 'td-layer'; layer.setAttribute('aria-hidden', 'true');
    layer.dataset.reduced = String(Boolean(reduced));
    function element(className, parent = layer) {
      const node = document.createElement('div'); node.className = className; parent.append(node); return node;
    }
    const bolt = element('td-bolt');
    element('td-bolt-halo', bolt);
    for (const name of ['td-bolt-edge', 'td-bolt-body', 'td-bolt-core']) element(`td-bolt-shape ${name}`, bolt);
    element('td-hit'); element('td-floor');
    const arcs = element('td-arcs');
    // Connected fine line segments, not miniature lightning-symbol silhouettes.
    const paths = [
      [[.16,.18],[.1,.26],[.17,.33],[.09,.39],[.15,.47]],
      [[.82,.14],[.89,.23],[.82,.29],[.91,.36],[.86,.44]],
      [[.34,.1],[.42,.05],[.48,.12],[.56,.07],[.65,.13]],
      [[.11,.58],[.18,.64],[.13,.74],[.24,.7],[.29,.8]],
      [[.88,.53],[.93,.62],[.84,.68],[.89,.78]],
      [[.42,.84],[.49,.9],[.54,.85],[.62,.91],[.7,.86]]
    ];
    paths.forEach((points, index) => {
      const wire = element('td-wire', arcs);
      wire.style.setProperty('--td-wire-delay', `${index * 18}ms`);
      for (let point = 1; point < points.length; point++) {
        const [x, y] = points[point - 1], [nextX, nextY] = points[point];
        const segment = element('td-wire-segment', wire);
        segment.style.left = `${x * 100}%`; segment.style.top = `${y * 100}%`;
        segment.style.width = `${Math.hypot(nextX - x, nextY - y) * 100}%`;
        segment.style.transform = `rotate(${Math.atan2(nextY - y, nextX - x)}rad)`;
      }
    });
    const set = (name, value) => layer.style.setProperty(`--td-${name}`, value);
    set('gold', spell.color); set('hit-ms', `${timing.impact}ms`);
    set('strike-start', `${Math.max(0, timing.impact - 60)}ms`);
    set('tail-start', `${timing.impact + 300}ms`); set('tail-ms', `${Math.max(1, spell.tailMs - 300)}ms`);
    let geometry = null;
    function place(next) {
      if (geometry && geometry.width === next.width && geometry.height === next.height) return;
      geometry = next;
      const hitY = next.to.y + (next.targetGround.y - next.to.y) * .55;
      set('x', `${next.to.x}px`); set('hit-y', `${hitY}px`);
      set('body', `${next.to.y}px`); set('ground', `${next.targetGround.y}px`);
      set('unit', `${next.unit * spell.size / 100}px`);
      set('width', `${next.unit * 9.7 * spell.size / 100}px`);
      set('height', `${Math.max(20, hitY - 8)}px`);
    }
    place(scene); container.append(layer);
    // Pause CSS animations and sample their time from the existing controller.
    // This keeps the strike and damage synchronized, and permits interruption.
    const animations = layer.getAnimations({ subtree: true });
    for (const animation of animations) { animation.pause(); animation.currentTime = 0; }
    let stopped = false;
    return {
      update(time, next) {
        if (stopped) return;
        place(next);
        for (const animation of animations) animation.currentTime = Math.max(0, time);
      },
      stop() {
        if (stopped) return;
        stopped = true;
        for (const animation of animations) animation.cancel();
        layer.remove();
      }
    };
  };
})(window.BattleEffects);
