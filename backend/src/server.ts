import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for mobile devices, emulators, and local development clients
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'X-Requested-With'],
}));

// Pre-allocate a 64 KB buffer in memory for zero-GC high-throughput streaming
const CHUNK_SIZE = 64 * 1024;
const dummyChunk = Buffer.alloc(CHUNK_SIZE, 0xAA);

// 1. Service Health & Diagnostic Probe
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Network QoS Reference Backend',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now(),
    serverTime: new Date().toISOString(),
  });
});

// 2. High-precision RTT Ping Probe (cache-busted)
app.get('/api/ping', (req: Request, res: Response) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.json({
    t: Date.now(),
  });
});

// 3. Calibrated Download Throughput Benchmark
// Accepts ?mb=5 or ?bytes=5242880 (defaults to 5 MB)
app.get('/api/download', (req: Request, res: Response) => {
  const queryMb = parseFloat(req.query.mb as string);
  const queryBytes = parseInt(req.query.bytes as string);

  let targetBytes = 5 * 1024 * 1024; // 5 MB default
  if (!isNaN(queryBytes) && queryBytes > 0) {
    targetBytes = Math.min(Math.max(queryBytes, 64 * 1024), 50 * 1024 * 1024); // 64 KB to 50 MB
  } else if (!isNaN(queryMb) && queryMb > 0) {
    targetBytes = Math.min(Math.max(Math.round(queryMb * 1024 * 1024), 64 * 1024), 50 * 1024 * 1024);
  }

  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Length': targetBytes.toString(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Payload-Bytes': targetBytes.toString(),
  });

  let bytesRemaining = targetBytes;

  function streamNextChunk() {
    let canContinue = true;
    while (bytesRemaining > 0 && canContinue) {
      const bytesToSend = Math.min(bytesRemaining, CHUNK_SIZE);
      const slice = bytesToSend === CHUNK_SIZE ? dummyChunk : dummyChunk.subarray(0, bytesToSend);
      bytesRemaining -= bytesToSend;
      canContinue = res.write(slice);
    }

    if (bytesRemaining <= 0) {
      res.end();
    } else {
      res.once('drain', streamNextChunk);
    }
  }

  streamNextChunk();
});

// 4. Calibrated Upload Throughput Benchmark
// Receives raw binary data stream and computes real-time throughput metrics
app.post('/api/upload', (req: Request, res: Response) => {
  const startTime = Date.now();
  let totalBytes = 0;

  req.on('data', (chunk: Buffer) => {
    totalBytes += chunk.length;
  });

  req.on('end', () => {
    const durationMs = Math.max(Date.now() - startTime, 1);
    const durationSec = durationMs / 1000;
    const mbps = (totalBytes * 8) / (durationSec * 1_000_000);

    res.json({
      status: 'success',
      receivedBytes: totalBytes,
      durationMs,
      calculatedMbps: parseFloat(mbps.toFixed(2)),
      timestamp: Date.now(),
    });
  });

  req.on('error', (err: Error) => {
    res.status(500).json({ error: 'Stream interrupted', details: err.message });
  });
});

app.listen(PORT, () => {
  console.log(`[QoS Backend] Server running on port ${PORT}`);
  console.log(`[QoS Backend] Endpoints: /api/health | /api/ping | /api/download | /api/upload`);
});
