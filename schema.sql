CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  ip TEXT,
  country TEXT,
  city TEXT,
  region TEXT,
  ua TEXT,
  lang TEXT,
  path TEXT,
  referrer TEXT,
  device TEXT
);
CREATE INDEX IF NOT EXISTS idx_visits_ts ON visits(ts DESC);
CREATE INDEX IF NOT EXISTS idx_visits_ip ON visits(ip);
CREATE INDEX IF NOT EXISTS idx_visits_country ON visits(country);
