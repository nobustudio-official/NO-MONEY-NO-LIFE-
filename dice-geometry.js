/* Equal-edge cube projection for Canvas 2D; no scene, model file or WebGL. */
(function(root){
 const vertices=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
 const faces=[{ids:[4,5,6,7],normal:[0,0,1],key:'front'},{ids:[1,0,3,2],normal:[0,0,-1],key:'back'},
 {ids:[0,1,5,4],normal:[0,-1,0],key:'top'},{ids:[7,6,2,3],normal:[0,1,0],key:'bottom'},
 {ids:[0,4,7,3],normal:[-1,0,0],key:'left'},{ids:[5,1,2,6],normal:[1,0,0],key:'right'}];
 function rotate(p,angles){let[x,y,z]=p;const[a,b,c]=angles;
  [y,z]=[y*Math.cos(a)-z*Math.sin(a),y*Math.sin(a)+z*Math.cos(a)];
  [x,z]=[x*Math.cos(b)+z*Math.sin(b),-x*Math.sin(b)+z*Math.cos(b)];
  return[x*Math.cos(c)-y*Math.sin(c),x*Math.sin(c)+y*Math.cos(c),z];
 }
 function faceValuesForTop(value){
  if(!Number.isInteger(value)||value<1||value>6)throw new Error('Invalid dice result');
  const front=[2,1,1,1,1,2][value-1],left=[3,3,2,5,4,4][value-1];
  return{top:value,bottom:7-value,front,back:7-front,left,right:7-left};
 }
 const geometry={vertices,faces,rotate,faceValuesForTop};
 if(typeof module==='object'&&module.exports)module.exports=geometry;else root.DiceCubeGeometry=geometry;
})(typeof window==='undefined'?globalThis:window);
