/* Preview anchored zooms with a transform, then commit the scroll position. */
(function(){
 'use strict';
 function attach(area,board,getZoom,setZoom){
  let frame=0,target=null,from=1,elapsed=0,lastTick=0,duration=160,anchor=null,translateX=0,translateY=0;
  let finishFocus,pinch=null,pinchFrame=0,detailPreview=false;
  const clamp=value=>Math.max(MapScene.getMinZoom(),Math.min(MapScene.config.maxZoom,value));
  function captureAnchor(clientX,clientY,center=false){
   const zoom=getZoom(),bounds=board.getBoundingClientRect(),view=area.getBoundingClientRect();
   const screenX=clientX-view.left,screenY=clientY-view.top;
   return {x:(clientX-bounds.left)/zoom,y:(clientY-bounds.top)/zoom,
    screenX,screenY,endX:center?view.width/2:screenX,endY:center?view.height/2:screenY,
    clientX,clientY,width:board.clientWidth,height:board.clientHeight,
    centerX:bounds.left+board.clientWidth*zoom/2-translateX,
    centerY:bounds.top+board.clientHeight*zoom/2-translateY};
  }
  function preview(zoom,point,clientX,clientY){
   setZoom(zoom,{preview:true});
   translateX=clientX-point.centerX-(point.x-point.width/2)*zoom;
   translateY=clientY-point.centerY-(point.y-point.height/2)*zoom;
   board.style.transform=`translate(${translateX}px,${translateY}px) scale(${zoom})`;
  }
  function commit(zoom,point,clientX,clientY){
   board.classList.remove('map-zoom-interacting');
   setZoom(zoom);
   const bounds=board.getBoundingClientRect();
   area.scrollTo({left:area.scrollLeft+bounds.left+point.x*getZoom()-clientX,
    top:area.scrollTop+bounds.top+point.y*getZoom()-clientY,behavior:'instant'});
   MapScene.clampScroll();
  }
  function end(){
   frame=0;target=null;translateX=translateY=0;
   board.classList.remove('map-zoom-interacting');
   if(detailPreview){window.MapOverviewCache?.setPreview(board,false);detailPreview=false;}
   const finish=finishFocus;
   finishFocus=null;
   finish?.();
  }
  function tick(now){
   if(!board.isConnected){end();return;}
   // A slow first paint must not consume the whole transition before the user
   // sees it. Advance at most two nominal frames after a rendering pause.
   elapsed+=Math.max(0,Math.min(32,now-lastTick));lastTick=now;
   const progress=Math.min(1,elapsed/duration),eased=1-(1-progress)**3;
   const zoom=progress===1?target:from+(target-from)*eased;
   const offsetX=(anchor.endX-anchor.screenX)*eased,offsetY=(anchor.endY-anchor.screenY)*eased;
   // Preview the board transform and readable pieces. Commit scroll margins
   // and ocean tiling once at the end.
   if(progress<1){
    // Scrolling a huge raster/SVG surface every frame can block on rendering.
    // Keep the cursor's world point fixed using composition only; scroll once.
    preview(zoom,anchor,anchor.clientX+offsetX,anchor.clientY+offsetY);
   }else{
    const view=area.getBoundingClientRect();
    commit(zoom,anchor,view.left+anchor.endX,view.top+anchor.endY);
   }
   if(progress<1)frame=requestAnimationFrame(tick);
   else end();
  }
  function begin(nextTarget,clientX,clientY,center){
   if(pinch)finishPinch(true);
   const current=getZoom();
   target=nextTarget;
   from=current;elapsed=0;lastTick=performance.now();duration=center?360:160;
   anchor=captureAnchor(clientX,clientY,center);
   board.classList.add('map-zoom-interacting');
   if(!detailPreview)detailPreview=window.MapOverviewCache?.setPreview(board,true)===true;
   if(!frame)frame=requestAnimationFrame(tick);
  }
  area.addEventListener('wheel',event=>{
   if(event.ctrlKey||!event.deltaY)return;
   event.preventDefault();
   if(finishFocus)cancel(true);
   const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?area.clientHeight:1);
   const previousTarget=target??getZoom();
   const nextTarget=clamp(previousTarget-Math.max(-160,Math.min(160,pixels))*.001);
   // Further wheel input at either limit must not restart layer promotion,
   // repaint the map or prolong a gesture already heading to that limit.
   if(Math.abs(nextTarget-previousTarget)<1e-9)return;
   begin(nextTarget,event.clientX,event.clientY,false);
  },{passive:false});
  function readPinch(touches){
   const a=touches[0],b=touches[1];
   return {x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2,distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)};
  }
  function pinchZoom(gesture){
   return clamp(gesture.initialZoom*gesture.input.distance/gesture.initialDistance);
  }
  function finishPinch(preserveView){
   const gesture=pinch;
   if(!gesture)return;
   pinch=null;
   cancelAnimationFrame(pinchFrame);pinchFrame=0;
   if(preserveView&&board.isConnected)commit(pinchZoom(gesture),gesture.anchor,gesture.input.x,gesture.input.y);
   translateX=translateY=0;
   board.classList.remove('map-zoom-interacting');
   if(detailPreview){window.MapOverviewCache?.setPreview(board,false);detailPreview=false;}
  }
  area.addEventListener('touchstart',event=>{
   if(event.touches.length>2)finishPinch(true);
   if(event.touches.length!==2||pinch)return;
   const input=readPinch(event.touches);
   if(!input.distance)return;
   if(event.cancelable)event.preventDefault();
   cancel(true);
   pinch={input,initialDistance:input.distance,initialZoom:getZoom(),anchor:captureAnchor(input.x,input.y)};
   board.classList.add('map-zoom-interacting');
   if(!detailPreview)detailPreview=window.MapOverviewCache?.setPreview(board,true)===true;
  },{passive:false});
  area.addEventListener('touchmove',event=>{
   if(!pinch||event.touches.length!==2)return;
   if(event.cancelable)event.preventDefault();
   pinch.input=readPinch(event.touches);
   if(pinchFrame)return;
   pinchFrame=requestAnimationFrame(()=>{
    pinchFrame=0;
    if(board.isConnected)preview(pinchZoom(pinch),pinch.anchor,pinch.input.x,pinch.input.y);
    else finishPinch(false);
   });
  },{passive:false});
  area.addEventListener('touchend',event=>{if(event.touches.length!==2)finishPinch(true);},{passive:true});
  area.addEventListener('touchcancel',()=>finishPinch(true),{passive:true});
  function cancel(preserveView){
   if(pinch)finishPinch(preserveView);
   if(!frame)return;
   const before=preserveView&&board.isConnected&&board.getBoundingClientRect();
   cancelAnimationFrame(frame);
   end();
   if(before){
    setZoom(getZoom());
    const after=board.getBoundingClientRect();
    area.scrollBy({left:after.left-before.left,top:after.top-before.top,behavior:'instant'});
    MapScene.clampScroll();
   }
  }
  function zoomToCenter(zoom,square,focus){
   const next=clamp(zoom);
   if(Math.abs(next-getZoom())<1e-7)return false;
   const rect=square.getBoundingClientRect();
   const abort=()=>cancel(true);
   focus.signal.addEventListener('abort',abort,{once:true});
   finishFocus=()=>{
    focus.signal.removeEventListener('abort',abort);
    focus.abort();
   };
   begin(next,rect.left+rect.width/2,rect.top+rect.height/2,true);
   return true;
  }
  return {board,cancel,zoomToCenter};
 }
 window.MapZoomInteraction=Object.freeze({attach});
})();
