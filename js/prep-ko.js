/* Exact weighted roll convolution for the selected number of hits.
   Damage and end-of-turn effects come from the pinned Smogon engine.
   Keep equal rolls' multiplicity; never approximate probabilities from a range. */
(function(root){
  "use strict";
  function hitRolls(damage){
    if(typeof damage==="number")return [[damage]];
    if(!Array.isArray(damage)||!damage.length)return [[0]];
    if(Array.isArray(damage[0]))return damage;
    return damage.length>=16 ? [damage] : damage.map(value=>[value]);
  }
  function weighted(rolls){
    const counts=new Map();
    for(const value of rolls)counts.set(value,(counts.get(value)||0)+1/rolls.length);
    return [...counts];
  }
  function evaluate({damage,laterDamage=damage,hp,maxHP,sitrus=false,ripen=false,
    resistBerry=false,leftovers=0,endOfTurn=0,toxic=0,sturdy=false,sash=false,maxTurns=4,rollsForState=null}){
    const initial=hitRolls(damage).map(weighted), later=hitRolls(laterDamage).map(weighted);
    let states=new Map([[hp+"|0",{hp,used:false,p:1}]]),ko=0;
    const add=(map,hp,used,p)=>{
      const key=hp+"|"+Number(used),old=map.get(key);
      if(old)old.p+=p;else map.set(key,{hp,used,p});
    };
    for(let turn=1;turn<=maxTurns;turn++){
      for(let hit=0;hit<initial.length;hit++){
        const next=new Map();
        for(const state of states.values()){
          const rolls=rollsForState ? weighted(rollsForState(state,hit,turn)) :
            ((state.used && resistBerry ? later : initial)[hit]||later.at(-1));
          for(const [damage,probability] of rolls){
            const p=state.p*probability;
            let remaining=state.hp-damage,used=state.used;
            if(remaining<=0 && state.hp===maxHP && (sturdy || (sash&&!used))){
              remaining=1;if(sash)used=true;
            }
            // A fainted Pokémon never activates a healing item.
            if(remaining<=0){ko+=p;continue;}
            if(resistBerry && damage>0)used=true;
            if(sitrus && !used && remaining<=Math.floor(maxHP/2)){
              remaining=Math.min(maxHP,remaining+Math.floor(maxHP/4)*(ripen?2:1));
              used=true;
            }
            add(next,remaining,used,p);
          }
        }
        states=next;
      }
      // Recovery happens between attacks, not as extra HP before the first hit.
      const next=new Map();
      for(const state of states.values()){
        const remaining=Math.min(maxHP,state.hp+leftovers+endOfTurn-Math.floor(maxHP*(toxic?toxic+turn-1:0)/16));
        if(remaining<=0)ko+=state.p;
        else add(next,remaining,state.used,state.p);
      }
      states=next;
      if(ko>1e-12){
        const chance=Math.min(1,ko);
        const count=turn===1?"OHKO":turn+"HKO";
        const guaranteed=states.size===0;
        const percent=Math.max(.1,Math.min(99.9,Math.round(chance*1000)/10));
        return {chance:guaranteed?1:chance,turns:turn,remainingHP:0,
          label:guaranteed?"Guaranteed "+count:percent+"% chance to "+count};
      }
    }
    return {chance:0,turns:0,remainingHP:Math.min(...[...states.values()].map(state=>state.hp)),
      label:"No KO within "+maxTurns+" attack"+(maxTurns===1?"":"s")};
  }
  const api={hitRolls,evaluate};
  if(typeof module!=="undefined")module.exports=api;
  root.PrepKO=api;
})(globalThis);
