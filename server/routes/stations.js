const express = require("express");
const { getAllStations, getStationById } = require("../lib/stationStore");

const router = express.Router();

function toPublicStation(station) {
  // 세그먼트 코드는 응답에서 제외한다.
  const { id, name, city, lat, lng, fastCount, slowCount } = station;
  return { id, name, city, lat, lng, fastCount, slowCount };
}

// GET /api/stations
router.get("/", (req, res) => {
  const stations = getAllStations().map(toPublicStation);
  res.json(stations);
});

// GET /api/stations/:id
router.get("/:id", (req, res) => {
  const station = getStationById(req.params.id);
  if (!station) {
    return res.status(404).json({ error: "충전소를 찾을 수 없습니다." });
  }
  res.json({
    ...toPublicStation(station),
    advisory: "향후 실시간 충전 현황 데이터와 연동 시 확장 가능",
  });
});

module.exports = router;
