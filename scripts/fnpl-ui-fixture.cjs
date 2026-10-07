// Local-only browser QA with isolated Postgres; no production requests or writes.
const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
(async()=>{
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create table leagues(id text primary key,current_matchup_number int,regular_season_matches int);insert into leagues values('flash-family-season-1',3,10);create table flash_family_matchups(league_id text,week int,display_order int,home_team_id text,away_team_id text);`);
  const teams=JSON.parse(await fs.readFile(path.join(root,'data/league-teams.json'),'utf8')).teams;
  for(let week=1;week<=10;week++)for(let i=0;i<7;i++)await db.query('insert into flash_family_matchups values($1,$2,$3,$4,$5)',['flash-family-season-1',week,i+1,teams[i*2].id,teams[i*2+1].id]);
  await db.exec(await fs.readFile(path.join(root,'supabase/migrations/20261007190000_add_friday_night_pokeleague.sql'),'utf8'));
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
  http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1:8028');res.setHeader('Cache-Control','no-store');
    try{
      if(url.pathname.startsWith('/__rpc/')){
        let body='';for await(const chunk of req)body+=chunk;const p=JSON.parse(body||'{}');let result;
        if(url.pathname.endsWith('/read_flash_family_fnpl'))result=(await db.query('select read_flash_family_fnpl() as value')).rows[0].value;
        else if(url.pathname.endsWith('/save_flash_family_fnpl'))result=(await db.query('select save_flash_family_fnpl($1,$2,$3,$4,$5) as value',['PUFF1',p.p_week,p.p_event_date,JSON.stringify(p.p_slots),p.p_expected_revision])).rows[0].value;
        else throw new Error('Fixture endpoint unavailable');
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
      }
      if(url.pathname==='/__admin-fixture.js'){
        res.setHeader('Content-Type','application/javascript');res.end(`document.querySelector('[data-admin-workspace]').hidden=false;document.querySelectorAll('[data-admin-panel]').forEach(p=>p.hidden=p.dataset.adminPanel!=='fnpl');document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('is-active',b.dataset.adminTab==='fnpl'));`);return;
      }
      const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep))throw new Error('Not found');
      let content=await fs.readFile(file);
      if(url.pathname.endsWith('.html')){
        content=content.toString().replace(/<script\b[^>]*src="(?!js\/(?:theme|fnpl|fnpl-admin)\.js)[^"]*"[^>]*><\/script>/g,'');
        if(url.pathname==='/admin-controls.html')content=content.replace('</head>','<script src="/__admin-fixture.js" defer></script></head>');
      }
      if(url.pathname==='/js/fnpl.js')content=content.toString().replace('https://cgvxehwqoviihxndupoj.supabase.co/rest/v1/rpc/','/__rpc/');
      res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(content);
    }catch(error){res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({message:error.message}));}
  }).listen(8028,'127.0.0.1',()=>console.log('FNPL isolated preview: http://127.0.0.1:8028/admin-controls.html?preview=admin'));
})().catch(error=>{console.error(error);process.exitCode=1;});
