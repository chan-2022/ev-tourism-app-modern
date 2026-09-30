const regions = require('../data/regions.json');
const stations = require('../data/stations.json');
const definitions = [
  // distanceM/walkMin/lat/lng below are cross-checked against live Naver local search (2026-09-29)
  // where an exact single-POI match exists; see chat for per-place confidence notes.
  ['강릉','PI330449','골목의 작은 발견','시장을 중심으로 주변 장소를 소개합니다.',
    [{name:'서당골산채',category:'음식점',distanceM:154,walkMin:2,lat:37.7560371,lng:128.8921283},
     {name:'벌집',category:'음식점',distanceM:190,walkMin:3,lat:37.7544828,lng:128.8928549}],
    '충전 대기 15분, 서당골산채에서 강릉식 한상 어때요?','도보 2분 거리, 짧은 충전 시간에 딱 맞는 코스예요',
    {label:'방문 인증하기',reward:'서당골산채 2,000원 할인'}],
  ['원주','ST511305','도착지에서 만나는 동네','지역 상권을 탐색하는 안내 방식을 제안합니다.',
    // 골목 전체가 아닌 골목 초입 상호(자유시장돈가스골목) 좌표 기준 근사치
    [{name:'원주 전통시장 먹거리 골목',category:'음식점',distanceM:242,walkMin:3,lat:37.3506523,lng:127.9490925}],
    '오늘 전통시장에서 쓴 영수증, 충전 혜택으로 바꿔드려요','먹거리 골목에서 1만원 이상 결제 후 영수증을 제출해보세요',
    {label:'영수증 제출하기',reward:'전통시장 먹거리 골목 3,000원 할인'}],
  ['홍천','ME18B201','정보가 없을 때도, 분명하게','준비된 장소 정보가 없는 상황을 안내합니다.',
    [],
    '이 충전소 주변엔 걸어서 갈 만한 상권이 없어요','장시간 충전이 필요하면 대체 충전소를 고려해보세요',
    null],
  ['속초','HE240049','바다 가까이, 취향에 따라','장소를 먼저 살펴보고 선택하는 경험을 제안합니다.',
    // '황가네천'은 네이버 지역검색에서 확인되지 않아 좌표 미부여, 원본 수치 유지
    [{name:'황가네천',category:'음식점',distanceM:329,walkMin:5}],
    '동명항 방파제 산책하고 황가네천에서 마무리하세요','충전 진행 단계에 맞춰 동선을 나눠드려요',
    {label:'방문 인증하기',reward:'황가네천 2,000원 할인'}],
  ['춘천','ME18B229','강변에서 찾는 다음 장면','주변 관광 정보를 탐색하는 안내를 제공합니다.',
    // distanceM/walkMin은 강변길 왕복 스트롤 기준(원본 수치 유지). lat/lng은 스트롤 시작점(소양강처녀동상)만 참고용.
    [{name:'소양강 처녀상 강변길',category:'관광지',distanceM:1600,walkMin:40,lat:37.8939304,lng:127.7252805}],
    '소양강 스카이워크 다녀오고 방문 인증해보세요','강변길 왕복 약 40분, 충전 완료 전에 넉넉히 돌아올 수 있어요',
    null],
];
const cases = definitions.map(([city,stationId,title,description,places,benefitTitle,benefitSubtitle,cta])=>({city,stationId,title,description,places,benefitTitle,benefitSubtitle,cta,station:stations.find(s=>s.id===stationId)}));
const source = {file:'ev_mvp/build/final_report/segment_strategy_table.csv',label:'기존 정적 분석 결과표',note:'p_route·p_dest 백분위와 기존 분류를 사용합니다. 앱에서 분류를 재계산하지 않습니다.'};
module.exports={regions,cases,source};
