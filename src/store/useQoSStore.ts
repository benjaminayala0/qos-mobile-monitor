import { create } from 'zustand';
import Constants from 'expo-constants';
import { QoSMeasurement, getMeasurements, saveMeasurement } from '../database/measurementsRepository';
import { fetchTelephonyInfo } from '../native/telephonyAdapter';

export type NetworkType = '5G' | '4G' | '3G' | 'WIFI' | 'UNKNOWN';
export type TestStage = 'idle' | 'locating' | 'pinging' | 'downloading' | 'uploading' | 'saving' | 'completed' | 'error';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BenchmarkStep {
  id: 'gps' | 'ping' | 'download' | 'upload' | 'persist';
  title: string;
  status: StepStatus;
  detail?: string;
}

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

const getDefaultBackendUrl = (): string => {
  try {
    const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoClient?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      return `http://${host}:3001`;
    }
  } catch {
    // ignore
  }
  return 'http://192.168.1.6:3001';
};

const initialSteps: BenchmarkStep[] = [
  { id: 'gps', title: 'GPS Geolocation & Network Tagging', status: 'pending' },
  { id: 'ping', title: 'RTT Latency & Jitter (RFC 2544)', status: 'pending' },
  { id: 'download', title: 'Downlink Throughput (Mbps)', status: 'pending' },
  { id: 'upload', title: 'Uplink Throughput (Mbps)', status: 'pending' },
  { id: 'persist', title: 'Local SQLite Persistence', status: 'pending' },
];

interface QoSState {
  // Active Network Telemetry
  network: NetworkInfo;
  setNetwork: (network: Partial<NetworkInfo>) => void;
  refreshTelephony: () => Promise<void>;

  // QoS Engine Execution Stage
  testStage: TestStage;
  setTestStage: (stage: TestStage) => void;
  benchmarkSteps: BenchmarkStep[];
  updateStep: (id: BenchmarkStep['id'], status: StepStatus, detail?: string) => void;
  resetBenchmarkSteps: () => void;
  
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

  // Multi-Host RTT Telemetry (RFC 2544 Comparison)
  multiHostResults: MultiHostPingResult[];
  setMultiHostResults: (results: MultiHostPingResult[]) => void;

  // History & SQLite Persistence
  history: QoSMeasurement[];
  loadHistory: () => void;
  recordNewMeasurement: (measurement: Omit<QoSMeasurement, 'id'>) => Promise<QoSMeasurement>;
}

export interface MultiHostPingResult {
  hostId: string;
  hostName: string;
  min: number;
  avg: number;
  max: number;
  jitter: number;
  lossPct: number;
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
  refreshTelephony: async () => {
    try {
      const info = await fetchTelephonyInfo();
      set({ network: info });
    } catch {
      // Gracefully handle query fallback
    }
  },

  testStage: 'idle',
  setTestStage: (stage) => set({ testStage: stage }),

  benchmarkSteps: initialSteps,
  updateStep: (id, status, detail) =>
    set((state) => ({
      benchmarkSteps: state.benchmarkSteps.map((step) =>
        step.id === id ? { ...step, status, ...(detail !== undefined ? { detail } : {}) } : step
      ),
    })),
  resetBenchmarkSteps: () =>
    set({
      benchmarkSteps: initialSteps.map((s) => ({ ...s, status: 'pending', detail: undefined })),
    }),

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
      benchmarkSteps: initialSteps.map((s) => ({ ...s, status: 'pending', detail: undefined })),
      multiHostResults: [],
    }),

  backendUrl: getDefaultBackendUrl(),
  setBackendUrl: (url) => set({ backendUrl: url }),

  configuredHosts: [
    'Reference Backend (:3001)',
    '1.1.1.1 (Cloudflare DNS)',
    '8.8.8.8 (Google DNS)',
  ],
  selectedHost: 'Reference Backend (:3001)',
  setSelectedHost: (host) => set({ selectedHost: host }),

  multiHostResults: [],
  setMultiHostResults: (results) => set({ multiHostResults: results }),

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
