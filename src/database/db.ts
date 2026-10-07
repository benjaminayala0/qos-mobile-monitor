import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDatabase = (): SQLite.SQLiteDatabase => {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync('network_qos.db');
    initDatabase(dbInstance);
  }
  return dbInstance;
};

export const initDatabase = (db: SQLite.SQLiteDatabase): void => {
  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      label TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS qos_measurements (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      timestamp INTEGER NOT NULL,
      network_type TEXT NOT NULL,       -- '5G', '4G', '3G', 'WIFI', 'UNKNOWN'
      operator TEXT,                    -- e.g. 'Personal', 'Claro', 'Movistar', 'Wi-Fi'
      signal_strength_dbm INTEGER,      -- e.g. -78
      signal_level INTEGER,             -- 1 to 5 bars
      latitude REAL,
      longitude REAL,
      ping_min_ms REAL,
      ping_avg_ms REAL,
      ping_max_ms REAL,
      jitter_ms REAL,                   -- RFC 2544 Jitter
      packet_loss_pct REAL,             -- Packet loss percentage
      download_mbps REAL,               -- Downlink throughput
      upload_mbps REAL,                 -- Uplink throughput
      target_host TEXT                  -- Tested endpoint or host
    );

    CREATE INDEX IF NOT EXISTS idx_qos_timestamp ON qos_measurements(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_qos_network ON qos_measurements(network_type);
  `);

  // Seed initial data if the database table is empty for immediate visual validation
  seedInitialData(db);
};

const seedInitialData = (db: SQLite.SQLiteDatabase): void => {
  const countRow = db.getFirstSync<{ count: number }>('SELECT count(*) as count FROM qos_measurements');
  if (countRow && countRow.count > 0) return;

  const now = Date.now();
  const seedItems = [
    {
      id: 'seed-01',
      session_id: 'sess-01',
      timestamp: now - 1000 * 60 * 45, // 45 mins ago
      network_type: '5G',
      operator: 'Personal 5G',
      signal_strength_dbm: -74,
      signal_level: 5,
      latitude: -31.3920,
      longitude: -58.0180,
      ping_min_ms: 18.2,
      ping_avg_ms: 22.4,
      ping_max_ms: 31.0,
      jitter_ms: 2.1,
      packet_loss_pct: 0.0,
      download_mbps: 142.8,
      upload_mbps: 38.4,
      target_host: 'api.qos.local:3001',
    },
    {
      id: 'seed-02',
      session_id: 'sess-01',
      timestamp: now - 1000 * 60 * 30, // 30 mins ago
      network_type: '4G',
      operator: 'Claro 4G LTE',
      signal_strength_dbm: -88,
      signal_level: 4,
      latitude: -31.3945,
      longitude: -58.0215,
      ping_min_ms: 34.1,
      ping_avg_ms: 41.5,
      ping_max_ms: 58.2,
      jitter_ms: 4.8,
      packet_loss_pct: 0.0,
      download_mbps: 45.2,
      upload_mbps: 14.6,
      target_host: 'api.qos.local:3001',
    },
    {
      id: 'seed-03',
      session_id: 'sess-01',
      timestamp: now - 1000 * 60 * 20, // 20 mins ago
      network_type: '4G',
      operator: 'Claro 4G LTE',
      signal_strength_dbm: -98,
      signal_level: 2,
      latitude: -31.3970,
      longitude: -58.0260,
      ping_min_ms: 55.0,
      ping_avg_ms: 68.3,
      ping_max_ms: 92.4,
      jitter_ms: 8.7,
      packet_loss_pct: 2.5,
      download_mbps: 18.4,
      upload_mbps: 5.2,
      target_host: '1.1.1.1',
    },
    {
      id: 'seed-04',
      session_id: 'sess-01',
      timestamp: now - 1000 * 60 * 10, // 10 mins ago
      network_type: '3G',
      operator: 'Movistar 3G',
      signal_strength_dbm: -108,
      signal_level: 1,
      latitude: -31.4010,
      longitude: -58.0310,
      ping_min_ms: 110.4,
      ping_avg_ms: 148.0,
      ping_max_ms: 220.6,
      jitter_ms: 22.4,
      packet_loss_pct: 8.0,
      download_mbps: 4.1,
      upload_mbps: 1.1,
      target_host: '8.8.8.8',
    },
    {
      id: 'seed-05',
      session_id: 'sess-01',
      timestamp: now - 1000 * 60 * 2, // 2 mins ago
      network_type: 'WIFI',
      operator: 'Telecom Fibra',
      signal_strength_dbm: -58,
      signal_level: 5,
      latitude: -31.3890,
      longitude: -58.0150,
      ping_min_ms: 9.8,
      ping_avg_ms: 12.3,
      ping_max_ms: 16.5,
      jitter_ms: 1.2,
      packet_loss_pct: 0.0,
      download_mbps: 210.5,
      upload_mbps: 85.0,
      target_host: 'api.qos.local:3001',
    },
  ];

  for (const item of seedItems) {
    db.runSync(
      `INSERT INTO qos_measurements (
        id, session_id, timestamp, network_type, operator, signal_strength_dbm,
        signal_level, latitude, longitude, ping_min_ms, ping_avg_ms, ping_max_ms,
        jitter_ms, packet_loss_pct, download_mbps, upload_mbps, target_host
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.session_id,
        item.timestamp,
        item.network_type,
        item.operator,
        item.signal_strength_dbm,
        item.signal_level,
        item.latitude,
        item.longitude,
        item.ping_min_ms,
        item.ping_avg_ms,
        item.ping_max_ms,
        item.jitter_ms,
        item.packet_loss_pct,
        item.download_mbps,
        item.upload_mbps,
        item.target_host,
      ]
    );
  }
};
