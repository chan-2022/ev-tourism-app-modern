# 앱형 버전 로컬 개발

작업 폴더: ev-tourism-app-dev/ev-tourism-app-modern
실행: `npm ci` → `npm start` → http://127.0.0.1:3002
개발: `npm run dev` (서버 변경 감지; 클라이언트 변경 후 브라우저 새로고침)
검증: `npm test`

Express와 vanilla JavaScript를 유지합니다. 서버 진입점은 server/index.js이며 화면은 client/index.html, app.js, styles.css입니다. server/routes의 이전 라우터 파일은 보존용이며 활성 서버에서 사용하지 않습니다.

.env 없이 키 없는 고정 시연이 기본입니다. 선택적 설정은 .env.example 참고. 로컬 피드백 DB는 처음 실행 시 생성됩니다. 기존 앱·showcase·trip 분석 폴더를 변경하거나 커밋·푸시하지 않습니다.

지도 장애 재현: http://127.0.0.1:3002/?map=offline
