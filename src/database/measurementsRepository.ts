import { getDatabase } from './db';

export interface QoSMeasurement {
  id: string;
  session_id?: string;
  timestamp: number;
  network_type: '5G' | '4G' | '3G' | 'WIFI' | 'UNKNOWN';
  operator: string;
  signal_strength_dbm: number;
  signal_level: number; // 1 to 5
  latitude: number | null;
  longitude: number | null;
  ping_min_ms: number;
  ping_avg_ms: number;
  ping_max_ms: number;
  jitter_ms: number;
  packet_loss_pct: number;
  download_mbps: number;
  upload_mbps: number;
  target_host: string;
}

export interface FilterOptions {
  networkType?: string;
  fromDate?: number;
  toDate?: number;
  limit?: number;
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number; // 0.0 to 1.0 normalized quality
  dbm: number;
  networkType: string;
}

export const saveMeasurement = async (item: Omit<QoSMeasurement, 'id'>): Promise<QoSMeasurement> => {
  const db = getDatabase();
  const id = 'meas-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const record: QoSMeasurement = { id, ...item };

  db.runSync(
    `INSERT INTO qos_measurements (
      id, session_id, timestamp, network_type, operator, signal_strength_dbm,
      signal_level, latitude, longitude, ping_min_ms, ping_avg_ms, ping_max_ms,
      jitter_ms, packet_loss_pct, download_mbps, upload_mbps, target_host
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.session_id || 'default-session',
      record.timestamp,
      record.network_type,
      record.operator,
      record.signal_strength_dbm,
      record.signal_level,
      record.latitude,
      record.longitude,
      record.ping_min_ms,
      record.ping_avg_ms,
      record.ping_max_ms,
      record.jitter_ms,
      record.packet_loss_pct,
      record.download_mbps,
      record.upload_mbps,
      record.target_host,
    ]
  );

  return record;
};

export const getMeasurements = (options?: FilterOptions): QoSMeasurement[] => {
  const db = getDatabase();
  let query = 'SELECT * FROM qos_measurements WHERE 1=1';
  const params: any[] = [];

  if (options?.networkType && options.networkType !== 'ALL') {
    query += ' AND network_type = ?';
    params.push(options.networkType);
  }

  if (options?.fromDate) {
    query += ' AND timestamp >= ?';
    params.push(options.fromDate);
  }

  if (options?.toDate) {
    query += ' AND timestamp <= ?';
    params.push(options.toDate);
  }

  query += ' ORDER BY timestamp DESC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  return db.getAllSync<QoSMeasurement>(query, params);
};

export const getHeatmapData = (): HeatmapPoint[] => {
  const db = getDatabase();
  const rows = db.getAllSync<QoSMeasurement>(
    'SELECT latitude, longitude, signal_strength_dbm, network_type FROM qos_measurements WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
  );

  return rows.map((r) => {
    // Normalize dBm (-120 dBm = 0.1 min, -60 dBm = 1.0 max)
    const normalizedWeight = Math.min(Math.max((r.signal_strength_dbm + 120) / 60, 0.1), 1.0);
    return {
      latitude: r.latitude!,
      longitude: r.longitude!,
      weight: parseFloat(normalizedWeight.toFixed(2)),
      dbm: r.signal_strength_dbm,
      networkType: r.network_type,
    };
  });
};

export const getAggregatedStats = () => {
  const db = getDatabase();
  const result = db.getFirstSync<{
    totalTests: number;
    avgPing: number;
    avgDownload: number;
    avgUpload: number;
  }>(`
    SELECT 
      count(*) as totalTests,
      COALESCE(avg(ping_avg_ms), 0) as avgPing,
      COALESCE(avg(download_mbps), 0) as avgDownload,
      COALESCE(avg(upload_mbps), 0) as avgUpload
    FROM qos_measurements
  `);

  return {
    totalTests: result?.totalTests || 0,
    avgPing: parseFloat((result?.avgPing || 0).toFixed(1)),
    avgDownload: parseFloat((result?.avgDownload || 0).toFixed(1)),
    avgUpload: parseFloat((result?.avgUpload || 0).toFixed(1)),
  };
};

export const exportToCSV = (): string => {
  const measurements = getMeasurements();
  const headers = [
    'ID',
    'Timestamp',
    'Date_UTC',
    'Network_Type',
    'Operator',
    'Signal_dBm',
    'Signal_Bars',
    'Latitude',
    'Longitude',
    'Ping_Min_ms',
    'Ping_Avg_ms',
    'Ping_Max_ms',
    'Jitter_ms',
    'Packet_Loss_pct',
    'Download_Mbps',
    'Upload_Mbps',
    'Target_Host',
  ];

  const rows = measurements.map((m) => [
    m.id,
    m.timestamp,
    new Date(m.timestamp).toISOString(),
    m.network_type,
    `"${m.operator.replace(/"/g, '""')}"`,
    m.signal_strength_dbm,
    m.signal_level,
    m.latitude ?? '',
    m.longitude ?? '',
    m.ping_min_ms,
    m.ping_avg_ms,
    m.ping_max_ms,
    m.jitter_ms,
    m.packet_loss_pct,
    m.download_mbps,
    m.upload_mbps,
    `"${m.target_host}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
};

export const exportToJSON = (): string => {
  const measurements = getMeasurements();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      recordCount: measurements.length,
      measurements,
    },
    null,
    2
  );
};
