import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQoSStore } from '../../src/store/useQoSStore';
import { executeFullQoSBenchmark } from '../../src/core/qosEngine';
import { colors } from '../../src/theme/colors';

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
  } = useQoSStore();

  const [showConfig, setShowConfig] = useState(false);
  const [customIp, setCustomIp] = useState(backendUrl);

  const isRunning = testStage === 'pinging' || testStage === 'downloading' || testStage === 'uploading';

  const handleStartTest = async () => {
    if (isRunning) return;
    try {
      await executeFullQoSBenchmark();
    } catch (e) {
      console.error('Benchmark execution error:', e);
    }
  };

  const getPrimaryDisplayValue = () => {
    if (testStage === 'downloading') return `${liveMetrics.downloadMbps.toFixed(1)} Mbps`;
    if (testStage === 'uploading') return `${liveMetrics.uploadMbps.toFixed(1)} Mbps`;
    if (testStage === 'pinging') return `${liveMetrics.pingAvg.toFixed(1)} ms`;
    if (testStage === 'completed') return `${liveMetrics.downloadMbps.toFixed(1)} Mbps`;
    return '0.0 Mbps';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
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

            <Text style={styles.configSub}>Backend URL (LAN or Emulator IP):</Text>
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
          </View>
        )}

        {/* Speedometer Gauge Visualizer */}
        <View style={styles.gaugeContainer}>
          <View style={styles.gaugeRing}>
            <View style={styles.gaugeCenter}>
              <Text style={styles.gaugeStageLabel}>{liveMetrics.stageLabel}</Text>
              <Text style={styles.gaugeValue}>{getPrimaryDisplayValue()}</Text>
              <Text style={styles.gaugeSublabel}>
                {testStage === 'uploading' ? 'UPLINK THROUGHPUT' : 'DOWNLINK SPEED'}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${liveMetrics.progressPct}%` }]} />
          </View>
        </View>

        {/* Real-time Metrics Grid */}
        <View style={styles.metricsGrid}>
          {/* Ping Card */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="time-outline" size={18} color={colors.pingColor} />
              <Text style={styles.metricLabel}>RTT PING</Text>
            </View>
            <Text style={styles.metricBig}>{liveMetrics.pingAvg} ms</Text>
            <Text style={styles.metricSub}>
              Min: {liveMetrics.pingMin} · Max: {liveMetrics.pingMax}
            </Text>
          </View>

          {/* Jitter Card */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="pulse-outline" size={18} color={colors.jitterColor} />
              <Text style={styles.metricLabel}>JITTER</Text>
            </View>
            <Text style={styles.metricBig}>{liveMetrics.jitter} ms</Text>
            <Text style={styles.metricSub}>Loss: {liveMetrics.packetLoss}%</Text>
          </View>

          {/* Downlink Card */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="cloud-download-outline" size={18} color={colors.downloadColor} />
              <Text style={styles.metricLabel}>DOWNLOAD</Text>
            </View>
            <Text style={styles.metricBig}>{liveMetrics.downloadMbps} Mbps</Text>
            <Text style={styles.metricSub}>Chunked 5 MB Stream</Text>
          </View>

          {/* Uplink Card */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="cloud-upload-outline" size={18} color={colors.uploadColor} />
              <Text style={styles.metricLabel}>UPLOAD</Text>
            </View>
            <Text style={styles.metricBig}>{liveMetrics.uploadMbps} Mbps</Text>
            <Text style={styles.metricSub}>Binary Sink 1 MB</Text>
          </View>
        </View>

        {/* Action Buttons */}
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
                <Text style={styles.startButtonText}>Running Probes...</Text>
              </>
            ) : (
              <>
                <Ionicons name="play" size={20} color={colors.background} />
                <Text style={styles.startButtonText}>
                  {testStage === 'completed' ? 'Run Again' : 'Start Full Benchmark'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {testStage === 'completed' && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetLiveMetrics}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
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
  gaugeRing: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 6,
    borderColor: colors.cardSecondary,
    borderTopColor: colors.primary,
    borderRightColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background + '80',
  },
  gaugeCenter: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
  },
  gaugeStageLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
    height: 24,
  },
  gaugeValue: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -1,
    textAlign: 'center',
  },
  gaugeSublabel: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cardSecondary,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
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
  resetButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
