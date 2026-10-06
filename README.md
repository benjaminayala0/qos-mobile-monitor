# Network QoS Monitor — Real-Time Telemetry & Coverage Heatmap 📶📡

[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo%20SDK-54-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22--alpine-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

**Network QoS Monitor** is a professional mobile telecommunications engineering platform designed to measure, persist, and geographically visualize Quality of Service (QoS) and Quality of Experience (QoE) metrics in real time across cellular networks (5G NR, 4G/LTE, 3G) and Wi-Fi.

The platform correlates cellular radio indicators (carrier, network type, signal strength RSSI in dBm) with active performance probes (RTT latency, RFC 2544 Jitter, packet loss, upload and download throughput in Mbps) and high-precision GPS coordinates, generating an interactive personal coverage **Heatmap** backed by offline-first SQLite storage.

---

## 🏛️ System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   MOBILE CLIENT (REACT NATIVE & EXPO)                  │
│                                                                        │
│   • Telephony Engine: Cellular technology, carrier name, RSSI (dBm)    │
│   • Active Probing: RTT ping probes, RFC 2544 Jitter, packet loss      │
│   • Throughput Runner: Calibrated upload & download tests (Mbps)       │
│   • Geo Heatmap: Geographic coverage overlay (react-native-maps)       │
│   • Local Storage: Offline SQLite relational database + CSV/JSON export│
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

## 🚀 Reference Backend Setup (Docker)

The reference backend provides deterministic endpoints for latency probing and network throughput benchmarking without external network variance or ISP throttling.

### 1. Launch with Docker Compose

From the `backend/` directory:

```bash
cd backend
docker compose up -d --build
```

The service is exposed on port `3001`.

### 2. Available Endpoints

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/health` | `GET` | Service status, uptime, and diagnostic timestamp |
| `/api/ping` | `GET` | Cache-busted microsecond RTT latency probe |
| `/api/download` | `GET` | Calibrated binary stream (`?mb=5` or `?bytes=5242880`) |
| `/api/upload` | `POST` | Raw binary streaming sink computing real-time upload Mbps |

### 3. Verification

Test health and latency probes:

```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/ping
```

Benchmark a 5 MB download stream:

```bash
curl -o /dev/null -w "Time: %{time_total}s | Speed: %{speed_download} bytes/sec\n" "http://localhost:3001/api/download?mb=5"
```
