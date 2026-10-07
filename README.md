# Network QoS Monitor — Real-Time Telemetry & Coverage Heatmap 📶📡

[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo%20SDK-54-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22--alpine-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

**Network QoS Monitor** is a professional telecommunications and mobile network engineering platform designed to measure, persist, and geographically visualize Quality of Service (QoS) and Quality of Experience (QoE) metrics in real time across cellular networks (5G NR, 4G LTE, 3G) and Wi-Fi.

The application correlates cellular radio indicators (carrier, network generation, RSSI signal in dBm, cell ID, frequency bands) with active performance probes (RTT latency, RFC 2544 Jitter, packet loss, uplink and downlink throughput in Mbps) and high-precision GPS coordinates, rendering an interactive personal coverage **Heatmap** backed by offline-first SQLite storage, automated background sampling, and QoS degradation alerts.

---

## 🏛️ System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   MOBILE CLIENT (REACT NATIVE & EXPO)                  │
│                                                                        │
│   • Dashboard: Real-time RSSI (dBm) radial gauge & radio specifications│
│   • Speed Test: Color-adaptive speedometer & 4-card telemetry runner   │
│   • Coverage Map: Personal geo-heatmap with signal quality overlays    │
│   • History: SQLite persistence, time-series chart & CSV/JSON export   │
│   • Native Bridge: Android Kotlin TelephonyManager & CellInfo module   │
│   • Background Engine: 15-min background sampling & degradation alerts │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ HTTP REST & Sockets
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               REFERENCE BENCHMARKING BACKEND (DOCKER)                  │
│                                                                        │
│   Node.js / Express microservice containerized on port 3001            │
│   • GET  /api/health   -> Service health & diagnostic status           │
│   • GET  /api/ping     -> Microsecond RTT latency probe (no-cache)     │
│   • GET  /api/download -> Chunked binary stream (5 MB to 50 MB)        │
│   • POST /api/upload   -> Streaming sink for upload throughput tests   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🧮 Mathematical QoS / QoE Formulation

The benchmarking engine computes standardized network metrics following international telecommunication standards:

### 1. Throughput Calculation (Bit-Rate)
Bit-rate throughput is computed over deterministic transfer windows using standard bit-conversion:

$$\text{Throughput (Mbps)} = \frac{\text{Bytes Transferidos} \times 8}{\text{Tiempo Transcurrido (segundos)} \times 10^6}$$

### 2. Statistical Latency & Packet Loss (RFC 2544)
For a probe burst of $N$ round-trip packets with transit times $T = [t_1, t_2, \dots, t_M]$ (where $M \le N$ packets successfully return):

$$\text{Ping}_{\min} = \min(T), \quad \text{Ping}_{\max} = \max(T), \quad \text{Ping}_{\text{avg}} = \frac{1}{M}\sum_{k=1}^M t_k$$

$$\text{Packet Loss (\%)} = \left(\frac{N - M}{N}\right) \times 100$$

### 3. Exponential Jitter Filter (RFC 3550 / RFC 2544)
Packet delay variation (jitter) is smoothed using the RFC 3550 exponential low-pass filter with a gain parameter $\alpha = \frac{1}{16}$:

$$D_i = |(R_i - S_i) - (R_{i-1} - S_{i-1})| = |\Delta \text{Latency}_i|$$

$$J_i = J_{i-1} + \frac{D_i - J_{i-1}}{16}$$

---

## 📱 Mobile Client Screens & Features

| Screen | Core Capabilities |
| :--- | :--- |
| **Live Dashboard** | SVG radial gauge for signal strength in dBm, 5-bar signal level indicator, carrier identification (Personal, Claro, Movistar, Wi-Fi), serving cell ID, frequency bands, and aggregate stats. |
| **Speed Test** | Multi-phase active benchmark runner with sequential color-adaptive SVG speedometer, real-time RTT Ping, RFC 2544 Jitter, Downlink and Uplink cards, multi-host RTT comparisons (Cloudflare, Google, Local), and background sampling toggle. |
| **Coverage Heatmap** | Interactive satellite/standard map rendering personalized heatmap layer, individual sample markers with signal quality color codes, instant GPS auto-centering, and technical inspection cards. |
| **Session History** | Chronological benchmark records, temporal evolution SVG trend chart (throughput vs. RTT ping), dynamic technology filters (`5G`, `4G`, `3G`, `WIFI`), and one-tap export to **RFC 4180 CSV** and **JSON**. |

---

## ⚙️ Native Android Bridge (Kotlin)

When running on Android devices, the client uses a custom native module (`NetworkQoSModule.kt`) to query low-level radio hardware:

* **TelephonyManager**: Real-time cellular radio technology detection (`NETWORK_TYPE_NR`, `NETWORK_TYPE_LTE`, `NETWORK_TYPE_HSDPA`, etc.).
* **CellSignalStrength**: Hardware-measured RSSI / RSRP / RSRQ signal power in dBm and discrete level (1 to 5 bars).
* **Serving Cell & Carrier**: SIM operator numeric code, operator alphanumeric name, cell identity (eNodeB / gNodeB), and operating frequency.
* **Simulator Fallback**: On iOS and Expo Go environments, a cross-platform telemetry adapter (`src/native/telephonyAdapter.ts`) provides realistic radio simulation with dynamic dBm fluctuations.

---

## 🔄 Background Sampling & Degradation Alerts

Built using `expo-task-manager`, `expo-background-fetch`, and `expo-notifications`:

* **Periodic Sampling**: Registers an OS-managed background task that executes every 15 minutes, reading radio indicators, taking a quick GPS fix, performing lightweight pings, and persisting samples into SQLite.
* **QoS Degradation Alerts**: Evaluates telemetry against telecom thresholds and sends local notifications:
  * **Critical Blind Spot**: Signal $\le -105$ dBm.
  * **Packet Drop**: Packet loss $\ge 15\%$.
  * **Jitter Anomaly**: RFC 3550 Jitter $\ge 25$ ms.
  * **High Latency**: Average RTT $\ge 250$ ms.
* **Smart Cooldown**: Employs a 3-minute debounce cooldown per alert type to avoid notification spamming.

---

## 💾 Offline-First SQLite Database Schema

All measurements are stored locally in an embedded SQLite database (`network_qos.db`):

```sql
CREATE TABLE IF NOT EXISTS qos_measurements (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  timestamp INTEGER NOT NULL,
  network_type TEXT NOT NULL,       -- '5G', '4G', '3G', 'WIFI', 'UNKNOWN'
  operator TEXT,                    -- e.g. 'Personal', 'Claro', 'Movistar'
  signal_strength_dbm INTEGER,      -- e.g. -78 dBm
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
```

---

## 🚀 Running the Project

### 1. Start the Docker Reference Backend

```bash
cd backend
docker compose up -d --build
```

Verify service status:

```bash
curl http://localhost:3001/api/health
```

### 2. Start the Mobile Client

From the project root:

```bash
npm install
npx expo start
```

Press `a` to open in Android Emulator, or scan the QR code with the **Expo Go** app on your physical mobile device.

### 3. Run Automated Tests

Execute the Jest-compatible automated test suite validating RFC 2544 math, RFC 3550 jitter filters, and throughput calculations:

```bash
npm run test:qos
```

Output:
```text
Testing Throughput Formulas (Mbps):
  PASS: 5MB in 1.0s equals 41.94 Mbps
  PASS: 10MB in 2.0s equals 41.94 Mbps
  PASS: 250KB in 0.5s equals 4.10 Mbps
  PASS: Zero bytes returns 0 Mbps
  PASS: Zero duration returns 0 Mbps
  PASS: Negative duration returns 0 Mbps

Testing RFC 3550 / RFC 2544 Jitter Filter:
  PASS: Constant latency produces 0 ms jitter
  PASS: Single sample produces 0 ms jitter
  PASS: Empty series produces 0 ms jitter
  PASS: Applies RFC 3550 filter gain 1/16 to [20,25,22,30,24]
  PASS: Decays jitter after stabilization

Testing RFC 2544 Statistics:
  PASS: Calculates min latency: 15.2 ms
  PASS: Calculates max latency: 31.6 ms
  PASS: Calculates average latency: 22.6 ms
  PASS: Reports 0% packet loss when all probes reply
  PASS: Calculates positive jitter
  PASS: Calculates 60% packet loss for 3/5 dropped packets
  PASS: Calculates 100% loss on full timeout
  PASS: Outage reports 0 ms average latency

Tests finished: 19 passed, 0 failed.
```

## 📄 License & Maintainer

* **Author & Lead Engineer**: Benjamin Ayala ([@benjaminayala0](https://github.com/benjaminayala0))
* **License**: MIT License
* **Repository**: [qos-mobile-monitor](https://github.com/benjaminayala0/qos-mobile-monitor)
