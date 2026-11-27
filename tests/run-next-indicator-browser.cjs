// Shared continuation label layouts in an isolated, invisible Chrome profile.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const output=process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(path.join(os.tmpdir(),'nmnl-next-indicator-report-'));
const page=process.argv[3]||'next-indicator-browser.html';
if(!/^[\w-]+\.html$/.test(page))throw Error('Invalid test page');
const server=http.createServer((req,res)=>{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1));
    if(name==='__dividend_baseline.css'){
        res.setHeader('Content-Type','text/css');res.end(execFileSync('git',['show','HEAD:dividend-presentation.css'],{cwd:root}));return;
    }
    const file=path.resolve(root,name),ext=path.extname(file);
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
        '.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav'};
    if(!file.startsWith(root+path.sep)||!types[ext]||name.split('/').some(part=>part.startsWith('.'))){res.writeHead(404).end();return;}
    fs.readFile(file,(error,data)=>{if(error)res.writeHead(404).end();else{res.setHeader('Content-Type',types[ext]);if(name==='index.html')data=data.toString().replace(/<link[^>]*href="next-indicator\.css[^>]+>/g,'').replace(/<script[^>]*src="next-indicator\.js[^>]+><\/script>/g,'');res.end(data);}});
});
async function main(){
    fs.mkdirSync(output,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nmnl-next-indicator-chrome-'));
    const child=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',[
        '--headless=new','--no-first-run','--no-default-browser-check','--mute-audio','--disable-background-networking',
        '--disable-background-timer-throttling','--disable-renderer-backgrounding',
        '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true});
    let socket;
    try{
        const endpoint=await new Promise((resolve,reject)=>{
            let errors='';const timeout=setTimeout(()=>reject(Error('Chrome startup timed out: '+errors.slice(-500))),15000);
            child.once('error',error=>{clearTimeout(timeout);reject(error)});
            child.stderr.on('data',chunk=>{errors+=chunk;const url=errors.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];if(url){clearTimeout(timeout);resolve(url)}});
        });
        socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
        let next=0;const pending=new Map();
        socket.addEventListener('message',event=>{const message=JSON.parse(event.data),task=pending.get(message.id);if(!task)return;pending.delete(message.id);clearTimeout(task.timeout);if(message.error)task.reject(Error(message.error.message));else task.resolve(message.result)});
        const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++next,timeout=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method))},15000);pending.set(id,{resolve,reject,timeout});socket.send(JSON.stringify({id,method,params,sessionId}))});
        const {targetId}=await send('Target.createTarget',{url:'about:blank'});
        const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});const call=(method,params)=>send(method,params,sessionId);
        const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
        await call('Page.enable');await call('Page.bringToFront');await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1200,deviceScaleFactor:2,mobile:false});
        await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
        await call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/tests/${page}`});
        let complete=false;
        for(let i=0;i<1200;i++){
            const state=await evaluate(`({complete:document.body?.dataset.complete==='true',capture:window.__captureRequest})`);
            if(state.capture){
                const clip=await evaluate(`(()=>{const r=document.getElementById('game').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()`);
                const {data}=await call('Page.captureScreenshot',{format:'png',clip});
                if(state.capture.name)fs.writeFileSync(path.join(output,path.basename(state.capture.name)),Buffer.from(data,'base64'));
                await evaluate('window.__captureRequest=null;window.__continueCapture();window.__continueCapture=null');
            }
            if(state.complete){complete=true;break;}
            await new Promise(resolve=>setTimeout(resolve,30));
        }
        if(!complete)throw Error('Next indicator tests did not complete');
        const report=await evaluate(`JSON.parse(document.getElementById('report').textContent)`);
        fs.writeFileSync(path.join(output,'next-indicator-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({stage:report.stage,cases:report.results.length,failures:report.failures}));
        if(report.failures.length)throw Error('Next indicator regression failed');
        await send('Browser.close').catch(()=>{});
    }finally{socket?.close();child.kill();server.close();}
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1});
