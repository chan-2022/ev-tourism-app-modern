# 출처와 설계 결정

## 데이터

- 충전소: 원본 앱 `server/data/stations.json` 그대로 복사, 2,756개. 보유 수량이며 실시간 사용 가능 수량이 아니다.
- 분석: 개발 복제본 `ev_mvp/build/final_report/segment_strategy_table.csv`의 sgg, A_route, A_dest, p_route, p_dest, segment만 `server/data/regions.json`에 옮겼다. 표시 좌표와 유형을 테스트로 대조한다. 새 분석·분류 재계산 없음.
- 지역 분류: 원본 `server/lib/segments.js`의 18개 매핑과 일치 확인. 산점도에 임의의 중앙값 경계나 분류 경계선을 넣지 않는다.
- 고정 장소: 원본 fallback-places.json의 상호·카테고리. PI330449(강릉), ST511305(원주), ME18B201(홍천), HE240049(속초), ME18B229(춘천).
- 홍천의 기존 단정적 부재·차량 이동 안내, 모든 사례의 할인·도보 시간·충전 진행 단계 보장 문구는 새 시연 데이터에 사용하지 않는다.
- 장소 좌표가 없어 핀을 만들지 않는다. 네이버 링크는 지역+이름 검색 링크다.
- D는 방문·소비 각 50%의 관광수요 지표. D·U는 지역 분류축이 아니며 사례 선정 검토에 사용한다. 기존 다섯 사례는 최종 선정 결과가 아니라 시연 사례다.

## 화면과 실행

참고: https://linear.app / https://synqai.co.kr / https://diskk74n903gx.cloudfront.net (2026-09-28 직접 확인).
참고한 요소: Linear의 넓은 여백·다크 제품 화면, SynQ의 설명 순서, BATON의 인트로와 조작형 콘텐츠. 로고·소스·고유 자산을 복사하지 않았다.
승인 방향: 다크 인트로 / 밝은 체험, 설명 후 직접 체험. Express + vanilla JS 유지.
산점도 선택, 고정 사례 전환, 목록·지도 동기화, 단계·모의 혜택·시연 피드백은 실제 동작한다.
세션별 helpful/interested 각각 한 번 저장. SQLite UNIQUE 제약으로 동시 중복도 방지한다. 원본의 visited를 새 DB로 이관하지 않는다.

## 이미지

내장 ImageGen 사용. 생성 이미지이며 실제 강원 지형·좌표를 나타내지 않는다.
프로젝트 자산: `client/assets/gangwon-terrain.png`.
생성 원본: `/Users/kjh/.codex/generated_images/01a0e821-5339-7ae3-8e2f-59936493bd43/exec-d8a154d6-c5be-4387-9307-1ce707714366.png`.

최종 생성 프롬프트:

> Use case: illustration-story. Asset type: decorative hero background for Gangwon EV tourism desktop website, not a map or factual geographic visualization. Wide cinematic aerial 3D topographic sculpture of mountainous Korean east coast at night. Deep midnight charcoal and blue-black, intricate restrained terrain contours, ocean along the right edge, fine silver-blue coastal light. Mountain mass predominantly right two-thirds, left third fades to completely dark empty negative space for text overlay. A few tiny cyan lights scattered in valleys, no traced routes or location pins. Sophisticated editorial digital terrain relief, Linear-level restrained premium aesthetic, realistic tactile shadows, no neon rainbow, no text, no labels, no logos, no chart, no borders. Wide landscape composition.

지도: Leaflet + OpenStreetMap, 타일 출처 표시 유지. 폰트: npm pretendard 패키지(SIL OFL), 로컬 제공. 지도 라이브러리: npm leaflet 패키지(BSD-2-Clause), 로컬 제공. 각 라이선스는 설치 패키지에 포함된다.
