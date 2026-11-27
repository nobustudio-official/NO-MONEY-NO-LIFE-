// Isolated real-DOM checks; Chrome stays headless and uses a fresh profile.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { ITEM_CONTENTS } = require('../data.js');
const root = path.resolve(__dirname, '..');
const output = process.argv[2] ? path.resolve(process.argv[2]) : fs.mkdtempSync(path.join(os.tmpdir(), 'nmnl-fuku-report-'));
const cards = Object.entries(ITEM_CONTENTS).map(([id, item]) => ({ id: Number(id), name: item.name, rank: item.rank })).sort((a, b) => b.name.length - a.name.length);
const choices = [...cards.filter(card => card.id !== 15 && card.rank === 1).slice(0, 5), ...cards.filter(card => card.rank === 2).slice(0, 1)];

function fixtureSetup() {
    const nativeFillRect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
        if (this.canvas.classList.contains('fukubukuro-dice')) {
            const m = this.getTransform(), bounds = window.__diceBounds;
            for (const [px, py] of [[x, y], [x + width, y], [x, y + height], [x + width, y + height]]) {
                const sx = m.a * px + m.c * py + m.e, sy = m.b * px + m.d * py + m.f;
                bounds.left = Math.min(bounds.left, sx); bounds.right = Math.max(bounds.right, sx);
                bounds.top = Math.min(bounds.top, sy); bounds.bottom = Math.max(bounds.bottom, sy);
            }
        }
        return nativeFillRect.call(this, x, y, width, height);
    };
    const createRenderer = DiceAnimation.createRenderer;
    const resetBounds = () => { window.__diceBounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity }; };
    DiceAnimation.createRenderer = (canvas, options) => {
        const renderer = createRenderer(canvas, options);
        return { draw(state, time) {
            resetBounds();
            window.__lastDice = { canvas, renderer, state: { ...state } };
            return renderer.draw(state, time);
        } };
    };
    window.__sampleDice = () => {
        const { canvas, renderer, state } = window.__lastDice;
        let samples = 0;
        for (const phase of ['rolling', 'stopping']) for (let elapsed = 0; elapsed <= (phase === 'rolling' ? 5000 : 1100); elapsed += 10) {
            resetBounds();
            renderer.draw({ ...state, phase, began: 0, stopped: 1000, results: [1, 3, 6] }, phase === 'rolling' ? elapsed : 1000 + elapsed);
            const b = window.__diceBounds;
            if (b.left < .5 || b.top < .5 || b.right > canvas.width - .5 || b.bottom > canvas.height - .5) {
                throw Error('Dice clipped: ' + JSON.stringify({ phase, elapsed, bounds: b, size: [canvas.width, canvas.height], scale: state.diceScale }));
            }
            samples++;
        }
        renderer.draw(state, performance.now());
        return { samples, scale: state.diceScale, canvas: [canvas.clientWidth, canvas.clientHeight] };
    };
    let sequence = 0;
    window.__openFuku = (owner = true, choices = window.__choices) => {
        window.__counts = { start: 0, stop: 0, finish: 0 };
        const event = { eventId: 'layout-' + ++sequence, status: 'ready', cards: choices };
        window.__event = event;
        FukubukuroUI.show(event, { name: 'テストプレイヤー' }, {
            owner,
            onStart: async () => { window.__counts.start++; },
            onStop: async () => { window.__counts.stop++; return { ...event, status: 'result', rolls: [1, 3, 6] }; },
            onFinish: async () => { window.__counts.finish++; await new Promise(resolve => setTimeout(resolve, 30)); FukubukuroUI.close(); }
        });
    };
    window.__ready = true;
}

const modules = ['dice-geometry.js', 'dice-stop-motion.js', 'dice-animation.js', 'plane02-layout.js', 'fukubukuro-ui.js'];
const fixture = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/game-panels.css"><link id="fukuCss" rel="stylesheet" href="/fukubukuro-ui.css">
<style>html,body{margin:0;overflow:hidden}.game-container,.game-screen{position:relative;width:100vw;height:100dvh}.game-screen>.game-hud{position:absolute;top:8px;left:8px;right:8px;width:auto;height:58px;padding:0;display:flex;align-items:center;justify-content:center}.game-screen{background:#071b3f}#assetPurchasePopup.gp-root{position:fixed;top:-9999px;left:-9999px;right:auto;bottom:auto;width:800px;height:300px;display:block}</style>
<body><div class="game-container"><div class="game-screen"><header class="game-hud">福袋レイアウト検証</header></div></div>
<div id="assetPurchasePopup" class="gp-root gp-shop gp-shop-no-staff"><div class="gp-heading"><button id="referenceClose" class="gp-close">終了</button></div></div>
<script>const ITEM_CONTENTS={29:{name:'お楽しみ福袋'}};window.__cards=${JSON.stringify(cards)};window.__choices=${JSON.stringify(choices)};window.Audio=class extends EventTarget{constructor(){super();this.currentTime=0;}pause(){}play(){return Promise.resolve();}};window.GameSE={playLocal:()=>Promise.resolve()};</script>
${modules.map(file => `<script src="/${file}"></script>`).join('')}<script>(${fixtureSetup.toString()})()</script>`;

const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname.slice(1));
    if (!name) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fixture); return; }
    const file = path.resolve(root, name), extension = path.extname(file);
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
        '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
    if (!file.startsWith(root + path.sep) || !types[extension] || name.split('/').some(part => part.startsWith('.'))) { res.writeHead(404).end(); return; }
    fs.readFile(file, (error, data) => { if (error) res.writeHead(404).end(); else { res.setHeader('Content-Type', types[extension]); res.end(data); } });
});

async function main() {
    fs.mkdirSync(output, { recursive: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nmnl-fuku-chrome-'));
    const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
        '--headless=new', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--disable-background-networking',
        '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'
    ], { windowsHide: true });
    let socket;
    try {
        const endpoint = await new Promise((resolve, reject) => {
            let errors = '';
            const timeout = setTimeout(() => reject(Error('Chrome startup timed out: ' + errors.slice(-500))), 15000);
            chrome.once('error', error => { clearTimeout(timeout); reject(error); });
            chrome.stderr.on('data', chunk => {
                errors += chunk;
                const url = errors.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];
                if (url) { clearTimeout(timeout); resolve(url); }
            });
        });
        socket = new WebSocket(endpoint);
        await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
        let next = 0;
        const pending = new Map();
        socket.addEventListener('message', event => {
            const message = JSON.parse(event.data), task = pending.get(message.id);
            if (!task) return;
            pending.delete(message.id); clearTimeout(task.timeout);
            if (message.error) task.reject(Error(message.error.message)); else task.resolve(message.result);
        });
        const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
            const id = ++next, timeout = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, 15000);
            pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params, sessionId }));
        });
        const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
        const call = (method, params) => send(method, params, sessionId);
        const evaluate = async expression => {
            const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
            return result.result.value;
        };
        const waitFor = async (expression, attempts = 150) => {
            for (let i = 0; i < attempts; i++) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 30)); }
            throw Error('Condition timed out: ' + expression);
        };
        const delay = ms => evaluate(`new Promise(resolve=>setTimeout(resolve,${ms}))`);
        const screenshot = async name => { const { data } = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, name), Buffer.from(data, 'base64')); };
        await call('Page.enable');
        await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
        await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
        const reports = [];
        for (const [width, height] of process.env.NMNL_ITEM_CHOICE_ONLY === '1' ? [] : [[852, 393], [740, 360], [640, 320], [1024, 432], [1920, 1080]]) {
            await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
            await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
            await waitFor('window.__ready===true');
            await evaluate(`window.__buttonStyle=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return [r.width,r.height,s.fontFamily,s.fontSize,s.fontWeight,s.color,s.backgroundImage,s.backgroundColor,s.borderTopWidth,s.borderTopColor,s.borderRadius]};document.getElementById('fukuCss').sheet.disabled=true;window.__referenceBefore=__buttonStyle(document.getElementById('referenceClose'));document.getElementById('fukuCss').sheet.disabled=false;if(JSON.stringify(__referenceBefore)!==JSON.stringify(__buttonStyle(document.getElementById('referenceClose'))))throw Error('Other shop style changed');__openFuku();`);
            await delay(80);
            const before = await evaluate(`(()=>{if(document.getElementById('assetPurchasePopup').getBoundingClientRect().bottom>=0)throw Error('Reference shop covers the fixture');const cards=[...document.querySelectorAll('.fukubukuro-card')],r=cards[0].getBoundingClientRect();for(const card of cards){if(card.getBoundingClientRect().height<86)throw Error('Card below 86px');}for(const label of document.querySelectorAll('.fukubukuro-card-name')){if(label.scrollWidth>label.clientWidth||getComputedStyle(label).whiteSpace!=='nowrap')throw Error('Name does not fit');}window.__beforeCard={y:r.y,width:r.width,height:r.height};return __beforeCard})()`);
            await evaluate(`document.querySelectorAll('.fukubukuro-card').forEach((card,index)=>{const gold=index===5;if(card.dataset.frameId!==(gold?'BT03-G':'BT03-S')||getComputedStyle(card).borderTopColor!==(gold?'rgb(242, 213, 141)':'rgb(196, 204, 212)'))throw Error('Incorrect rank color at face '+(index+1));});`);
            const dice = await evaluate('__sampleDice()');
            if (dice.scale < .4 || dice.scale > .52) throw Error('Unexpected dice scale: ' + dice.scale);
            if (width === 852) await screenshot('fukubukuro-852x393-ready.png');
            await evaluate(`document.querySelector('.fukubukuro-roll').click()`); await delay(50);
            await evaluate(`document.querySelector('.fukubukuro-roll').click()`);
            await waitFor(`document.querySelector('.fukubukuro-finish')?.hidden===false`);
            await delay(50);
            await evaluate(`(()=>{if(document.querySelector('.fukubukuro-status'))throw Error('Bottom result text remains');if(document.querySelector('.fukubukuro-title').textContent!=='以下のアイテムを入手！')throw Error('Result title incorrect');const button=document.querySelector('.fukubukuro-finish');if(JSON.stringify(__buttonStyle(button))!==JSON.stringify(__buttonStyle(document.getElementById('referenceClose'))))throw Error('Shop finish button differs');for(const card of document.querySelectorAll('.fukubukuro-card')){const r=card.getBoundingClientRect();for(const key of ['y','width','height'])if(Math.abs(r[key]-__beforeCard[key])>.1)throw Error('Card moved/resized: '+key);}for(const label of document.querySelectorAll('.fukubukuro-card-name'))if(label.scrollWidth>label.clientWidth)throw Error('Result name clipped');document.querySelector('.fukubukuro-sp04').click();if(__counts.finish)throw Error('Panel click finished item');})()`);
            await evaluate(`document.querySelectorAll('.fukubukuro-card').forEach((card,index)=>{const gold=index===2;if(card.dataset.frameId!==(gold?'BT03-G':'BT03-S')||getComputedStyle(card).borderTopColor!==(gold?'rgb(242, 213, 141)':'rgb(196, 204, 212)'))throw Error('Result rank color changed');});`);
            if (width === 852) await screenshot('fukubukuro-852x393-result.png');
            await evaluate(`document.querySelector('.fukubukuro-finish').click();document.querySelector('.fukubukuro-finish').click()`);
            await waitFor('!FukubukuroUI.isOpen()');
            await evaluate(`if(__counts.start!==1||__counts.stop!==1||__counts.finish!==1||document.querySelector('.game-screen').inert)throw Error('Finish flow or inert state incorrect');`);
            // Every implemented item name must fit, including result slots.
            for (let offset = 0; offset < cards.length; offset += 6) {
                await evaluate(`__openFuku(true,__cards.slice(${offset},${offset + 6}));`); await delay(30);
                await evaluate(`for(const label of document.querySelectorAll('.fukubukuro-card-name'))if(label.scrollWidth>label.clientWidth)throw Error('Item name clipped: '+label.textContent);`);
            }
            await evaluate(`FukubukuroUI.close();__openFuku(false);FukubukuroUI.show({...__event,status:'result',rolls:[1,3,6]},{name:'observer'});`);
            await waitFor(`document.querySelector('.fukubukuro-finish')?.hidden===false`);
            await evaluate(`const finish=document.querySelector('.fukubukuro-finish');if(!finish.disabled)throw Error('Observer can finish');finish.click();if(__counts.finish)throw Error('Observer callback invoked');FukubukuroUI.close();`);
            reports.push({ viewport: [width, height], card: before, dice, itemNames: cards.length, rankColors: '1-5 silver, 6 gold; preserved in results', resultAndObserver: 'passed', otherShopStyle: 'unchanged' });
        }
        if (process.env.NMNL_ITEM_CHOICE_ONLY === '1') {
            await call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
            await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/tests/item-choice-browser.html` });
            await waitFor(`document.body?.dataset.complete==='true'`, 500);
            const integration = await evaluate(`JSON.parse(document.getElementById('report').textContent)`);
            fs.writeFileSync(path.join(output, 'item-choice-integration-report.json'), JSON.stringify(integration, null, 2));
            console.log(JSON.stringify({ integration, output }, null, 2));
            if (integration.failures.length) throw Error('Item choice regression: ' + JSON.stringify(integration.failures));
        } else {
            fs.writeFileSync(path.join(output, 'fukubukuro-layout-report.json'), JSON.stringify(reports, null, 2));
            console.log(JSON.stringify({ reports, output }, null, 2));
        }
        await send('Browser.close').catch(() => {});
    } finally {
        socket?.close(); chrome.kill(); server.close();
    }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
