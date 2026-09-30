const path = require("path");
const stations = require(path.join(__dirname, "..", "data", "stations.json"));
const { getSegmentCodeByCity } = require("./segments");

function getAllStations() {
  return stations;
}

function getStationById(id) {
  return stations.find((s) => s.id === id) || null;
}

// 세그먼트 코드는 내부 로직에서만 사용하고, 응답에는 절대 포함하지 않는다.
function getSegmentCodeForStation(station) {
  return getSegmentCodeByCity(station.city);
}

module.exports = { getAllStations, getStationById, getSegmentCodeForStation };
