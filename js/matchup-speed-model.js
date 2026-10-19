/* Shared, deterministic base-Speed model. No battle modifiers or roster writes. */
(() => {
  const key = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
  const isMega = name => /(?:^|[- ])mega(?:[- ]|$)/i.test(name);
  const speedOf = form => Number.isFinite(form?.stats?.speed) ? form.stats.speed : null;
  const buildIndex = (catalog, details) => catalog.map(pokemon => {
    const forms = details.pokemon[key(pokemon.name)]?.formes || [];
    const base = forms.find(form => key(form.name) === key(pokemon.name)) || forms.find(form => !isMega(form.name));
    return {
      name: pokemon.name, aliases: [...(pokemon.aliases || []), ...(base ? [base.name] : [])],
      sprite: pokemon.sprite, types: base?.types || pokemon.types || [], speed: speedOf(base),
      megas: forms.filter(form => isMega(form.name)).map(form => ({
        name: form.name.replace(/^(.*?)-Mega(.*)$/i, 'Mega $1$2').replace(/-/g, ' '),
        speed: speedOf(form), types: form.types || [],
      })),
    };
  });
  const ranked = rows => {
    const sorted = [...rows].sort((a,b) => (b.speed ?? -1) - (a.speed ?? -1) || a.name.localeCompare(b.name) || a.teamId.localeCompare(b.teamId));
    const counts = new Map();
    sorted.forEach(row => counts.set(row.speed, (counts.get(row.speed) || 0) + 1));
    let rank = null;
    return sorted.map((row,i) => {
      if (i === 0 || row.speed !== sorted[i-1].speed) rank = row.speed == null ? null : i+1;
      return {...row,rank,tied:row.speed != null && counts.get(row.speed)>1};
    });
  };
  const compare = (teamIds, rosters, index) => {
    const lookup = new Map();
    index.forEach(pokemon => [pokemon.name,...pokemon.aliases].forEach(name => lookup.set(key(name),pokemon)));
    const base=[], mega=[];
    [...new Set(teamIds)].forEach(teamId => {
      [...new Set(rosters[teamId] || [])].forEach(slug => {
        const pokemon = lookup.get(key(slug));
        const row = {teamId,name:pokemon?.name || slug.replace(/-/g,' '),speed:pokemon?.speed ?? null,
          types:pokemon?.types || [],sprite:pokemon?.sprite || '',baseName:pokemon?.name || slug};
        base.push(row);
        (pokemon?.megas || []).forEach(form => mega.push({...row,...form,isMega:true}));
      });
    });
    return {base:ranked(base),mega:ranked(mega)};
  };
  const model = {key,isMega,buildIndex,ranked,compare};
  if(typeof module !== 'undefined') module.exports=model;
  if(typeof window !== 'undefined') window.PokeLeagueSpeed=model;
})();
