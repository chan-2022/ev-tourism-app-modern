const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dbPath = path.join(__dirname, "..", "data", "feedback.db");
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    stationId TEXT NOT NULL,
    segmentCode TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('helpful', 'visited')),
    sessionId TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )
`);

module.exports = db;
