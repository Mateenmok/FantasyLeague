/* Private, browser-local scouting notes. Never writes league data. */
(() => {
  const roles={support:{label:'Support',color:'#2da86a'},sweeper:{label:'Sweeper',color:'#e45159'},balance:{label:'Balance',color:'#3895ed'}};
  const threats={ohko:{label:'Can reliably OHKO',color:'#ed4e58'},possible:{label:'Might OHKO',color:'#f19436'},twohit:{label:'2HKO',color:'#e2c432'},safe:{label:'Not threatening',color:'#39ad73'},minimal:{label:'Can barely damage it',color:'#8c9aa5'}};
  const empty=()=>({roles:{},forms:{},lines:[]});
  const storageKey=ids=>'pokeleague.matchupNotes.v1:'+JSON.stringify([...ids].sort());
  const normalize=value=>{
    const result=empty();
    if(!value||typeof value!=='object')return result;
    for(const [id,role] of Object.entries(value.roles||{}))if(Object.hasOwn(roles,role)&&id.includes(':'))result.roles[id]=role;
    for(const [id,form] of Object.entries(value.forms||{}))if(id.includes(':')&&typeof form==='string'&&form.length<100)result.forms[id]=form;
    for(const line of Array.isArray(value.lines)?value.lines.slice(0,1000):[]){
      if(line&&typeof line.from==='string'&&typeof line.to==='string'&&line.from.includes(':')&&line.to.includes(':')&&line.from.split(':')[0]!==line.to.split(':')[0]&&Object.hasOwn(threats,line.threat)){
        result.lines=result.lines.filter(old=>old.from!==line.from||old.to!==line.to);
        result.lines.push({from:line.from,to:line.to,threat:line.threat});
      }
    }
    return result;
  };
  const connect=(notes,from,to,threat)=>{
    if(!from||!to||from.teamId===to.teamId||!Object.hasOwn(threats,threat))return false;
    notes.lines=notes.lines.filter(line=>line.from!==from.formId||line.to!==to.formId);
    notes.lines.push({from:from.formId,to:to.formId,threat});return true;
  };
  const selectedRows=(result,ids,forms)=>ids.map(teamId=>MRank(result.base.filter(row=>row.teamId===teamId).map(base=>result.all.find(row=>row.id===base.id&&row.name===forms[base.id])||base)));
  const MRank=rows=>[...rows].sort((a,b)=>(b.speed??-1)-(a.speed??-1)||a.name.localeCompare(b.name));
  const model={roles,threats,empty,storageKey,normalize,connect,selectedRows};
  if(typeof module!=='undefined')module.exports=model;
  if(typeof window!=='undefined')window.PokeLeagueNotes=model;
})();
