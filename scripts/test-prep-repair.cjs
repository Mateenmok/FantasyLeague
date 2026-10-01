// No production writes: all browser requests are intercepted.
// Requires the temporary dependencies/learnset fixture described in build-prep-calc.cjs.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),context={};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/vendor/prep-calc.js'),'utf8'),context);
const calc=context.calc,gen=calc.Generations.get(0);
const display=name=>name.replace(/^(.+)-Mega(?:-([XYZ]))?$/,(_,base,suffix)=>'Mega '+base+(suffix?' '+suffix:''));
const dex={},species={},items={};
for(const mon of gen.species){
  const b=mon.baseStats;
  dex[display(mon.name)]={t1:mon.types[0],t2:mon.types[1],bs:{hp:b.hp,at:b.atk,df:b.def,sa:b.spa,sd:b.spd,sp:b.spe}};
  species[mon.id]={...mon,isMega:mon.name.includes('-Mega')};
}
if(process.env.PREP_POKEDEX){
  const sourceContext={$:{extend:require('@smogon/calc/dist/util').extend}};
  vm.runInNewContext(fs.readFileSync(process.env.PREP_POKEDEX,'utf8'),sourceContext);
  for(const name of Object.keys(dex))delete dex[name];
  Object.assign(dex,sourceContext.POKEDEX_CHAMPIONS);
}
for(const [stone,forms] of Object.entries(calc.MEGA_STONES)){
  for(const [base,form] of Object.entries(forms)){
    if(species[calc.toID(form)]){
      species[calc.toID(form)].requiredItem=stone;
      if(dex[base])(dex[base].formes??=[]).push(display(form));
    }
  }
}
for(const item of gen.items)items[item.id]={...item};
const moves=[...gen.moves].map(m=>({...m,power:m.basePower,inChampions:true}));
const learnsets=fs.readFileSync(process.env.PREP_LEARNSETS||'/private/tmp/pokeleague-prep-repair/champions-learnsets.ts','utf8');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp'};
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH,headless:true});
  const errors=[],writes=[];
  try{
    const page=await browser.newPage({viewport:{width:1600,height:1100}});
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>localStorage.setItem('pokeleague.accessCode','PUFF1'));
    await page.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(req.method()!=='GET')writes.push(req.url());
      if(url.hostname.endsWith('supabase.co'))return route.fulfill({json:[]});
      if(url.pathname.endsWith('/script_res/pokedex.js'))return route.fulfill({body:'var POKEDEX_CHAMPIONS='+JSON.stringify(dex),contentType:'text/javascript'});
      if(url.pathname.endsWith('/champions/species.json'))return route.fulfill({json:species});
      if(url.pathname.endsWith('/champions/items.json'))return route.fulfill({json:items});
      if(url.pathname.endsWith('/moves/moves.json'))return route.fulfill({json:moves});
      if(url.pathname.endsWith('/learnsets/learnsets.json'))return route.fulfill({json:{}});
      if(url.pathname.endsWith('/champions/learnsets.ts'))return route.fulfill({body:learnsets});
      if(url.hostname==='127.0.0.1'){
        const file=path.join(root,decodeURIComponent(url.pathname));
        if(!fs.existsSync(file))return route.fulfill({status:404});
        let body=fs.readFileSync(file);
        // Test-only access to the IIFE. This is never saved or published.
        if(url.pathname.endsWith('/prep-station.html'))body=body.toString().replace("(function(){\n'use strict';","(function(){\n'use strict';\nwindow.__prepTest=code=>eval(code);");
        return route.fulfill({body,contentType:mime[path.extname(file)]||'application/octet-stream'});
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:8014/prep-station.html');
    const run=code=>page.evaluate(code=>window.__prepTest(code),code);
    await page.waitForFunction(()=>window.__prepTest?.('damageDataLoaded && setDataLoaded'));
    const select=async(side,name,ability='',item='')=>run(`
      if(!chooseBase("${side}",${JSON.stringify(name)}))throw new Error("Test Pokémon unavailable: "+${JSON.stringify(name)});
      SET_AUTO_STATE.${side}={ability:false,item:false}; SET_USAGE_REQUEST_TOKEN.${side}++;
      MOVE_AUTO_STATE.${side}=false; MOVE_USAGE_REQUEST_TOKEN.${side}++;
      ensureBuilderSelectValue($id("${side}Ability"),${JSON.stringify(ability)});
      ensureBuilderSelectValue($id("${side}Item"),${JSON.stringify(item)});
      $id("${side}Nature").value="serious";
      syncAbilityWeather("${side}");
    `);
    const weather=async value=>page.selectOption('#battleWeather',value);
    await select('left','Charizard','Blaze');
    await run('setActiveForm("left","Mega Charizard Y")');
    assert.equal(await run('FIELD_STATE.weather'),'Sun','Mega ability sets Sun');
    await weather('Rain');
    await run('renderSide("left");populateSetOptions("left",{preserve:true})');
    assert.equal(await run('FIELD_STATE.weather'),'Rain','manual weather survives rerenders');
    await run('setActiveForm("left","Charizard")');
    await run('setActiveForm("left","Mega Charizard Y")');
    assert.equal(await run('FIELD_STATE.weather'),'Sun','changing form re-evaluates setter');
    for(const [mon,ability,w] of [['Pelipper','Drizzle','Rain'],['Tyranitar','Sand Stream','Sand'],['Abomasnow','Snow Warning','Snow']]){
      await select('right',mon,ability);
      assert.equal(await run('FIELD_STATE.weather'),w);
    }
    await select('right','Snorlax','Immunity');
    for(const [mon,ability,w] of [['Victreebel','Chlorophyll','Sun'],['Beartic','Swift Swim','Rain'],['Excadrill','Sand Rush','Sand'],['Beartic','Slush Rush','Snow']]){
      await select('left',mon,ability);
      await weather('');
      const normal=await run('currentSpeed("left")');
      await weather(w);
      assert.equal(await run('currentSpeed("left")'),normal*2,ability);
      assert.equal(await run('effectiveSpeedForNature("left",leftFormName,0,"serious")'),normal*2);
      assert.equal(Number(await page.locator('#leftStats [data-stat-key="spe"] .stat-final').innerText()),normal*2,'Displayed Speed includes '+ability);
      assert.equal(Number(await page.locator('#leftStats [data-stat-key="spe"] td').nth(1).innerText()),await run('statBase(leftFormName,"spe")'),'Species base Speed stays unchanged');
      const speedSP=page.locator('#leftStats input[data-stat="spe"]');
      await speedSP.fill('12');
      assert.equal(Number(await page.locator('#leftStats [data-stat-key="spe"] .stat-final').innerText()),await run('currentSpeed("left")'),'Editing SP retains weather-adjusted Speed');
      await speedSP.fill('0');
      await weather('');
      assert.equal(Number(await page.locator('#leftStats [data-stat-key="spe"] .stat-final').innerText()),normal,'Removing weather restores displayed Speed');
      await weather(w);
      await run('FIELD_STATE.left.tailwind=true');
      assert.equal(await run('currentSpeed("left")'),normal*4,'Tailwind stacks once');
      await run('FIELD_STATE.left.tailwind=false');
    }
    await select('left','Victreebel','Chlorophyll');
    await select('right','Charizard','Blaze');
    await run('setActiveForm("right","Mega Charizard Y")');
    assert.equal(Number(await page.locator('#leftStats [data-stat-key="spe"] .stat-final').innerText()),180,'Opposing Drought updates displayed Speed immediately');
    await select('right','Altaria','Cloud Nine');
    await weather('Sun');
    assert.equal(Number(await page.locator('#leftStats [data-stat-key="spe"] .stat-final').innerText()),90,'Cloud Nine suppresses displayed weather boost');
    await run('clearSide("right")');
    assert.equal(Number(await page.locator('#leftStats [data-stat-key="spe"] .stat-final').innerText()),180,'Removing Cloud Nine restores displayed weather boost');
    await select('right','Beartic','Swift Swim');
    await weather('Rain');
    assert.equal(Number(await page.locator('#rightStats [data-stat-key="spe"] .stat-final').innerText()),await run('currentSpeed("right")'),'Opponent displayed Speed matches optimizer');
    await page.locator('#rightStats input[data-stat="spe"]').fill('12');
    assert.equal(Number(await page.locator('#rightStats [data-stat-key="spe"] .stat-final').innerText()),await run('currentSpeed("right")'),'Opponent SP updates effective Speed');
    await page.selectOption('#rightItem','Choice Scarf');
    await page.selectOption('#rightStatus','par');
    await page.locator('[data-field-side="right"][data-field-key="tailwind"]').click();
    assert.equal(Number(await page.locator('#rightStats [data-stat-key="spe"] .stat-final').innerText()),await run('currentSpeed("right")'),'Displayed Speed stacks Scarf, paralysis, Tailwind and rain once');
    await page.evaluate(()=>document.documentElement.dataset.theme='dark');
    await page.locator('#rightStats').screenshot({path:'/tmp/prep-effective-speed.png'});
    await page.locator('[data-field-side="right"][data-field-key="tailwind"]').click();
    await select('left','Charizard','Blaze');
    await select('right','Snorlax','Immunity');
    await weather('');
    const fire=await run('calculateMoveDamage("left","Flamethrower").max');
    await weather('Sun');
    assert(await run('calculateMoveDamage("left","Flamethrower").max')>fire);
    await weather('Rain');
    assert(await run('calculateMoveDamage("left","Flamethrower").max')<fire);
    for(const [w,type] of [['Sun','Fire'],['Rain','Water'],['Sand','Rock'],['Snow','Ice']]){
      await weather(w);
      assert.equal(await run('calculateMoveDamage("left","Weather Ball").effectiveType'),type);
      assert.equal(await run('calculateMoveDamage("left","Weather Ball").power'),100);
    }
    await select('right','Tyranitar','Unnerve');
    await weather('');
    const plain=await run('calculateMoveDamage("left","Dragon Pulse").max');
    await weather('Sand');
    assert(await run('calculateMoveDamage("left","Dragon Pulse").max')<plain,'Sand Rock SpD');
    await select('left','Staraptor','Intimidate','Life Orb');
    await select('right','Snorlax','Immunity');
    await weather('');
    assert(await run('learnedMoveNames("Staraptor").includes("Final Gambit")'),'current Champions legality');
    assert(!(await run('learnedMoveNames("Staraptor")')).includes('Protect'),'normal calculator only damaging moves');
    assert((await run('allLearnedMoveNames("Staraptor")')).includes('Protect'),'Builder includes status');
    const fg=await run('calculateMoveDamage("left","Final Gambit").min');
    assert.equal(fg,await run('currentHpValueForSide("left")'));
    await run('BATTLE_STATE.left.hpPct=50');
    assert.equal(await run('calculateMoveDamage("left","Final Gambit").min'),await run('currentHpValueForSide("left")'));
    await run('BATTLE_STATE.left.hpPct=100; optimizeFinalGambitKO("Final Gambit")');
    assert.equal(await run('leftSP.spa'),0);
    assert.equal(await run('selectedItem("left")'),'Life Orb');
    await select('left','Dragonite','Inner Focus');
    await select('right','Snorlax','Immunity');
    assert.equal(await run('calculateMoveDamage("left","Dual Wingbeat").result.damage.length'),2);
    assert.equal(await run('calculateMoveDamage("left","Dragon Darts").hits'),1);
    await run('ensureBuilderSelectValue($id("leftAbility"),"Skill Link")');
    assert.equal(await run('moveMultiHitProfile("Rock Blast","left").defaultHits'),5);
    await run('ensureBuilderSelectValue($id("leftAbility"),"");ensureBuilderSelectValue($id("leftItem"),"Loaded Dice")');
    assert.equal(await run('moveMultiHitProfile("Rock Blast","left").min'),4);
    // Ordinary sends reveal only species/form; Mega sends reveal only guaranteed information.
    await select('right','Charizard','Blaze','Life Orb');
    await run('NOTE_SHEET_STATE.slots=Array.from({length:6},emptyNoteSheetSlot);sendRightPokemonToNoteSheet()');
    assert.equal(await run('NOTE_SHEET_STATE.slots[0].ability'),'');
    assert.equal(await run('NOTE_SHEET_STATE.slots[0].item'),'');
    await run('setActiveForm("right","Mega Charizard Y");sendRightPokemonToNoteSheet()');
    assert.equal(await run('NOTE_SHEET_STATE.slots[1].ability'),'Drought');
    assert.equal(await run('NOTE_SHEET_STATE.slots[1].item'),'Charizardite Y');
    // Direct Note Sheet selection, form changes, and saved notes use the same defaults.
    await run('setNoteSheetPokemon(2,"Charizard");openNoteSheetPicker(2,"form")');
    await page.locator('#pickerList .picker-option').filter({hasText:'Mega Charizard Y'}).click();
    assert.equal(await run('NOTE_SHEET_STATE.slots[2].ability'),'Drought');
    assert.equal(await run('NOTE_SHEET_STATE.slots[2].item'),'Charizardite Y');
    await page.locator('#noteSheetGrid [data-note-index="2"].note-card').screenshot({path:'/tmp/prep-mega-note.png'});
    await run('openNoteSheetPicker(2,"form")');
    await page.locator('#pickerList .picker-option').filter({hasText:'Mega Charizard X'}).click();
    assert.equal(await run('NOTE_SHEET_STATE.slots[2].ability'),'Tough Claws');
    assert.equal(await run('NOTE_SHEET_STATE.slots[2].item'),'Charizardite X');
    await run('openNoteSheetPicker(2,"form")');
    await page.locator('#pickerList .picker-option').filter({hasText:'Base Form'}).click();
    assert.equal(await run('NOTE_SHEET_STATE.slots[2].ability'),'','Returning to base form does not guess an ability');
    assert.equal(await run('NOTE_SHEET_STATE.slots[2].item'),'','Returning to base form clears Mega stone');
    await run('setNoteSheetPokemon(3,"Swampert","Mega Swampert")');
    assert.equal(await run('NOTE_SHEET_STATE.slots[3].ability'),'Swift Swim');
    assert.equal(await run('NOTE_SHEET_STATE.slots[3].item'),'Swampertite');
    await run('NOTE_SHEET_STATE.slots[3].moves=["Protect","","",""];NOTE_SHEET_STATE.slots[3].notes="Keep my scouting notes";NOTE_SHEET_STATE.slots[3].item="";NOTE_SHEET_STATE.slots[3].ability="";saveNoteSheetState()');
    await page.reload();
    await page.waitForFunction(()=>window.__prepTest?.('damageDataLoaded && setDataLoaded'));
    assert.equal(await run('NOTE_SHEET_STATE.slots[3].ability'),'Swift Swim','Existing saved Mega gets its ability');
    assert.equal(await run('NOTE_SHEET_STATE.slots[3].item'),'Swampertite','Existing saved Mega gets its stone');
    assert.equal(await run('NOTE_SHEET_STATE.slots[3].moves[0]'),'Protect');
    assert.equal(await run('NOTE_SHEET_STATE.slots[3].notes'),'Keep my scouting notes');
    assert.equal(await run('JSON.parse(localStorage.getItem(NOTE_SHEET_STORAGE_KEY)).slots[3].ability'),'Swift Swim','Backfilled Mega defaults persist');
    await run('NOTE_SHEET_STATE.slots[0].moves=["Protect","","",""];loadNoteSheetSlotToCalculator(0)');
    await run('populateSetOptions("right",{preserve:true});populateMoves("right")');
    assert.equal(await run('selectedAbility("right")'),'');
    assert.equal(await run('selectedItem("right")'),'');
    assert.equal(await page.locator('#rightMove1').inputValue(),'Protect');
    assert.equal(await page.locator('#rightMove2').inputValue(),'');
    assert.equal(await run('calcPokemon("right").ability'),'(unknown)');
    assert.equal(await run('rosterPrimaryDisplay("Salamence",rosterSpeedProfile("Salamence"),"left").primaryName'),'Mega Salamence');
    await select('left','Salamence','Intimidate');
    assert.equal(await run('rosterPrimaryDisplay("Salamence",rosterSpeedProfile("Salamence"),"left").primaryName'),'Salamence');
    await run('setActiveForm("left","Mega Salamence")');
    assert.equal(await run('rosterPrimaryDisplay("Salamence",rosterSpeedProfile("Salamence"),"left").primarySpeed'),120);
    for(const [name,slug] of [['Indeedee-M','indeedee'],['Aegislash-Shield','aegislash'],['Mega Charizard Y','charizard-megay'],['Arcanine-Hisui','arcanine-hisui']]){
      assert.equal(await run('spriteSlugCandidates('+JSON.stringify(name)+')[0]'),slug);
    }
    // A failed cached URL must retry a real named-form sprite, not Substitute.
    await page.route('https://play.pokemonshowdown.com/sprites/home/charizard.png',route=>route.fulfill({
      contentType:'image/png',body:fs.readFileSync(path.join(root,'images/sprites/champions/Menu CP 0006.png'))
    }));
    await run('RESOLVED_SPRITE_URLS.set("Charizard","https://fixture.invalid/broken.png");setSprite("left","Charizard")');
    await page.waitForFunction(()=>document.querySelector('#leftSprite').dataset.spriteFallback==='resolved');
    assert.match(await page.locator('#leftSprite').getAttribute('src'),/home\/charizard\.png$/);
    await select('left','Aegislash','Stance Change');
    assert.match(await run('leftFormName'),/Aegislash(?:-Shield)?$/);
    // Builder transfer keeps Nature, SP, item, ability and status moves.
    await run(`TEAM_BUILDER_STATE.slots[0]={baseName:"Charizard",formName:"Charizard",displayName:"Charizard",
      nature:"modest",ability:"Blaze",item:"Life Orb",sp:{hp:2,atk:0,def:0,spa:32,spd:0,spe:32},
      moves:[{name:"Protect"},{name:"Flamethrower"},{name:"Air Slash"},{name:"Dragon Pulse"}]};
      loadTeamBuilderSlotToCalculator(0)`);
    assert.equal(await page.locator('#leftNature').inputValue(),'modest');
    assert.equal(await run('leftSP.spa'),32);
    assert.equal(await run('leftSP.spe'),32);
    assert.equal(await page.locator('#leftMove1').inputValue(),'Protect');
    assert.equal(await run('selectedItem("left")'),'Life Orb');
    await select('right','Snorlax','Immunity');
    await run('$id("optFocus").value="trickroom_min";optimize()');
    assert.equal(await run('leftSP.spe'),0);
    assert.equal(await page.locator('#leftNature').inputValue(),'quiet');
    await run('$id("optFocus").value="neutral_outspeed";optimize()');
    assert.equal(await run('rightSP.spe'),32);
    assert.equal(await run('setNatureMultiplier($id("rightNature").value,"spe")'),1);
    await select('left','Charizard','Blaze','Charcoal');
    await select('right','Snorlax','Immunity');
    await run('BATTLE_STATE.right.hpPct=10;ensureTransferredCalculatorMoveValue($id("leftMove1"),"Flamethrower");$id("optFocus").value="guaranteed_ko";refreshDamageBenchmarkUI();$id("damageBenchmarkMove").value="Flamethrower";optimize()');
    assert.equal(await run('leftSP.spa'),0,'No unnecessary SP for an existing KO');
    assert.equal(await run('selectedItem("left")'),'Charcoal','No unnecessary Life Orb');
    await run('BATTLE_STATE.right.hpPct=100;ensureTransferredCalculatorMoveValue($id("rightMove1"),"Tackle");$id("optFocus").value="survive_hit";refreshDamageBenchmarkUI();$id("damageBenchmarkMove").value="Tackle";optimize()');
    assert.equal(await run('selectedItem("left")'),'Charcoal','Survival never changes item');
    assert.equal(await run('leftSP.hp'),0,'No unnecessary HP when already surviving');
    await select('left','Charizard','Blaze');
    await select('right','Snorlax','Immunity','Sitrus Berry');
    await run('ensureTransferredCalculatorMoveValue($id("leftMove1"),"Flamethrower");switchWorkspacePage("calculator");updateAllDamage()');
    assert.match(await page.locator('#leftMoveResult1 .move-percent-only').innerText(),/%$/);
    assert.match(await page.locator('#leftMoveResult1 .move-ko').innerText(),/chance|Guaranteed|No KO/);
    for(const width of [1600,1100,390]){
      await page.setViewportSize({width,height:1100});
      await page.evaluate(()=>document.documentElement.dataset.theme='dark');
      const geometry=await page.locator('#leftMoveResult1').evaluate(el=>{
        const p=el.querySelector('.move-percent-only'),ko=el.querySelector('.move-ko'),meta=el.querySelector('.move-meta');
        return {overflow:p.scrollWidth>p.clientWidth+1,ordered:p.getBoundingClientRect().bottom<=ko.getBoundingClientRect().top+1 && ko.getBoundingClientRect().bottom<=meta.getBoundingClientRect().top+1};
      });
      assert(!geometry.overflow,'percentage fits at '+width);
      assert(geometry.ordered,'KO directly beneath percentage at '+width);
      await page.locator('#leftMoveResult1').screenshot({path:'/tmp/prep-repair-damage-'+width+'.png'});
    }
    assert.deepEqual(errors,[]);
    assert.deepEqual(writes,[]);
    console.log('PASS: real engine, weather Speed display and optimizer parity on both sides, SP edits, weather suppression and modifier stacking, Weather Ball, Sand bulk, legal/status moves, Final Gambit, multihit controls, exact Note transfers, direct/form-picker/persisted Mega note defaults, rail overrides, sprite aliases, dark/mobile damage layout; no production writes.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
