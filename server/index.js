require('dotenv').config();
const express=require('express');
const path=require('node:path');
const crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {regions,cases,source}=require('./lib/showcase');
const {getStationById}=require('./lib/stationStore');
const {fetchNearbyPlaces}=require('./lib/naver');
const app=express();
const db=new DatabaseSync(process.env.FEEDBACK_DB || path.join(__dirname,'data','app-modern-feedback.db'));
db.exec(`CREATE TABLE IF NOT EXISTS demo_feedback (id TEXT PRIMARY KEY, stationId TEXT NOT NULL, sessionId TEXT NOT NULL, type TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'simulation', createdAt TEXT NOT NULL, UNIQUE(sessionId,type))`);
const sessions=new Map();
const SESSION_TTL=24*60*60*1000;
const walkMinFromDist=m=>Math.max(1,Math.round(m/70));
app.use(express.json({limit:'8kb'}));
app.get('/api/analysis',(_req,res)=>res.json({regions,source,demandNote:'D는 방문·소비 각 50%의 관광수요 지표입니다. D·U는 분류축이 아니며 대표 사례 선정 검토에 사용합니다.'}));
app.get('/api/cases',(_req,res)=>res.json({mode:'simulation',cases:cases.map(({places,...c})=>({...c,placeCount:places.length}))}));
app.get('/api/stations/:id/strategy',async(req,res,next)=>{
  try{
    const station=getStationById(req.params.id);
    if(!station)return res.status(404).json({error:'충전소를 찾을 수 없습니다.'});
    const curated=cases.find(c=>c.stationId===station.id);
    if(curated)return res.json({stationId:station.id,source:'curated',...curated,notice:'기존 데모의 고정 예시입니다. 현재 영업·보행 접근성은 확인하지 않았습니다.'});
    if(process.env.ENABLE_EXTERNAL_SEARCH==='true' && process.env.NAVER_APIGW_KEY_ID && process.env.NAVER_APIGW_KEY){
      try{
        const results=await fetchNearbyPlaces(station);
        if(results.length)return res.json({stationId:station.id,source:'external',title:'검색으로 찾은 주변 장소',description:'검색 결과이며 제휴·영업·보행 가능성을 보장하지 않습니다.',places:results.map(p=>({name:p.name,category:p.group==='관광명소'?'관광지':p.group,roadAddress:p.roadAddress,distanceM:p.distanceM,walkMin:walkMinFromDist(p.distanceM)})),notice:'외부 검색 결과 · 실시간 충전 및 보행 경로와 미연동. 도보 시간은 직선거리 추정치입니다.'});
      }catch(err){return res.json({stationId:station.id,source:'unavailable',title:'외부 검색에 연결하지 못했어요',description:'준비된 대표 사례로 계속할 수 있습니다.',places:[],notice:'연결 실패는 주변 시설 부재를 뜻하지 않습니다.'});}
    }
    res.json({stationId:station.id,source:'unavailable',title:'준비된 예시가 없는 충전소예요',description:'강릉·원주·홍천·속초·춘천의 대표 사례를 선택해 주세요.',places:[],notice:'정보 미확인은 주변 시설 부재를 뜻하지 않습니다.'});
  }catch(err){next(err);}
});
app.use('/api/stations',require('./routes/stations'));
app.post('/api/checkin',(req,res)=>{
  const {stationId}=req.body||{};
  if(typeof stationId!=='string')return res.status(400).json({error:'충전소를 선택해 주세요.'});
  if(!getStationById(stationId))return res.status(404).json({error:'충전소를 찾을 수 없습니다.'});
  for(const [id,s] of sessions)if(Date.now()-s.createdAt>SESSION_TTL)sessions.delete(id);
  const sessionId=crypto.randomUUID(); sessions.set(sessionId,{stationId,createdAt:Date.now()});
  res.status(201).json({sessionId,mode:'simulation'});
});
app.post('/api/feedback',(req,res)=>{
  const {stationId,sessionId,type}=req.body||{}; const s=sessions.get(sessionId);
  if(!['helpful','interested'].includes(type))return res.status(400).json({error:'지원하지 않는 응답입니다.'});
  if(!s || s.stationId!==stationId || Date.now()-s.createdAt>SESSION_TTL)return res.status(401).json({error:'모의 체크인을 다시 진행해 주세요.'});
  const result=db.prepare('INSERT OR IGNORE INTO demo_feedback (id,stationId,sessionId,type,createdAt) VALUES (?,?,?,?,?)').run(crypto.randomUUID(),stationId,sessionId,type,new Date().toISOString());
  res.status(result.changes?201:200).json({saved:true,duplicate:!result.changes,mode:'simulation'});
});
app.use('/vendor/leaflet',express.static(path.join(__dirname,'../node_modules/leaflet/dist')));
app.use('/vendor/font',express.static(path.join(__dirname,'../node_modules/pretendard/dist/web')));
app.use(express.static(path.join(__dirname,'../client')));
app.use('/api',(_req,res)=>res.status(404).json({error:'요청한 API가 없습니다.'}));
app.use((err,_req,res,_next)=>res.status(err.status===400?400:500).json({error:err.status===400?'요청 형식을 확인해 주세요.':'정보를 불러오지 못했습니다. 다시 시도해 주세요.'}));
if(require.main===module){const port=process.env.PORT||3002;const host=process.env.HOST||'127.0.0.1';app.listen(port,host,()=>console.log(`App demo: http://${host}:${port}`));}
module.exports={app,db};
