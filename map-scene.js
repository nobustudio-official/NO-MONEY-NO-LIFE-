/* Background and world bounds only. Never modifies squares or online state. */
(function(){
 'use strict';
 const config=Object.freeze({width:9216,height:7424,minZoom:.1,maxZoom:2.2,baseTileSize:1024,rippleTileSize:768});
 // World rectangle inferred from the approved 1920x952 overview framing.
 const cameraFrame=Object.freeze({left:-4992,top:-1560,width:19200,height:9520});
 const observedAreas=new WeakSet();let activeScale=1,oceanCheckFrame=0;
 const cameraLimits=new WeakMap();let cameraLayoutVersion=0;
 const continent=window.MapContinentData;
 const oceanImageUrls=['images/map/backgrounds/world/ocean/base-repeat.svg','images/map/backgrounds/world/ocean/ripples-repeat.svg'];
 const assetUrls=[continent.grassTexture,...window.MapRegionBackground.assetUrls];
 document.documentElement.style.setProperty('--map-world-width',config.width+'px');
 document.documentElement.style.setProperty('--map-world-height',config.height+'px');
 function getMinZoom(){
  const area=document.querySelector('.game-screen .map-area');if(!area)return config.minZoom;
  const fitZoom=Math.max(area.clientWidth/cameraFrame.width,area.clientHeight/cameraFrame.height);
  const touchDevice=window.matchMedia?.('(pointer: coarse)').matches;
  return Math.max(touchDevice ? .02 : config.minZoom,fitZoom);
 }
 function invalidateCameraLimits(board){
  if(board)cameraLimits.delete(board);else cameraLayoutVersion++;
 }
 function getCameraLimits(){
  const area=document.querySelector('.game-screen .map-area'),board=document.getElementById('mapBoard');if(!area||!board)return null;
  const preview=board.classList.contains('map-zoom-interacting'),saved=cameraLimits.get(board);
  if(!preview&&saved?.area===area&&saved.zoom===activeScale&&saved.version===cameraLayoutVersion)return saved.limits;
  // Read layout once after invalidation; ordinary scrolling only reads its position.
  const width=area.clientWidth,height=area.clientHeight;
  if(!(width>0&&height>0))return null;
  const originX=board.offsetLeft+config.width*(1-activeScale)/2,originY=board.offsetTop+config.height*(1-activeScale)/2;
  const nativeX=Math.max(0,area.scrollWidth-width),nativeY=Math.max(0,area.scrollHeight-height);
  const bound=(value,max)=>Math.max(0,Math.min(max,value));
  const fitZoom=Math.max(width/cameraFrame.width,height/cameraFrame.height);
  const minZoom=Math.max(window.matchMedia?.('(pointer: coarse)').matches ? .02 : config.minZoom,fitZoom);
  let limits;
  if(activeScale<=minZoom+1e-7){const x=bound(originX+(cameraFrame.left+cameraFrame.width/2)*activeScale-width/2,nativeX),y=bound(originY+(cameraFrame.top+cameraFrame.height/2)*activeScale-height/2,nativeY);limits={minLeft:x,maxLeft:x,minTop:y,maxTop:y};}
  else limits={minLeft:bound(originX+cameraFrame.left*activeScale,nativeX),maxLeft:bound(originX+(cameraFrame.left+cameraFrame.width)*activeScale-width,nativeX),minTop:bound(originY+cameraFrame.top*activeScale,nativeY),maxTop:bound(originY+(cameraFrame.top+cameraFrame.height)*activeScale-height,nativeY)};
  if(!preview)cameraLimits.set(board,{area,zoom:activeScale,version:cameraLayoutVersion,limits:Object.freeze(limits)});
  return limits;
 }
 function clampScroll(){
  if(document.getElementById('mapBoard')?.classList.contains('map-zoom-interacting'))return;
  const area=document.querySelector('.game-screen .map-area'),limits=getCameraLimits();if(!area||!limits)return;
  const left=area.scrollLeft,top=area.scrollTop;
  const x=Math.max(limits.minLeft,Math.min(limits.maxLeft,left)),y=Math.max(limits.minTop,Math.min(limits.maxTop,top));
  if(Math.abs(x-left)>.51)area.scrollLeft=x;if(Math.abs(y-top)>.51)area.scrollTop=y;
 }
 function pointInCoast(x,y){
  let inside=false;const points=continent.coast;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
   const a=points[i],b=points[j];
   if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
 }
 function segmentIntersects(a,b,c,d){
  const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const onSegment=(p,q,r)=>q.x>=Math.min(p.x,r.x)-1e-7&&q.x<=Math.max(p.x,r.x)+1e-7&&q.y>=Math.min(p.y,r.y)-1e-7&&q.y<=Math.max(p.y,r.y)+1e-7;
  const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
  if(((abC>0&&abD<0)||(abC<0&&abD>0))&&((cdA>0&&cdB<0)||(cdA<0&&cdB>0)))return true;
  return (Math.abs(abC)<1e-7&&onSegment(a,c,b))||(Math.abs(abD)<1e-7&&onSegment(a,d,b))||
   (Math.abs(cdA)<1e-7&&onSegment(c,a,d))||(Math.abs(cdB)<1e-7&&onSegment(c,b,d));
 }
 function viewportShowsOcean(){
  const area=document.querySelector('.game-screen .map-area'),board=document.getElementById('mapBoard');
  if(!area||!board)return false;
  const view=area.getBoundingClientRect(),bounds=board.getBoundingClientRect();
  const left=(view.left-bounds.left)/activeScale,top=(view.top-bounds.top)/activeScale;
  const right=left+area.clientWidth/activeScale,bottom=top+area.clientHeight/activeScale;
  const corners=[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
  // Anything outside the continent polygon is ocean, including the camera margin.
  if(corners.some(point=>!pointInCoast(point.x,point.y)))return true;
  const rectEdges=corners.map((point,index)=>[point,corners[(index+1)%corners.length]]);
  for(let i=0;i<continent.coast.length;i++){
   const a=continent.coast[i],b=continent.coast[(i+1)%continent.coast.length];
   if(rectEdges.some(([c,d])=>segmentIntersects(a,b,c,d)))return true;
  }
  return false;
 }
 function updateOceanTexture(){
  oceanCheckFrame=0;
  const area=document.querySelector('.game-screen .map-area');if(!area)return;
  const useTexture=activeScale>=.5&&viewportShowsOcean();
  area.classList.toggle('map-ocean-textured',useTexture);
  area.classList.toggle('map-ocean-flat',!useTexture);
  if(useTexture){
   area.style.setProperty('--ocean-ripple-image',`url("${oceanImageUrls[1]}")`);
   area.style.setProperty('--ocean-base-image',`url("${oceanImageUrls[0]}")`);
  }else{
   area.style.removeProperty('--ocean-ripple-image');
   area.style.removeProperty('--ocean-base-image');
  }
 }
 function queueOceanCheck(){if(!oceanCheckFrame)oceanCheckFrame=requestAnimationFrame(updateOceanTexture);}
 function setZoom(zoom){
  const area=document.querySelector('.game-screen .map-area');if(!area)return;
  const scale=Math.max(getMinZoom(),Math.min(config.maxZoom,Number(zoom)||1));activeScale=scale;
  // Board zoom uses a CSS transform outside the SVG; compensate the guide
  // width here so it stays thin but visible at the full-continent overview.
  document.documentElement.style.setProperty('--map-boundary-width',1.2/scale+'px');
  area.classList.add('map-ocean');
  area.classList.toggle('map-ocean-flat',scale<.5);
  if(!observedAreas.has(area)){observedAreas.add(area);area.addEventListener('scroll',()=>{clampScroll();queueOceanCheck();},{passive:true});}
  // Center-origin enlargement otherwise pushes the world's left/top into
  // negative, unreachable scroll coordinates. Reserve matching space on both sides.
  const extraX=Math.max(0,config.width*(scale-1)/2),extraY=Math.max(0,config.height*(scale-1)/2);
  // Keep the viewport's padding bounded; oversized padding would enlarge its
  // border box. Enlargement space belongs to the board's content margins.
  area.style.paddingLeft=area.style.paddingRight='50vw';
  area.style.paddingTop=area.style.paddingBottom='50vh';
  const board=document.getElementById('mapBoard');
  if(board){board.style.marginLeft=board.style.marginRight=extraX+'px';board.style.marginTop=board.style.marginBottom=extraY+'px';}
  area.style.setProperty('--ocean-base-size',config.baseTileSize*scale+'px');
  area.style.setProperty('--ocean-ripple-size',config.rippleTileSize*scale+'px');
  // Match the board's center-origin zoom, including the scrollable padding.
  const padding=getComputedStyle(area);
  area.style.backgroundPosition=`calc(${padding.paddingLeft} + ${extraX+config.width*(1-scale)/2}px) calc(${padding.paddingTop} + ${extraY+config.height*(1-scale)/2}px)`;
  invalidateCameraLimits();
  clampScroll();
  queueOceanCheck();
 }
 function createBackground(squares){
  const background=document.createElement('div');background.className='map-background';
  // Phones use the same native-resolution raster tiles as desktop, but only
  // tiles in the viewport are loaded. The 25% overview is reserved for zoomed
  // out views; using it as the gameplay base made the map visibly blurry.
  if(window.mobileRuntimeTuning===true){
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
   svg.classList.add('map-continent');
   svg.setAttribute('viewBox',`0 0 ${config.width} ${config.height}`);
   svg.setAttribute('aria-hidden','true');
   const fallback=window.MapOverviewRasterData?.mobileImage;
   if(fallback){
    const image=document.createElementNS('http://www.w3.org/2000/svg','image');
    image.setAttribute('href',fallback);
    image.setAttribute('width',String(config.width));
    image.setAttribute('height',String(config.height));
    svg.append(image);
   }
   background.append(svg);
   window.MapWorkshopScene?.mount(background);
   setZoom(typeof window.getMapZoomUI==='function'?window.getMapZoomUI():1);
   queueMicrotask(()=>window.MapBackgroundCache?.prepare(background,svg));
   return background;
  }
  const ns='http://www.w3.org/2000/svg';
  function add(parent,name,attributes){const element=document.createElementNS(ns,name);for(const [key,value] of Object.entries(attributes))element.setAttribute(key,value);parent.append(element);return element;}
  const svg=add(background,'svg',{class:'map-continent',viewBox:`0 0 ${config.width} ${config.height}`,'aria-hidden':'true'});
  const defs=add(svg,'defs',{}),path=continent.coast.map((point,index)=>(index?'L':'M')+point.x+','+point.y).join(' ')+' Z';
  const clip=add(defs,'clipPath',{id:'map-continent-clip'});add(clip,'path',{d:path});
  window.MapRegionBackground.createIslandMask(defs,config.width,config.height);
  window.MapRegionBackground.createGroundPattern(defs,'map-continent-water',window.MapRegionData.lake.ground);
  // The lake is one independent area; its water covers land-region guides.
  const lake=continent.lake,water=add(svg,'g',{'clip-path':'url(#map-continent-clip)'});
  add(water,'ellipse',{class:'map-continent-lake',cx:lake.x,cy:lake.y,rx:lake.radiusX,ry:lake.radiusY,transform:`rotate(${lake.rotation} ${lake.x} ${lake.y})`,fill:'url(#map-continent-water)',stroke:'none'});
  // Raised shores now come from the surrounding islands, not shallow-water strips.
  window.MapIslandBanks.draw(svg,defs);
  const islands=add(svg,'g',{class:'map-region-islands',mask:'url(#map-island-mask)'});
  // Use the opaque bitmap directly inside the pattern to avoid seams from
  // rasterizing a nested SVG at small zoom levels.
  const grass=add(defs,'pattern',{id:'map-continent-grass',patternUnits:'userSpaceOnUse',width:1024,height:1024});
  add(grass,'rect',{width:1024,height:1024,fill:'#add13e'});
  for(const transform of ['', 'translate(1024 0) scale(-1 1)', 'translate(0 1024) scale(1 -1)', 'translate(1024 1024) scale(-1 -1)'])add(grass,'image',{href:continent.grassTexture,width:512,height:512,transform});
  add(islands,'path',{d:path,fill:'url(#map-continent-grass)'});
  window.MapRegionBackground.draw(islands,defs);
  window.MapWorkshopScene?.mount(background);
  setZoom(typeof window.getMapZoomUI==='function'?window.getMapZoomUI():1);
  // Start after the caller attaches the background to the current board.
  queueMicrotask(()=>MapBackgroundCache.prepare(background,svg));
  return background;
 }
 window.addEventListener('resize',()=>{invalidateCameraLimits();const zoom=typeof window.getMapZoomUI==='function'?window.getMapZoomUI():1;if(typeof window.setMapZoomUI==='function')window.setMapZoomUI(zoom);else setZoom(zoom);});
 document.addEventListener('fullscreenchange',()=>invalidateCameraLimits());
 window.MapScene=Object.freeze({config,cameraFrame,assetUrls,createBackground,setZoom,getMinZoom,getCameraLimits,clampScroll,invalidateCameraLimits});
})();
