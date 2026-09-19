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
  const pokemon=(id,catalog)=>catalog.find(p=>slug(p.name)===id)||{name:id,sprite:'images/favicon.webp'};
  const badge=(id,catalog)=>{const p=pokemon(id,catalog);return `<span class="game-lineup-mon"><img src="${esc(p.sprite)}" alt=""><strong>${esc(p.name)}</strong></span>`;};
  const edit=({game,home,away,lineup,catalog,rosters,onApply})=>{
    const choices={home:[...(lineup?.home||[])],away:[...(lineup?.away||[])]};
    show(`Edit Game ${game}`,`<label class="game-winner-field">Game ${game} winner<select data-game-winner><option value="">Winner not reported</option>${[home,away].map(t=>`<option value="${esc(t.id)}" ${lineup?.winnerTeamId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label><p>Select up to four Pokémon per side. Leave unrevealed Pokémon unselected — even zero is fine.</p><div class="game-lineup-sides">${['home','away'].map(side=>{
      const t=side==='home'?home:away;
      const ids=[...new Set([...(rosters[t.id]||[]),...choices[side]])];
      return `<section><h3>${esc(t.name)} <small data-game-count="${side}"></small></h3><div class="game-lineup-options">${ids.map(id=>`<label><input type="checkbox" data-game-side="${side}" value="${esc(id)}" ${choices[side].includes(id)?'checked':''}>${badge(id,catalog)}</label>`).join('')||'<p>No roster available.</p>'}</div></section>`;
    }).join('')}</div><p class="game-lineup-note">Apply adds these details to your report. Use “Save Scores” to publish them.</p><button class="game-lineup-apply" type="button">Apply game details</button>`);
    const update=()=>{
      for(const side of ['home','away']){
        dialog.querySelector(`[data-game-count="${side}"]`).textContent=`${choices[side].length}/4`;
        dialog.querySelectorAll(`[data-game-side="${side}"]`).forEach(input=>{input.disabled=choices[side].length>=4&&!input.checked;});
      }
    };
    dialog.querySelectorAll('[data-game-side]').forEach(input=>input.addEventListener('change',()=>{
      choices[input.dataset.gameSide]=[...dialog.querySelectorAll(`[data-game-side="${input.dataset.gameSide}"]:checked`)].map(el=>el.value);update();
    }));
    update();dialog.querySelector('.game-lineup-apply').onclick=()=>{onApply({game,home:choices.home,away:choices.away,winnerTeamId:dialog.querySelector('[data-game-winner]').value||null});dialog.close();};
  };
  const view=({matchup,home,away,catalog})=>{
    const count=Number(matchup.home_score||0)+Number(matchup.away_score||0);
    const games=matchup.game_lineups||[];
    show(`Week ${matchup.week} · ${home.name} vs ${away.name}`,`<p>${matchup.home_score==null||matchup.away_score==null?'Scores pending':`Final score: ${matchup.home_score}–${matchup.away_score}`}</p>${count?Array.from({length:count},(_,i)=>{
      const g=games.find(entry=>entry.game===i+1)||{home:[],away:[]};
      const winner=[home,away].find(t=>t.id===g.winnerTeamId);
      return `<section class="game-lineup-history"><h3>Game ${i+1}</h3><p class="game-winner-result ${winner?'is-reported':''}">${winner?`★ Winner: ${esc(winner.name)}`:'Winner not reported'}</p><div class="game-lineup-sides">${['home','away'].map(side=>`<section><h4>${esc((side==='home'?home:away).name)}</h4><div class="game-lineup-brought">${g[side].map(id=>badge(id,catalog)).join('')}</div><p class="game-lineup-note">${g[side].length?`${g[side].length}/4 Pokémon reported${g[side].length<4?' · Remaining Pokémon unrevealed or not recorded':''}`:'No Pokémon reported'}</p></section>`).join('')}</div></section>`;
    }).join(''):'<p>Game details will appear once scores and optional lineups are reported.</p>'}`);
  };
  window.PokeLeagueGameLineups={edit,view,slug};
})();
