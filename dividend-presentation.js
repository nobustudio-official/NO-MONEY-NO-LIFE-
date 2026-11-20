/* Shared, read-only dividend presentation. Used by the game and its demo. */
(function () {
 'use strict';
 let active = null;
 const colors = {1:'#bf8b60',2:'#514749',3:'#74bdf0',4:'#c75e47',5:'#e1c66f',6:'#9173be',7:'#665954',8:'#ea8caa',9:'#cb9b65',10:'#64966b',11:'#64966b',12:'#655b61'};
 const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.DividendPresentation = { mount, close() { if (active) { active(); active = null; } } };
 function mount(root, options) {
  const data = options.players.map(p => ({...p, name:escape(p.name),color:p.color || PLAYER_CONTENTS[p.characterId]?.graphColor || colors[p.characterId] || '#b0aacb'}));
  const assets = {map: options.map || 'images/backgrounds/scenes/配当.webp', gold:options.gold || 'images/map/space-icons/gold.webp'};
  const stages = ['振込アナウンス','今回の配当金','現在の総資産','総資産の推移','トップの紹介','最下位の紹介','価格変動のお知らせ','最後の挨拶'];
  const format = n => Number(n).toLocaleString('ja-JP');
  const total = p => p.cash + p.property;
  const icon = p => `<img src="${p.icon}" alt="顔アイコン">`;
  const body = root.querySelector('.dp-body'), next = root.querySelector('.dp-next');
  let stage = options.stage;
  let revealFrame = 0, guideAudio = null, marketVoice;
  let chartMotion = null, chartScene = null;
  const revealAnimations = [];
  function cancelReveal() {
    cancelAnimationFrame(revealFrame); revealFrame = 0;
    revealAnimations.splice(0).forEach(animation => animation.cancel());
    chartMotion = null; chartScene = null;
  }
  function revealReceipts() {
    const table = body.querySelector('.dp-receipts');
    const rows = [...table.querySelectorAll('.dp-receipt')];
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { table.dataset.revealState = 'complete'; return; }
    table.dataset.revealState = 'playing';
    rows.forEach(row => { row.style.opacity = '0'; });
    const start = performance.now() - Math.max(0, Date.now() - (options.startedAt || Date.now())), duration = 620, interval = 620, leadIn = 120;
    const begun = new Set();
    function frame(now) {
      if (!root.isConnected || !table.isConnected) { cancelReveal(); return; }
      let complete = true;
      rows.forEach((row, index) => {
        const elapsed = now - start - leadIn - index * interval;
        if (elapsed < 0) { complete = false; return; }
        if (elapsed >= duration) { row.style.opacity = '1'; row.classList.remove('is-paying'); return; }
        if (!begun.has(row)) {
          begun.add(row); row.classList.add('is-paying'); row.style.opacity = '1';
          if (typeof row.animate === 'function') revealAnimations.push(row.animate([
            { opacity: 0, transform: 'translateX(-14px)' },
            { opacity: 1, transform: 'translateX(0)' }
          ], { duration: 440, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' }));
        }
        const progress = Math.min(1, elapsed / duration);
        if (progress < 1) complete = false;
        else row.classList.remove('is-paying');
      });
      if (complete) { table.dataset.revealState = 'complete'; revealFrame = 0; }
      else revealFrame = requestAnimationFrame(frame);
    }
    revealFrame = requestAnimationFrame(frame);
  }
  root.querySelector('.dp-screen').style.setProperty('--dp-map', `url("${assets.map}")`);
  root.querySelector('.dp-steps').innerHTML = stages.map((s, i) => `<button type="button" data-step="${i}">${String(i + 1).padStart(2, '0')} ${s}</button>`).join('');
  function render() {
    cancelReveal();
    root.querySelector('.dp-screen').dataset.stage = String(stage);
    root.querySelector('.dp-title').textContent = stages[stage];
    const guideStage = [0,4,5,6,7].includes(stage);
    root.querySelector('.dp-title').hidden = guideStage;
    root.querySelectorAll('[data-step]').forEach(button => { if (Number(button.dataset.step) === stage) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current'); });
    body.classList.remove('dp-announcement');
    body.classList.toggle('dp-chart-layout', stage === 2 || stage === 3);
    next.textContent = '次へ▶';
    if (guideStage) {
      const ranked = data.map((player,index)=>({player,index})).sort((a,b)=>total(b.player)-total(a.player)||a.index-b.index);
      const player = stage === 4 ? ranked[0]?.player : stage === 5 ? ranked[ranked.length-1]?.player : null;
      const copy = stage===0 ? '配当金のお時間です。' : stage===4 ? '現在トップの冒険者はこの方です' : stage===5 ? '逆に、最下位の冒険者はこの方です' : stage===6 ? options.marketMessage : '引き続き、頑張ってくださいね！';
      const voice = stage===0 ? '配当アナウンス1' : stage===4 ? '配当アナウンス2' : stage===5 ? `配当アナウンス${options.lastPlaceVoice === '3-2' ? '3-2' : '3-1'}` : stage===7 ? '配当アナウンス4' : null;
      const content = stage===0 ? `<h2>配当金が振り込まれます</h2><div class="dp-turn">${options.completedTurn}ターン終了</div><div class="dp-envelope" role="img" aria-label="配当の封筒と金貨"><img src="${assets.gold}" alt=""></div>` : player ? `${icon(player)}<span>${player.name}</span><strong>${format(total(player))}G</strong>` : '';
      // Keep the staff art and AN02 frame fixed between the market notice
      // and closing line. Only the copy wraps as needed.
      body.innerHTML = `<div class="dp-guide-scene${stage===6?' dp-guide-market':stage===7?' dp-guide-final':''}">${content?`<div class="dp-guide-summary">${content}</div>`:''}<img class="dp-guide-staff" src="images/characters/npc/jobs/ギルド-店員.webp" alt="ギルドのお姉さん"><div class="dp-guide-banner"><span class="dp-guide-speaker">ギルドのお姉さん</span><div class="dp-guide-copy">${stage===6?'':copy}</div></div></div>`;
      const banner = body.querySelector('.dp-guide-banner');
      banner.append(next);
      if (stage===6) {
        next.disabled = true;
        const text = body.querySelector('.dp-guide-copy');
        const waitForMarketSound = options.marketSound
          ? options.readOnly
            ? window.GameSE?.waitForEnd?.(options.marketSound)
            : window.GameSE?.playAndWait?.(options.marketSound,{shared:true,eventId:`${options.eventId}:market`})
          : Promise.resolve();
        Promise.resolve(waitForMarketSound).catch(error => console.warn('[配当] 価格変動SEを再生できません:',error)).then(() => {
          if (!root.isConnected || stage !== 6 || !banner.isConnected) return;
          text.textContent = copy;
          if (options.marketVoice) {
            marketVoice = options.marketVoice;
            window.GameSE?.play?.(marketVoice, { eventId: `${options.eventId}:market-voice` })?.catch(error => console.warn('[配当] 価格変動のボイスを再生できません:',error));
          }
          next.disabled = options.readOnly === true;
        });
      } else {
        guideAudio = new Audio(`sounds/ガイド/${voice}.mp3`);
        const slider = document.getElementById('seVolumeSlider'); guideAudio.volume = slider ? Math.max(0,Math.min(1,Number(slider.value)/100)) : .7;
        Promise.resolve(window.GameSE ? window.GameSE.playLocal(guideAudio) : guideAudio.play()).catch(error => console.warn('[配当] 音声を再生できません:', error));
      }
    }
    if (stage === 1) body.innerHTML = `<table class="dp-receipts"><colgroup><col class="dp-col-player"><col class="dp-col-income"><col class="dp-col-property"><col class="dp-col-yield"></colgroup><thead><tr><th scope="col">プレイヤー</th><th scope="col">配当金</th><th scope="col">保有資産額</th><th scope="col" data-tooltip="資産価格で重み付けした平均利回り">平均利回り</th></tr></thead><tbody>${data.map(p => {
      return `<tr class="dp-receipt"><th scope="row"><div class="dp-person">${icon(p)}<span class="dp-name">${p.name}</span></div></th><td><strong class="dp-income" aria-label="配当金 +${format(p.income)}G"><span class="dp-amount-value" aria-hidden="true">+${format(p.income)}G</span></strong></td><td class="dp-property-value">${format(p.property)}G</td><td class="dp-average-yield">${p.property > 0 && Number.isFinite(p.averageYield) ? `${p.averageYield.toFixed(1)}%` : '—'}</td></tr>`;
    }).join('')}</tbody></table>`;
    if (stage === 2) body.innerHTML = `<div class="dp-chart-top dp-key"><span><i></i>資産</span><span><i></i>ゴールド</span></div><div class="dp-plot"></div><div class="dp-axis-players">${data.map(p => `<div class="dp-axis-player"><strong class="dp-axis-head">${format(total(p))}G</strong>${icon(p)}<span class="dp-player-name">${p.name}</span></div>`).join('')}</div>`;
    if (stage === 3) body.innerHTML = `<div class="dp-chart-top" aria-hidden="true"></div><div class="dp-plot"></div><div class="dp-axis-players dp-legends">${data.map(p => `<div class="dp-axis-player dp-legend"><span class="dp-axis-head"><span class="dp-swatch" style="--player-color:${p.color}" aria-label="${p.name}の線"></span></span>${icon(p)}<span class="dp-player-name">${p.name}</span></div>`).join('')}</div>`;
    body.querySelector('.dp-axis-players')?.style.setProperty('grid-template-columns', `repeat(${data.length},minmax(0,1fr))`);
    if (stage === 2 || stage === 3) chartMotion = { stage, startedAt: performance.now() - Math.max(0, Date.now() - (options.startedAt || Date.now())), reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
    draw();
    if (stage === 1) revealReceipts();
    else if (stage === 2 || stage === 3) revealChart();
  }
  function draw() {
    const plot = body.querySelector('.dp-plot');
    if (!plot) { fitReceiptText(); return; }
    const width = plot.getBoundingClientRect().width;
    if (width < 1) return;
    const axisFont = Math.min(20, Math.max(14, window.innerWidth * .013));
    const height = Math.round(plot.getBoundingClientRect().height), right = 14, top = 16, bottom = 28;
    const values = data.flatMap(p => stage === 2 ? [p.property, p.cash < 0 ? p.cash : total(p)] : p.history);
    const min = Math.min(0, ...values), max = Math.max(0, ...values);
    const range = Math.max(1, max - min);
    const magnitude = 10 ** Math.floor(Math.log10(range / 4));
    const step = Math.max(1, Math.ceil(range / 4 / magnitude) * magnitude);
    const upper = Math.max(step, Math.ceil(max * 1.12 / step) * step);
    const lower = min < 0 ? Math.floor(min * 1.12 / step) * step : 0;
    const tickText = value => width < 420 ? `${value / 10000}万G` : `${format(value)}G`;
    const ruler = document.createElement('canvas').getContext('2d');
    ruler.font = `700 ${axisFont}px ${getComputedStyle(root).fontFamily}`;
    const left = Math.ceil(Math.max(ruler.measureText(tickText(upper)).width, ruler.measureText(tickText(lower)).width)) + 18;
    const chartWidth = width - left - right, chartHeight = height - top - bottom;
    const y = n => top + chartHeight * (upper - n) / (upper - lower);
    let markup = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${stages[stage]}。金額の単位はG。4人分を表示">`;
    if (stage === 2) markup += `<defs>
      <linearGradient id="dp-bar-blue" x1="0%" y1="0%" x2="100%" y2="0%"><stop stop-color="#58b5dc"/><stop offset=".5" stop-color="#83cce9"/><stop offset="1" stop-color="#58b5dc"/></linearGradient>
      <linearGradient id="dp-bar-gold" x1="0%" y1="0%" x2="100%" y2="0%"><stop stop-color="#dfb640"/><stop offset=".5" stop-color="#f5d575"/><stop offset="1" stop-color="#dfb640"/></linearGradient>
      </defs>`;
    for (let value = lower; value <= upper; value += step) markup += `<line class="dp-gridline" x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}"/><text class="dp-y-tick" x="${left - 8}" y="${y(value) + axisFont * .35}" text-anchor="end">${tickText(value)}</text>`;
    markup += `<line class="dp-axis-line" data-axis="y" x1="${left}" x2="${left}" y1="${top}" y2="${y(lower)}"/><line class="dp-axis-line" data-axis="x" x1="${left}" x2="${width - right}" y1="${y(0)}" y2="${y(0)}"/>`;
    if (stage === 2) data.forEach((p, i) => {
      const column = chartWidth / data.length, bar = Math.min(column * (width < 420 ? .72 : .48), 70), x = left + column * (i + .5) - bar / 2;
      const brief = n => bar < 59 ? `${n / 10000}万G` : `${format(n)}G`;
      markup += `<defs><clipPath id="dp-bar-clip-${i}"><rect class="dp-bar-clip" x="${x - 2}" y="${top}" width="${bar + 4}" height="${chartHeight}" data-top-height="${y(0) - y(p.cash < 0 ? p.property : total(p))}" data-bottom-height="${p.cash < 0 ? y(p.cash) - y(0) : 0}"/></clipPath></defs><g class="dp-bar-player" clip-path="url(#dp-bar-clip-${i})">`;
      markup += stackedBarMarkup(x, bar, y(0), y(p.property), y(p.cash < 0 ? p.cash : total(p)), brief(p.property), brief(p.cash), p.cash < 0);
      markup += '</g>';
    });
    if (stage === 3) {
      const count = data[0].history.length, x = i => left + chartWidth * i / Math.max(1, count - 1);
      for (let i = 0; i < count; i++) if (width >= 420 || i === 0 || i === count - 1 || i % 2 === 0) markup += `<text x="${x(i)}" y="${height - 5}" text-anchor="${i === count - 1 ? 'end' : 'middle'}">${options.historyTurns[i]}</text>`;
      markup += `<defs><clipPath id="dp-history-clip"><rect class="dp-history-clip" x="${left - 4}" y="${top - 4}" width="${chartWidth + 8}" height="${chartHeight + 8}"/></clipPath></defs><g clip-path="url(#dp-history-clip)">`;
      // Shared segments alternate their colors on the same exact coordinates.
      // No offset is added to the monetary values to separate overlapping lines.
      for (let i = 1; i < count; i++) {
        const segments = new Map();
        data.forEach(p => {
          const key = `${p.history[i - 1]}:${p.history[i]}`;
          if (!segments.has(key)) segments.set(key, []);
          segments.get(key).push(p);
        });
        for (const peers of segments.values()) {
          const p = peers[0], points = `${x(i - 1)},${y(p.history[i - 1])} ${x(i)},${y(p.history[i])}`;
          markup += `<polyline points="${points}" fill="none" stroke="#fcfcfc55" stroke-width="4.5"/>`;
          peers.forEach((p, j) => {
            const dash = peers.length > 1 ? `stroke-dasharray="8 ${8 * (peers.length - 1)}" stroke-dashoffset="${-j * 8}"` : '';
            markup += `<polyline data-history-player="${data.indexOf(p)}" points="${points}" fill="none" stroke="${p.color}" stroke-width="3.25" ${dash}/>`;
          });
        }
      }
      for (let i = 0; i < count; i++) {
        const points = new Map();
        data.forEach(p => { const n = p.history[i]; if (!points.has(n)) points.set(n, []); points.get(n).push(p); });
        for (const [n, peers] of points) {
          peers.slice().reverse().forEach(p => {
            const j = peers.indexOf(p);
            markup += `<circle cx="${x(i)}" cy="${y(n)}" r="${3.5 + j * 1.5}" fill="${j === 0 ? '#f7f7ef' : 'none'}" stroke="${p.color}" stroke-width="1.5"><title>${peers.map(p => p.name).join('・')} ${options.historyTurns[i]}ターン: ${format(n)}G</title></circle>`;
          });
        }
      }
      markup += '</g>';
    }
    plot.innerHTML = markup + '</svg>';
    body.querySelector('.dp-axis-players')?.style.setProperty('--dp-axis-left', `${left}px`);
    chartScene = { plot, baseline: y(0), width: chartWidth,
      bars: [...plot.querySelectorAll('.dp-bar-clip')], labels: [...body.querySelectorAll('.dp-axis-player')],
      history: plot.querySelector('.dp-history-clip') };
    updateChart(performance.now());
    fitLegendNames();
  }
  function fitLegendNames() {
    body.querySelectorAll('.dp-player-name').forEach(name => {
      const label = name.parentElement;
      const base = parseFloat(getComputedStyle(label).fontSize);
      name.style.fontSize = `${base}px`;
      const available = label.getBoundingClientRect().width;
      const needed = name.scrollWidth;
      if (available > 0 && needed > available) name.style.fontSize = `${Math.floor(base * available / needed * 100) / 100}px`;
    });
  }
  function fitReceiptText() {
    const table = body.querySelector('.dp-receipts');
    if (!table) return;
    const base = parseFloat(getComputedStyle(table).fontSize);
    table.querySelectorAll('thead th,.dp-property-value,.dp-average-yield').forEach(cell => {
      cell.style.fontSize = `${base}px`;
      const style = getComputedStyle(cell), available = cell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const range = document.createRange(); range.selectNodeContents(cell);
      const needed = range.getBoundingClientRect().width;
      if (available > 0 && needed > available) cell.style.fontSize = `${base * available / needed * .98}px`;
    });
  }
  function stackedBarMarkup(x, width, baseline, assetsTop, goldTop, assetValue, goldValue, negativeGold) {
    const middle = x + width / 2;
    let result = `<g aria-label="資産 ${assetValue}、ゴールド ${goldValue}">
      <rect x="${x}" y="${assetsTop}" width="${width}" height="${baseline - assetsTop}" fill="url(#dp-bar-blue)"/>
      <rect x="${x}" y="${negativeGold ? baseline : goldTop}" width="${width}" height="${negativeGold ? goldTop - baseline : assetsTop - goldTop}" fill="url(#dp-bar-gold)"/>`;
    for (const [value, centerY] of [[assetValue, (baseline + assetsTop) / 2], [goldValue, ((negativeGold ? baseline : assetsTop) + goldTop) / 2]]) {
      const segmentHeight = value === assetValue ? baseline - assetsTop : (negativeGold ? goldTop - baseline : assetsTop - goldTop);
      if (segmentHeight < 18) continue;
      result += `<text class="dp-bar-value" x="${middle}" y="${centerY + 4}" text-anchor="middle" style="font-size:${width < 40 ? 11 : 12}px">${value}</text>`;
    }
    return result + '</g>';
  }
  function updateChart(now) {
    if (!chartMotion || !chartScene) return true;
    const elapsed = now - chartMotion.startedAt;
    let done = true;
    const progress = (delay, duration) => chartMotion.reduced ? 1 : Math.max(0, Math.min(1, (elapsed - delay) / duration));
    if (chartMotion.stage === 2) chartScene.bars.forEach((bar, index) => {
      const value = progress(120 + index * 650, 650), eased = 1 - (1 - value) ** 3;
      const above = Number(bar.dataset.topHeight) * eased, below = Number(bar.dataset.bottomHeight) * eased;
      bar.setAttribute('y', String(chartScene.baseline - above)); bar.setAttribute('height', String(above + below));
      const label = chartScene.labels[index];
      const fade = Math.min(1, value * 2);
      label.style.opacity = String(fade * fade * (3 - 2 * fade));
      if (value < 1) done = false;
    });
    else {
      const value = progress(100, 1200);
      chartScene.history.setAttribute('width', String((chartScene.width + 8) * value));
      if (value < 1) done = false;
    }
    chartScene.plot.dataset.revealState = done ? 'complete' : 'playing';
    return done;
  }
  function revealChart() {
    const motion = chartMotion;
    function frame(now) {
      if (chartMotion !== motion || !root.isConnected || !chartScene?.plot.isConnected) return;
      if (updateChart(now)) revealFrame = 0;
      else revealFrame = requestAnimationFrame(frame);
    }
    revealFrame = requestAnimationFrame(frame);
  }

  next.disabled = options.readOnly === true;
  next.onclick = async () => {
    if (next.disabled) return;
    next.disabled = true;
    window.GameSE?.play?.('confirm', { shared:true }).catch(error => console.warn('[SE] 画面送り音を再生できません:', error));
    try { await options.onNext(); }
    catch (error) { if (root.isConnected) { next.disabled = false; next.textContent = '再試行'; } console.error('配当画面の進行:', error); }
  };
  const observer = new ResizeObserver(draw); observer.observe(body);
  render();
  const cleanup = () => {
    cancelReveal();
    observer.disconnect();
    if (guideAudio) { if (window.GameSE) window.GameSE.stop(guideAudio); else guideAudio.pause(); guideAudio = null; }
    if (marketVoice) window.GameSE?.stopSound?.(marketVoice);
  };
  return cleanup;
 }
 let musicEvent = null, dividendMusicStarted = false;
 function music(eventId) {
  if (musicEvent === eventId) return;
  musicEvent = eventId;
  dividendMusicStarted = bossBattleBGM.paused;
  if (!dividendMusicStarted) return;
  setupBGM(dividendBGM, dividendBGMGain, setDividendBGMGain);
 }
 window.DividendPresentation.show = function(summary, readOnly, onNext) {
  this.close();
  music(summary.eventId);
  const overlay = document.createElement('div'); overlay.id = 'dividendPresentationOverlay';
  overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-label','配当と総資産');
  overlay.innerHTML = '<div id="nmnl-dividend-lab"><nav class="dp-steps" hidden></nav><section class="dp-screen"><h2 class="dp-title"></h2><div class="dp-body" aria-live="polite"></div><footer class="dp-footer"><small></small><button type="button" class="dp-next">次へ</button></footer></section></div>';
  overlay.addEventListener('click', event => {
    if (event.target.closest('button, input, select, textarea, a')) return;
    const button = overlay.querySelector('.dp-next');
    if (button && !button.disabled) button.click();
  });
  document.body.append(overlay);
  const previousOverflow = [document.documentElement.style.overflow,document.body.style.overflow];
  document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden';
  const entries = summary.presentation || [];
  const players = entries.map(p => ({...p, icon:PLAYER_CONTENTS[p.characterId]?.icon || PLAYER_CONTENTS[1].icon,
    color:PLAYER_CONTENTS[p.characterId]?.graphColor || colors[p.characterId] || '#b0aacb', history:p.history.map(point => point.value)}));
    const serverNow = window.onlineGame?.isOnline ? window.onlineGame.sync?.serverNow?.() : null;
    const startedAt = Number.isFinite(serverNow) ? Date.now() - (serverNow - summary.startedAt) : summary.startedAt;
  const marketKind = summary.marketSeason?.kind;
  const marketVoice = marketKind === 'crash' ? 'marketCrash' : marketKind === 'boom' ? 'marketBoom' : marketKind === 'normal' ? 'marketStableVoice' : null;
    const cleanup = mount(overlay.firstElementChild, {stage:['announcement','dividend','assets','history','leader','last','market','closing'].indexOf(summary.stage),
    players, completedTurn:summary.completedTurn, startedAt, lastPlaceVoice:summary.lastPlaceVoice,
    marketMessage:summary.marketSeason?marketSeasonMessage(summary.marketSeason):'',marketSound:summary.marketSeason?marketSeasonSound(summary.marketSeason):null,marketVoice,eventId:summary.eventId,
    historyTurns:entries[0]?.history.map(point => point.turn) || [], readOnly, onNext});
  active = () => { cleanup(); overlay.remove(); document.documentElement.style.overflow=previousOverflow[0]; document.body.style.overflow=previousOverflow[1]; };
 };
 window.DividendPresentation.stopMusic = function() {
  if (musicEvent === null) return;
  musicEvent = null;
  if (dividendMusicStarted) { dividendBGM.pause(); dividendBGM.preload = 'none'; const nextPlayer = window.onlineGame?.isOnline ? window.onlineGame.sync?.state?.players?.[window.onlineGame.sync?.state?.activePlayerIndex] : (Array.isArray(window.players) ? window.players[0] : null); if (nextPlayer?.underground) window.transitionAreaBGM?.('underground', 0); else if (nextPlayer) window.MapAreaAudio?.updateForPlayer(nextPlayer, { immediate:true }); else setupAdventureBGM(); }
  dividendMusicStarted = false;
 };
})();
