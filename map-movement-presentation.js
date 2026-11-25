/* Visual movement only. Positions and online authority remain in game.js. */
(function () {
    'use strict';
    const duration = 280;
    const worldPixelsPerMs = 200 / duration;
    const cameraSpeedLimit = 1200;
    // Keep the existing fast-move flag for synchronized clients; only its
    // presentation speed changes from 2x to the midpoint, 1.5x.
    const durationForDistance=(distance,speedMultiplier=1)=>Math.max(0,distance)/worldPixelsPerMs/(speedMultiplier===2?1.5:1);
    const active = new WeakMap();
    function capture(board, playerIndex) {
        const piece = board.querySelector(`.player-piece[data-player-index="${playerIndex}"]`);
        if(!piece)return null;
        const parent=piece.closest('.map-node');
        return Object.assign(piece.getBoundingClientRect(),{squareId:Number(parent.dataset.squareId),worldX:parseFloat(parent.style.left),worldY:parseFloat(parent.style.top)});
    }
    function play(board, playerIndex, before, speedMultiplier=1) {
        active.get(board)?.cancel();
        const piece = board.querySelector(`.player-piece[data-player-index="${playerIndex}"]`);
        if (!piece || !before) return Promise.resolve();
        const area = document.querySelector('.game-screen .map-area');
        // Cancel any native smooth scroll so it cannot compete with this step.
        if (area) area.scrollTo({left:area.scrollLeft,top:area.scrollTop,behavior:'instant'});
        const after = piece.getBoundingClientRect();
        const parent = piece.closest('.map-node');
        const parentRect = parent.getBoundingClientRect();
        // Include both board zoom and the square's own visual scale.
        const nodeScaleX = parentRect.width / parent.offsetWidth;
        const nodeScaleY = parentRect.height / parent.offsetHeight;
        const dx = (before.left - after.left) / nodeScaleX;
        const dy = (before.top - after.top) / nodeScaleY;
        if (Math.hypot(dx, dy) < .5) return Promise.resolve();
        piece.classList.add('map-piece-moving');
        // Individual translate leaves sprite direction/scale transforms intact.
        const route=window.MapWorkshopScene?.roadPoints(before.squareId,Number(parent.dataset.squareId));
        const from={x:before.worldX,y:before.worldY},to={x:parseFloat(parent.style.left),y:parseFloat(parent.style.top)};
        const distance=route?route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-route[i].x,p.y-route[i].y),0):Math.hypot(to.x-from.x,to.y-from.y);
        const duration=durationForDistance(distance,speedMultiplier);
        if(!Number.isFinite(duration)||duration<=0)return Promise.resolve();
        let positions=[{x:dx,y:dy,offset:0},{x:0,y:0,offset:1}];
        if(route?.length>2){
            const first=route[0],last=route.at(-1),total=route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-route[i].x,p.y-route[i].y),0);
            const zoom=typeof getMapZoomUI==='function'?getMapZoomUI():1;
            const sx=first.x!==last.x?dx/(first.x-last.x):zoom/nodeScaleX;
            const sy=first.y!==last.y?dy/(first.y-last.y):zoom/nodeScaleY;
            let length=0;
            positions=route.map((p,i)=>{if(i)length+=Math.hypot(p.x-route[i-1].x,p.y-route[i-1].y);return {x:(p.x-last.x)*sx,y:(p.y-last.y)*sy,offset:length/total};});
        }
        const animation = piece.animate(positions.map(p=>({translate:p.x+'px '+p.y+'px',offset:p.offset})), { duration, easing: 'linear' });
        let frame = 0;
        const start = area ? {left:area.scrollLeft,top:area.scrollTop} : null;
        const view = area?.getBoundingClientRect();
        const node = piece.closest('.map-node').getBoundingClientRect();
        let limits = window.MapScene?.getCameraLimits();
        const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
        const target = area ? {
            left:clamp(start.left+(node.left+node.width/2)-(view.left+view.width/2),
                limits?.minLeft ?? 0,limits?.maxLeft ?? area.scrollWidth-area.clientWidth),
            top:clamp(start.top+(node.top+node.height/2)-(view.top+view.height/2),
                limits?.minTop ?? 0,limits?.maxTop ?? area.scrollHeight-area.clientHeight)
        } : null;
        const cameraAbort = new AbortController();
        const releaseCameraMotion = window.MapDetailLevel?.beginCameraMotion?.(board);
        const state = {cancel(){cameraAbort.abort();cancelAnimationFrame(frame);animation.cancel();piece.classList.remove('map-piece-moving');releaseCameraMotion?.();}};
        active.set(board,state);
        let lastCameraTick = performance.now();
        function follow(now) {
            if (!area || !piece.isConnected || active.get(board)!==state) return;
            if (window.MapScene?.isViewportResizing?.()) {
                lastCameraTick = now;
                frame = requestAnimationFrame(follow);
                return;
            }
            limits = window.MapScene?.getCameraLimits() || limits;
            // Read the sprite's animation clock: camera and character share the
            // exact progress even if rendering temporarily misses a frame.
            const progress = clamp(Number(animation.currentTime || 0)/duration,0,1);
            const end=positions.findIndex(p=>p.offset>=progress),a=positions[Math.max(0,end-1)],b=positions[Math.max(0,end)],t=(progress-a.offset)/(b.offset-a.offset||1);
            const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,sx=nodeScaleX,sy=nodeScaleY;
            const desiredLeft=clamp(start.left+(x-dx)*sx+(target.left-start.left+dx*sx)*progress,limits?.minLeft??0,limits?.maxLeft??area.scrollWidth-area.clientWidth);
            const desiredTop=clamp(start.top+(y-dy)*sy+(target.top-start.top+dy*sy)*progress,limits?.minTop??0,limits?.maxTop??area.scrollHeight-area.clientHeight);
            const maxStep=cameraSpeedLimit*Math.max(0,Math.min(32,now-lastCameraTick))/1000;
            lastCameraTick=now;
            const left=area.scrollLeft,top=area.scrollTop;
            const distance=Math.hypot(desiredLeft-left,desiredTop-top),fraction=distance?Math.min(1,maxStep/distance):1;
            if(distance>.01)area.scrollTo({left:left+(desiredLeft-left)*fraction,top:top+(desiredTop-top)*fraction,behavior:'instant'});
            frame=requestAnimationFrame(follow);
        }
        if (area) frame=requestAnimationFrame(follow);
        return animation.finished.catch(() => {}).then(async () => {
            try {
                cancelAnimationFrame(frame);
                if (active.get(board)===state) {
                    // If a zoomed-in or off-center view lagged behind the sprite,
                    // finish at the same camera limit instead of snapping to it.
                    if (area && piece.isConnected && !cameraAbort.signal.aborted) {
                        await window.panMapCameraTo?.(area,target.left,target.top,cameraSpeedLimit,cameraAbort.signal);
                    }
                    if(active.get(board)===state)active.delete(board);
                }
                animation.cancel();
                piece.classList.remove('map-piece-moving');
            } finally { releaseCameraMotion?.(); }
        });
    }
    window.MapMovementPresentation = Object.freeze({ duration, durationForDistance, worldPixelsPerMs, cameraSpeedLimit, capture, play, isMoving:board=>active.has(board) });
})();
