(function(root,factory){
    const api=factory();
    if(typeof module==='object'&&module.exports)module.exports=api;
    if(root)root.MapRegionRules=api;
})(typeof window!=='undefined'?window:null,function(){
    'use strict';
    const cache=new WeakMap();
    function pointsFor(region){
        const tokens=String(region.path||'').match(/[MCZ]|-?\d+(?:\.\d+)?/g)||[];
        const points=[];let index=0,current=null,start=null;
        while(index<tokens.length){
            const command=tokens[index++];
            if(command==='M'){
                current={x:Number(tokens[index++]),y:Number(tokens[index++])};start={...current};points.push(current);
            }else if(command==='C'&&current){
                const p0=current,p1={x:Number(tokens[index++]),y:Number(tokens[index++])},p2={x:Number(tokens[index++]),y:Number(tokens[index++])},p3={x:Number(tokens[index++]),y:Number(tokens[index++])};
                for(let step=1;step<=48;step++){const t=step/48,u=1-t;points.push({x:u*u*u*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t*t*t*p3.x,y:u*u*u*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t*t*t*p3.y});}
                current=p3;
            }else if(command==='Z'&&start){points.push(start);current=start;}
        }
        return points;
    }
    function boundaries(data){
        let result=cache.get(data);if(!result){result={regions:(data.regions||[]).slice(0,8).map(region=>({region,points:pointsFor(region)})),lake:data.lake};cache.set(data,result);}return result;
    }
    function insidePolygon(points,x,y){
        let inside=false;
        for(let i=0,j=points.length-1;i<points.length;j=i++){
            const a=points[i],b=points[j];
            if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
        }
        return inside;
    }
    function regionAt(data,x,y){
        if(!data||!Number.isFinite(x)||!Number.isFinite(y))return null;
        const {regions,lake}=boundaries(data);
        if(lake){const angle=-Number(lake.rotation||0)*Math.PI/180,dx=x-lake.x,dy=y-lake.y,rx=dx*Math.cos(angle)-dy*Math.sin(angle),ry=dx*Math.sin(angle)+dy*Math.cos(angle);if((rx/lake.radiusX)**2+(ry/lake.radiusY)**2<=1)return{id:'lake',name:'湖'};}
        return regions.find(entry=>insidePolygon(entry.points,x,y))?.region||null;
    }
    function regionForPlayer(player,squares,data){
        const square=(squares||[]).find(row=>Number(row.id)===Number(player?.position));
        return square?regionAt(data,Number(square.x),Number(square.y)):null;
    }
    function destinations(player,squares,data,playableSquares){
        const current=regionForPlayer(player,squares,data);
        if(!current)return[];
        return (playableSquares||[]).filter(square=>{
            if(Number(square.id)===Number(player.position))return false;
            const region=regionAt(data,Number(square.x),Number(square.y));
            return Boolean(region&&region.id!==current.id);
        });
    }
    return Object.freeze({regionAt,regionForPlayer,destinations});
});
