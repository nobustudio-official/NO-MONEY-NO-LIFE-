// Runs actual IndexedDB + page reloads in a separate Chrome profile and random origin.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file.endsWith(path.sep) ? path.join(file, 'index.html') : file, (error, data) => {
        if (error) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
    });
});
server.listen(0, '127.0.0.1', () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nmnl-recovery-chrome-'));
    const fileMode = process.env.NMNL_RECOVERY_FILE_TEST === '1';
    const url = fileMode ? pathToFileURL(path.join(__dirname, 'local-match-browser.html')).href : `http://127.0.0.1:${server.address().port}/tests/local-match-browser.html`;
    const child = spawn(chrome, ['--headless=new', ...(process.env.NMNL_CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio',
        ...(fileMode ? ['--allow-file-access-from-files'] : []),
        '--disable-background-networking', '--blink-settings=imagesEnabled=false', '--window-size=1000,800',
        '--user-data-dir=' + profile, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--virtual-time-budget=180000', '--dump-dom', url], { windowsHide: true });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    const timeout = setTimeout(() => child.kill(), 90000);
    child.on('error', error => { console.error(error); server.close(); process.exitCode = 1; });
    child.on('close', (code, signal) => {
        clearTimeout(timeout); server.close();
        const report = stdout.match(/<pre id="report">([\s\S]*?)<\/pre>/)?.[1]?.replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
        if (!report || !stdout.includes('data-complete="true"')) { console.error('Browser test incomplete:', {code, signal, report, profile}, stderr.slice(-2000)); process.exitCode = 1; return; }
        console.log(report);
        try { if (JSON.parse(report).failures.length) process.exitCode = 1; } catch { process.exitCode = 1; }
    });
});
