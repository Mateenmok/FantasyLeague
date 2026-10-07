(() => {
  const root=document.querySelector('[data-fnpl-admin]');
  if(!root) return;
  const F=window.PokeLeagueFNPL,$=s=>root.querySelector(s),e=F.escape;
  let data,teams,week,slots=[],revision=0,selected=0,dirty=false,busy=false,dragIndex=null,pointerDrag=null,code='';
  const feedback=(message,error=false)=>{ $('[data-fnpl-admin-status]').textContent=message;$('[data-fnpl-admin-status]').classList.toggle('is-error',error); };
  const markDirty=()=>{dirty=true;feedback('Unsaved changes — save to publish this lineup.');};
  const matches=()=>data.matchups.filter(m=>m.week===week);
  const assignment=m=>({displayOrder:m.display_order,homeTeamId:m.home_team_id,awayTeamId:m.away_team_id});
  const empty=()=>({displayOrder:null,homeTeamId:null,awayTeamId:null});
  const name=id=>teams[id]?.teamName || id;
  const render=()=>{
    $('[data-fnpl-slots]').innerHTML=slots.map((s,i)=>`<li class="fnpl-edit-slot${i===selected?' is-selected':''}" data-slot="${i}"><div class="fnpl-slot-tools"><button type="button" data-select="${i}" aria-pressed="${i===selected}">Slot ${i+1}</button><label>Eastern time<input type="time" data-time="${i}" value="${e(s.time)}" required aria-label="Slot ${i+1} Eastern time"></label><button type="button" class="fnpl-remove" data-remove="${i}" aria-label="Remove slot ${i+1}">−</button></div><div class="fnpl-assignment" draggable="${s.displayOrder!=null}" data-drag="${i}" tabindex="0" aria-label="${s.displayOrder!=null?e(`${name(s.homeTeamId)} versus ${name(s.awayTeamId)}. Use Move earlier or Move later buttons to reorder.`):`Empty slot ${i+1}. Select a matchup below.`}">${s.displayOrder!=null?F.matchup(s,teams):'<span>Click a weekly matchup to fill this slot</span>'}</div><div class="fnpl-reorder"><button type="button" data-move="${i}" data-direction="-1"${i===0?' disabled':''} aria-label="Move slot ${i+1} matchup earlier">↑ Earlier</button><button type="button" data-move="${i}" data-direction="1"${i===slots.length-1?' disabled':''} aria-label="Move slot ${i+1} matchup later">↓ Later</button><button type="button" data-clear="${i}"${s.displayOrder==null?' disabled':''}>Clear matchup</button></div></li>`).join('');
    $('[data-fnpl-matchups]').innerHTML=matches().map(m=>{
      const assigned=slots.some(s=>s.displayOrder===m.display_order);
      return `<button type="button" class="fnpl-pool-match" data-match="${m.display_order}"${assigned||!slots.length?' disabled':''}>${F.matchup(assignment(m),teams)}<span>${assigned?'Already in lineup':`Add to slot ${Math.min(selected+1,slots.length)}`}</span></button>`;
    }).join('') || '<p class="fnpl-empty">Set this week’s matchups in Schedule first, then reload this panel.</p>';
    root.querySelectorAll('.fnpl-reorder').forEach((row,i)=>{const grip=document.createElement('button');grip.type='button';grip.dataset.grab=String(i);grip.className='fnpl-grip';grip.textContent='⠿ Drag';grip.setAttribute('aria-label',`Drag slot ${i+1} matchup to another slot`);grip.disabled=slots[i].displayOrder==null;row.prepend(grip);});
    $('[data-fnpl-add]').disabled=slots.length>=20;
  };
  const chooseWeek=()=>{
    week=Number($('[data-fnpl-admin-week]').value);
    const saved=data.events.find(event=>event.week===week);
    slots=saved?saved.slots.map(s=>s.valid?{...s}:{time:s.time,...empty()}):F.defaultSlots();
    revision=saved?.revision || 0; selected=0;dirty=false;
    $('[data-fnpl-event-date]').value=saved?.eventDate || F.dateForWeek(week,data.currentWeek);
    feedback(saved?'Saved lineup loaded.': 'Default slots: 7:00, 8:00, and 9:00 PM Eastern. Choose a date and matchups, then save.');
    if(saved?.slots.some(s=>s.displayOrder!=null&&!s.valid)) feedback('A weekly matchup changed. Its old FNPL assignment has been cleared here; select the updated matchup and save.',true);
    render();
  };
  const load=async()=>{
    busy=true;$('[data-fnpl-fields]').disabled=true;
    try{
      const [next,nextTeams]=await Promise.all([F.read(),F.teams()]);data=next;teams=nextTeams;
      week=Math.min(week || Math.max(1,data.currentWeek),data.totalWeeks);
      $('[data-fnpl-admin-week]').innerHTML=Array.from({length:data.totalWeeks},(_,i)=>`<option value="${i+1}"${week===i+1?' selected':''}>Week ${i+1}</option>`).join('');
      chooseWeek();
    }catch(error){feedback(error.message,true);}
    finally{busy=false;$('[data-fnpl-fields]').disabled=false;}
  };
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||busy) return;
    if(button.matches('[data-fnpl-reload]')){if(!dirty||confirm('Discard your unsaved FNPL changes and reload the saved lineup?'))load();return;}
    if(!data) return;
    if(button.dataset.select!=null){selected=Number(button.dataset.select);render();return;}
    if(button.dataset.match!=null){const m=matches().find(row=>row.display_order===Number(button.dataset.match));if(!m||!slots[selected])return;slots[selected]={time:slots[selected].time,...assignment(m)};const open=slots.findIndex(s=>s.displayOrder==null);if(open>=0)selected=open;}
    else if(button.dataset.remove!=null){slots.splice(Number(button.dataset.remove),1);selected=Math.max(0,Math.min(selected,slots.length-1));}
    else if(button.dataset.clear!=null){const i=Number(button.dataset.clear);slots[i]={time:slots[i].time,...empty()};selected=i;}
    else if(button.dataset.move!=null){const i=Number(button.dataset.move),to=i+Number(button.dataset.direction);slots=F.moveAssignment(slots,i,to);selected=to;}
    else if(button.matches('[data-fnpl-add]')){const last=slots.at(-1)?.time || '18:00';const mins=Number(last.slice(0,2))*60+Number(last.slice(3))+60;slots.push({time:mins<1440?`${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`:'',...empty()});selected=slots.length-1;}
    else return;
    markDirty();render();
  });
  root.addEventListener('change',event=>{
    if(busy||!data)return;
    if(event.target.matches('[data-fnpl-admin-week]')){
      if(dirty&&!confirm('Discard unsaved FNPL changes and switch weeks?')){event.target.value=String(week);return;}
      chooseWeek();return;
    }
    if(event.target.dataset.time!=null){const active=slots[selected];slots[Number(event.target.dataset.time)].time=event.target.value;slots.sort((a,b)=>a.time.localeCompare(b.time));selected=Math.max(0,slots.indexOf(active));render();}
    markDirty();
  });
  root.addEventListener('dragstart',event=>{const card=event.target.closest('[data-drag]');if(!card||busy)return;dragIndex=Number(card.dataset.drag);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(dragIndex));});
  root.addEventListener('dragover',event=>{if(dragIndex!=null&&event.target.closest('[data-slot]')){event.preventDefault();event.dataTransfer.dropEffect='move';}});
  root.addEventListener('drop',event=>{const target=event.target.closest('[data-slot]');if(!target||dragIndex==null||busy)return;event.preventDefault();selected=Number(target.dataset.slot);slots=F.moveAssignment(slots,dragIndex,selected);dragIndex=null;markDirty();render();});
  root.addEventListener('dragend',()=>{dragIndex=null;});
  // A pointer handle supports touch and browsers with limited HTML drag-and-drop.
  const clearDrop=()=>root.querySelectorAll('.is-drop-target').forEach(el=>el.classList.remove('is-drop-target'));
  root.addEventListener('pointerdown',event=>{
    const grip=event.target.closest('[data-grab]');if(!grip||grip.disabled||busy||event.button!==0)return;
    event.preventDefault();grip.setPointerCapture(event.pointerId);
    pointerDrag={from:Number(grip.dataset.grab),id:event.pointerId,x:event.clientX,y:event.clientY};
  });
  root.addEventListener('pointermove',event=>{
    if(!pointerDrag||pointerDrag.id!==event.pointerId)return;
    clearDrop();const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-slot]');
    if(target&&root.contains(target))target.classList.add('is-drop-target');
  });
  root.addEventListener('pointerup',event=>{
    if(!pointerDrag||pointerDrag.id!==event.pointerId)return;
    const drag=pointerDrag;pointerDrag=null;clearDrop();
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-slot]');
    if(!busy&&target&&root.contains(target)&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>8){selected=Number(target.dataset.slot);slots=F.moveAssignment(slots,drag.from,selected);markDirty();render();}
  });
  root.addEventListener('pointercancel',()=>{pointerDrag=null;clearDrop();});
  $('[data-fnpl-form]').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!data)return;
    busy=true;$('[data-fnpl-fields]').disabled=true;feedback('Saving FNPL…');
    try{
      revision=await F.save(code,week,$('[data-fnpl-event-date]').value,slots,revision);dirty=false;
      const saved={week,eventDate:$('[data-fnpl-event-date]').value,revision,slots:slots.map(s=>({...s,valid:s.displayOrder!=null}))};
      data.events=data.events.filter(row=>row.week!==week).concat(saved);
      feedback('Saved and published. The homepage and FNPL page will update automatically.');
    }catch(error){feedback(error.message,true);}
    finally{busy=false;$('[data-fnpl-fields]').disabled=false;}
  });
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  (async()=>{
    try{
      code=(localStorage.getItem('pokeleague.accessCode')||sessionStorage.getItem('pokeleague.accessCode')||'').trim().toUpperCase();
      const response=await fetch('data/teams.json?v=teams8',{cache:'no-store'}),accounts=(await response.json()).accounts||{};
      const preview=['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).get('preview')==='admin';
      if(accounts[code]?.isAdmin!==true&&!preview)return;
      await load();
    }catch(error){feedback(error.message,true);}
  })();
})();
