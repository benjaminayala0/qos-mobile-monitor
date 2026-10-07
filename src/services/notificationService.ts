import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let lastNotificationTime: Record<string, number> = {};
const COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes cooldown between repeated alerts

export interface QoSDegradationAlert {
  type: 'signal' | 'loss' | 'jitter' | 'latency';
  title: string;
  body: string;
}

/**
 * Requests local notification permissions if not already granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.warn('Error requesting notification permissions:', err);
    return false;
  }
}

/**
 * Checks QoS metrics against telecommunication degradation thresholds
 * and dispatches a local system notification if a threshold is breached.
 */
export async function evaluateQoSAndNotify(metrics: {
  signalDbm: number;
  packetLossPct: number;
  jitterMs: number;
  pingAvgMs: number;
  operator?: string;
}): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const now = Date.now();
  let alert: QoSDegradationAlert | null = null;

  // 1. Critical Signal Attenuation (< -105 dBm)
  if (metrics.signalDbm <= -105 && metrics.signalDbm > -140) {
    if (!lastNotificationTime['signal'] || now - lastNotificationTime['signal'] > COOLDOWN_MS) {
      alert = {
        type: 'signal',
        title: '⚠️ Severe Signal Degradation',
        body: `Cellular RSSI dropped to ${metrics.signalDbm} dBm (${metrics.operator || 'Mobile Network'}). You have entered a low-coverage blind spot.`,
      };
      lastNotificationTime['signal'] = now;
    }
  }

  // 2. High Packet Loss (> 15%)
  else if (metrics.packetLossPct >= 15) {
    if (!lastNotificationTime['loss'] || now - lastNotificationTime['loss'] > COOLDOWN_MS) {
      alert = {
        type: 'loss',
        title: '🔴 Critical Packet Loss Detected',
        body: `Observed ${metrics.packetLossPct.toFixed(1)}% packet drop on active link. Voice and video streams will experience buffering or call drops.`,
      };
      lastNotificationTime['loss'] = now;
    }
  }

  // 3. Jitter Anomaly RFC 3550 (> 25 ms)
  else if (metrics.jitterMs >= 25) {
    if (!lastNotificationTime['jitter'] || now - lastNotificationTime['jitter'] > COOLDOWN_MS) {
      alert = {
        type: 'jitter',
        title: '⚡ High Jitter Anomaly',
        body: `RFC 2544 Jitter spiked to ${metrics.jitterMs.toFixed(1)} ms. Route latency instability detected.`,
      };
      lastNotificationTime['jitter'] = now;
    }
  }

  // 4. Excessive RTT Latency (> 250 ms)
  else if (metrics.pingAvgMs >= 250) {
    if (!lastNotificationTime['latency'] || now - lastNotificationTime['latency'] > COOLDOWN_MS) {
      alert = {
        type: 'latency',
        title: '🐢 High Round-Trip Latency',
        body: `Average ping reached ${metrics.pingAvgMs.toFixed(0)} ms. Interactive services may feel unresponsive.`,
      };
      lastNotificationTime['latency'] = now;
    }
  }

  if (alert) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: alert.title,
          body: alert.body,
          sound: true,
          data: { type: alert.type, timestamp: now },
        },
        trigger: null, // deliver immediately
      });
      return true;
    } catch (err) {
      console.warn('Failed to schedule local QoS alert:', err);
      return false;
    }
  }

  return false;
}
