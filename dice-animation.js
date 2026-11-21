/* Approved dice artwork and motion, shared with the editable demo. */
(function(){
 'use strict';
 const STOP_DURATION=900,STOP_STAGGER=45,THROW_LEFT=110,THROW_FORWARD=58;
 function createRenderer(canvas,options={}){
 const ctx=canvas.getContext('2d'), reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 let phase='idle',results=[],began=0,stopped=0,showIndividualResults=true;
 let throwLeft=THROW_LEFT,throwForward=THROW_FORWARD;
 const pips={1:[[.5,.5]],2:[[.26,.26],[.74,.74]],3:[[.26,.26],[.5,.5],[.74,.74]],4:[[.26,.26],[.74,.26],[.26,.74],[.74,.74]],5:[[.26,.26],[.74,.26],[.5,.5],[.26,.74],[.74,.74]],6:[[.26,.24],[.74,.24],[.26,.5],[.74,.5],[.26,.76],[.74,.76]]};
 function face(points,value,light){const [a,b,,d]=points;
  ctx.save();ctx.transform(b[0]-a[0],b[1]-a[1],d[0]-a[0],d[1]-a[1],a[0],a[1]);
  const cream=ctx.createLinearGradient(0,0,1,1);cream.addColorStop(0,options.theme==='black'?(light>.7?'#414858':'#242a37'):(light>.7?'#fffdf7':'#f5e8de'));cream.addColorStop(1,options.theme==='black'?'#080b12':'#dcc6b8');
  ctx.fillStyle=cream;ctx.fillRect(0,0,1,1);ctx.strokeStyle='#b9965c';ctx.lineWidth=.018;ctx.strokeRect(0,0,1,1);
  for(const [u,v] of pips[value]){
   const radius=value===1?.13:.078;
   const ink=ctx.createRadialGradient(u-.025,v-.035,.01,u,v,radius);
   ink.addColorStop(0,value===1?'#ff5561':options.theme==='black'?'#ffffff':'#5b4640');ink.addColorStop(1,value===1?'#b2071e':options.theme==='black'?'#d9e2ed':'#251e1d');
   ctx.beginPath();ctx.arc(u,v,radius,0,Math.PI*2);ctx.fillStyle=ink;ctx.fill();
   ctx.strokeStyle=value===1?'#e9a6a0':options.theme==='black'?'#ffffff':'#baa298';ctx.lineWidth=.018;ctx.stroke();
  }
  for(const [u,v,sx,sy] of [[0,0,1,1],[1,0,-1,1],[1,1,-1,-1],[0,1,1,-1]]){
   ctx.save();ctx.translate(u,v);ctx.scale(sx,sy);
   const gold=ctx.createLinearGradient(0,0,.2,.2);gold.addColorStop(0,'#fff3a2');gold.addColorStop(.4,'#ffc93d');gold.addColorStop(1,'#c47b05');
   ctx.beginPath();ctx.moveTo(0,.27);ctx.quadraticCurveTo(.16,.29,.13,.13);ctx.quadraticCurveTo(.29,.16,.27,0);ctx.lineTo(0,0);ctx.closePath();ctx.fillStyle=gold;ctx.fill();ctx.strokeStyle='#9e5c09';ctx.lineWidth=.022;ctx.stroke();ctx.restore();
  }
  ctx.restore();
 }
 function die(x,y,size,t,index,settled){
  const spinning=phase==='rolling'||phase==='stopping'&&!settled;
  // Isometric camera: all three visible face normals have equal depth.
  const rest=[-Math.PI/4,Math.atan(1/Math.sqrt(2)),-Math.PI/6];
  // Stable per-die variations avoid synchronized tumbling without adding jitter.
  const variation=index*2.3999632297;
  const speedX=.0075*(1+.19*Math.sin(variation));
  const speedY=.011*(1+.17*Math.cos(variation+.8));
  const spinAt=time=>{
   const e=Math.max(0,time-began),blend=Math.min(1,e/220);
   return[rest[0]-e*speedX-.36*Math.sin(variation)*blend,
    rest[1]-e*speedY-.4*Math.cos(variation)*blend,
    rest[2]-(Math.sin(e*(.0022+.0006*Math.sin(variation))+variation)-Math.sin(variation))*(.11+.025*Math.cos(variation))];
  };
  const landed=settled||['result','moving','done'].includes(phase);
  let angles=rest,lift=0,travel=landed&&!reduced?-throwLeft:0,ground=landed&&!reduced?throwForward:0,depth=landed&&!reduced?1.08:1;
  if(spinning&&!reduced){
   if(phase==='rolling'||t<stopped+index*STOP_STAGGER)angles=spinAt(t);
   else{
    const initial=spinAt(stopped+index*STOP_STAGGER),p=Math.min(1,(t-stopped-index*STOP_STAGGER)/STOP_DURATION),ease=1-(1-p)**2;
    angles=initial.map((a,i)=>a+(rest[i]+Math.PI*2*Math.round((a-rest[i])/(Math.PI*2))-(i===1?Math.PI*2:0)-a)*ease);
    // A small lob toward the left foreground; scale stays uniform to keep a cube.
    if(p<.55){const f=p/.55;lift=-42*Math.sin(Math.PI*f);travel=-(throwLeft-8)*f;ground=throwForward*f;depth=1+.08*f;}
    else{const g=(p-.55)/.45;lift=-5*Math.abs(Math.sin(g*Math.PI*2))*Math.exp(-3*g);travel=-(throwLeft-8)-8*(1-(1-g)**2);ground=throwForward;depth=1.08;}
    // Optional shared motion; callers choose the approved stop choreography.
    if(options.stopMotion)({lift,travel,ground,depth}=options.stopMotion(p,throwLeft,throwForward));
   }
  }
  const shadowScale=1+lift/120;
  ctx.save();ctx.translate(x+travel*size,y+(ground+46)*size);ctx.scale(size*depth*shadowScale,size*.25*depth*shadowScale);ctx.beginPath();ctx.ellipse(0,0,37,18,0,0,Math.PI*2);ctx.fillStyle=`rgba(5,23,44,${Math.max(.05,.33+lift/180)})`;ctx.fill();ctx.restore();
  ctx.save();ctx.translate(x+travel*size,y+(ground+lift)*size);ctx.scale(size*depth,size*depth);
  const geometry=window.DiceCubeGeometry;
  const rotated=geometry.vertices.map(v=>geometry.rotate(v,angles));
  const projected=rotated.map(([x,y])=>[x*32,y*32]);
  if(settled)canvas.dataset[`topEdge${index}`]=String(y+(ground+lift)*size+Math.min(...projected.map(p=>p[1]))*size*depth);
  const value=results[index]||1;
  const values=options.faceValuesForTop
   ? options.faceValuesForTop(value,index)
   : geometry.faceValuesForTop(value);
  const visible=geometry.faces.map(f=>({...f,normal:geometry.rotate(f.normal,angles)})).filter(f=>f.normal[2]>.015);
  visible.sort((a,b)=>a.normal[2]-b.normal[2]);
  visible.forEach(f=>{
   face(f.ids.map(id=>projected[id]),values[f.key],f.normal[2]);
   if(settled&&f.key==='top')canvas.dataset[`topFace${index}`]=String(values[f.key]);
  });
  ctx.restore();
  if(settled&&results[index]&&showIndividualResults){
   const above=showIndividualResults==='above';
   ctx.save();ctx.font=`900 ${Math.round((above?26:17)*size)}px "Yu Gothic",sans-serif`;ctx.textAlign='center';ctx.fillStyle=above?'#fcfcfc':'#f3d68e';
   if(above){ctx.shadowColor='#102b49';ctx.shadowBlur=5;}
   ctx.fillText(String(results[index]),above?x+travel*size:x,above?y+(ground-64*depth)*size:y+78*size);ctx.restore();
  }
 }

 return {draw(state,t){
  ({phase,results,began,stopped,showIndividualResults=true}=state);
  const count=()=>state.count;
  const r=canvas.getBoundingClientRect(),ratio=Math.min(2,devicePixelRatio||1);
  if(canvas.width!==Math.round(r.width*ratio)||canvas.height!==Math.round(r.height*ratio)){canvas.width=Math.round(r.width*ratio);canvas.height=Math.round(r.height*ratio);}
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,r.width,r.height);
  const columns=Math.min(count(),r.width<420?3:5),rows=Math.ceil(count()/columns),cell=Math.min(r.width/columns,rows>2?80:120),size=Math.min(1.05,cell/110,rows>2?.64:1)*(state.diceScale||1);
  // Launch the whole group from the upper-right area, then land at screen center.
  throwLeft=state.cornerLaunch ? .5*Math.max(0,Math.min(r.width*.27,r.width/2-(columns-1)*cell/2-70))/size : THROW_LEFT;
  const verticalRoom=state.canvasLanding?Math.max(0,r.height*.55-(rows-1)*(rows>2?76:116)/2-60):Infinity;
  throwForward=state.cornerLaunch?Math.min(r.height*(state.launchHeight??.26),verticalRoom)/size:THROW_FORWARD;
  for(let i=0;i<count();i++){const row=Math.floor(i/columns),inRow=Math.min(columns,count()-row*columns);
   const rowOffset=(row-(rows-1)/2)*(showIndividualResults==='above'?(rows>2?108:146):(rows>2?76:116));
   const x=r.width/2+(i%columns-(inRow-1)/2)*cell+(state.centerLanding&&!reduced?throwLeft*size:0);
   const y=state.centerLanding?(state.canvasLanding?r.height*.55:window.innerHeight/2-r.top)+(state.landingOffsetY??0)-(reduced?0:throwForward*size)+rowOffset:state.alignBottom?r.height-82-(rows-1-row)*(rows>2?76:116):r.height/2-18+rowOffset;
   const settled=!['rolling','idle'].includes(phase)&&(phase!=='stopping'||t-stopped>=STOP_DURATION+i*STOP_STAGGER);
   die(x,y,size,t,i,settled);
  }

  return phase==='stopping' && t-stopped>=STOP_DURATION+(count()-1)*STOP_STAGGER;
 }};
 }
 window.DiceAnimation={createRenderer,duration:count=>STOP_DURATION+(count-1)*STOP_STAGGER,gameplayScale:.52};
})();
