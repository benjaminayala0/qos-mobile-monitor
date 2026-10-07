import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useQoSStore } from '../../src/store/useQoSStore';
import { executeFullQoSBenchmark } from '../../src/core/qosEngine';
import { colors } from '../../src/theme/colors';
import {
  registerBackgroundSamplingAsync,
  unregisterBackgroundSamplingAsync,
  isBackgroundSamplingRegisteredAsync,
} from '../../src/services/backgroundSampling';
import { requestNotificationPermissions } from '../../src/services/notificationService';

const RADIUS = 96;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function SpeedTestScreen() {
  const {
    testStage,
    liveMetrics,
    resetLiveMetrics,
    backendUrl,
    setBackendUrl,
    configuredHosts,
    selectedHost,
    setSelectedHost,
    multiHostResults,
  } = useQoSStore();

  const [showConfig, setShowConfig] = useState(false);
  const [customIp, setCustomIp] = useState(backendUrl);
  const [isBgSampling, setIsBgSampling] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    isBackgroundSamplingRegisteredAsync().then(setIsBgSampling);
  }, []);

  const handleToggleBgSampling = async (val: boolean) => {
    setIsBgSampling(val);
    if (val) {
      await requestNotificationPermissions();
      const ok = await registerBackgroundSamplingAsync();
      if (!ok) setIsBgSampling(false);
    } else {
      await unregisterBackgroundSamplingAsync();
    }
  };

  const isRunning =
    testStage === 'locating' ||
    testStage === 'pinging' ||
    testStage === 'downloading' ||
    testStage === 'uploading' ||
    testStage === 'saving';

  const handleStartTest = async () => {
    if (isRunning) return;
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    try {
      await executeFullQoSBenchmark();
    } catch (e) {
      console.error('Benchmark execution error:', e);
    }
  };

  const getActiveRingColor = () => {
    if (testStage === 'locating') return colors.pingColor; // #F59E0B (Amber/Yellow)
    if (testStage === 'pinging') return colors.pingColor; // #F59E0B (Amber/Yellow)
    if (testStage === 'downloading') return colors.downloadColor; // #00D2FF (Cyan Blue)
    if (testStage === 'uploading') return colors.uploadColor; // #A855F7 (Purple)
    if (testStage === 'saving') return colors.secondary; // #10B981 (Green)
    if (testStage === 'completed') return colors.secondary; // #10B981 (Green)
    return colors.primary;
  };

  const activeRingColor = getActiveRingColor();
  const progressRatio = Math.min(Math.max(liveMetrics.progressPct, 0), 100) / 100;
  const strokeDashoffset = CIRCUMFERENCE - progressRatio * CIRCUMFERENCE;

  const getPrimaryDisplayValue = () => {
    if (testStage === 'locating') return 'GPS FIX';
    if (testStage === 'pinging') return `${liveMetrics.pingAvg.toFixed(1)} ms`;
    if (testStage === 'downloading') return `${liveMetrics.downloadMbps.toFixed(1)} Mbps`;
    if (testStage === 'uploading') return `${liveMetrics.uploadMbps.toFixed(1)} Mbps`;
    if (testStage === 'saving') return 'SAVED';
    if (testStage === 'completed') return `${liveMetrics.downloadMbps.toFixed(1)} Mbps`;
    return '0.0 Mbps';
  };

  const getGaugeSublabel = () => {
    if (testStage === 'locating') return 'SATELLITE POSITIONING';
    if (testStage === 'pinging') return 'ROUND-TRIP TIME (LATENCY)';
    if (testStage === 'downloading') return 'DOWNLINK THROUGHPUT';
    if (testStage === 'uploading') return 'UPLINK THROUGHPUT';
    if (testStage === 'saving') return 'SQLITE PERSISTENCE';
    if (testStage === 'completed') return 'PEAK DOWNLOAD SPEED';
    return 'READY TO BENCHMARK';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>QoS Speed Benchmark</Text>
            <Text style={styles.subtitle}>RFC 2544 Active Probe & Throughput Runner</Text>
          </View>
          <TouchableOpacity
            style={styles.configToggle}
            onPress={() => setShowConfig(!showConfig)}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Server & Endpoint Config Card */}
        {showConfig && (
          <View style={styles.configCard}>
            <Text style={styles.configTitle}>Target Server & Host</Text>
            <View style={styles.hostPills}>
              {configuredHosts.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.hostPill, selectedHost === h && styles.hostPillActive]}
                  onPress={() => setSelectedHost(h)}
                >
                  <Text style={[styles.hostPillText, selectedHost === h && styles.hostPillTextActive]}>
                    {h}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.configSub}>Backend URL (LAN or Host IP):</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={customIp}
                onChangeText={setCustomIp}
                placeholder="http://192.168.1.XX:3001"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.saveIpButton}
                onPress={() => setBackendUrl(customIp)}
              >
                <Text style={styles.saveIpText}>Apply</Text>
              </TouchableOpacity>
            </View>

            {multiHostResults && multiHostResults.length > 0 && (
              <View style={styles.multiHostSection}>
                <Text style={styles.configSub}>Multi-Host RTT (RFC 2544 Comparison):</Text>
                <View style={styles.multiHostGrid}>
                  {multiHostResults.map((h) => (
                    <View key={h.hostId} style={styles.multiHostCard}>
                      <Text style={styles.multiHostTitle}>{h.hostName.split(' ')[0]}</Text>
                      <Text style={styles.multiHostVal}>{h.avg} ms</Text>
                      <Text style={styles.multiHostJitter}>Jitter: {h.jitter} ms</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Background QoS Sampling & Local Notifications */}
            <View style={styles.bgSamplingSection}>
              <View style={styles.bgSamplingHeader}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.configTitle}>Background Sampling (15m)</Text>
                  <Text style={styles.configSub}>
                    {isBgSampling ? 'Active · Periodic radio polling & alerts' : 'Disabled · Manual testing only'}
                  </Text>
                </View>
                <Switch
                  value={isBgSampling}
                  onValueChange={handleToggleBgSampling}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={isBgSampling ? colors.background : colors.textSecondary}
                />
              </View>
            </View>
          </View>
        )}

        {/* Speedometer Gauge Visualizer with Dynamic SVG Wheel */}
        <View style={styles.gaugeContainer}>
          <View style={styles.gaugeRingWrapper}>
            <Svg width={230} height={230}>
              {/* Inactive Background Track */}
              <Circle
                cx={115}
                cy={115}
                r={RADIUS}
                stroke={colors.cardSecondary}
                strokeWidth={10}
                fill="transparent"
              />
              {/* Active Color-Adaptive Progress Track */}
              <Circle
                cx={115}
                cy={115}
                r={RADIUS}
                stroke={activeRingColor}
                strokeWidth={10}
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 115 115)"
                fill="transparent"
              />
            </Svg>

            {/* Inner Content with Premium Celebratory Check Badge on Completion */}
            <View style={styles.gaugeCenterAbsolute}>
              {testStage === 'completed' ? (
                <View style={styles.completedBadgeWrap}>
                  <View style={styles.completedCheckHalo}>
                    <View style={styles.completedCheckBadge}>
                      <Ionicons name="checkmark-sharp" size={28} color="#0D1117" />
                    </View>
                  </View>
                  <View style={styles.completedTierChip}>
                    <Text style={styles.completedTierText}>EXCELLENT QoS GRADE</Text>
                  </View>
                  <Text style={styles.completedSpeedNumber}>
                    {liveMetrics.downloadMbps.toFixed(1)}
                    <Text style={styles.completedSpeedUnit}> Mbps</Text>
                  </Text>
                  <Text style={styles.completedSublabel}>PEAK DOWNLOAD SPEED</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.gaugeStageLabel}>{liveMetrics.stageLabel}</Text>
                  <Text style={[styles.gaugeValue, { color: activeRingColor }]}>
                    {getPrimaryDisplayValue()}
                  </Text>
                  <Text style={[styles.gaugeSublabel, { color: activeRingColor }]}>
                    {getGaugeSublabel()}
                  </Text>
                </>
              )}
            </View>
          </View>

        </View>

        {/* Action Controls (Visible during idle and running phases) */}
        {testStage !== 'completed' && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.startButton, isRunning && styles.startButtonDisabled]}
              disabled={isRunning}
              onPress={handleStartTest}
              activeOpacity={0.8}
            >
              {isRunning ? (
                <>
                  <ActivityIndicator color={colors.background} size="small" />
                  <Text style={styles.startButtonText}>Running Benchmark...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="play" size={20} color={colors.background} />
                  <Text style={styles.startButtonText}>Start Full Benchmark</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Real-time Metrics Grid (4 Core Telemetry Cards) */}
        <View style={styles.metricsGrid}>
          {/* Ping Card */}
          <View
            style={[
              styles.metricCard,
              testStage === 'pinging' && styles.metricCardActivePing,
            ]}
          >
            <View style={styles.metricHeader}>
              <Ionicons name="time-outline" size={18} color={colors.pingColor} />
              <Text style={styles.metricLabel}>RTT PING</Text>
            </View>
            <Text style={styles.metricBig}>{liveMetrics.pingAvg} ms</Text>
            <Text style={styles.metricSub}>
              Min: {liveMetrics.pingMin} · Max: {liveMetrics.pingMax} ms
            </Text>
          </View>

          {/* Jitter Card */}
          <View
            style={[
              styles.metricCard,
              testStage === 'pinging' && styles.metricCardActiveJitter,
            ]}
          >
            <View style={styles.metricHeader}>
              <Ionicons name="pulse-outline" size={18} color={colors.jitterColor} />
              <Text style={styles.metricLabel}>JITTER</Text>
            </View>
            <Text style={styles.metricBig}>{liveMetrics.jitter} ms</Text>
            <Text style={styles.metricSub}>RFC 2544 · Loss: {liveMetrics.packetLoss}%</Text>
          </View>

          {/* Downlink Card */}
          <View
            style={[
              styles.metricCard,
              testStage === 'downloading' && styles.metricCardActiveDown,
            ]}
          >
            <View style={styles.metricHeader}>
              <Ionicons name="cloud-download-outline" size={18} color={colors.downloadColor} />
              <Text style={styles.metricLabel}>DOWNLOAD</Text>
            </View>
            <Text style={styles.metricBig}>{liveMetrics.downloadMbps} Mbps</Text>
            <Text style={styles.metricSub}>Calibrated Downlink Stream</Text>
          </View>

          {/* Uplink Card */}
          <View
            style={[
              styles.metricCard,
              testStage === 'uploading' && styles.metricCardActiveUp,
            ]}
          >
            <View style={styles.metricHeader}>
              <Ionicons name="cloud-upload-outline" size={18} color={colors.uploadColor} />
              <Text style={styles.metricLabel}>UPLOAD</Text>
            </View>
            <Text style={styles.metricBig}>{liveMetrics.uploadMbps} Mbps</Text>
            <Text style={styles.metricSub}>Calibrated Uplink Stream</Text>
          </View>
        </View>

        {/* Single Action Button on Completion */}
        {testStage === 'completed' && (
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartTest}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={18} color={colors.background} />
            <Text style={styles.startButtonText}>Run Again</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 18,
    paddingBottom: 48,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  configToggle: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  configCard: {
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  configTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  hostPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hostPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hostPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  hostPillText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  hostPillTextActive: {
    color: colors.primary,
  },
  configSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.cardSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveIpButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveIpText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.background,
  },
  gaugeContainer: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 18,
  },
  gaugeRingWrapper: {
    width: 230,
    height: 230,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  gaugeCenterAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 2,
  },
  gaugeStageLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '700',
    height: 24,
    paddingHorizontal: 8,
  },
  gaugeValue: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
  },
  gaugeValueCompleted: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
    marginTop: 2,
  },
  gaugeSublabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gaugeSublabelCompleted: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  gaugeStageLabelCompleted: {
    fontSize: 11,
    color: colors.secondary,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  metricCardActivePing: {
    borderColor: colors.pingColor,
    backgroundColor: colors.pingColor + '18',
  },
  metricCardActiveJitter: {
    borderColor: colors.jitterColor,
    backgroundColor: colors.jitterColor + '18',
  },
  metricCardActiveDown: {
    borderColor: colors.downloadColor,
    backgroundColor: colors.downloadColor + '18',
  },
  metricCardActiveUp: {
    borderColor: colors.uploadColor,
    backgroundColor: colors.uploadColor + '18',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  metricBig: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  metricSub: {
    fontSize: 10,
    color: colors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  startButton: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  startButtonDisabled: {
    opacity: 0.7,
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.background,
  },
  completedBadgeWrap: {
    alignItems: 'center',
    gap: 3,
  },
  completedCheckHalo: {
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    padding: 4,
    borderRadius: 26,
    marginBottom: 2,
  },
  completedCheckBadge: {
    backgroundColor: colors.secondary,
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedTierChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: colors.secondary,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 2,
  },
  completedTierText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: 0.5,
  },
  completedSpeedNumber: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -1,
    textAlign: 'center',
  },
  completedSpeedUnit: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.secondary,
  },
  completedSublabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  multiHostSection: {
    gap: 6,
    marginTop: 6,
  },
  multiHostGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  multiHostCard: {
    flex: 1,
    backgroundColor: colors.cardSecondary,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 2,
  },
  multiHostTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  multiHostVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  multiHostJitter: {
    fontSize: 9,
    color: colors.textMuted,
  },
  bgSamplingSection: {
    backgroundColor: colors.cardSecondary,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  bgSamplingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
