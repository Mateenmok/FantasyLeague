(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const defaultSlots = () => ['19:00','20:00','21:00'].map(time => ({time,displayOrder:null,homeTeamId:null,awayTeamId:null}));
  const dateForWeek = (week, currentWeek, now = new Date()) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
    const d = new Date(Date.UTC(+parts.year,+parts.month-1,+parts.day));
    d.setUTCDate(d.getUTCDate()+(5-d.getUTCDay()+7)%7+(week-Math.max(1,currentWeek))*7);
    return d.toISOString().slice(0,10);
  };
  const moveAssignment = (slots, from, to) => {
    if (![from,to].every(i=>Number.isInteger(i)&&i>=0&&i<slots.length)) return slots;
    const assignments=slots.map(({time,startsAt,...assignment})=>assignment);
    assignments.splice(to,0,assignments.splice(from,1)[0]);
    return slots.map((slot,i)=>({time:slot.time,...assignments[i]}));
  };
  const countdown = (startsAt, now=Date.now()) => {
    const ms=Date.parse(startsAt)-now;
    if(!Number.isFinite(ms)) return null;
    const s=Math.max(0,Math.floor(ms/1000));
    return {ended:ms<=0,values:[Math.floor(s/86400),Math.floor(s/3600)%24,Math.floor(s/60)%60,s%60]};
  };
  const model={escape,defaultSlots,dateForWeek,moveAssignment,countdown};
  if(typeof module !== 'undefined') module.exports=model;
  if(typeof window === 'undefined') return;
  const rpc = async (name,body={}) => {
    const response=await fetch(`https://cgvxehwqoviihxndupoj.supabase.co/rest/v1/rpc/${name}`,{method:'POST',cache:'no-store',headers:{apikey:'sb_publishable_pB_pv3N_-EXLhXBp6OXpkA_U14NjoJu','Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    const data=await response.json();
    if(!response.ok) throw new Error(data.message || 'FNPL could not be loaded. Please retry.');
    return data;
  };
  const read=()=>rpc('read_flash_family_fnpl');
  const save=(code,week,date,slots,revision)=>rpc('save_flash_family_fnpl',{p_access_code:code,p_week:week,p_event_date:date,p_slots:slots,p_expected_revision:revision});
  const teams=async()=>{
    const response=await fetch('data/teams.json?v=teams8',{cache:'no-store'});
    if(!response.ok) throw new Error('Team logos could not be loaded.');
    return Object.values((await response.json()).accounts||{}).reduce((map,t)=>(map[t.teamId]=t,map),{});
  };
  const sign=()=>'<span class="fnpl-sign" role="img" aria-label="Friday Night PokeLeague"><img src="images/navigation/friday-night-pokeleague.png" alt="" width="1672" height="941"></span>';
  const teamMarkup=(id,map)=>{
    const t=map[id];
    return t?`<span class="fnpl-team"><img src="${escape(t.logo)}" alt="" width="90" height="90"><strong>${escape(t.teamName)}</strong></span>`:'<span class="fnpl-team fnpl-tba">TBA</span>';
  };
  const matchup=(slot,map)=>`<span class="fnpl-matchup">${teamMarkup(slot.homeTeamId,map)}<b class="fnpl-vs" aria-label="versus">VS</b>${teamMarkup(slot.awayTeamId,map)}</span>`;
  const timeLabel=time=>new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'UTC'}).format(new Date(`2000-01-01T${time}:00Z`));
  const dateLabel=date=>new Intl.DateTimeFormat('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
  const clockMarkup=()=>`<span class="fnpl-clock" data-fnpl-clock role="timer" aria-live="off">${['days','hrs','min','sec'].map(label=>`<span><b>00</b><small>${label}</small></span>`).join('')}</span>`;
  window.PokeLeagueFNPL={...model,read,save,teams,sign,matchup,timeLabel,dateLabel,clockMarkup};
  const home=document.querySelector('[data-fnpl-home]'),page=document.querySelector('[data-fnpl-page]');
  if(!home&&!page) return;
  let data,map,selectedWeek=null,first=null,offset=0,loading=false,interacted=false;
  const weekSelect=page?.querySelector('[data-fnpl-week]');
  const tick=()=>{
    document.querySelectorAll('[data-fnpl-clock]').forEach(clock=>{
      const value=countdown(first?.startsAt,Date.now()+offset);
      if(!value) return;
      clock.querySelectorAll('b').forEach((node,i)=>node.textContent=String(value.values[i]).padStart(2,'0'));
      const label=clock.parentElement.querySelector('[data-fnpl-count-label]');
      if(label) label.textContent=value.ended?'Scheduled start reached':'First match starts in';
    });
  };
  const render=()=>{
    const week=selectedWeek ?? Math.max(1,data.currentWeek);
    const event=data.events.find(e=>e.week===week);
    first=event?.slots.find(slot=>slot.valid) || null;
    const hero=`${sign()}<span class="fnpl-eyebrow">Week ${week} · Friday Night PokeLeague</span>${first?`${matchup(first,map)}<span class="fnpl-count-label" data-fnpl-count-label>First match starts in</span>${clockMarkup()}<span class="fnpl-date">${escape(dateLabel(event.eventDate))} · ${timeLabel(first.time)} Eastern</span>`:'<span class="fnpl-pending">Lineup coming soon</span><span class="fnpl-date">The Friday night stage is getting set.</span>'}`;
    if(home) home.innerHTML=`${hero}<span class="fnpl-open">View the night’s lineup <b aria-hidden="true">↗</b></span>`;
    if(page){
      page.querySelector('[data-fnpl-hero]').innerHTML=hero;
      weekSelect.disabled=false;
      weekSelect.innerHTML=Array.from({length:Math.max(1,data.totalWeeks)},(_,i)=>`<option value="${i+1}"${i+1===week?' selected':''}>Week ${i+1}</option>`).join('');
      page.querySelector('[data-fnpl-lineup]').innerHTML=event?.slots.length?event.slots.map((slot,i)=>`<li class="fnpl-slot"><div class="fnpl-slot-heading"><span>Slot ${i+1}</span><time datetime="${escape(slot.startsAt)}">${timeLabel(slot.time)} <small>Eastern</small></time></div>${slot.valid?matchup(slot,map):'<p class="fnpl-pending">Matchup to be announced</p>'}</li>`).join(''):'<li class="fnpl-empty">No time slots have been announced for this week yet.</li>';
      page.querySelector('[data-fnpl-feedback]').textContent='';
    }
    tick();
  };
  const refresh=async()=>{
    if(loading||document.hidden) return;
    loading=true;
    try{[data,map]=await Promise.all([read(),map?Promise.resolve(map):teams()]);offset=Date.parse(data.serverNow)-Date.now();if(!interacted)selectedWeek=Math.min(data.totalWeeks,Math.max(1,data.currentWeek));render();}
    catch(error){if(home&&!data)home.innerHTML=`${sign()}<span class="fnpl-pending">Friday Night PokeLeague</span><span class="fnpl-open">View schedule ↗</span>`;if(page){page.querySelector('[data-fnpl-feedback]').textContent=error.message;if(!data)page.querySelector('[data-fnpl-hero]').innerHTML=`${sign()}<span class="fnpl-pending">Schedule unavailable</span><span class="fnpl-date">Use Refresh to try again.</span>`;}}
    finally{loading=false;}
  };
  weekSelect?.addEventListener('change',()=>{if(!data)return;interacted=true;selectedWeek=Number(weekSelect.value);render();});
  page?.querySelector('[data-fnpl-refresh]')?.addEventListener('click',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  setInterval(()=>{if(!document.hidden)tick();},1000);setInterval(refresh,60000);refresh();
})();
