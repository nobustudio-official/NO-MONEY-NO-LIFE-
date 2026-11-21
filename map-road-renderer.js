/* Warm-gray stone streets. Presentation only; never changes routes. */
(function(){
 'use strict';
 const ns='http://www.w3.org/2000/svg',scenes=new WeakMap();let serial=0;
 const palette={base:'#82796a',border:'#605a4e',tiles:['#b8afa0','#d0c8b8','#aaa395','#c3bbac'],curbs:['#a49a88','#bfb4a0'],curbBorder:'#756c5b'};
 function add(parent,tag,attributes){const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));parent.append(node);return node;}
 function edgeKey(a,b){return [String(a),String(b)].sort().join(':');}
 function pattern(defs,id,width,height,x=0,y=0){return add(defs,'pattern',{id,patternUnits:'userSpaceOnUse',x,y,width,height,viewBox:`0 0 ${width} ${height}`});}
 function definitions(svg){
  const prefix=`map-road-${++serial}`,defs=add(svg,'defs',{});
  const ids={paving:prefix+'-paving',curb:prefix+'-curb'};
  const paving=pattern(defs,ids.paving,46,25,0,-12),colors=palette.tiles;
  for(let row=0;row<2;row++)for(let col=-1;col<3;col++){
   const x=col*23+(row?11:0),y=row*12.5;
   add(paving,'rect',{x,y,width:21,height:11,rx:2,fill:colors[((col+row*2)%4+4)%4],stroke:palette.border+'4d','stroke-width':.6});
   add(paving,'line',{x1:x+2,y1:y+2,x2:x+19,y2:y+2,stroke:'#fff8dc55','stroke-width':.7,'stroke-linecap':'round'});
  }
  const curb=pattern(defs,ids.curb,34,5);
  for(let i=0;i<2;i++)add(curb,'rect',{x:i*17+.5,y:0,width:16,height:5,rx:1,fill:palette.curbs[i%2],stroke:palette.curbBorder,'stroke-width':.6});
  return ids;
 }
 function draw(svg,squares){
  svg.replaceChildren();svg.classList.add('map-stone-roads');svg.setAttribute('aria-hidden','true');
  const ids=definitions(svg),edges=new Map(),byId=new Map(squares.map(square=>[String(square.id),square]));
  const depth=1; // Approved provisional road angle: 0 degrees; original paving.
  const vector=add(svg,'g',{class:'map-road-vector'});
  // Offset in map coordinates, outside rotated roads: light always comes from upper left.
  const shadows=add(vector,'g',{class:'map-road-shadows',transform:'translate(3 4)'});
  for(const from of squares)for(const next of from.next||[]){
   const to=byId.get(String(next)),key=edgeKey(from.id,next);if(!to||edges.has(key))continue;
   const path=window.MapWorkshopScene?.roadPoints(from.id,to.id);
   if(path?.length>2){
    const shadow=add(shadows,'g',{'data-shadow-edge':key}),group=add(vector,'g',{class:'map-stone-edge','data-road-edge':key,transform:'matrix(1 0 0 1 0 0)'}),segments=[];
    for(let i=1;i<path.length;i++){
     const a=path[i-1],b=path[i],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(!length)continue;
     const transform=`matrix(${dx/length} ${dy/length} ${-dy/length} ${dx/length} ${a.x} ${a.y})`;
     add(shadow,'rect',{x:0,y:-18,width:length,height:36,rx:5,fill:'#102a2c55',transform});
     const part=add(group,'g',{transform});
     add(part,'rect',{x:0,y:-18,width:length,height:36,rx:5,fill:palette.base,stroke:palette.border,'stroke-width':1});
     add(part,'rect',{x:0,y:-12,width:length,height:25,fill:`url(#${ids.paving})`});
     for(const y of [-18,13])add(part,'rect',{x:0,y:0,width:length,height:5,transform:`translate(0 ${y})`,fill:`url(#${ids.curb})`});
     segments.push({transform,length});
    }
    edges.set(key,{group,segments,transform:'matrix(1 0 0 1 0 0)',highlight:null});continue;
   }
   const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);if(!Number.isFinite(length)||length<=0)continue;
   // Keep the centerline joined to both squares. Only the road's cross-section
   // is foreshortened vertically to match the map's oblique ground markers.
   const cos=dx/length,sin=dy/length;
   const transform=`matrix(${cos} ${sin} ${-sin} ${cos*depth} ${from.x} ${from.y})`;
   add(shadows,'rect',{class:'map-road-shadow','data-shadow-edge':key,x:0,y:-18,width:length,height:36,rx:5,fill:'#102a2c55',transform});
   const group=add(vector,'g',{class:'map-stone-edge','data-road-edge':key,transform});
   add(group,'rect',{x:0,y:-18,width:length,height:36,rx:5,fill:palette.base,stroke:palette.border,'stroke-width':1});
   add(group,'rect',{x:0,y:-12,width:length,height:25,fill:`url(#${ids.paving})`});
   for(const y of [-18,13])add(group,'rect',{x:0,y:0,width:length,height:5,transform:`translate(0 ${y})`,fill:`url(#${ids.curb})`});
   edges.set(key,{group,length,transform,highlight:null});
  }
  // Bridge artwork is rendered separately so it can be removed cleanly when
  // the temporary collapse effect is active.
  for(const [key,edge] of edges){
   const [a,b]=key.split(':').map(Number),style=window.MapWorkshopScene?.roadStyle(a,b);
   if(!window.MapBridgeRoads?.isBridge(style))continue;
   edge.group.classList.add('map-road-bridge-edge');edge.group.style.display='none';
   const shadow=svg.querySelector(`[data-shadow-edge="${key}"]`);if(shadow)shadow.style.display='none';
  }
  const overlay=add(svg,'g',{class:'map-road-overlay'});
  scenes.set(svg,{edges,overlay,active:new Set(),simpleMode:false,collapseState:window.bridgeCollapseVisualState});
  queueMicrotask(()=>window.MapRoadCache?.prepare(svg,squares));
 }
 function setShortestPath(svg,path){
  const scene=scenes.get(svg);if(!scene)return;
  const next=new Set();for(let i=0;i<path.length-1;i++){const key=edgeKey(path[i],path[i+1]);if(scene.edges.has(key))next.add(key);}
  for(const key of new Set([...scene.active,...next])){
   const edge=scene.edges.get(key),active=next.has(key);if(!edge||active===scene.active.has(key))continue;
   edge.group.classList.toggle('is-shortest',active);
   if(active){
    const highlight=document.createElementNS(ns,'g');highlight.classList.add('map-road-shortest-highlight');
    highlight.setAttribute('transform',edge.transform);
    scene.overlay.append(highlight);
    for(const segment of edge.segments||[edge]){
    const part=edge.segments?add(highlight,'g',{transform:segment.transform}):highlight;
    if(segment.length>36)add(part,'rect',{x:18,y:-12,width:segment.length-36,height:24,rx:4,fill:'#e896b526'});
    if(segment.length>50)for(const y of [-16,16]){
     add(part,'line',{x1:25,y1:y,x2:segment.length-25,y2:y,stroke:'#ff91c44d','stroke-width':6,'stroke-linecap':'round'});
     add(part,'line',{class:'map-road-route-edge',x1:25,y1:y,x2:segment.length-25,y2:y,stroke:'#ffd2e7','stroke-width':1.5,'stroke-linecap':'round'});
    }
    }
    edge.highlight=highlight;
   }else{edge.highlight?.remove();edge.highlight=null;}
  }
  scene.active=next;
 }
 function syncBridgeVisibility(svg,scene){
  for(const [key,edge] of scene.edges){
   if(!edge.group.classList.contains('map-road-bridge-edge'))continue;
   const [aId,bId]=key.split(':').map(Number);
   const closed=Boolean(scene.collapseState&&window.BridgeCollapseRules?.isClosed(scene.collapseState,aId,bId));
   edge.group.style.display=scene.simpleMode&&!closed?'':'none';
  }
 }
 function setSimpleMode(svg,enabled){
  const scene=scenes.get(svg);if(!scene)return;
  scene.simpleMode=Boolean(enabled);syncBridgeVisibility(svg,scene);
 }
 function setBridgeCollapse(svg,squares,state){
  if(!svg)return;
  const scene=scenes.get(svg);if(scene){scene.collapseState=state;syncBridgeVisibility(svg,scene);}
  svg.querySelector(':scope > .map-bridge-collapse-markers')?.remove();
  for(const [aId,bId] of window.BridgeCollapseRules?.edges||[]){
   const key=edgeKey(aId,bId),closed=Boolean(state&&window.BridgeCollapseRules.isClosed(state,aId,bId));
   for(const element of svg.querySelectorAll(`[data-road-edge="${key}"]`)){
    if(element.classList.contains('map-road-bridge-edge'))element.style.display=scene?.simpleMode&&!closed?'':'none';
    else element.style.display=closed?'none':'';
   }
  }
  window.MapRoadCache?.setBridgeCollapse(svg,state);
 }
 window.MapRoadRenderer={draw,setShortestPath,setBridgeCollapse,setSimpleMode,
  cacheRecipe:JSON.stringify(palette)+pattern.toString()+definitions.toString()+draw.toString()};
})();
