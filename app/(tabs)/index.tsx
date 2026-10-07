import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQoSStore } from '../../src/store/useQoSStore';
import { colors, getSignalColor, getSignalQualityLabel } from '../../src/theme/colors';
import { getAggregatedStats } from '../../src/database/measurementsRepository';

export default function DashboardScreen() {
  const router = useRouter();
  const network = useQoSStore((state) => state.network);
  const stats = getAggregatedStats();

  const signalColor = getSignalColor(network.signalDbm);
  const qualityLabel = getSignalQualityLabel(network.signalDbm);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>Network QoS Monitor</Text>
            <Text style={styles.appSubtitle}>Real-Time Telemetry & Radio Probing</Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: network.isConnected ? colors.secondary : colors.signalPoor }]}>
            <View style={[styles.statusDot, { backgroundColor: network.isConnected ? colors.secondary : colors.signalPoor }]} />
            <Text style={styles.statusText}>{network.isConnected ? 'ONLINE' : 'OFFLINE'}</Text>
          </View>
        </View>

        {/* Primary Telemetry Card */}
        <View style={styles.mainCard}>
          <View style={styles.mainCardHeader}>
            <View style={styles.carrierInfo}>
              <Ionicons
                name={network.type === 'WIFI' ? 'wifi' : 'radio-outline'}
                size={24}
                color={colors.primary}
              />
              <View>
                <Text style={styles.carrierName}>{network.operator}</Text>
                <Text style={styles.networkTech}>{network.type} Mobile Broadband</Text>
              </View>
            </View>
            <View style={[styles.qualityPill, { backgroundColor: signalColor + '20', borderColor: signalColor }]}>
              <Text style={[styles.qualityText, { color: signalColor }]}>{qualityLabel}</Text>
            </View>
          </View>

          {/* Signal Strength Gauge & Bar Indicator */}
          <View style={styles.gaugeContainer}>
            <View style={styles.dbmBox}>
              <Text style={[styles.dbmValue, { color: signalColor }]}>
                {network.signalDbm}
              </Text>
              <Text style={styles.dbmUnit}>dBm (RSSI)</Text>
            </View>

            {/* Signal Bars (1 to 5) */}
            <View style={styles.barsContainer}>
              {[1, 2, 3, 4, 5].map((bar) => {
                const isActive = bar <= network.signalLevel;
                return (
                  <View
                    key={bar}
                    style={[
                      styles.signalBar,
                      { height: 8 + bar * 6 },
                      isActive ? { backgroundColor: signalColor } : styles.signalBarInactive,
                    ]}
                  />
                );
              })}
            </View>
          </View>

          {/* Radio Specifications Grid */}
          <View style={styles.specGrid}>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Frequency Band</Text>
              <Text style={styles.specValue}>{network.frequencyMhz ? `${network.frequencyMhz} MHz (B3)` : 'B7 (2600 MHz)'}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Serving Cell ID</Text>
              <Text style={styles.specValue}>{network.cellId || 'eNodeB-4192'}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Protocol Layer</Text>
              <Text style={styles.specValue}>TCP/IP Sockets</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Duplexing Mode</Text>
              <Text style={styles.specValue}>FDD LTE</Text>
            </View>
          </View>
        </View>

        {/* Aggregated Benchmarks Card */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Local QoS Telemetry Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Ionicons name="documents-outline" size={20} color={colors.primary} />
              <Text style={styles.statNumber}>{stats.totalTests}</Text>
              <Text style={styles.statLabel}>Recorded Tests</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="time-outline" size={20} color={colors.pingColor} />
              <Text style={styles.statNumber}>{stats.avgPing} ms</Text>
              <Text style={styles.statLabel}>Avg RTT Ping</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="cloud-download-outline" size={20} color={colors.secondary} />
              <Text style={styles.statNumber}>{stats.avgDownload}</Text>
              <Text style={styles.statLabel}>Avg Mbps Down</Text>
            </View>
          </View>
        </View>

        {/* Action Button: Start Speed Test */}
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.8}
          onPress={() => router.push('/(tabs)/test')}
        >
          <Ionicons name="speedometer-outline" size={22} color={colors.background} />
          <Text style={styles.actionButtonText}>Launch Active QoS Benchmark</Text>
        </TouchableOpacity>
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
    marginBottom: 6,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  mainCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 18,
  },
  mainCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  carrierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  carrierName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  networkTech: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  qualityPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  qualityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  gaugeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardSecondary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dbmBox: {
    gap: 2,
  },
  dbmValue: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  dbmUnit: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 42,
  },
  signalBar: {
    width: 8,
    borderRadius: 4,
  },
  signalBarInactive: {
    backgroundColor: '#30363D',
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  specItem: {
    width: '47%',
    backgroundColor: colors.cardSecondary,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  specLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  specValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 3,
  },
  statsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.cardSecondary,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  statNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: 14,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.background,
  },
});
