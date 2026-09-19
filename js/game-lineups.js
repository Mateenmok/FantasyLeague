(() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=name=>String(name||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const dialog=document.createElement('dialog');
  dialog.className='game-lineup-dialog';dialog.setAttribute('aria-labelledby','gameLineupTitle');
  document.body.append(dialog);
  let focusBefore,overflowBefore;
  const show=(title,body)=>{
    focusBefore=document.activeElement;overflowBefore=document.body.style.overflow;
    dialog.innerHTML=`<header><h2 id="gameLineupTitle">${esc(title)}</h2><button type="button" data-game-close aria-label="Close game details">×</button></header><div class="game-lineup-body">${body}</div>`;
    dialog.querySelector('[data-game-close]').onclick=()=>dialog.close();
    document.body.style.overflow='hidden';dialog.showModal();dialog.scrollTop=0;
  };
  dialog.addEventListener('close',()=>{document.body.style.overflow=overflowBefore||'';focusBefore?.focus();});
  dialog.addEventListener('cancel',event=>{if(dialog.dataset.saving==='true')event.preventDefault();});
  const pokemon=(id,catalog)=>catalog.find(p=>slug(p.name)===id)||{name:id,sprite:'images/favicon.webp'};
  const survivalStatus=(game,side,teamId,id)=>{
    if(game.winnerTeamId&&game.winnerTeamId!==teamId)return false;
    const value=game.survival?.[side]?.[id];
    return typeof value==='boolean'?value:null;
  };
  const badge=(id,catalog,status=null,showStatus=false)=>{
    const p=pokemon(id,catalog);
    return `<span class="game-lineup-mon ${status===true?'is-survived':status===false?'is-fainted':''}"><span class="game-lineup-portrait"><img src="${esc(p.sprite)}" alt=""></span><strong>${esc(p.name)}</strong>${showStatus?`<small class="game-survival-label">${status===true?'Survived':status===false?'Fainted':'Not reported'}</small>`:''}</span>`;
  };
  const edit=({game,home,away,lineup,catalog,rosters,onApply})=>{
    const choices={home:[...(lineup?.home||[])],away:[...(lineup?.away||[])]};
    let survival=structuredClone(lineup?.survival||{home:{},away:{}});
    survival.home ||= {};survival.away ||= {};
    const teams={home,away};
    show(`Edit Game ${game}`,`<label class="game-winner-field">Game ${game} winner<select data-game-winner><option value="">Winner not reported</option>${[home,away].map(t=>`<option value="${esc(t.id)}" ${lineup?.winnerTeamId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label><p>Select up to four Pokémon per side. Leave unrevealed Pokémon unselected — even zero is fine.</p><div class="game-lineup-sides">${['home','away'].map(side=>{
      const t=side==='home'?home:away;
      const ids=[...new Set([...(rosters[t.id]||[]),...choices[side]])];
      return `<section><h3>${esc(t.name)} <small data-game-count="${side}"></small></h3><div class="game-lineup-options">${ids.map(id=>`<div class="game-lineup-option"><label><input type="checkbox" data-game-side="${side}" value="${esc(id)}" ${choices[side].includes(id)?'checked':''}>${badge(id,catalog)}</label><label class="game-survival-field" hidden>Survival<select data-game-survival-side="${side}" data-pokemon="${esc(id)}" aria-label="${esc(t.name)} — ${esc(pokemon(id,catalog).name)} survival"><option value="">Not reported</option><option value="true">Survived · Green</option><option value="false">Fainted · Red</option></select></label></div>`).join('')||'<p>No roster available.</p>'}</div></section>`;
    }).join('')}</div><p class="game-lineup-note">Green = survived · Red = fainted. The losing side is automatically red. Changing the winner resets survival markers; unreported statuses stay unmarked.</p><p class="game-lineup-note">Save Scores first to record the match score. Then save each game's details here directly — no second Save Scores click needed.</p><p class="game-lineup-save-status" role="status" aria-live="polite"></p><button class="game-lineup-apply" type="button">Save game details</button>`);
    const winner=dialog.querySelector('[data-game-winner]');
    const update=()=>{
      for(const side of ['home','away']){
        dialog.querySelector(`[data-game-count="${side}"]`).textContent=`${choices[side].length}/4`;
        dialog.querySelectorAll(`[data-game-side="${side}"]`).forEach(input=>{input.disabled=choices[side].length>=4&&!input.checked;});
        dialog.querySelectorAll(`[data-game-survival-side="${side}"]`).forEach(select=>{
          const selected=choices[side].includes(select.dataset.pokemon);
          const losing=Boolean(winner.value&&winner.value!==teams[side].id);
          const status=selected?survivalStatus({winnerTeamId:winner.value,survival},side,teams[side].id,select.dataset.pokemon):null;
          select.closest('.game-survival-field').hidden=!selected;
          select.value=status===null?'':String(status);select.disabled=losing||!selected;
          const mon=select.closest('.game-lineup-option').querySelector('.game-lineup-mon');
          mon.classList.toggle('is-survived',status===true);mon.classList.toggle('is-fainted',status===false);
        });
      }
    };
    winner.addEventListener('change',()=>{survival={home:{},away:{}};update();});
    dialog.querySelectorAll('[data-game-survival-side]').forEach(select=>select.addEventListener('change',()=>{
      const side=select.dataset.gameSurvivalSide,id=select.dataset.pokemon;
      if(select.value==='')delete survival[side][id];else survival[side][id]=select.value==='true';
      update();
    }));
    dialog.querySelectorAll('[data-game-side]').forEach(input=>input.addEventListener('change',()=>{
      choices[input.dataset.gameSide]=[...dialog.querySelectorAll(`[data-game-side="${input.dataset.gameSide}"]:checked`)].map(el=>el.value);update();
    }));
    update();dialog.querySelector('.game-lineup-apply').onclick=async()=>{
      if(dialog.dataset.saving==='true')return;
      const reported={home:{},away:{}};
      for(const side of ['home','away'])for(const id of choices[side]){
        const status=survivalStatus({winnerTeamId:winner.value,survival},side,teams[side].id,id);
        if(status!==null)reported[side][id]=status;
      }
      const details={game,home:choices.home,away:choices.away,winnerTeamId:winner.value||null,survival:reported};
      const controls=[...dialog.querySelectorAll('button,input,select')].map(el=>[el,el.disabled]);
      const status=dialog.querySelector('.game-lineup-save-status'),button=dialog.querySelector('.game-lineup-apply');
      dialog.dataset.saving='true';controls.forEach(([el])=>el.disabled=true);
      status.textContent='Saving game details…';status.classList.remove('is-error');button.textContent='Saving…';
      try{await onApply(details);dialog.close();}
      catch(error){status.textContent=error.message||'Game details could not be saved. Your selections are still here.';status.classList.add('is-error');}
      finally{dialog.dataset.saving='false';controls.forEach(([el,disabled])=>el.disabled=disabled);button.textContent='Save game details';}
    };
  };
  const view=({matchup,home,away,catalog})=>{
    const count=Number(matchup.home_score||0)+Number(matchup.away_score||0);
    const games=matchup.game_lineups||[];
    show(`Week ${matchup.week} · ${home.name} vs ${away.name}`,`<p>${matchup.home_score==null||matchup.away_score==null?'Scores pending':`Final score: ${matchup.home_score}–${matchup.away_score}`}</p>${count?Array.from({length:count},(_,i)=>{
      const g=games.find(entry=>entry.game===i+1)||{home:[],away:[]};
      const winner=[home,away].find(t=>t.id===g.winnerTeamId);
      return `<section class="game-lineup-history"><h3>Game ${i+1}</h3><p class="game-winner-result ${winner?'is-reported':''}">${winner?`★ Winner: ${esc(winner.name)}`:'Winner not reported'}</p><div class="game-lineup-sides">${['home','away'].map(side=>`<section><h4>${esc((side==='home'?home:away).name)}</h4><div class="game-lineup-brought">${g[side].map(id=>badge(id,catalog,survivalStatus(g,side,(side==='home'?home:away).id,id),true)).join('')}</div><p class="game-lineup-note">${g[side].length?`${g[side].length}/4 Pokémon reported${g[side].length<4?' · Remaining Pokémon unrevealed or not recorded':''}`:'No Pokémon reported'}</p></section>`).join('')}</div></section>`;
    }).join(''):'<p>Game details will appear once scores and optional lineups are reported.</p>'}`);
  };
  window.PokeLeagueGameLineups={edit,view,slug};
})();
