const Anthropic = require("@anthropic-ai/sdk");
const { z } = require("zod");
const path = require("path");
const fallbackPlaces = require(path.join(__dirname, "..", "data", "fallback-places.json"));
const { getSegmentSummary } = require("./segments");

const SYSTEM_PROMPT = `당신은 강원도 EV 충전 관광 앱의 추천 엔진입니다.
주어진 충전소 정보와 주변 장소 리스트를 바탕으로 지정된 JSON 스키마에 정확히 맞는 객체만 반환하세요.
설명문이나 코드블록 표기 없이 JSON만 출력하고, 스키마에 없는 필드는 만들지 마세요.
세그먼트 명칭이나 내부 분류 코드는 절대 본문에 노출하지 마세요.

모든 문구는 "이용 안내"식 일반론이 아니라, 실제로 사용자의 방문을 유도하는 구체적인 카피로 씁니다:
- benefit.title/subtitle, action.options[].detail, advisory에는 가능하면 네이버 검색 결과에 있는
  실제 상호명을 직접 언급하세요. ("근처 음식점을 이용해보세요" 같은 표현 금지)
- 네이버 검색 결과가 비어 있으면 있지도 않은 장소를 지어내지 말고, nearbyPlaces는 빈 배열로 두고
  advisory에 그 사실과 대안을 안내하세요.
- 세그먼트 설명에 적힌 행동 지침(action.type, cta 사용 여부 등)을 그대로 따르세요.
- 네이버 검색 결과에 phone/link 값이 있으면 해당 장소의 phone/link 필드에 그대로 옮기고, 없으면 필드 자체를 생략하세요.
- 영업시간 정보는 네이버 검색 결과에 포함되어 있지 않습니다. 절대로 영업시간을 추측하거나 지어내지 마세요.
- cta는 네이버 검색 결과 중 실제 음식점/카페 상호가 있을 때만 넣으세요. cta.reward는 반드시
  "{실제 상호명} {금액}원 할인"처럼 어디서 얼마를 할인해주는지 명시하세요 ("혜택 받기"처럼 대상이 안 드러나는 표현 금지).
- 포인트 적립, 스탬프 적립처럼 나중에 모아서 쓰는 방식은 절대 쓰지 마세요 — 이 앱은 로그인/적립 이력 관리가 없어서
  쌓인 포인트를 확인하거나 쓸 방법이 없습니다. 반드시 그 자리에서 바로 받는 할인만 제안하세요.
- 음식점/카페가 하나도 없고 관광지뿐이거나 결과가 비어 있으면 cta는 null로 두세요. 억지로 혜택을 만들지 마세요.
  cta.label은 그 혜택을 받기 위한 행동 문구로 쓰세요 (예: "방문 인증하기").`;

const PlaceSchema = z.object({
  name: z.string(),
  distanceM: z.number(),
  walkMin: z.number(),
  category: z.string(),
  group: z.string().optional(),
  roadAddress: z.string().optional(),
  phone: z.string().optional(),
  link: z.string().optional(),
});

const StrategyResponseSchema = z.object({
  stationId: z.string(),
  benefit: z.object({
    title: z.string(),
    subtitle: z.string(),
  }),
  advisory: z.string().nullable(),
  action: z
    .object({
      type: z.enum(["duration", "phase", "none"]),
      options: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          detail: z.string(),
          places: z.array(PlaceSchema).optional(),
        })
      ),
    })
    .nullable(),
  nearbyPlaces: z.array(PlaceSchema),
  cta: z
    .object({
      label: z.string(),
      kind: z.enum(["receipt_submit", "none"]),
      reward: z.string().optional(),
    })
    .nullable(),
  note: z.string().nullable(),
});

let anthropicClient = null;
function getClient() {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY 가 설정되어 있지 않습니다.");
    }
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function buildUserPrompt({ station, segmentCode, naverResults }) {
  const segmentSummary = getSegmentSummary(segmentCode);
  return `[충전소] ${station.name} (${station.city})
[내부 세그먼트] ${segmentCode}
[세그먼트 설명(보고서 요약)] ${segmentSummary}
[네이버 검색 API 결과] ${JSON.stringify(naverResults)}
[요청] 위 정보를 바탕으로 StrategyResponse 스키마에 맞는 JSON을 생성하세요.

StrategyResponse 스키마:
{
  "stationId": string,
  "benefit": { "title": string, "subtitle": string },
  "advisory": string | null,
  "action": { "type": "duration" | "phase" | "none", "options": [{ "key": string, "label": string, "detail": string, "places"?: Place[] }] } | null,
  "nearbyPlaces": Place[],
  "cta": { "label": string, "kind": "receipt_submit" | "none", "reward"?: string } | null,
  "note": string | null
}
Place: { "name": string, "distanceM": number, "walkMin": number, "category": string, "group"?: string, "roadAddress"?: string, "phone"?: string, "link"?: string }
stationId 필드에는 정확히 "${station.id}" 값을 넣으세요.`;
}

const AUTO_NOTE = "* 네이버 검색 결과를 기반으로 자동 추천되었습니다";
const walkMinFromDist = (m) => Math.max(1, Math.round(m / 70));

function toPlace(p) {
  return {
    name: p.name,
    distanceM: p.distanceM,
    walkMin: walkMinFromDist(p.distanceM),
    category: p.category,
    ...(p.group ? { group: p.group } : {}),
    ...(p.roadAddress ? { roadAddress: p.roadAddress } : {}),
    ...(p.phone ? { phone: p.phone } : {}),
    ...(p.link ? { link: p.link } : {}),
  };
}

// "혜택"은 반드시 실제 돈을 받는 가게(음식점/카페)가 있을 때만 의미가 있다.
// 포인트·스탬프처럼 쌓아뒀다 나중에 쓰는 방식은 로그인/이력 관리가 없는 지금
// 구조에서는 적립분을 확인·사용할 곳이 없어 앞뒤가 안 맞는다. 그래서 쿠폰은
// "실제 상호명 + 그 자리에서 바로 쓰는 할인"으로만 만들고, 쓸 만한 가게가
// 없으면 쿠폰 자체를 내지 않는다(정보/안내만 남긴다).
function findShop(places) {
  return places.find((p) => p.group === "음식점" || p.group === "카페") || null;
}

function shopCta(shop, amount) {
  if (!shop) return null;
  return {
    label: "방문 인증하기",
    kind: "receipt_submit",
    reward: `${shop.name} ${amount.toLocaleString()}원 할인`,
  };
}

// LLM 호출이 불가능하거나 실패했을 때도, 네이버 검색 결과가 있으면 세그먼트별
// 행동 패턴에 맞춰 최대한 실효적인 추천을 조립한다. 결과가 아예 없을 때만
// "정보 없음"에 가까운 문구로 대체한다.
function buildGenericFallback(station, segmentCode, naverResults) {
  const places = (naverResults || []).slice(0, 12).map(toPlace);
  const has = places.length > 0;
  const shop = findShop(places);

  if (segmentCode === "dest") {
    return {
      benefit: has
        ? { title: `${places[0].name} 등 근처 상권을 이용해보세요`, subtitle: shop ? `${shop.name} 방문 후 영수증을 제출하면 할인받을 수 있어요` : "방문 후 영수증을 제출하면 할인받을 수 있어요" }
        : { title: "근처 상권 정보를 아직 확인하지 못했어요", subtitle: "잠시 후 다시 시도해주세요" },
      advisory: null,
      action: null,
      nearbyPlaces: places,
      cta: shopCta(shop, 3000),
      note: has ? AUTO_NOTE : null,
    };
  }

  if (segmentCode === "weak") {
    return {
      benefit: has
        ? { title: `걸어서 갈 수 있는 곳으로 ${places[0].name}이 있어요`, subtitle: `도보 ${places[0].walkMin}분 거리예요` }
        : { title: "이 충전소 주변엔 걸어서 갈 만한 상권이 확인되지 않아요", subtitle: "장시간 충전이 필요하면 다른 충전소도 고려해보세요" },
      advisory: has ? null : "주변 편의시설 정보가 부족한 지역입니다. 대기 전 간식·용품을 미리 준비하는 것을 권장합니다.",
      action: null,
      nearbyPlaces: places,
      // 상권 자체가 부족한 지역이라 할인을 걸 가게가 없는 경우가 대부분이다.
      // 가게가 있으면 그 자리에서 쓰는 할인만 걸고, 없으면 쿠폰 없이 정보만 준다.
      cta: shopCta(shop, 2000),
      note: has ? AUTO_NOTE : null,
    };
  }

  if (segmentCode === "done") {
    const half = Math.ceil(places.length / 2);
    const early = places.slice(0, half);
    const late = places.slice(half);
    return {
      benefit: has
        ? { title: `충전 단계별로 ${places[0].name} 등을 둘러보세요`, subtitle: "초반/막바지 동선을 나눠 제안합니다" }
        : { title: "근처 정보를 아직 확인하지 못했어요", subtitle: "잠시 후 다시 시도해주세요" },
      advisory: null,
      action: has
        ? {
            type: "phase",
            options: [
              { key: "early", label: "충전 초반", detail: "지금 나가서 가볍게 둘러보고 오세요.", places: early },
              { key: "late", label: "충전 막바지", detail: "복귀 전 들르기 좋은 곳이에요.", places: late.length ? late : early },
            ],
          }
        : null,
      nearbyPlaces: places,
      cta: shopCta(shop, 2000),
      note: has ? AUTO_NOTE : null,
    };
  }

  if (segmentCode === "balanced") {
    return {
      benefit: has
        ? { title: `${places[0].name}를 다녀와보세요`, subtitle: "방문 후 알려주시면 반영할게요" }
        : { title: "근처 정보를 아직 확인하지 못했어요", subtitle: "잠시 후 다시 시도해주세요" },
      advisory: null,
      action: null,
      nearbyPlaces: places,
      cta: shopCta(shop, 2000),
      note: has ? AUTO_NOTE : null,
    };
  }

  // route (기본값)
  const top = places.slice(0, 2);
  return {
    benefit: has
      ? { title: `충전 대기 시간에 ${top[0].name} 어때요?`, subtitle: `도보 ${top[0].walkMin}분 거리예요` }
      : { title: "짧게 다녀올 만한 곳을 아직 찾지 못했어요", subtitle: "잠시 후 다시 시도해주세요" },
    advisory: null,
    action: has
      ? {
          type: "duration",
          options: [
            { key: "short", label: "30~90분", detail: "충전 중 다녀올 수 있는 가까운 곳이에요.", places: top },
          ],
        }
      : null,
    nearbyPlaces: places,
    cta: shopCta(shop, 2000),
    note: has ? AUTO_NOTE : null,
  };
}

function getFallbackResponse(station, segmentCode, naverResults) {
  const curated = fallbackPlaces[station.id];
  const body = curated || buildGenericFallback(station, segmentCode, naverResults);
  return { stationId: station.id, ...body };
}

async function generateStrategy({ station, segmentCode, naverResults }) {
  try {
    const client = getClient();
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
    const message = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildUserPrompt({ station, segmentCode, naverResults }) },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock) throw new Error("LLM 응답에 텍스트 블록이 없습니다.");

    const parsed = JSON.parse(textBlock.text);
    const validated = StrategyResponseSchema.parse(parsed);
    return validated;
  } catch (err) {
    // 스키마 검증 실패, 파싱 오류, API 오류 등 모든 실패 케이스는 폴백으로 대체한다.
    // (사용자 화면이 깨지지 않도록 에러를 던지지 않는다.)
    console.error("[llm] generateStrategy fallback:", err.message);
    return getFallbackResponse(station, segmentCode, naverResults);
  }
}

module.exports = { generateStrategy, StrategyResponseSchema };
