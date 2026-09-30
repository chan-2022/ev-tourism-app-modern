const express = require("express");
const crypto = require("crypto");
const db = require("../lib/db");
const { getStationById, getSegmentCodeForStation } = require("../lib/stationStore");

const router = express.Router();

const insertFeedback = db.prepare(`
  INSERT INTO feedback (id, stationId, segmentCode, type, sessionId, createdAt)
  VALUES ($id, $stationId, $segmentCode, $type, $sessionId, $createdAt)
`);

// POST /api/feedback  body: { stationId, type, sessionId }
router.post("/", (req, res) => {
  const { stationId, type, sessionId } = req.body || {};

  if (!stationId || !sessionId || !["helpful", "visited"].includes(type)) {
    return res.status(400).json({ error: "stationId, sessionId, type(helpful|visited)가 필요합니다." });
  }

  const station = getStationById(stationId);
  if (!station) {
    return res.status(404).json({ error: "충전소를 찾을 수 없습니다." });
  }

  const entry = {
    id: crypto.randomUUID(),
    stationId,
    segmentCode: getSegmentCodeForStation(station),
    type,
    sessionId,
    createdAt: new Date().toISOString(),
  };

  insertFeedback.run({
    $id: entry.id,
    $stationId: entry.stationId,
    $segmentCode: entry.segmentCode,
    $type: entry.type,
    $sessionId: entry.sessionId,
    $createdAt: entry.createdAt,
  });
  res.status(201).json({ id: entry.id });
});

// GET /api/feedback/summary?stationId=&segmentCode=
router.get("/summary", (req, res) => {
  const { stationId, segmentCode } = req.query;

  let query = "SELECT type, COUNT(*) as count FROM feedback WHERE 1=1";
  const params = [];
  if (stationId) {
    query += " AND stationId = ?";
    params.push(stationId);
  }
  if (segmentCode) {
    query += " AND segmentCode = ?";
    params.push(segmentCode);
  }
  query += " GROUP BY type";

  const rows = db.prepare(query).all(...params);
  const summary = { helpful: 0, visited: 0 };
  for (const row of rows) {
    summary[row.type] = row.count;
  }

  res.json(summary);
});

module.exports = router;
