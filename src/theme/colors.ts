export const colors = {
  background: '#0D1117',
  card: '#161B22',
  cardSecondary: '#21262D',
  border: '#30363D',
  borderLight: '#484F58',
  
  // Accents
  primary: '#00D2FF',      // Electric Cyan
  secondary: '#10B981',    // Emerald Green
  accent: '#8B5CF6',       // Tech Violet
  
  // QoS Status & Signal
  signalExcellent: '#10B981', // > -80 dBm
  signalGood: '#84CC16',      // -80 to -95 dBm
  signalFair: '#F59E0B',      // -95 to -105 dBm
  signalPoor: '#EF4444',      // < -105 dBm
  signalDisconnected: '#6E7681',

  // Typography
  textPrimary: '#F0F6FC',
  textSecondary: '#8B949E',
  textMuted: '#6E7681',
  white: '#FFFFFF',

  // Metrics Highlights
  pingColor: '#F59E0B',
  jitterColor: '#EC4899',
  downloadColor: '#00D2FF',
  uploadColor: '#10B981',
};

export const getSignalColor = (dbm: number | null | undefined): string => {
  if (dbm == null) return colors.signalDisconnected;
  if (dbm >= -80) return colors.signalExcellent;
  if (dbm >= -95) return colors.signalGood;
  if (dbm >= -105) return colors.signalFair;
  return colors.signalPoor;
};

export const getSignalQualityLabel = (dbm: number | null | undefined): string => {
  if (dbm == null) return 'No Signal';
  if (dbm >= -80) return 'Excellent';
  if (dbm >= -95) return 'Good';
  if (dbm >= -105) return 'Fair';
  return 'Poor';
};
