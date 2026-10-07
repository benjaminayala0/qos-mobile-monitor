import { create } from 'zustand';
import { QoSMeasurement, getMeasurements, saveMeasurement } from '../database/measurementsRepository';

export type NetworkType = '5G' | '4G' | '3G' | 'WIFI' | 'UNKNOWN';
export type TestStage = 'idle' | 'pinging' | 'downloading' | 'uploading' | 'completed' | 'error';

export interface NetworkInfo {
  type: NetworkType;
  operator: string;
  signalDbm: number;
  signalLevel: number; // 1 to 5
  isConnected: boolean;
  frequencyMhz?: number;
  cellId?: string;
}

export interface LiveMetrics {
  pingMin: number;
  pingAvg: number;
  pingMax: number;
  jitter: number;
  packetLoss: number;
  downloadMbps: number;
  uploadMbps: number;
  progressPct: number;
  stageLabel: string;
}

interface QoSState {
  // Active Network Telemetry
  network: NetworkInfo;
  setNetwork: (network: Partial<NetworkInfo>) => void;

  // QoS Engine Execution Stage
  testStage: TestStage;
  setTestStage: (stage: TestStage) => void;
  
  // Real-Time Active Benchmark Metrics
  liveMetrics: LiveMetrics;
  setLiveMetrics: (metrics: Partial<LiveMetrics>) => void;
  resetLiveMetrics: () => void;

  // Endpoint & Host Configuration
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  configuredHosts: string[];
  selectedHost: string;
  setSelectedHost: (host: string) => void;

  // History & SQLite Persistence
  history: QoSMeasurement[];
  loadHistory: () => void;
  recordNewMeasurement: (measurement: Omit<QoSMeasurement, 'id'>) => Promise<QoSMeasurement>;
}

export const useQoSStore = create<QoSState>((set, get) => ({
  network: {
    type: '4G',
    operator: 'Personal 4G LTE',
    signalDbm: -84,
    signalLevel: 4,
    isConnected: true,
    frequencyMhz: 1800,
    cellId: 'CID-28419',
  },
  setNetwork: (newInfo) =>
    set((state) => ({ network: { ...state.network, ...newInfo } })),

  testStage: 'idle',
  setTestStage: (stage) => set({ testStage: stage }),

  liveMetrics: {
    pingMin: 0,
    pingAvg: 0,
    pingMax: 0,
    jitter: 0,
    packetLoss: 0,
    downloadMbps: 0,
    uploadMbps: 0,
    progressPct: 0,
    stageLabel: 'Ready to test',
  },
  setLiveMetrics: (partial) =>
    set((state) => ({ liveMetrics: { ...state.liveMetrics, ...partial } })),
  resetLiveMetrics: () =>
    set({
      liveMetrics: {
        pingMin: 0,
        pingAvg: 0,
        pingMax: 0,
        jitter: 0,
        packetLoss: 0,
        downloadMbps: 0,
        uploadMbps: 0,
        progressPct: 0,
        stageLabel: 'Ready to test',
      },
      testStage: 'idle',
    }),

  backendUrl: 'http://10.0.2.2:3001', // Android emulator localhost alias or configurable LAN IP
  setBackendUrl: (url) => set({ backendUrl: url }),

  configuredHosts: [
    'Reference Backend (:3001)',
    '1.1.1.1 (Cloudflare DNS)',
    '8.8.8.8 (Google DNS)',
  ],
  selectedHost: 'Reference Backend (:3001)',
  setSelectedHost: (host) => set({ selectedHost: host }),

  history: [],
  loadHistory: () => {
    try {
      const rows = getMeasurements({ limit: 50 });
      set({ history: rows });
    } catch {
      // Gracefully ignore during pre-database initialization
    }
  },
  recordNewMeasurement: async (data) => {
    const saved = await saveMeasurement(data);
    get().loadHistory();
    return saved;
  },
}));
