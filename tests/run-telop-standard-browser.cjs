// Check real CSS/DOM in an isolated headless Chrome; no screenshots or live game saves.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const fileMode = process.env.NMNL_TELOP_FILE_TEST === '1';
const css = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
    .map(match => match[1]).filter(file => !file.startsWith('telop-standard.css'));
const modules = ['common-announcements.js', 'lost-magic-ui.js', 'hatataki-haken-ui.js', 'special-item-ui.js', 'money-transfer-ui.js',
    'fukubukuro-ui.js', 'duplicate-item-ui.js', 'guidebook-ui.js', 'underground-ui.js', 'ponzi-presentation.js'];

async function childMain() {
    const failures = [], checks = [];
    const assert = (condition, label) => { if (!condition) failures.push(label); };
    const wait = () => new Promise(resolve => setTimeout(resolve, 32));
    const load = (tag, file) => new Promise((resolve, reject) => {
        const element = document.createElement(tag);
        if (tag === 'link') { element.rel = 'stylesheet'; element.href = new URL(file, document.baseURI).href; } else element.src = new URL(file, document.baseURI).href;
        element.onload = resolve; element.onerror = () => reject(new Error('Cannot load ' + file)); document.head.append(element);
    });
    const q = selector => document.querySelector(selector);
    const box = element => { const r = element.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; };
    const sameBox = (a, b) => a.every((value, i) => Math.abs(value - b[i]) < .7);
    const style = element => {
        const s = getComputedStyle(element);
        return [s.fontFamily, s.fontSize, s.lineHeight, s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft,
            s.borderTopWidth, s.borderRadius, s.backgroundImage, s.position, s.display, s.transform, ...box(element)];
    };
    try {
        const popup = q('#eventPopup'), copy = q('#eventPopupMessage'), portrait = q('.announcement-portrait'), next = q('#eventPopupButton');
        CommonAnnouncements.render(popup, { common: true, subjectIndex: 0 }, { players, icon });
        await wait();
        const reference = { box: box(popup), portrait: box(portrait), copy: getComputedStyle(copy), next: style(next) };
        reference.copyFont = reference.copy.fontSize;
        const protectedNodes = [...document.querySelectorAll('[data-protected]')];
        const before = protectedNodes.map(style);
        popup.style.display = 'none';
        await load('link', 'telop-standard.css'); await load('script', 'telop-standard.js'); await wait();
        const standard = window.TelopStandard;
        protectedNodes.forEach((element, i) => assert(JSON.stringify(style(element)) === JSON.stringify(before[i]), 'protected UI: ' + element.dataset.protected));
        const ctx = { players, active: 0, icon, control: false, online: false, book: { withdrawals: [] }, turnKey: '1:0' };
        const cases = [];
        const add = (name, build, selector, upper, options = {}) => cases.push({ name, build, selector, upper, options });
        const lostView = { actorIcon: icon(0), targetIcon: icon(1), targets: [{ index: 1, name: players[1].name, icon: icon(1), hasMagic: true }],
            targetName: players[1].name, magics: [{ id: 1, name: 'テスト魔法', icon: icon(0) }], magicId: 1, magicName: 'テスト魔法', blockedText: '無敵の加護で防いだ！', recovery: true };
        for (const stage of ['intro', 'result', 'blocked']) {
            add('lost-' + stage, () => LostMagicUI.render({ ...lostView, stage }), '.lost-magic-an02', '.lost-magic-panel',
                { message: '.lost-magic-an02-copy', portrait: 'img', next: '.lost-magic-an02-next' });
        }
        for (const [itemId, stages] of [[25, ['result']]]) {
            for (const stage of stages) add('special-' + itemId + '-' + stage, () => SpecialItemUI.show({ itemId, stage, destination: 'town', players, actorIndex: 0, icon }),
                '.special-item-announcement', '.special-item-panel', { message: 'span', portrait: 'img' });
        }
        for (const kind of ['expired', 'immunity-expired', 'last-chance']) {
            add('guidebook-' + kind, () => GuidebookUI.render({ kind, owner: 0 }, ctx), '.guidebook-an02', '.guidebook-panel',
                { message: 'p', portrait: 'img', next: '.guidebook-next', notice: '.guidebook-notice', reserveSpace: true });
        }
        add('second-book', () => GuidebookUI.showSecondBook(players, 0, icon), '.guidebook-an02', '.guidebook-panel',
            { message: 'p', portrait: 'img', next: '.guidebook-next', reserveSpace: true });
        add('special-reward', () => GuidebookUI.renderSpecialReward({ status: 'announcing', page: 0 }, ctx), '.guidebook-an02', '.guidebook-panel',
            { message: 'p', portrait: 'img', next: '.guidebook-next', reserveSpace: true });
        add('withdrawal', () => GuidebookUI.announceWithdrawals([0], players, icon), '.guidebook-withdrawal', null,
            { message: 'p', portrait: 'img', passive: true });
        for (const stage of ['debt', 'paid', 'guard']) {
            add('underground-' + stage, () => UndergroundUI.render({ players, activePlayerIndex: 0, currentTurn: 1,
                undergroundFlow: { stage, page: 0, step: stage, playerIndex: 0 }, matchPhase: 'playing' }, false, () => Promise.resolve()),
                '.ug-caption', '.ug-scene', { message: 'p', portrait: 'img', next: '.ug-next', speaker: '.ug-speaker' });
        }
        add('ponzi', () => PonziPresentation.open({ players, activePlayerIndex: 0, ponzi: { phase: 'choices', investments: [0, 0], round: 0 } },
            { submit: async () => null }), '.ponzi-panel', '.ponzi-frame', { message: '.ponzi-text', speaker: '.ponzi-speaker', next: '.ponzi-next' });
        function closeAll() {
            LostMagicUI.hide(); HatatakiHakenUI.hide(); MoneyTransferUI.close(); SpecialItemUI.hide(); FukubukuroUI.close();
            DuplicateItemUI.hide(); GuidebookUI.reset(); UndergroundUI.suspend(); PonziPresentation.close(false);
        }
        for (const entry of cases) {
            closeAll(); window.TelopStandard = undefined;
            entry.build();
            if (entry.name === 'fukubukuro') CommonAnnouncements.fitText(q('.fukubukuro-an02-copy'));
            await wait();
            const panel = q(entry.selector);
            if (!panel) { failures.push(entry.name + ': no panel'); continue; }
            const upper = entry.upper && q(entry.upper), upperBox = upper && box(upper);
            const options = { ...entry.options };
            for (const key of ['message', 'portrait', 'next', 'speaker', 'notice']) if (typeof options[key] === 'string') options[key] = panel.querySelector(options[key]);
            const handler = options.next?.onclick;
            const frame = standard.apply(panel, options); await wait();
            assert(sameBox(box(frame), reference.box), entry.name + ': frame ' + JSON.stringify(box(frame)) + ' vs ' + JSON.stringify(reference.box));
            const message = frame.querySelector('.telop-standard-copy');
            const textStyle = getComputedStyle(message), fontSize = parseFloat(textStyle.fontSize);
            assert(fontSize <= parseFloat(reference.copyFont) + .1 && fontSize >= 14, entry.name + ': text font ' + textStyle.fontSize);
            assert(Math.abs(parseFloat(textStyle.lineHeight) / fontSize - 1.35) < .01, entry.name + ': line height');
            if (options.portrait) assert(sameBox(box(options.portrait), reference.portrait), entry.name + ': portrait');
            if (options.next) {
                assert(options.next.onclick === handler, entry.name + ': next handler changed');
                if (!options.next.hidden) {
                    assert(getComputedStyle(options.next).fontSize === getComputedStyle(next).fontSize, entry.name + ': next font');
                    assert(sameBox(box(options.next), reference.next.slice(-4)), entry.name + ': next geometry ' + JSON.stringify(box(options.next)));
                }
            }
            if (upper && !upper.hidden) assert(sameBox(box(upper), upperBox), entry.name + ': upper panel moved ' + JSON.stringify(upperBox) + ' -> ' + JSON.stringify(box(upper)));
            closeAll(); window.TelopStandard = standard; entry.build(); await wait();
            assert(Boolean(q(entry.selector)?.classList.contains('telop-standard-frame') || q(entry.selector)?.querySelector('.telop-standard-frame')), entry.name + ': module did not opt in');
            if (entry.name === 'ponzi') {
                for (const stage of ['payout', 'report']) {
                    q('#ponzi-preview').dataset.stage = stage;
                    assert(getComputedStyle(q('.ponzi-panel')).display === 'none', 'ponzi ' + stage + ': hidden caption became visible');
                }
            }
            checks.push(entry.name);
        }
        closeAll();
        // A money-popup notification specific to this item must also use the original money geometry.
        popup.classList.add('hatataki-announcement'); popup.style.display = 'block'; await wait();
        assert(sameBox(box(popup), reference.box), 'hatataki shared popup geometry'); popup.style.display = 'none';
        parent.postMessage({ telopReport: true, viewport: [innerWidth, innerHeight], checks, failures }, '*');
    } catch (error) {
        parent.postMessage({ telopReport: true, viewport: [innerWidth, innerHeight], checks, failures: [...failures, error.stack] }, '*');
    }
}

const stub = `
const icon=()=>'/portrait.webp';
const players=[{name:'プレイヤー1',money:100000,magic:[1],inventory:[1],characterId:1},{name:'プレイヤー2',money:100000,magic:[1],inventory:[],characterId:1}];
const ITEM_CONTENTS=Object.fromEntries([[1,'人力車'],[13,'ロスノート'],[17,'叩き派遣'],[18,'ロストマジック'],[19,'闇みずほ'],[21,'闇ヤマト'],[24,'ランドマークワープ'],[25,'みんなで平均値'],[26,'アイテム封じ'],[29,'お楽しみ福袋'],[32,'複製さん'],[33,'攻略本2']].map(([id,name])=>[id,{name,price:1000,effect:'説明'}]));
window.GameSE={play:()=>Promise.resolve(),playLocal:()=>Promise.resolve()};
window.Plane02Layout={apply(){},release(){}};
window.SpecialItemRules={destinations:[{key:'town',name:'街',image:icon()}],average:()=>100000};
window.DiceAnimation={createRenderer:()=>({draw(){}})};window.DiceStopMotion={sample(){}};
window.UndergroundRules={stake:10000,track:[[0,0]],holdsMonopolizedBranch:()=>false};
window.PonziRules={pending:()=>true,config:{investmentUnit:1000}};
window.transitionAreaBGM=()=>{};window.MapAreaAudio={updateForPlayer(){}};
const bossBattleBGM={paused:true},bossVictoryBGM={paused:true};function stopAllBGM(){}function getMapZoomUI(){return 1;}
`;
const fixture = `<!doctype html><meta charset="utf-8">${fileMode ? `<base href="${pathToFileURL(root + path.sep).href}">` : ''}${css.map(file => `<link rel="stylesheet" href="${file}">`).join('')}
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}.game-container{position:fixed;inset:0}</style>
<body><div class="game-container"></div>
<div id="eventPopup" class="event-popup common-announcement" style="display:block"><img class="announcement-portrait" src="/portrait.webp"><div class="event-popup-title"></div><p id="eventPopupMessage" class="event-popup-message">魔法を失わせるプレイヤーを選んでください。</p><button id="eventPopupButton" class="event-popup-button">次へ▶</button></div>
<section class="boss-opening boss-opening-start" data-protected="opening"><div class="boss-opening-banner"><span class="boss-opening-speaker">ギルドのお姉さん</span><p class="boss-opening-copy">開始アナウンス</p></div></section>
<div id="endingPresentationOverlay" class="bf-ending-sequence"><div class="bf-banner" data-protected="ending"><p class="bf-copy">終了アナウンス</p></div></div>
<div class="maou-dialogue-root" style="display:flex"><div class="maou-dialogue-screen"><div class="maou-dialogue-message" data-protected="maou">魔王の会話</div></div></div>
<script>addEventListener('error',event=>parent.postMessage({telopReport:true,viewport:[innerWidth,innerHeight],checks:[],failures:[event.message]},'*'));</script>
<script>${stub}</script>${modules.map(file => `<script src="${file}"></script>`).join('')}<script>(${childMain.toString()})()</script></body>`;
const parentPage = `<!doctype html><meta charset="utf-8"><body><pre id="report"></pre><script>
const sizes=[[1920,1080],[852,393],[600,393],[393,852]];const results=[];let frame;
function next(){if(!sizes.length){document.body.dataset.complete='true';document.getElementById('report').textContent=JSON.stringify({results,failures:results.flatMap(r=>r.failures.map(f=>r.viewport.join('x')+': '+f))});return;}const [w,h]=sizes.shift();frame=document.createElement('iframe');frame.style.cssText='position:absolute;left:0;top:0;border:0;width:'+w+'px;height:'+h+'px';frame.src='/fixture';document.body.append(frame);}
addEventListener('message',e=>{if(!e.data?.telopReport)return;results.push(e.data);frame.remove();next();});next();</script>`;
const types = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/' || pathname === '/fixture') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(pathname === '/' ? parentPage : fixture); return; }
    const file = path.resolve(root, '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => { if (error) res.writeHead(404).end(); else res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(data); });
});
server.listen(0, '127.0.0.1', () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nmnl-telop-chrome-'));
    if (fileMode) {
        fs.writeFileSync(path.join(profile, 'fixture.html'), fixture);
        fs.writeFileSync(path.join(profile, 'runner.html'), parentPage.replace("frame.src='/fixture'", 'frame.src=' + JSON.stringify(pathToFileURL(path.join(profile, 'fixture.html')).href)));
    }
    const child = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu',
        ...(process.env.NMNL_CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : []),
        ...(fileMode ? ['--allow-file-access-from-files'] : []),
        '--no-first-run', '--no-default-browser-check', '--mute-audio', '--disable-background-networking', '--blink-settings=imagesEnabled=false',
        '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--user-data-dir=' + profile,
        '--window-size=1000,800', '--virtual-time-budget=60000', '--dump-dom', fileMode ? pathToFileURL(path.join(profile, 'runner.html')).href : `http://127.0.0.1:${server.address().port}/`], { windowsHide: true });
    let output = '', errors = '';
    child.stdout.on('data', value => { output += value; }); child.stderr.on('data', value => { errors += value; });
    const timeout = setTimeout(() => child.kill(), 60000);
    child.on('error', error => { console.error(error); server.close(); process.exitCode = 1; });
    child.on('close', (code, signal) => {
        clearTimeout(timeout); server.close();
        const encoded = output.match(/<pre id="report">([\s\S]*?)<\/pre>/)?.[1];
        if (!encoded || !output.includes('data-complete="true"')) { console.error('Browser test incomplete', { code, signal }, errors.slice(-1000)); process.exitCode = 1; return; }
        const report = JSON.parse(encoded.replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
        console.log(JSON.stringify({ viewports: report.results.map(result => ({ viewport: result.viewport, cases: result.checks.length })), failures: report.failures }, null, 2)); if (report.failures.length) process.exitCode = 1;
    });
});
