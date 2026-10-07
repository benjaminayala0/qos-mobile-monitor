import {
  calculateRfc3550Jitter,
  calculateThroughputMbps,
  calculateRfc2544Stats,
} from '../qosMath.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, extra?: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${testName}`);
  } else {
    failed++;
    console.error(`  FAIL: ${testName} ${extra ? `-> ${extra}` : ''}`);
  }
}

function runTests() {
  console.log('Testing Throughput Formulas (Mbps):');
  const fiveMbBytes = 5 * 1024 * 1024;
  assert(calculateThroughputMbps(fiveMbBytes, 1.0) === 41.94, '5MB in 1.0s equals 41.94 Mbps');
  assert(calculateThroughputMbps(10 * 1024 * 1024, 2.0) === 41.94, '10MB in 2.0s equals 41.94 Mbps');
  assert(calculateThroughputMbps(250 * 1024, 0.5) === 4.1, '250KB in 0.5s equals 4.10 Mbps');
  assert(calculateThroughputMbps(0, 5) === 0, 'Zero bytes returns 0 Mbps');
  assert(calculateThroughputMbps(1000, 0) === 0, 'Zero duration returns 0 Mbps');
  assert(calculateThroughputMbps(1000, -1) === 0, 'Negative duration returns 0 Mbps');

  console.log('\nTesting RFC 3550 / RFC 2544 Jitter Filter:');
  assert(calculateRfc3550Jitter([30, 30, 30, 30, 30]) === 0, 'Constant latency produces 0 ms jitter');
  assert(calculateRfc3550Jitter([40]) === 0, 'Single sample produces 0 ms jitter');
  assert(calculateRfc3550Jitter([]) === 0, 'Empty series produces 0 ms jitter');
  assert(calculateRfc3550Jitter([20, 25, 22, 30, 24]) === 5.13, 'Applies RFC 3550 filter gain 1/16 to [20,25,22,30,24]');
  assert(calculateRfc3550Jitter([20, 80, 20, 20, 20, 20, 20, 20]) < 60, 'Decays jitter after stabilization');

  console.log('\nTesting RFC 2544 Statistics:');
  const stats = calculateRfc2544Stats([15.2, 22.8, 18.4, 25.0, 31.6], 5);
  assert(stats.min === 15.2, 'Calculates min latency: 15.2 ms');
  assert(stats.max === 31.6, 'Calculates max latency: 31.6 ms');
  assert(stats.avg === 22.6, 'Calculates average latency: 22.6 ms');
  assert(stats.lossPct === 0, 'Reports 0% packet loss when all probes reply');
  assert(stats.jitter > 0, 'Calculates positive jitter');

  const lossStats = calculateRfc2544Stats([20.0, 24.0], 5);
  assert(lossStats.lossPct === 60, 'Calculates 60% packet loss for 3/5 dropped packets');

  const outageStats = calculateRfc2544Stats([], 5);
  assert(outageStats.lossPct === 100, 'Calculates 100% loss on full timeout');
  assert(outageStats.avg === 0, 'Outage reports 0 ms average latency');

  console.log(`\nTests finished: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runTests();
