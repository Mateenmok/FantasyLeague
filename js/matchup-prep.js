(() => {
  const $=selector=>document.querySelector(selector), M=window.PokeLeagueSpeed, N=window.PokeLeagueNotes;
  const ACCESS_KEY='pokeleague.matchupPrep', BASE='https://cgvxehwqoviihxndupoj.supabase.co/rest/v1/';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const color=value=>/^#[0-9a-f]{3,8}$/i.test(value||'')?value:'#159bb9';
  let data=null, week=null, loading=false, loadedAt=0;
  let result=null, pairKey='', notes=N.empty(), history=[], view='speed', threat='ohko', pending=null, drag=null, suppressClick=false;
  const noteMessage='Notes save only in this browser, per matchup. League rosters are never changed.';
  const snapshot=()=>{history.push(JSON.stringify(notes));if(history.length>40)history.shift();};
  const saveNotes=()=>{
    try{localStorage.setItem(pairKey,JSON.stringify(notes));$('[data-notes-status]').textContent='Saved in this browser · '+noteMessage;}
    catch{$('[data-notes-status]').textContent='Browser storage is unavailable. These notes will be lost when you leave or refresh.';}
    $('[data-undo]').disabled=!history.length;$('[data-clear-lines]').disabled=!notes.lines.length;
  };
  const loadNotes=ids=>{
    const next=N.storageKey(ids);if(next===pairKey)return;
    pairKey=next;history=[];pending=null;drag=null;
    try{notes=N.normalize(JSON.parse(localStorage.getItem(next)||'null'));$('[data-notes-status]').textContent=noteMessage;}
    catch{notes=N.empty();$('[data-notes-status]').textContent='Previous notes could not be loaded. New notes are kept in this browser when available.';}
  };
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
  const roleControl=row=>`<select class="role-select" data-role-select="${escape(row.id)}" aria-label="Highlight ${escape(row.name)} (${escape(team(row.teamId).name)})"><option value="">No highlight</option>${Object.entries(N.roles).map(([key,role])=>`<option value="${key}"${notes.roles[row.id]===key?' selected':''}>${escape(role.label)}</option>`).join('')}</select>`;
  const rowMarkup=row=>{
    const owner=team(row.teamId),accent=color(owner.accent);
    const portrait=row.sprite?`<img src="${escape(row.sprite)}" alt="" width="64" height="64" loading="lazy">`:'<span aria-hidden="true">?</span>';
    const sigil=row.isMega?'<img class="mega-sigil" src="images/icons/mega-evolution-v2.webp" alt="Mega Evolution" width="20" height="20">':'';
    return `<li class="speed-row" style="--team-accent:${accent}" data-speed="${row.speed??''}" data-note-id="${escape(row.id)}" data-role="${escape(notes.roles[row.id]||'')}">
      <span class="speed-sprite">${portrait}${sigil}</span>
      <span class="speed-identity"><strong>${escape(row.name)}</strong><span class="row-owner"><i aria-hidden="true"></i>${escape(owner.name)}</span>
        <span class="row-types">${row.types.map(type=>escape(type)).join(' / ')}${row.isMega?' <span class="tie-badge">MEGA</span>':''}</span>
      </span>
      <span class="speed-value" aria-label="Base Speed ${row.speed??'unavailable'}"><b>${row.speed??'—'}</b><small>SPE</small></span>
      ${roleControl(row)}</li>`;
  };
  const renderSpeed=()=>{
    $('[data-base-count]').textContent=result.all.length;
    $('[data-prep-base]').innerHTML=result.all.length?M.speedTiers(result.all).map(tier=>`<section class="speed-tier" data-speed-tier="${tier.id}" aria-labelledby="tier-${tier.id}">
      <header class="speed-tier-heading"><h3 id="tier-${tier.id}" aria-label="Base Speed ${tier.description}">${tier.label}</h3><span>${tier.rows.length} ${tier.rows.length===1?'form':'forms'}</span></header>
      ${tier.rows.length?`<ul class="speed-tier-list">${tier.rows.map(rowMarkup).join('')}</ul>`:'<p class="tier-empty">No Pokémon in this tier.</p>'}</section>`).join(''):'<p class="empty-state">These teams have no saved roster Pokémon yet.</p>';
  };
  const activeRows=()=>N.selectedRows(result,getPair(),notes.forms);
  const currentLineRows=()=>{
    const rows=activeRows().flat(),lookup=new Map(rows.map(row=>[row.formId,row]));
    return notes.lines.filter(line=>lookup.has(line.from)&&lookup.has(line.to));
  };
  const renderConnections=()=>{
    const lookup=new Map(result.all.map(row=>[row.formId,row])),active=new Set(activeRows().flat().map(row=>row.formId));
    const available=notes.lines.map((line,index)=>({...line,index,fromRow:lookup.get(line.from),toRow:lookup.get(line.to)})).filter(line=>line.fromRow&&line.toRow);
    $('[data-connections]').innerHTML=`<h3>Saved lines <span>${available.length}</span></h3><p>Lines are specific to the selected forms. Use Show to restore a saved pairing.</p>`+(available.length?available.map(line=>`<div class="connection-item" style="--threat:${N.threats[line.threat].color}"><span><b>${escape(line.fromRow.name)} → ${escape(line.toRow.name)}</b><small>${escape(N.threats[line.threat].label)}${active.has(line.from)&&active.has(line.to)?'':' · Other forms selected'}</small></span><button class="glass-button" data-show-line="${line.index}" aria-label="Show ${escape(line.fromRow.name)} to ${escape(line.toRow.name)} line">Show</button><button class="glass-button" data-remove-line="${line.index}" aria-label="Remove ${escape(line.fromRow.name)} to ${escape(line.toRow.name)} line">×</button></div>`).join(''):'<p class="empty-state">No lines yet. Connect an attacker to an opposing Pokémon above.</p>');
    $('[data-undo]').disabled=!history.length;$('[data-clear-lines]').disabled=!notes.lines.length;
  };
  const curve=(from,to,offset=0)=>{
    const direction=to.x>from.x?1:-1,reach=Math.max(30,Math.abs(to.x-from.x)*.45)+offset;
    return `M ${from.x} ${from.y} C ${from.x+direction*reach} ${from.y+direction*offset}, ${to.x-direction*reach} ${to.y+direction*offset}, ${to.x} ${to.y}`;
  };
  const drawLines=()=>{
    if(view!=='board'||!result||$('[data-prep-detail]').hidden)return;
    const board=$('[data-board]'),bounds=board.getBoundingClientRect(),svg=$('[data-lines]');
    const ports=new Map([...board.querySelectorAll('[data-port]')].map(port=>{const box=port.getBoundingClientRect();return [port.dataset.port,{x:box.left+box.width/2-bounds.left,y:box.top+box.height/2-bounds.top}];}));
    svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
    let html='<defs>'+Object.entries(N.threats).map(([key,value])=>`<marker id="arrow-${key}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${value.color}"/></marker>`).join('')+'</defs>';
    currentLineRows().forEach((line,i)=>{const from=ports.get(line.from),to=ports.get(line.to);if(from&&to){const direction=to.x>from.x?1:-1;html+=`<path class="matchup-path" d="${curve({...from,x:from.x+direction*17},{...to,x:to.x-direction*20},8+(i%5)*5)}" stroke="${N.threats[line.threat].color}" marker-end="url(#arrow-${line.threat})"/>`;}});
    if(drag?.active&&ports.has(drag.from)){const point={x:drag.x-bounds.left,y:drag.y-bounds.top};html+=`<path class="matchup-path line-preview" d="${curve(ports.get(drag.from),point)}" stroke="${N.threats[threat].color}"/>`;}
    svg.innerHTML=html;
  };
  const renderBoard=()=>{
    const ids=getPair();
    $('[data-board-columns]').innerHTML=activeRows().map((rows,side)=>`<section class="team-column ${side?'right-team':'left-team'}"><header><img src="${escape(team(ids[side]).logo)}" alt="" width="46" height="46"><h3>${escape(team(ids[side]).name)}<small>${rows.length} roster Pokémon</small></h3></header><div class="board-roster">${rows.map(row=>{
      const variants=result.all.filter(form=>form.id===row.id),portrait=row.sprite?`<img src="${escape(row.sprite)}" alt="" width="58" height="58">`:'';
      return `<article class="board-card" data-note-id="${escape(row.id)}" data-role="${escape(notes.roles[row.id]||'')}" style="--team-accent:${color(team(row.teamId).accent)}"><div class="board-mon"><span class="board-sprite">${portrait}${row.isMega?'<span class="mega-tag">MEGA</span>':''}</span><div><strong>${escape(row.name)}</strong><span>${escape(row.types.join(' / '))}</span></div><b class="board-speed">${row.speed??'—'}<small>SPE</small></b></div><div class="card-controls">${variants.length>1?`<select data-form-select="${escape(row.id)}" aria-label="Form for ${escape(row.baseName)}"><option value="${escape(row.baseName)}"${row.name===row.baseName?' selected':''}>Base form</option>${variants.filter(form=>form.isMega).map(form=>`<option value="${escape(form.name)}"${form.name===row.name?' selected':''}>${escape(form.name)}</option>`).join('')}</select>`:'<span class="base-form-label">Base form</span>'}${roleControl(row)}</div><button class="connector${pending===row.formId?' selected':''}" data-port="${escape(row.formId)}" aria-pressed="${pending===row.formId}" aria-label="Connect ${escape(row.name)} (${escape(team(row.teamId).name)})">${side?'←':'→'}</button></article>`;
    }).join('')||'<p class="empty-state">No saved roster Pokémon.</p>'}</div></section>`).join('');
    renderConnections();requestAnimationFrame(drawLines);
  };
  const updatePorts=()=>{document.querySelectorAll('[data-port]').forEach(port=>{const selected=port.dataset.port===pending;port.classList.toggle('selected',selected);port.setAttribute('aria-pressed',String(selected));});};
  const connectPorts=(fromId,toId)=>{
    const from=result.all.find(row=>row.formId===fromId),to=result.all.find(row=>row.formId===toId);
    if(!from||!to||from.teamId===to.teamId){$('[data-line-status]').textContent='Choose a Pokémon on the opposing team.';return false;}
    snapshot();N.connect(notes,from,to,threat);pending=null;saveNotes();updatePorts();renderConnections();drawLines();
    $('[data-line-status]').textContent=`${from.name} → ${to.name}: ${N.threats[threat].label}.`;return true;
  };
  const choosePort=id=>{
    if(pending===id){pending=null;$('[data-line-status]').textContent='Line cancelled. Choose an attacker.';}
    else if(pending){connectPorts(pending,id);}
    else{pending=id;$('[data-line-status]').textContent='Now choose the opposing Pokémon this attacker targets. Press Escape to cancel.';}
    updatePorts();
  };
  const setView=next=>{
    view=next;pending=null;drag=null;$('[data-speed-view]').hidden=view!=='speed';$('[data-board-view]').hidden=view!=='board';
    document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
    if(view==='board')renderBoard();
  };
  const renderDetail=ids=>{
    loadNotes(ids);const [home,away]=ids.map(team);result=M.compare(ids,data.rosters,data.index);
    $('[data-prep-comparison]').innerHTML=`<p class="eyebrow">LIVE ROSTER COMPARISON</p><h1 class="comparison-title" tabindex="-1">${escape(home.name)} <span>vs</span> ${escape(away.name)}</h1><div class="comparison-teams"><div style="--team-accent:${color(home.accent)}">${teamArt(home)}<span>${(data.rosters[home.id]||[]).length} Pokémon</span></div><b class="versus">VS</b><div style="--team-accent:${color(away.accent)}">${teamArt(away)}<span>${(data.rosters[away.id]||[]).length} Pokémon</span></div></div>`;
    const fastest=result.all.find(row=>row.speed!=null),topNames=result.all.filter(row=>row.speed===fastest?.speed).map(row=>row.name);
    $('[data-prep-summary]').innerHTML=`<div><span>FASTEST BASE SPEED · ALL FORMS</span><strong>${fastest?.speed??'—'} <small>${escape(topNames.join(' / ')||'No roster data')}</small></strong></div><div><span>ROSTER POKÉMON</span><strong>${result.base.length}<small>Both teams combined</small></strong></div><div><span>MEGA OPTIONS</span><strong>${result.mega.length}<small>Included in the speed ladder</small></strong></div>`;
    renderSpeed();setView(view);
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
  $('[data-threat-palette]').innerHTML=Object.entries(N.threats).map(([key,value])=>`<button class="threat-button" data-threat="${key}" style="--threat:${value.color}" aria-pressed="${key===threat}"><i aria-hidden="true"></i>${escape(value.label)}</button>`).join('');
  $('[data-prep-detail]').addEventListener('change',event=>{
    const roleId=event.target.dataset.roleSelect,formId=event.target.dataset.formSelect;
    if(roleId){
      snapshot();if(event.target.value)notes.roles[roleId]=event.target.value;else delete notes.roles[roleId];saveNotes();
      document.querySelectorAll('[data-note-id]').forEach(card=>{card.dataset.role=notes.roles[card.dataset.noteId]||'';const select=card.querySelector('[data-role-select]');if(select)select.value=card.dataset.role;});
    }
    if(formId){snapshot();notes.forms[formId]=event.target.value;pending=null;saveNotes();renderBoard();$('[data-line-status]').textContent='Form updated. Lines are shown only for the selected forms.';}
  });
  $('[data-prep-detail]').addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.view)setView(button.dataset.view);
    if(button.dataset.threat){threat=button.dataset.threat;document.querySelectorAll('[data-threat]').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.threat===threat)));}
    if(button.dataset.port&&!suppressClick)choosePort(button.dataset.port);
    if(button.hasAttribute('data-remove-line')){snapshot();notes.lines.splice(Number(button.dataset.removeLine),1);saveNotes();renderConnections();drawLines();}
    if(button.hasAttribute('data-show-line')){
      const line=notes.lines[Number(button.dataset.showLine)];if(!line)return;
      snapshot();[line.from,line.to].forEach(id=>{const row=result.all.find(row=>row.formId===id);if(row)notes.forms[row.id]=row.name;});pending=null;saveNotes();renderBoard();$('[data-board]').scrollIntoView({block:'start'});
    }
  });
  $('[data-undo]').addEventListener('click',()=>{if(!history.length)return;notes=JSON.parse(history.pop());pending=null;saveNotes();renderSpeed();renderBoard();$('[data-line-status]').textContent='Last annotation change undone.';});
  $('[data-clear-lines]').addEventListener('click',()=>{if(!notes.lines.length)return;snapshot();notes.lines=[];pending=null;saveNotes();updatePorts();renderConnections();drawLines();$('[data-line-status]').textContent='Lines cleared. Use Undo to restore them.';});
  $('[data-board]').addEventListener('pointerdown',event=>{
    const port=event.target.closest('[data-port]');if(!port||event.button!==0)return;
    drag={from:port.dataset.port,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,active:false,pointerId:event.pointerId};port.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    drag.x=event.clientX;drag.y=event.clientY;drag.active=drag.active||Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>6;
    if(drag.active){event.preventDefault();drawLines();}
  },{passive:false});
  document.addEventListener('pointerup',event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    const previous=drag;drag=null;
    if(previous.active){
      suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
      const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-port]');
      if(target)connectPorts(previous.from,target.dataset.port);
      else $('[data-line-status]').textContent='Drop on an opposing Pokémon’s connector, or click the two connectors instead.';
      drawLines();
    }
  });
  document.addEventListener('pointercancel',()=>{drag=null;drawLines();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){pending=null;drag=null;updatePorts();drawLines();$('[data-line-status]').textContent='Line cancelled. Choose an attacker.';}});
  new ResizeObserver(()=>requestAnimationFrame(drawLines)).observe($('[data-board]'));
  window.addEventListener('hashchange',()=>renderRoute(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&data&&Date.now()-loadedAt>60000)refresh();});
  if(sessionStorage.getItem(ACCESS_KEY)==='PREP')enter();
})();
