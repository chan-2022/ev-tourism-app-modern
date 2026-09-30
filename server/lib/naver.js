// 네이버 검색 API(지역 검색) 호출. 반드시 서버에서만 실행한다 (CORS/키 노출 방지).
const NAVER_LOCAL_SEARCH_URL = "https://naverapihub.apigw.ntruss.com/search/v1/local";

const CATEGORY_QUERIES = ["음식점", "카페", "관광명소"];

function stripHtml(text) {
  return text.replace(/<[^>]*>/g, "");
}

// 지구 반경 기반 haversine 거리 계산 (m 단위)
function haversineDistanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// 네이버 지역 검색은 좌표 반경 검색이 아니라 텍스트 검색이므로, 주소에서
// "시/군 + 읍/면/동(또는 도로명)" 정도의 지역 토큰을 뽑아 검색어에 섞어야
// 충전소 실제 위치와 가까운 결과가 나올 확률이 높아진다.
function buildLocalityQuery(station) {
  if (station.address) {
    // 예: "강원특별자치도 강릉시 임영로155번길 6" -> "강릉시 임영로155번길"
    const tokens = station.address.split(/\s+/).filter(Boolean);
    const locality = tokens.slice(1, 3).join(" "); // 도/특별자치도 다음 1~2개 토큰
    if (locality) return locality;
  }
  return `${station.city} ${station.name}`;
}

async function searchLocalCategory(station, categoryKeyword) {
  const keyId = process.env.NAVER_APIGW_KEY_ID;
  const key = process.env.NAVER_APIGW_KEY;
  if (!keyId || !key) {
    throw new Error("NAVER_APIGW_KEY_ID / NAVER_APIGW_KEY 가 설정되어 있지 않습니다.");
  }

  const query = `${buildLocalityQuery(station)} ${categoryKeyword}`;
  const url = new URL(NAVER_LOCAL_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("display", "8");
  url.searchParams.set("sort", "random");

  const res = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: {
      "X-NCP-APIGW-API-KEY-ID": keyId,
      "X-NCP-APIGW-API-KEY": key,
    },
  });

  if (!res.ok) {
    throw new Error(`Naver local search failed: ${res.status}`);
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];

  return items.map((item) => {
    // mapx/mapy: WGS84 좌표 * 10^7
    const lng = Number(item.mapx) / 1e7;
    const lat = Number(item.mapy) / 1e7;
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;

    // 네이버가 주는 category는 "음식점>일식>일식당"처럼 세분화되어 있어,
    // 검색에 쓴 대분류 키워드보다 가장 뒤쪽(가장 구체적인) 항목이 사용자에게 더 유용하다.
    const categoryPath = (item.category || "").split(">").map((s) => s.trim()).filter(Boolean);
    const category = categoryPath[categoryPath.length - 1] || categoryKeyword;

    const phone = (item.telephone || "").trim();
    const link = (item.link || "").trim();

    return {
      name: stripHtml(item.title || ""),
      category,
      group: categoryKeyword, // 음식점/카페/관광명소 대분류. 클라이언트 선호 필터링에 사용.
      distanceM: hasCoords ? haversineDistanceM(station.lat, station.lng, lat, lng) : null,
      roadAddress: item.roadAddress || item.address || "",
      ...(phone ? { phone } : {}),
      ...(link ? { link } : {}),
    };
  });
}

async function fetchNearbyPlaces(station) {
  const settled = await Promise.allSettled(CATEGORY_QUERIES.map(category => searchLocalCategory(station, category)));
  if (settled.every(r => r.status === "rejected")) throw new Error("Search unavailable");
  const results = settled.filter(r => r.status === "fulfilled").map(r => r.value);

  const merged = results.flat();
  // 이름 기준 중복 제거
  const seen = new Set();
  const deduped = [];
  for (const place of merged) {
    if (!place.name || seen.has(place.name)) continue;
    seen.add(place.name);
    deduped.push(place);
  }

  // 텍스트 검색 특성상 실제로는 멀리 떨어진 동명 지역 결과가 섞일 수 있어,
  // 거리 계산이 가능한 것만 남기고 가까운 순으로 정렬한다. 2km 넘는 결과는
  // "충전 대기 중 다녀올 수 있는 거리"로 보기 어려워 제외한다.
  return deduped
    .filter((p) => p.distanceM != null && p.distanceM <= 2000)
    .sort((a, b) => a.distanceM - b.distanceM);
}

module.exports = { fetchNearbyPlaces, haversineDistanceM };
