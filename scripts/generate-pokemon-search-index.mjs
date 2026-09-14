// Rebuild the small waiver search index from the existing, approved detail data.
import { readFileSync, writeFileSync } from 'node:fs';
const { pokemon } = JSON.parse(readFileSync('data/pokemon-details.json', 'utf8'));
const index = JSON.parse(readFileSync('data/pokemon-detail-index.json', 'utf8'));
for (const [key, detail] of Object.entries(pokemon)) {
  index[key] = {
    ...index[key],
    moves: (detail.moves || []).map(move => move.name),
    abilities: [...new Set([...(detail.abilities || []), ...(detail.formes || []).flatMap(form => form.abilities || [])].map(ability => ability.name))],
  };
}
writeFileSync('data/pokemon-detail-index.json', JSON.stringify(index, null, 2) + '\n');
console.log(`Indexed moves and abilities for ${Object.keys(index).length} Pokémon.`);
