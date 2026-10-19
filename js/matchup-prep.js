(() => {
  const $=selector=>document.querySelector(selector), M=window.PokeLeagueSpeed;
  const ACCESS_KEY='pokeleague.matchupPrep', BASE='https://cgvxehwqoviihxndupoj.supabase.co/rest/v1/';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const color=value=>/^#[0-9a-f]{3,8}$/i.test(value||'')?value:'#159bb9';
  let data=null, week=null, loading=false, loadedAt=0;
  const json=async(url,remote=false)=>{
    const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000),headers:remote?{apikey:'sb_publishable_pB_pv3N_-EXLhXBp6OXpkA_U14NjoJu'}:{}});
    if(!response.ok)throw new Error('The live league data could not be loaded. Please try Refresh rosters.');
    return response.json();
  };
  const api=(table,query)=>json(BASE+table+'?'+new URLSearchParams(query),true);
  const team=id=>data.teams.find(t=>t.id===id);
  const teamArt=t=>`<span class="match-team"><img src="${escape(t.logo)}" alt="" width="70" height="70"><strong>${escape(t.name)}</strong></span>`;
  const getPair=()=>{
    const ids=location.hash.slice(1).split('/');
    return ids.length===2&&ids[0]!==ids[1]&&ids.every(id=>team(id))?ids:null;
  };
  const openPair=(home,away)=>{
    if(home===away||!team(home)||!team(away))return;
    location.hash=home+'/'+away;
  };
  const renderMenu=()=>{
    const home=$('[data-custom-home]').value,away=$('[data-custom-away]').value;
    const scheduledWeeks=data.matchups.map(m=>m.week);
    const last=Math.max(data.totalWeeks,data.currentWeek,...scheduledWeeks,1);
    week=week??Math.max(1,data.currentWeek);
    $('[data-prep-week]').innerHTML=Array.from({length:last},(_,i)=>`<option value="${i+1}"${i+1===week?' selected':''}>Week ${i+1}${i+1===data.currentWeek?' · Current':''}</option>`).join('');
    $('[data-prep-week]').disabled=false;
    const matches=data.matchups.filter(m=>m.week===week);
    $('[data-prep-matchups]').innerHTML=matches.map((m,i)=>{
      const home=team(m.home_team_id),away=team(m.away_team_id);if(!home||!away)return '';
      return `<button class="matchup-tile" data-home="${escape(home.id)}" data-away="${escape(away.id)}" aria-label="Compare ${escape(home.name)} and ${escape(away.name)}"><span class="tile-kicker">MATCH ${String(i+1).padStart(2,'0')} <span>WEEK ${week}</span></span><span class="tile-teams">${teamArt(home)}<span class="versus">VS</span>${teamArt(away)}</span><span class="tile-footer">Compare speeds <b aria-hidden="true">↗</b></span></button>`;
    }).join('')||'<p class="empty-state">No matchups are scheduled for this week yet. You can still compare any two teams below.</p>';
    const options=data.teams.map(t=>`<option value="${escape(t.id)}">${escape(t.name)}</option>`).join('');
    $('[data-custom-home]').innerHTML=options;$('[data-custom-away]').innerHTML=options;
    $('[data-custom-home]').value=team(home)?home:data.teams[0]?.id||'';
    $('[data-custom-away]').value=team(away)?away:data.teams[1]?.id||'';
    $('[data-prep-custom]').querySelectorAll('select,button').forEach(el=>el.disabled=false);
  };
  const rowMarkup=(row,max)=>{
    const owner=team(row.teamId),accent=color(owner.accent);
    const portrait=row.sprite?`<img src="${escape(row.sprite)}" alt="" width="64" height="64" loading="lazy">`:'<span aria-hidden="true">?</span>';
    const sigil=row.isMega?'<img class="mega-sigil" src="images/icons/mega-evolution-v2.webp" alt="Mega Evolution" width="20" height="20">':'';
    return `<li class="speed-row" style="--team-accent:${accent};--speed-fill:${row.speed==null?0:Math.max(3,row.speed/max*100)}%" data-speed="${row.speed??''}">
      <span class="speed-rank" aria-label="${row.rank==null?'Unranked':`${row.tied?'Tied ':''}rank ${row.rank}`}">${row.rank==null?'—':String(row.rank).padStart(2,'0')}</span>
      <span class="speed-sprite">${portrait}${sigil}</span>
      <span class="speed-identity"><strong>${escape(row.name)}</strong><span class="row-owner"><i aria-hidden="true"></i>${escape(owner.name)}</span>
        <span class="row-types">${row.types.map(type=>escape(type)).join(' / ')}${row.tied?' <span class="tie-badge">SPEED TIE</span>':''}</span>
      </span>
      <span class="speed-value"><b>${row.speed??'—'}</b><small>${row.speed==null?'Unavailable':'BASE SPE'}</small></span>
      <span class="speed-meter" aria-hidden="true"><i></i></span></li>`;
  };
  const renderDetail=ids=>{
    const [home,away]=ids.map(team), result=M.compare(ids,data.rosters,data.index);
    $('[data-prep-comparison]').innerHTML=`<p class="eyebrow">LIVE ROSTER COMPARISON</p><h1 class="comparison-title" tabindex="-1">${escape(home.name)} <span>vs</span> ${escape(away.name)}</h1><div class="comparison-teams"><div style="--team-accent:${color(home.accent)}">${teamArt(home)}<span>${(data.rosters[home.id]||[]).length} Pokémon</span></div><b class="versus">VS</b><div style="--team-accent:${color(away.accent)}">${teamArt(away)}<span>${(data.rosters[away.id]||[]).length} Pokémon</span></div></div>`;
    const fastest=result.base.find(row=>row.speed!=null),topNames=result.base.filter(row=>row.speed===fastest?.speed).map(row=>row.name);
    $('[data-prep-summary]').innerHTML=`<div><span>FASTEST BASE SPEED</span><strong>${fastest?.speed??'—'} <small>${escape(topNames.join(' / ')||'No roster data')}</small></strong></div><div><span>ROSTER POKÉMON</span><strong>${result.base.length}<small>Both teams combined</small></strong></div><div><span>MEGA OPTIONS</span><strong>${result.mega.length}<small>Listed separately</small></strong></div>`;
    $('[data-base-count]').textContent=result.base.length;$('[data-mega-count]').textContent=result.mega.length;
    const maxBase=Math.max(1,...result.base.map(row=>row.speed||0)),maxMega=Math.max(1,...result.mega.map(row=>row.speed||0));
    $('[data-prep-base]').innerHTML=result.base.map(row=>rowMarkup(row,maxBase)).join('')||'<li class="empty-state">These teams have no saved roster Pokémon yet.</li>';
    $('[data-prep-mega]').innerHTML=result.mega.map(row=>rowMarkup(row,maxMega)).join('')||'<li class="empty-state">Neither roster has a Mega Evolution available.</li>';
  };
  const renderRoute=(focus=false)=>{
    if(!data)return;
    const pair=getPair();$('[data-prep-menu]').hidden=!!pair;$('[data-prep-detail]').hidden=!pair;
    document.title=pair?`${team(pair[0]).name} vs ${team(pair[1]).name} | Matchup Lab`:'Matchup Lab | PokeLeague PREP';
    if(pair){renderDetail(pair);if(focus)$('.comparison-title').focus();}
    else if(focus)$('#matchupMenuTitle').scrollIntoView({block:'start'});
  };
  const refresh=async()=>{
    if(loading)return;
    loading=true;$('[data-prep-refresh]').disabled=true;$('[data-prep-status]').textContent='Syncing live rosters…';
    try{
      const [leagueTeams,accounts,index,leagues,matchups,rows]=await Promise.all([
        json('data/league-teams.json?v=league-teams2'),json('data/teams.json?v=teams8'),json('data/matchup-speed-index.json?v=prep1'),
        api('leagues',{id:'eq.flash-family-season-1',select:'current_matchup_number,regular_season_matches',limit:'1'}),
        api('flash_family_matchups',{league_id:'eq.flash-family-season-1',select:'week,display_order,home_team_id,away_team_id',order:'week.asc,display_order.asc'}),
        api('team_rosters',{league_id:'eq.flash-family-season-1',select:'team_id,pokemon_slug,slot_number',order:'slot_number.asc'}),
      ]);
      if(!leagues[0])throw new Error('The league is unavailable. Please retry.');
      const owners=Object.values(accounts.accounts||{});
      data={teams:leagueTeams.teams.map(t=>({...t,accent:owners.find(a=>a.teamId===t.id)?.theme?.accent})),index,matchups,
        currentWeek:Number(leagues[0].current_matchup_number)||0,totalWeeks:Number(leagues[0].regular_season_matches)||1,
        rosters:rows.reduce((map,row)=>{(map[row.team_id]||=[]).push(row.pokemon_slug);return map;},{})};
      loadedAt=Date.now();renderMenu();renderRoute();
      $('[data-prep-status]').textContent=`Live rosters · Updated ${new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date(loadedAt))}`;
    }catch(error){$('[data-prep-status]').textContent=error.message+(data?' The last loaded rosters are still displayed.':'');if(!data)$('[data-prep-matchups]').innerHTML='<p class="empty-state">We couldn’t connect to the league. Use Refresh rosters to try again.</p>';}
    finally{loading=false;$('[data-prep-refresh]').disabled=false;}
  };
  const enter=()=>{$('[data-prep-gate]').hidden=true;$('[data-prep-app]').hidden=false;$('[data-prep-exit]').hidden=false;refresh();};
  $('[data-prep-gate-form]').addEventListener('submit',event=>{event.preventDefault();if($('#prepCode').value.trim().toUpperCase()!=='PREP'){$('[data-gate-status]').textContent='Use PREP to enter Matchup Lab.';return;}sessionStorage.setItem(ACCESS_KEY,'PREP');enter();});
  $('[data-prep-exit]').addEventListener('click',()=>{sessionStorage.removeItem(ACCESS_KEY);location.assign('index.html');});
  $('[data-prep-refresh]').addEventListener('click',refresh);
  $('[data-prep-week]').addEventListener('change',event=>{week=Number(event.target.value);renderMenu();});
  $('[data-prep-matchups]').addEventListener('click',event=>{const button=event.target.closest('[data-home]');if(button)openPair(button.dataset.home,button.dataset.away);});
  $('[data-prep-custom]').addEventListener('submit',event=>{event.preventDefault();const home=$('[data-custom-home]').value,away=$('[data-custom-away]').value;$('[data-custom-status]').textContent=home===away?'Choose two different teams.':'';if(home!==away)openPair(home,away);});
  $('[data-prep-back]').addEventListener('click',()=>{location.hash='';});
  window.addEventListener('hashchange',()=>renderRoute(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&data&&Date.now()-loadedAt>60000)refresh();});
  if(sessionStorage.getItem(ACCESS_KEY)==='PREP')enter();
})();
