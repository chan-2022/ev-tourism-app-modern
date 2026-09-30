const express = require("express");
const crypto = require("crypto");
const { getStationById } = require("../lib/stationStore");

const router = express.Router();

// 데모용 단순 마커. 인프라 확장 시 DB 테이블로 교체 가능.
const sessions = new Map();

// POST /api/checkin  body: { stationId }
router.post("/", (req, res) => {
  const { stationId } = req.body || {};
  if (!stationId) {
    return res.status(400).json({ error: "stationId가 필요합니다." });
  }
  const station = getStationById(stationId);
  if (!station) {
    return res.status(404).json({ error: "충전소를 찾을 수 없습니다." });
  }

  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { stationId, createdAt: new Date().toISOString() });

  res.json({ sessionId });
});

module.exports = router;
