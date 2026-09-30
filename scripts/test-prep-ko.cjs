const assert=require('node:assert/strict');
const {evaluate}=require('../js/prep-ko');
const rolls=value=>Array(16).fill(value);
const check=(settings,turns,chance=1)=>{
  const result=evaluate({hp:100,maxHP:100,...settings});
  assert.equal(result.turns,turns,JSON.stringify(settings));
  assert(Math.abs(result.chance-chance)<1e-12,JSON.stringify(result));
};
check({damage:[...Array(8).fill(50),...Array(8).fill(100)]},1,.5);
check({damage:rolls(60)},2);
check({damage:rolls(60),sitrus:true},3);
check({damage:rolls(150),sitrus:true},1); // No healing after fainting.
check({damage:[rolls(60),rolls(60)],sitrus:true},2);
check({damage:[rolls(60),rolls(60)]},1);
check({damage:rolls(50),leftovers:6},3);
check({damage:rolls(40),laterDamage:rolls(80),resistBerry:true},2);
check({hp:120,maxHP:120,damage:[rolls(40),rolls(80)],laterDamage:[rolls(80),rolls(80)],resistBerry:true},1);
check({damage:rolls(150),sturdy:true},2);
check({damage:[rolls(150),rolls(150)],sturdy:true},1);
check({hp:40,damage:rolls(40),sitrus:true},1);
check({damage:rolls(20),rollsForState:state=>rolls(state.hp===100?20:50)},3);
check({hp:10,maxHP:10,damage:Array.from({length:10},()=>[...Array(15).fill(0),1])},1,16**-10);
// Independent enumeration for 2–5 hits: preserve every equally likely branch.
for(let hits=2;hits<=5;hits++){
  for(const hp of [70,100,145,200]){
    for(const sitrus of [false,true]){
      let ko=0;
      function enumerate(hit,remaining,used){
        if(remaining<=0){ko+=2**(hits-hit);return;}
        if(hit===hits)return;
        for(const damage of [22,39]){
          let next=remaining-damage,consumed=used;
          if(next>0 && sitrus && !used && next<=Math.floor(hp/2)){
            next=Math.min(hp,next+Math.floor(hp/4));consumed=true;
          }
          enumerate(hit+1,next,consumed);
        }
      }
      enumerate(0,hp,false);
      const damage=Array.from({length:hits},()=>[...Array(8).fill(22),...Array(8).fill(39)]);
      const result=evaluate({damage,hp,maxHP:hp,sitrus,maxTurns:1});
      assert(Math.abs(result.chance-ko/(2**hits))<1e-12,'Exact '+hits+'-hit distribution');
    }
  }
}
console.log('PASS: weighted KO probabilities, current HP, 2–5 hit exact enumeration, Sitrus timing, no resurrection, one-use resist berries, Leftovers between attacks, Sturdy.');
