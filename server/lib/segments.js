// 18개 시·군 -> 5개 세그먼트 매핑. 세그먼트 코드/명칭은 API 응답이나 프론트에 노출하지 않는다.
const CITY_TO_SEGMENT = {
  강릉: "route",
  양양: "route",

  원주: "dest",
  철원: "dest",

  홍천: "weak",
  횡성: "weak",
  인제: "weak",
  화천: "weak",

  속초: "done",
  동해: "done",
  고성: "done",
  삼척: "done",
  정선: "done",
  영월: "done",
  태백: "done",

  춘천: "balanced",
  평창: "balanced",
  양구: "balanced",
};

// 보고서의 세그먼트별 전략 문단을 요약한 상수. 매 요청마다 보고서 전문을 넣지 않기 위함.
// 각 문장은 "일반적인 안내문"이 아니라 LLM이 실제 상호명을 활용해 방문을 유도하는
// 구체적 카피를 쓰도록 행동 지침 형태로 작성한다.
// 모든 세그먼트는 동선/안내 방식(action)은 다르게 쓰되, 방문·이용을 실제 소비/데이터로
// 연결하기 위해 cta(방문 인증)는 공통으로 둔다. 세그먼트마다 인증의 "명분"만 다르다.
const SEGMENT_SUMMARY = {
  route:
    "장거리 이동 경로상의 경유지. 이용자는 대부분 통과객이라 체류시간이 짧다. " +
    "benefit.title은 '지금 충전 대기 시간에 [실제 상호명]에서 무엇을 하라'는 식으로 구체적인 행동을 제안하고, " +
    "action.type은 'duration'으로 충전 소요 시간대별(예: 30~90분)로 다녀올 수 있는 도보권 장소를 나눠 제시한다. " +
    "먼 곳이나 추상적인 안내는 피하고, 실제 검색 결과에서 가장 가까운 1~2곳을 콕 집어 추천한다. " +
    "cta.kind는 'receipt_submit'으로 설정해 '다녀왔다고 알려주면 다음 충전 때 혜택' 같은 문구로 방문 인증을 유도한다.",
  dest:
    "목적지에 도착한 뒤 충전하는 경우가 많은 지역. 도착지 인근 전통시장·상점가 소비를 유도하는 것이 핵심이다. " +
    "benefit.title은 '[실제 상호명/상권]에서 소비하면 어떤 혜택이 있다'는 식의 소비 유도형 문구로 쓰고, " +
    "action은 보통 null로 두는 대신 cta.kind를 'receipt_submit'으로 설정해 방문 인증(영수증 제출)을 유도한다.",
  weak:
    "충전 인프라와 주변 편의시설이 모두 부족한 취약 지역. 없는 것을 있는 것처럼 꾸미지 않는다. " +
    "네이버 검색 결과가 비어있거나 도보 10분을 넘는 곳뿐이면 nearbyPlaces는 빈 배열로 두고, " +
    "advisory에 대체 충전소나 대안 행동(예: 미리 간식 챙기기, 장시간 대기 시 차량 이동)을 구체적으로 안내한다. action은 null로 둔다. " +
    "상권 소비를 유도할 수는 없지만, cta.kind는 'receipt_submit'으로 두고 '불편했던 이 충전소 이용을 인증하면 참여 포인트를 드려요' 식으로 " +
    "데이터 수집 목적의 이용 인증을 유도한다(주변 상권 혜택이 아니라 '이용 경험 제보'라는 명분을 쓴다).",
  done:
    "충전 인프라와 관광 동선이 잘 연결된 지역. action.type을 'phase'로 설정해 " +
    "'충전 초반'에는 짧게 둘러볼 곳, '충전 막바지'에는 복귀 동선에 자연스러운 곳(픽업/포장 등)으로 나눠 " +
    "각 단계 detail에 실제 상호명을 넣어 구체적으로 안내한다. " +
    "cta.kind는 'receipt_submit'으로 설정해 방문 인증을 유도한다.",
  balanced:
    "이용 패턴이 혼재된 경계 지역. 표준적인 관광지/상권 추천과 함께 방문 인증을 통한 데이터 수집이 유효하다. " +
    "benefit.title은 실제 관광지/상호명을 활용한 방문 제안 문구로 쓰고, cta.kind는 'receipt_submit'으로 " +
    "방문 인증을 유도한다(도보 접근이 어려운 관광지라도 왕복 소요 시간을 명시해 부담을 줄여준다).",
};

function getSegmentCodeByCity(city) {
  return CITY_TO_SEGMENT[city] || null;
}

function getSegmentSummary(segmentCode) {
  return SEGMENT_SUMMARY[segmentCode] || "";
}

module.exports = { getSegmentCodeByCity, getSegmentSummary, CITY_TO_SEGMENT };
