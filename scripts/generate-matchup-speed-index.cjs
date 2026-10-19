// Rebuild whenever the league's Pokémon details/catalog change.
const fs=require('node:fs');
const path=require('node:path');
const {buildIndex}=require('../js/matchup-speed-model.js');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'data',name),'utf8'));
const index=buildIndex(read('pokemon-catalog.json'),read('pokemon-details.json'));
if(index.some(p=>p.speed==null||p.megas.some(m=>m.speed==null)))throw new Error('Missing base Speed in league details');
fs.writeFileSync(path.join(root,'data/matchup-speed-index.json'),JSON.stringify(index)+'\n');
console.log(`Generated ${index.length} Pokémon and ${index.reduce((n,p)=>n+p.megas.length,0)} Mega forms.`);
