const express = require("express");
const { getStationById, getSegmentCodeForStation } = require("../lib/stationStore");
const { fetchNearbyPlaces } = require("../lib/naver");
const { generateStrategy } = require("../lib/llm");

const router = express.Router();

const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간
const cache = new Map(); // stationId -> { expiresAt, data }

// GET /api/stations/:id/strategy
router.get("/:id/strategy", async (req, res) => {
  const station = getStationById(req.params.id);
  if (!station) {
    return res.status(404).json({ error: "충전소를 찾을 수 없습니다." });
  }

  const cached = cache.get(station.id);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.data);
  }

  const segmentCode = getSegmentCodeForStation(station);

  let naverResults = [];
  try {
    naverResults = await fetchNearbyPlaces(station);
  } catch (err) {
    console.error("[strategy] naver fetch failed:", err.message);
  }

  const strategy = await generateStrategy({ station, segmentCode, naverResults });

  cache.set(station.id, { expiresAt: Date.now() + CACHE_TTL_MS, data: strategy });
  res.json(strategy);
});

module.exports = router;
