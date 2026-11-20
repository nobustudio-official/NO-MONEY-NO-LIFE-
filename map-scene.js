/* Background and world bounds only. Never modifies squares or online state. */
(function(){
 'use strict';
 const config=Object.freeze({width:9216,height:7424,minZoom:.1,maxZoom:2.2,baseTileSize:1024,rippleTileSize:768});
 // World rectangle inferred from the approved 1920x952 overview framing.
 const cameraFrame=Object.freeze({left:-4992,top:-1560,width:19200,height:9520});
 const observedAreas=new WeakSet();let activeScale=1;
 const continent=window.MapContinentData;
 const assetUrls=['images/map/backgrounds/world/ocean/base-repeat.svg','images/map/backgrounds/world/ocean/ripples-repeat.svg',continent.grassTexture,...window.MapRegionBackground.assetUrls];
 document.documentElement.style.setProperty('--map-world-width',config.width+'px');
 document.documentElement.style.setProperty('--map-world-height',config.height+'px');
 function getMinZoom(){
  const area=document.querySelector('.game-screen .map-area');if(!area)return config.minZoom;
  const fitZoom=Math.max(area.clientWidth/cameraFrame.width,area.clientHeight/cameraFrame.height);
  const touchDevice=window.matchMedia?.('(pointer: coarse)').matches;
  return Math.max(touchDevice ? .02 : config.minZoom,fitZoom);
 }
 function getCameraLimits(){
  const area=document.querySelector('.game-screen .map-area'),board=document.getElementById('mapBoard');if(!area||!board)return null;
  const originX=board.offsetLeft+config.width*(1-activeScale)/2,originY=board.offsetTop+config.height*(1-activeScale)/2;
  const nativeX=Math.max(0,area.scrollWidth-area.clientWidth),nativeY=Math.max(0,area.scrollHeight-area.clientHeight);
  const bound=(value,max)=>Math.max(0,Math.min(max,value));
  if(activeScale<=getMinZoom()+1e-7){const x=bound(originX+(cameraFrame.left+cameraFrame.width/2)*activeScale-area.clientWidth/2,nativeX),y=bound(originY+(cameraFrame.top+cameraFrame.height/2)*activeScale-area.clientHeight/2,nativeY);return {minLeft:x,maxLeft:x,minTop:y,maxTop:y};}
  return {minLeft:bound(originX+cameraFrame.left*activeScale,nativeX),maxLeft:bound(originX+(cameraFrame.left+cameraFrame.width)*activeScale-area.clientWidth,nativeX),minTop:bound(originY+cameraFrame.top*activeScale,nativeY),maxTop:bound(originY+(cameraFrame.top+cameraFrame.height)*activeScale-area.clientHeight,nativeY)};
 }
 function clampScroll(){
  if(document.getElementById('mapBoard')?.classList.contains('map-zoom-interacting'))return;
  const area=document.querySelector('.game-screen .map-area'),limits=getCameraLimits();if(!area||!limits)return;
  const x=Math.max(limits.minLeft,Math.min(limits.maxLeft,area.scrollLeft)),y=Math.max(limits.minTop,Math.min(limits.maxTop,area.scrollTop));
  if(Math.abs(x-area.scrollLeft)>.51)area.scrollLeft=x;if(Math.abs(y-area.scrollTop)>.51)area.scrollTop=y;
 }
 function setZoom(zoom){
  const area=document.querySelector('.game-screen .map-area');if(!area)return;
  const scale=Math.max(getMinZoom(),Math.min(config.maxZoom,Number(zoom)||1));activeScale=scale;
  // Board zoom uses a CSS transform outside the SVG; compensate the guide
  // width here so it stays thin but visible at the full-continent overview.
  document.documentElement.style.setProperty('--map-boundary-width',1.2/scale+'px');
  area.classList.add('map-ocean');
  if(!observedAreas.has(area)){observedAreas.add(area);area.addEventListener('scroll',clampScroll,{passive:true});}
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
  clampScroll();
 }
 function createBackground(squares){
  const background=document.createElement('div');background.className='map-background';
  // Reuse the validated baked terrain/roads on phones. Building the full-world
  // SVG and decoding all terrain/road images can exhaust Safari's memory while
  // the opening is still playing, even though the game is visually scaled down.
  if(window.mobileRuntimeTuning===true&&window.MapOverviewCache?.mountAsBase(background,squares)){
   setZoom(typeof window.getMapZoomUI==='function'?window.getMapZoomUI():1);
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
 window.addEventListener('resize',()=>{const zoom=typeof window.getMapZoomUI==='function'?window.getMapZoomUI():1;if(typeof window.setMapZoomUI==='function')window.setMapZoomUI(zoom);else setZoom(zoom);});
 window.MapScene=Object.freeze({config,cameraFrame,assetUrls,createBackground,setZoom,getMinZoom,getCameraLimits,clampScroll});
})();
