(() => {
  const base = 'https://cgvxehwqoviihxndupoj.supabase.co/rest/v1/rpc/';
  const headers = { apikey: 'sb_publishable_pB_pv3N_-EXLhXBp6OXpkA_U14NjoJu', 'Content-Type': 'application/json' };
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const code = () => localStorage.getItem('pokeleague.accessCode') || sessionStorage.getItem('pokeleague.accessCode') || '';
  const rpc = async (name, body) => {
    const response = await fetch(base + name, { method:'POST',headers,body:JSON.stringify(body),cache:'no-store' });
    if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || 'Survivor could not connect. Please retry.'); }
    return response.status === 204 ? null : response.json();
  };
  const dialog = document.createElement('dialog');
  dialog.className = 'survivor-dialog';
  dialog.setAttribute('aria-labelledby','survivorTitle');
  dialog.innerHTML = `<button class="survivor-close" type="button" aria-label="Close Survivor">×</button>
    <header class="survivor-hero"><img src="images/navigation/survivor.png" alt="" width="160" height="90"><div><h2 id="survivorTitle">PokeLeague Survivor</h2><p>One pick. One life. Outlast the league.</p></div></header>
    <div class="survivor-body"><p class="survivor-rules">Pick one winning team each week. You may change your pick before it locks, but can never reuse a team from an earlier week. An incorrect or missed pick eliminates you; you can keep playing for fun. Picks lock with Pick’ems when waivers close, or when scoring begins. Public picks are revealed once all results are in or the league advances.</p>
    <div class="survivor-topline"><h3 data-sv-week>Weekly pick</h3><span class="survivor-identity" data-sv-identity></span></div>
    <div class="survivor-deadline" data-sv-deadline></div><p class="survivor-status" data-sv-status role="status" aria-live="polite">Loading Survivor…</p>
    <button class="survivor-retry" type="button" hidden>Retry</button>
    <div data-sv-content hidden><div class="survivor-summary" data-sv-summary></div><div class="survivor-used" data-sv-used></div>
    <div class="survivor-matches" data-sv-matches></div><button class="survivor-save" type="button" disabled>Save Survivor pick</button>
    <h3 data-sv-remaining>Remaining contestants</h3><div class="survivor-contestants" data-sv-contestants></div>
    <div class="survivor-history-heading"><h3>Revealed picks</h3><label>Week <select data-sv-history-week aria-label="Survivor history week"></select></label></div><div class="survivor-history" data-sv-history></div></div></div>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  let state, teams = [], selected = '', historyWeek = '', loading = false, saving = false, timer, trigger, previousOverflow, receivedAt;
  const team = id => teams.find(t => t.id === id) || { id, name:id || 'No pick', logo:'' };
  const locked = () => !state || state.locked || (state.deadline && Date.parse(state.server_now) + Date.now() - receivedAt >= Date.parse(state.deadline));
  const announce = (message,error=false) => { $('[data-sv-status]').textContent=message; $('[data-sv-status]').classList.toggle('is-error',error); };
  const renderHistory = () => {
    const rows = state.history.filter(h => String(h.week) === historyWeek);
    $('[data-sv-history]').innerHTML = rows.length ? rows.map(h => {
      const t=team(h.picked_team_id), out=state.contestants.find(c => c.account_id===h.account_id)?.eliminated_week;
      const fun=out && out<h.week, correct=h.outcome==='correct', wrong=['incorrect','missed'].includes(h.outcome);
      const label = h.outcome==='pending' ? 'Result pending' : correct ? (fun ? 'Correct · for fun' : 'Survived') : h.outcome==='missed' ? 'No pick · eliminated' : fun ? 'Incorrect · for fun' : 'Eliminated';
      return `<article class="survivor-result">${t.logo?`<img src="${esc(t.logo)}" alt="">`:'<span aria-hidden="true">—</span>'}<div><strong>${esc(h.username)}</strong><small>${esc(t.name)} · ${esc(label)}</small></div><span class="survivor-mark${wrong?' is-out':''}" aria-label="${esc(label)}">${correct?'✓':wrong?'✕':'…'}</span></article>`;
    }).join('') : '<p class="survivor-empty">Picks stay private until the week ends.</p>';
  };
  const render = () => {
    if(!state)return;
    $('[data-sv-content]').hidden=false;
    $('[data-sv-week]').textContent=`Week ${state.week} · Your one pick`;
    $('[data-sv-identity]').textContent=state.username || 'Sign in to enter';
    $('[data-sv-deadline]').textContent=locked() ? 'Picks locked for this week' : state.deadline ? `Locks ${new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(state.deadline))}` : 'Deadline not scheduled yet';
    const own=state.own_picks.find(p=>p.week===state.week), contestant=state.contestants.find(c=>c.account_id===state.account_id);
    const used=new Set(state.own_picks.filter(p=>p.week!==state.week).map(p=>p.picked_team_id));
    $('[data-sv-summary]').textContent=!state.account_id?'Sign in with your league access code to make a Survivor pick.':`${contestant?.eliminated_week?`Eliminated in Week ${contestant.eliminated_week} — playing for fun.`:contestant?'You’re still in!':state.ended_weeks.length?'The season has started — new entries play for fun.':'Make your first pick to enter.'} ${own?`Saved pick: ${team(own.picked_team_id).name}.`:'No pick saved for this week.'}`;
    $('[data-sv-used]').innerHTML=[...used].map(id=>`<span>Used: ${esc(team(id).name)}</span>`).join('');
    $('[data-sv-matches]').innerHTML=state.matchups.length?state.matchups.map(m=>`<article class="survivor-match">${[m.home_team_id,m.away_team_id].map((id,i)=>{
      const t=team(id);return `${i?'<span class="survivor-versus">VS</span>':''}<button type="button" class="survivor-team" data-sv-team="${esc(id)}" aria-pressed="${selected===id}" ${!state.account_id||locked()||used.has(id)||saving?'disabled':''}><img src="${esc(t.logo)}" alt="" loading="lazy"><strong>${esc(t.name)}</strong><small>${used.has(id)?'Already used':selected===id?'Selected':locked()?'Locked':'Pick to win'}</small></button>`;
    }).join('')}</article>`).join(''):'<p class="survivor-empty">The commissioner hasn’t posted this week’s matchups yet.</p>';
    $('.survivor-save').disabled=!state.account_id||!selected||locked()||used.has(selected)||saving||own?.picked_team_id===selected;
    $('.survivor-save').textContent=saving?'Saving…':own?'Update Survivor pick':'Save Survivor pick';
    const remaining=state.contestants.filter(c=>!c.eliminated_week);
    $('[data-sv-remaining]').textContent=`Remaining contestants · ${remaining.length}`;
    $('[data-sv-contestants]').innerHTML=remaining.length?remaining.map(c=>`<span class="survivor-person">${esc(c.username)}</span>`).join(''):'<p class="survivor-empty">No remaining contestants yet. Eliminated players can still make picks for fun.</p>';
    if(!state.ended_weeks.map(String).includes(historyWeek))historyWeek=String(state.ended_weeks[0]||'');
    $('[data-sv-history-week]').innerHTML=state.ended_weeks.length?state.ended_weeks.map(w=>`<option value="${w}">Week ${w}</option>`).join(''):'<option value="">No completed weeks</option>';
    $('[data-sv-history-week]').value=historyWeek;
    renderHistory();
  };
  const refresh = async () => {
    if(loading||saving)return;
    loading=true; $('.survivor-retry').hidden=true;
    try {
      const [snapshot, response] = await Promise.all([rpc('read_flash_family_survivor',{p_access_code:code()}),teams.length?null:fetch('data/league-teams.json?v=survivor1',{cache:'no-store'})]);
      if(response){if(!response.ok)throw new Error('Team information could not load.');teams=(await response.json()).teams;}
      const changed=!state||state.week!==snapshot.week||state.account_id!==snapshot.account_id;
      state=snapshot;receivedAt=Date.now();
      if(changed)selected=state.own_picks.find(p=>p.week===state.week)?.picked_team_id||'';
      render();announce(locked()?'Picks are locked. Results will appear after the week ends.':'Choose one team, then save your pick.');return true;
    } catch(error){announce(error.message,true);$('.survivor-retry').hidden=false;return false;} finally{loading=false;}
  };
  document.querySelectorAll('[data-survivor-open]').forEach(button=>button.addEventListener('click',()=>{
    trigger=button;previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();refresh();
    timer=setInterval(()=>{if(!document.hidden){if(state)render();refresh();}},15000);
  }));
  $('.survivor-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{clearInterval(timer);document.body.style.overflow=previousOverflow||'';trigger?.focus();});
  $('.survivor-retry').addEventListener('click',refresh);
  $('[data-sv-history-week]').addEventListener('change',event=>{historyWeek=event.target.value;renderHistory();});
  $('[data-sv-matches]').addEventListener('click',event=>{const button=event.target.closest('[data-sv-team]');if(!button||button.disabled)return;selected=button.dataset.svTeam;render();});
  $('.survivor-save').addEventListener('click',async()=>{
    if(saving||locked()||!selected)return;
    saving=true;render();
    try{await rpc('submit_flash_family_survivor',{p_access_code:code(),p_week:state.week,p_team_id:selected});saving=false;if(await refresh())announce('Your Survivor pick is saved.');}
    catch(error){saving=false;render();announce(error.message,true);}
  });
})();
