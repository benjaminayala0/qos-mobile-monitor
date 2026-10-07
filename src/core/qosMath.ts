export interface PingResult {
  min: number;
  avg: number;
  max: number;
  jitter: number;
  lossPct: number;
}

/**
 * Calculates Interarrival Jitter according to RFC 3550 Section 6.4.1 / RFC 2544:
 *   D(i-1, i) = |latency[i] - latency[i-1]|
 *   J(i) = J(i-1) + (|D(i-1, i)| - J(i-1)) / 16
 */
export function calculateRfc3550Jitter(latencies: number[]): number {
  if (latencies.length < 2) return 0;
  let jitter = Math.abs(latencies[1] - latencies[0]);
  for (let i = 2; i < latencies.length; i++) {
    const deltaD = Math.abs(latencies[i] - latencies[i - 1]);
    jitter += (deltaD - jitter) / 16;
  }
  return parseFloat(Math.max(jitter, 0).toFixed(2));
}

/**
 * Calculates network throughput in Megabits per second (Mbps):
 *   Mbps = (Bytes * 8) / (durationSeconds * 10^6)
 */
export function calculateThroughputMbps(bytes: number, durationSec: number): number {
  if (durationSec <= 0 || bytes <= 0) return 0;
  const mbps = (bytes * 8) / (durationSec * 1_000_000);
  return parseFloat(mbps.toFixed(2));
}

/**
 * Calculates RFC 2544 latency metrics (min, avg, max, packet loss %)
 * coupled with RFC 3550 interarrival jitter.
 */
export function calculateRfc2544Stats(latencies: number[], totalPacketsSent: number): PingResult {
  if (latencies.length === 0) {
    return { min: 0, avg: 0, max: 0, jitter: 0, lossPct: 100 };
  }
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);
  const avg = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
  const jitter = calculateRfc3550Jitter(latencies);
  const lostPackets = Math.max(totalPacketsSent - latencies.length, 0);
  const lossPct = (lostPackets / totalPacketsSent) * 100;

  return {
    min: parseFloat(min.toFixed(1)),
    avg: parseFloat(avg.toFixed(1)),
    max: parseFloat(max.toFixed(1)),
    jitter,
    lossPct: parseFloat(lossPct.toFixed(1)),
  };
}
