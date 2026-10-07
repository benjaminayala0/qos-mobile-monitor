import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { fetchTelephonyInfo } from '../native/telephonyAdapter';
import { runPingProbe } from '../core/qosEngine';
import { saveMeasurement } from '../database/measurementsRepository';
import { evaluateQoSAndNotify } from './notificationService';

export const BACKGROUND_QOS_TASK = 'BACKGROUND_NETWORK_QOS_SAMPLING';

// Define the background execution task handler
TaskManager.defineTask(BACKGROUND_QOS_TASK, async () => {
  try {
    const timestamp = Date.now();
    const telephony = await fetchTelephonyInfo();

    // Quick location check using last known position to preserve battery
    let coords: { latitude: number; longitude: number } | null = null;
    try {
      const loc = await Location.getLastKnownPositionAsync();
      if (loc) {
        coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }
    } catch {
      // Continue without coordinates if unavailable in background
    }

    // Lightweight 3-sample ping probe against Cloudflare DNS
    const probe = await runPingProbe('https://1.1.1.1/cdn-cgi/trace', 3);

    // Save background sample to SQLite
    await saveMeasurement({
      session_id: 'bg-sampling',
      timestamp,
      network_type: telephony.type,
      operator: telephony.operator,
      signal_strength_dbm: telephony.signalDbm,
      signal_level: telephony.signalLevel,
      latitude: coords ? coords.latitude : null,
      longitude: coords ? coords.longitude : null,
      ping_min_ms: probe.min,
      ping_avg_ms: probe.avg,
      ping_max_ms: probe.max,
      jitter_ms: probe.jitter,
      packet_loss_pct: probe.lossPct,
      download_mbps: 0,
      upload_mbps: 0,
      target_host: '1.1.1.1 (Background)',
    });

    // Check for degradation and trigger local alert if needed
    await evaluateQoSAndNotify({
      signalDbm: telephony.signalDbm,
      packetLossPct: probe.lossPct,
      jitterMs: probe.jitter,
      pingAvgMs: probe.avg,
      operator: telephony.operator,
    });

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    console.warn('Background QoS sampling error:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Registers the background QoS sampling task with an interval of 15 minutes.
 */
export async function registerBackgroundSamplingAsync(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_QOS_TASK);
    if (isRegistered) return true;

    await BackgroundFetch.registerTaskAsync(BACKGROUND_QOS_TASK, {
      minimumInterval: 15 * 60, // 15 minutes in seconds
      stopOnTerminate: false,    // Continue running after app is closed (Android)
      startOnBoot: true,         // Auto-start on device reboot
    });

    return true;
  } catch (err) {
    console.warn('Failed to register background sampling task:', err);
    return false;
  }
}

/**
 * Unregisters the background QoS sampling task.
 */
export async function unregisterBackgroundSamplingAsync(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_QOS_TASK);
    if (!isRegistered) return true;

    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_QOS_TASK);
    return true;
  } catch (err) {
    console.warn('Failed to unregister background sampling task:', err);
    return false;
  }
}

/**
 * Checks whether the background QoS task is currently registered with the OS.
 */
export async function isBackgroundSamplingRegisteredAsync(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_QOS_TASK);
  } catch {
    return false;
  }
}
