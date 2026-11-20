(function(root,factory){
    const api=factory();
    if(typeof module==='object'&&module.exports)module.exports=api;
    if(root)root.BridgeCollapseRules=api;
})(typeof window!=='undefined'?window:null,function(){
    'use strict';
    // Verified against MapWorkshopData.draft.roads: each pair is a bridge-style
    // road and a bidirectional next connection between two distinct regions.
    const edges=Object.freeze([[144,145],[185,186],[199,200],[248,249],[253,254],[252,255],[247,256],[260,261],[362,363],[364,365],[366,367],[368,369],[370,371],[372,373],[374,375],[376,377],[539,540]].map(edge=>Object.freeze(edge)));
    const keys=new Set(edges.map(([a,b])=>[Number(a),Number(b)].sort((x,y)=>x-y).join(':')));
    function isBridgeEdge(a,b){return keys.has([Number(a),Number(b)].sort((x,y)=>x-y).join(':'));}
    function isClosed(state,a,b){return Boolean(state&&Number(state.remainingActions)>0&&isBridgeEdge(a,b));}
    function availableConnections(squares,position,state){
        const connected=new Set(),current=(squares||[]).find(square=>Number(square.id)===Number(position));
        if(!current)return[];
        for(const id of current.next||[])if(!isClosed(state,current.id,id))connected.add(Number(id));
        for(const square of squares||[])if((square.next||[]).some(id=>Number(id)===Number(position))&&!isClosed(state,square.id,position))connected.add(Number(square.id));
        return [...connected];
    }
    return Object.freeze({edges,isBridgeEdge,isClosed,availableConnections});
});
