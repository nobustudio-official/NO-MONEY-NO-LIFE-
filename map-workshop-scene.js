/* Shared material painters keep the workshop and production scenery identical. */
(function () {
    'use strict';
    const objects = window.MapWorkshopData?.objectLayout || [];
    const placedTemplateIds = new Set(objects.map(object => object.templateId));
    const optimizedObjectAsset = asset => {
        const objectRoot = 'images/map/objects/';
        const optimizedRoot = `${objectRoot}optimized/`;
        if (!asset?.startsWith(objectRoot) || asset.startsWith(optimizedRoot)) return asset;
        return asset.replace(objectRoot, optimizedRoot).replace(/\.webp$/i, '-70pct.webp');
    };
    // The map uses half-memory copies for placed props. Keep catalog and other
    // screens on their original images; backgrounds shared with props stay intact.
    const templates = new Map(MapObjectCatalog.objects.map(row => {
        const asset = placedTemplateIds.has(row.id) ? optimizedObjectAsset(row.asset) : row.asset;
        return [row.id, asset === row.asset ? row : { ...row, asset }];
    }));
    const styles = new Map((window.MapWorkshopData?.roadStyles || []).map(row => [[row.from, row.to].sort((a,b)=>a-b).join(':'), row.style]));
    const paths = new Map((window.MapWorkshopData?.roadStyles || []).map(row => [[row.from, row.to].sort((a,b)=>a-b).join(':'), row]));
    const images = new Map();
    const boards = new WeakMap();
    let preparing;
    const elfTemplate = 'imported-small-384c54c041f7';
    const targetTemplate = 'imported-small-0a0014a28f28';
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const streamImages = Boolean(window.MapDetailLevel?.touchDevice);
    // Match the shared scroll settle window. A longer object-only delay let
    // the baked low-resolution scenery disappear before its sharp image arrived.
    const objectImageDwellMs = 160;
    const objectImageMargin = 48;
    function sameViewport(a, b) {
        return Boolean(a && b && ['left', 'right', 'top', 'bottom'].every(key => Math.abs(a[key] - b[key]) < .5));
    }
    function cancelObjectLoad(state, row) {
        const token = state.pendingObjectImages.get(row);
        if (token === undefined) return;
        state.pendingObjectImages.delete(row);
        if (row.objectImageToken === token) row.objectImageToken++;
        window.MapDetailLevel?.releaseImage(row.image);
    }
    function prepareRoads() {
        return Promise.all([MapCapitalRoads.prepare(), MapBridgeRoads.prepare(), MapRegionRoads.prepare()]);
    }
    const objectOrder=(a,b)=>Number(templates.get(a.templateId)?.kind!=='ground')-Number(templates.get(b.templateId)?.kind!=='ground')||a.y-b.y;
    const roadStyle = (a,b) => styles.get([a,b].sort((a,b)=>a-b).join(':')) || 'stone';
    function roadPoints(a,b) {
        const row=paths.get([a,b].sort((a,b)=>a-b).join(':'));
        if(!row?.points)return null;
        return Number(row.from)===Number(a)?row.points:row.points.slice().reverse();
    }
    function arrowPlacement(current,destination,neighbors=[]) {
        const heading=to=>{
            const first=roadPoints(current.id,to.id)?.find(p=>p.x!==current.x||p.y!==current.y)||to;
            return Math.atan2(first.y-current.y,first.x-current.x);
        };
        const angle=heading(destination),same=neighbors.filter(to=>Math.abs(heading(to)-angle)<.001).sort((a,b)=>a.id-b.id);
        // Distinct choices at an unmarked junction stay clickable on the same radius.
        const fan=same.length>1?(same.findIndex(to=>to.id===destination.id)-(same.length-1)/2)*Math.PI/4:0;
        const radius=80;
        return {x:current.x+Math.cos(angle+fan)*radius,y:current.y+Math.sin(angle+fan)*radius,angle:angle*180/Math.PI+90};
    }
    function prepare() {
        if (!preparing) preparing = Promise.all([
            prepareRoads(),
            ...[...new Set(objects.map(o=>o.templateId))].map(async id => {
                const template=templates.get(id);
                if (!template?.asset) throw Error('オブジェクト画像がありません: '+id);
                const image=new Image();
                if(window.MapDetailLevel?.touchDevice) await window.MapDetailLevel.loadImage(image,template.asset,2);
                else { image.src=template.asset; await image.decode(); }
                if(image.naturalWidth) images.set(id,image);
            })
        ]);
        return preparing;
    }
    function drawRoad(ctx, points, style) {
        if (MapBridgeRoads.isBridge(style)) return MapBridgeRoads.draw(ctx,points,style);
        if (MapRegionRoads.styles[style]) return MapRegionRoads.draw(ctx,points,style);
        if (style === 'trail' || style === 'sea') {
            if (!points || points.length < 2) return false;
            const row=MapObjectCatalog.roadStyles.find(item=>item.id===style);
            if (!row) return false;
            const path=(dx=0,dy=0)=>{ctx.beginPath();ctx.moveTo(points[0].x+dx,points[0].y+dy);for(const point of points.slice(1))ctx.lineTo(point.x+dx,point.y+dy);};
            ctx.save();ctx.lineJoin='round';ctx.lineCap='butt';
            path(3,4);ctx.strokeStyle='#102a2c55';ctx.lineWidth=39;ctx.stroke();
            path();ctx.strokeStyle='#665e51';ctx.lineWidth=37;ctx.stroke();
            ctx.strokeStyle=row.color;ctx.lineWidth=29;ctx.stroke();ctx.restore();return true;
        }
        return MapCapitalRoads.draw(ctx,points,style);
    }
    function drawObjects(ctx, { excludeAnimatedTargets = false } = {}) {
        for (const object of objects.slice().sort(objectOrder)) {
            if (excludeAnimatedTargets && object.templateId === targetTemplate) continue;
            const image=images.get(object.templateId);
            if (!image) continue;
            const scale=object.scale??1,width=object.width*scale,height=(object.imageHeight??(image.naturalWidth?object.width*image.naturalHeight/image.naturalWidth:object.width*(templates.get(object.templateId)?.height??object.width*2)/(templates.get(object.templateId)?.width??object.width)))*scale;
            ctx.save();ctx.translate(object.x,object.y);ctx.rotate(object.rotation*Math.PI/180);
            ctx.drawImage(image,-width/2,-height,width,height);ctx.restore();
        }
    }
    function objectDimensions(object, image) {
        const scale=object.scale??1,width=object.width*scale;
        const height=(object.imageHeight??(image.naturalWidth?object.width*image.naturalHeight/image.naturalWidth:object.width*(templates.get(object.templateId)?.height??object.width*2)/(templates.get(object.templateId)?.width??object.width)))*scale;
        return {width,height};
    }
    function magicAnchor(object, dimensions, x, y) {
        const angle=object.rotation*Math.PI/180,localX=(x-.5)*dimensions.width,localY=(y-1)*dimensions.height;
        return {x:object.x+localX*Math.cos(angle)-localY*Math.sin(angle),y:object.y+localX*Math.sin(angle)+localY*Math.cos(angle)};
    }
    function makeMagicPairs(rows) {
        const targets=rows.filter(row=>row.object.templateId===targetTemplate);
        return rows.filter(row=>row.object.templateId===elfTemplate).map(elf=>{
            const target=targets.reduce((best,row)=>!best||Math.hypot(row.object.x-elf.object.x,row.object.y-elf.object.y)<Math.hypot(best.object.x-elf.object.x,best.object.y-elf.object.y)?row:best,null);
            if(!target)return null;
            return {elf,target,from:magicAnchor(elf.object,elf, .86,.24),to:magicAnchor(target.object,target,.40,.65)};
        }).filter(Boolean);
    }
    function createMagicEffectLayer(rows) {
        const layer=document.createElement('div');layer.className='map-workshop-magic-effects';
        Object.assign(layer.style,{position:'absolute',inset:'0',zIndex:'1',pointerEvents:'none',overflow:'hidden'});
        const pairs=makeMagicPairs(rows);
        for(const pair of pairs){
            const bolt=document.createElement('span');bolt.className='map-workshop-magic-bolt';
            Object.assign(bolt.style,{position:'absolute',display:'none',borderRadius:'50%',background:'radial-gradient(circle,#f1fffb 0%,#b6fff0 48%,#72e7dc 100%)',boxShadow:'0 0 8px 4px #69e8d5',transform:'translate(-50%,-50%)'});
            const trail=document.createElement('span');
            Object.assign(trail.style,{position:'absolute',width:'50%',height:'50%',left:'-30%',top:'25%',borderRadius:'50%',background:'#72e7dc99'});bolt.append(trail);layer.append(bolt);pair.bolt=bolt;
            const ring=document.createElement('span');ring.className='map-workshop-magic-impact';
            Object.assign(ring.style,{position:'absolute',display:'none',border:'3px solid #c8fff3',borderRadius:'50%',boxSizing:'border-box',transform:'translate(-50%,-50%)'});layer.append(ring);pair.ring=ring;
        }
        return {layer,pairs};
    }
    function updateMagicEffects(board,state,now=performance.now()) {
        state.effectTimer=0;
        if(!board.isConnected)return;
        const active=!document.hidden&&!board.classList.contains('map-overview-active')&&
            !board.classList.contains('map-zoom-interacting')&&!reducedMotion?.matches;
        let hasVisibleEffect=false;
        const phase=(now%4000)/4000;
        for(const pair of state.pairs){
            if(!active||(state.streamImages&&!pair.elf.sharp&&!pair.target.sharp)){
                if(pair.visible===false)continue;
                pair.visible=false;
                pair.bolt.style.display='none';pair.ring.style.display='none';pair.target.image.style.rotate='0deg';
                continue;
            }
            pair.visible=true;
            hasVisibleEffect=true;
            if(phase>=.12&&phase<.34){
                const t=(phase-.12)/.22,x=pair.from.x+(pair.to.x-pair.from.x)*t,y=pair.from.y+(pair.to.y-pair.from.y)*t-Math.sin(t*Math.PI)*16;
                const radius=Math.max(3,Math.min(9,pair.elf.width*.04));
                Object.assign(pair.bolt.style,{display:'block',left:x+'px',top:y+'px',width:radius*2+'px',height:radius*2+'px'});
            }else pair.bolt.style.display='none';
            if(phase>=.34&&phase<.42){
                const t=(phase-.34)/.08,radius=5+18*t;
                Object.assign(pair.ring.style,{display:'block',left:pair.to.x+'px',top:pair.to.y+'px',width:radius*2+'px',height:radius*2+'px',opacity:String(1-t)});
            }else pair.ring.style.display='none';
            const impact=phase>=.34&&phase<.47?Math.sin((phase-.34)*Math.PI*2/.13)*.055*(1-(phase-.34)/.13):0;
            pair.target.image.style.rotate=impact?impact+'rad':'0deg';
        }
        if(hasVisibleEffect)state.effectTimer=window.setTimeout(()=>updateMagicEffects(board,state),50);
    }
    function setViewport(board,bounds,visibleBounds=bounds) {
        if(window.MapDetailLevel?.isCameraJumping?.(board))return;
        const state=boards.get(board);if(!state)return;
        const viewportChanged=!sameViewport(state.visibleBounds,visibleBounds);
        state.bounds=bounds;
        state.visibleBounds=visibleBounds;
        if(state.streamImages&&viewportChanged){
            state.objectImagesReady=false;
            clearTimeout(state.objectImageTimer);
            for(const row of [...state.pendingObjectImages.keys()])cancelObjectLoad(state,row);
            state.objectImageTimer=window.setTimeout(()=>{
                state.objectImageTimer=0;
                if(!board.isConnected||!state.bounds||!state.visibleBounds)return;
                state.objectImagesReady=true;
                setViewport(board,state.bounds,state.visibleBounds);
            },objectImageDwellMs);
        }
        const overview=board.classList.contains('map-overview-active');
        const lowDetail=window.MapDetailLevel?.touchDevice&&getMapZoomUI()<=.6;
        const zooming=board.classList.contains('map-zoom-interacting');
        const objectMargin=objectImageMargin/Math.max(.01,getMapZoomUI()||1);
        const imageBounds={left:visibleBounds.left-objectMargin,right:visibleBounds.right+objectMargin,
            top:visibleBounds.top-objectMargin,bottom:visibleBounds.bottom+objectMargin};
        for(const row of state.rows){
            const {image,extent}=row;
            const visible=!overview&&!lowDetail&&extent.left<bounds.right&&extent.right>bounds.left&&extent.top<bounds.bottom&&extent.bottom>bounds.top;
            const onScreen=visible&&extent.left<visibleBounds.right&&extent.right>visibleBounds.left&&extent.top<visibleBounds.bottom&&extent.bottom>visibleBounds.top;
            if(row.sharp!==visible){
                row.sharp=visible;
                image?.classList.toggle('map-object-sharp',visible);
            }
            if(!image)continue;
            if(state.streamImages){
                const keepImage=!overview&&!lowDetail&&extent.left<imageBounds.right&&extent.right>imageBounds.left&&extent.top<imageBounds.bottom&&extent.bottom>imageBounds.top;
                if(!keepImage){
                    cancelObjectLoad(state,row);
                    image.classList.remove('is-ready');
                    window.MapDetailLevel?.releaseImage(image);
                }else if(onScreen&&!zooming&&state.objectImagesReady&&!image.hasAttribute('src')&&!state.pendingObjectImages.has(row)){
                    const centerX=(visibleBounds.left+visibleBounds.right)/2,centerY=(visibleBounds.top+visibleBounds.bottom)/2;
                    const distance=(row.object.x-centerX)**2+(row.object.y-centerY)**2;
                    const token=(row.objectImageToken||0)+1;
                    row.objectImageToken=token;
                    state.pendingObjectImages.set(row,token);
                    Promise.resolve(window.MapDetailLevel?.requestImage(image,row.asset,0,distance)).catch(()=>{}).finally(()=>{
                        if(row.objectImageToken===token)state.pendingObjectImages.delete(row);
                    });
                }
            }
        }
        if(!state.effectTimer)updateMagicEffects(board,state);
    }
    function releaseDetail(board) {
        const state=boards.get(board);if(!state?.streamImages)return;
        clearTimeout(state.objectImageTimer);
        state.objectImageTimer=0;
        state.objectImagesReady=false;
        for(const row of [...state.pendingObjectImages.keys()])cancelObjectLoad(state,row);
        for(const row of state.rows){
            if(!row.image)continue;
            row.sharp=false;
            row.image.classList.remove('map-object-sharp');
            row.image.classList.remove('is-ready');
            window.MapDetailLevel?.releaseImage(row.image);
        }
    }
    function objectExtent({object,width,height}) {
        const angle=object.rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
        const corners=[[-width/2,-height],[width/2,-height],[-width/2,0],[width/2,0]].map(([x,y])=>({
            x:object.x+x*cos-y*sin,y:object.y+x*sin+y*cos
        }));
        return {left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),
            top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))};
    }
    function mount(background, { bakedScenery = false } = {}) {
        const layer=document.createElement('div');layer.className='map-workshop-objects';
        const rows=[];
        const useStreaming = bakedScenery || streamImages;
        Object.assign(layer.style,{position:'absolute',inset:'0',zIndex:'2',pointerEvents:'none'});
        for (const object of objects.slice().sort(objectOrder)) {
            const template=templates.get(object.templateId);if(!template?.asset)continue;
            if(bakedScenery&&object.templateId!==targetTemplate){
                if(object.templateId!==elfTemplate)continue;
                const row={object,...objectDimensions(object,{naturalWidth:0}),sharp:null};
                row.extent=objectExtent(row);rows.push(row);
                continue;
            }
            const image=new Image();image.alt=object.name;image.draggable=false;image.dataset.objectId=object.id;
            if(useStreaming)image.classList.add('map-object-stream');
            if(!useStreaming)image.src=template.asset;
            const {width,height}=objectDimensions(object,image);
            Object.assign(image.style,{position:'absolute',left:object.x+'px',top:object.y+'px',width:width+'px',height:height+'px',maxWidth:'none',transform:'translate(-50%,-100%) rotate('+object.rotation+'deg)',transformOrigin:'50% 100%'});
            const row={image,object,width,height,asset:template.asset,sharp:null};rows.push(row);
            row.extent=objectExtent(row);
            image.addEventListener('load',()=>{
                image.classList.add('is-ready');
                if(object.imageHeight!==undefined)return;
                const height=width*image.naturalHeight/image.naturalWidth;
                if(row.height===height)return;
                row.height=height;
                row.extent=objectExtent(row);
                image.style.height=height+'px';
                const board=layer.parentElement,state=boards.get(board);
                if(state?.bounds)setViewport(board,state.bounds,state.visibleBounds);
            });
            layer.append(image);
        }
        // Keep native artwork outside the promoted, rasterized terrain surface.
        const effects=createMagicEffectLayer(rows);layer.append(effects.layer);
        queueMicrotask(()=>{
            const board=background.closest('#mapBoard');
            if(!board)return;
            board.append(layer);
            boards.set(board,{rows,bounds:null,visibleBounds:null,pairs:effects.pairs,effectTimer:0,streamImages:useStreaming,
                objectImageTimer:0,objectImagesReady:false,pendingObjectImages:new Map()});
            window.MapDetailLevel?.setZoom(board,getMapZoomUI());
        });
    }
    document.addEventListener('visibilitychange',()=>{
        const board=document.getElementById('mapBoard'),state=boards.get(board);
        if(state&&!state.effectTimer)updateMagicEffects(board,state);
    });
    window.MapWorkshopScene=Object.freeze({roadStyle,roadPoints,arrowPlacement,prepare,prepareRoads,drawRoad,drawObjects,mount,setViewport,releaseDetail});
})();
