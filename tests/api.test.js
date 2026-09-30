const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
process.env.FEEDBACK_DB=':memory:';
process.env.ENABLE_EXTERNAL_SEARCH='false';
const {app,db}=require('../server');
const {cases,regions}=require('../server/lib/showcase');
const {CITY_TO_SEGMENT}=require('../server/lib/segments');
let server,base;
before(async()=>{server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();});
async function request(url,body){const r=await fetch(base+'/api'+url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});return {status:r.status,data:await r.json()};}
test('18 regions preserve source coordinates and existing segment mapping',()=>{
 const csv=fs.readFileSync(path.resolve(__dirname,'fixtures/analysis-source.csv'),'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(s=>s.split(','));const header=csv.shift();
 const names={route:'이동 중 단절형',dest:'도착 후 단절형',weak:'전 구간 취약형',done:'연결 완성형',balanced:'균형·경계형'};
 assert.equal(regions.length,18);assert.equal(new Set(regions.map(r=>r.city)).size,18);
 for(const r of regions){const row=csv.find(row=>row[0]===r.city);for(const [field,col] of Object.entries({route:'A_route',dest:'A_dest',pRoute:'p_route',pDest:'p_dest'}))assert.equal(r[field],Number(row[header.indexOf(col)]));assert.equal(r.segment,row[header.indexOf('segment')]);assert.equal(r.segment,names[CITY_TO_SEGMENT[r.city.replace(/[시군]$/,'')]]);}
});
test('analysis and public stations return expected source metadata',async()=>{const a=await request('/analysis');assert.equal(a.status,200);assert.equal(a.data.regions.length,18);assert.match(a.data.demandNote,/분류축이 아니/);const s=await request('/stations');assert.equal(s.data.length,2756);});
test('all five cases complete check-in, recommendations, feedback without keys',async()=>{
 assert.equal(cases.length,5);assert.ok(cases.every(c=>c.station));
 for(const c of cases){const check=await request('/checkin',{stationId:c.stationId});assert.equal(check.status,201);assert.equal(check.data.mode,'simulation');const r=await request(`/stations/${c.stationId}/strategy`);assert.equal(r.data.source,'curated');assert.equal(r.data.places.length,c.places.length);assert.deepEqual(r.data.cta,c.cta);const f=await request('/feedback',{stationId:c.stationId,sessionId:check.data.sessionId,type:'helpful'});assert.equal(f.status,201);}
});
test('feedback deduplicates session/type, rejects forged and mismatched sessions',async()=>{
 const stationId=cases[0].stationId;const {data:{sessionId}}=await request('/checkin',{stationId});const payload={stationId,sessionId,type:'interested'};
 const results=await Promise.all([request('/feedback',payload),request('/feedback',payload)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM demo_feedback WHERE sessionId=?').get(sessionId).n,1);
 assert.equal((await request('/feedback',{...payload,sessionId:'invented'})).status,401);assert.equal((await request('/feedback',{...payload,stationId:cases[1].stationId})).status,401);assert.equal((await request('/feedback',{...payload,type:'visited'})).status,400);
});
test('non-curated and unknown stations have honest empty/error states',async()=>{const all=(await request('/stations')).data;const s=all.find(s=>!cases.some(c=>c.stationId===s.id));const r=await request(`/stations/${s.id}/strategy`);assert.equal(r.status,200);assert.equal(r.data.source,'unavailable');assert.deepEqual(r.data.places,[]);assert.match(r.data.notice,/시설 부재/);assert.equal((await request('/stations/not-a-station/strategy')).status,404);assert.equal((await request('/checkin',{stationId:42})).status,400);});
test('local font, map library, and hero are served without CDN',async()=>{for(const url of ['/','/vendor/leaflet/leaflet.js','/vendor/font/static/pretendard.css','/assets/gangwon-terrain.png']){const r=await fetch(base+url);assert.equal(r.status,200,url);await r.arrayBuffer();}});
