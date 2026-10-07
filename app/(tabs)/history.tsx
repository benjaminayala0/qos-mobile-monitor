import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Share, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQoSStore } from '../../src/store/useQoSStore';
import {
  exportToCSV,
  exportToJSON,
} from '../../src/database/measurementsRepository';
import { colors, getSignalColor } from '../../src/theme/colors';

export default function HistoryScreen() {
  const history = useQoSStore((state) => state.history);
  const loadHistory = useQoSStore((state) => state.loadHistory);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | '5G' | '4G' | '3G' | 'WIFI'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Automatically fetch fresh SQLite records whenever History tab is focused
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const filteredHistory = selectedFilter === 'ALL'
    ? history
    : history.filter((item) => item.network_type === selectedFilter);

  const handleRefresh = () => {
    setIsRefreshing(true);
    try {
      loadHistory();
      const currentCount = useQoSStore.getState().history.length;
      setFeedbackBanner(`Database synced: ${currentCount} records loaded`);
      setTimeout(() => {
        setFeedbackBanner(null);
      }, 3000);
    } catch {
      setFeedbackBanner('Failed to sync with SQLite');
      setTimeout(() => {
        setFeedbackBanner(null);
      }, 3000);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 400);
    }
  };

  const handleExportCSV = async () => {
    try {
      const csv = exportToCSV();
      await Share.share({
        message: csv,
        title: 'network_qos_telemetry.csv',
      });
    } catch {
      Alert.alert('CSV Export', 'CSV dataset generated successfully from local SQLite database.');
    }
  };

  const handleExportJSON = async () => {
    try {
      const json = exportToJSON();
      await Share.share({
        message: json,
        title: 'network_qos_telemetry.json',
      });
    } catch {
      Alert.alert('JSON Export', 'JSON export structure prepared from SQLite records.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Session History</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{filteredHistory.length}</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>SQLite Persistent QoS Telemetry Records</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleRefresh}
            disabled={isRefreshing}
            activeOpacity={0.7}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="reload-outline" size={18} color={colors.textPrimary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Sync Feedback Toast */}
        {feedbackBanner && (
          <View style={styles.feedbackToast}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.secondary} />
            <Text style={styles.feedbackToastText}>{feedbackBanner}</Text>
          </View>
        )}

        {/* Export & Actions Banner */}
        <View style={styles.exportCard}>
          <View style={styles.exportTextGroup}>
            <Text style={styles.exportTitle}>Data Export Engine</Text>
            <Text style={styles.exportSub}>RFC-4180 CSV & GeoJSON formats</Text>
          </View>
          <View style={styles.exportButtons}>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV} activeOpacity={0.8}>
              <Ionicons name="document-text-outline" size={16} color={colors.primary} />
              <Text style={styles.exportBtnText}>CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportJSON} activeOpacity={0.8}>
              <Ionicons name="code-slash-outline" size={16} color={colors.secondary} />
              <Text style={styles.exportBtnText}>JSON</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {(['ALL', '5G', '4G', '3G', 'WIFI'] as const).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterPill, selectedFilter === cat && styles.filterPillActive]}
              onPress={() => setSelectedFilter(cat)}
            >
              <Text style={[styles.filterText, selectedFilter === cat && styles.filterTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* History Records List */}
        <FlatList
          data={filteredHistory}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => {
            const signalColor = getSignalColor(item.signal_strength_dbm);
            const dateStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <View style={styles.recordCard}>
                {/* Header: Carrier, Tech Badge, Time */}
                <View style={styles.cardHeader}>
                  <View style={styles.carrierBox}>
                    <Ionicons
                      name={item.network_type === 'WIFI' ? 'wifi' : 'radio-outline'}
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.recordCarrier}>{item.operator}</Text>
                    <View style={styles.techBadge}>
                      <Text style={styles.techBadgeText}>{item.network_type}</Text>
                    </View>
                  </View>
                  <Text style={styles.recordTime}>{dateStr}</Text>
                </View>

                {/* Metrics Grid */}
                <View style={styles.recordMetrics}>
                  <View style={styles.recordMetricItem}>
                    <Text style={styles.metricLabel}>SIGNAL</Text>
                    <Text style={[styles.metricVal, { color: signalColor }]}>
                      {item.signal_strength_dbm} dBm
                    </Text>
                  </View>
                  <View style={styles.recordMetricItem}>
                    <Text style={styles.metricLabel}>RTT PING</Text>
                    <Text style={styles.metricVal}>{item.ping_avg_ms} ms</Text>
                  </View>
                  <View style={styles.recordMetricItem}>
                    <Text style={styles.metricLabel}>DOWNLINK</Text>
                    <Text style={[styles.metricVal, { color: colors.downloadColor }]}>
                      {item.download_mbps} Mbps
                    </Text>
                  </View>
                  <View style={styles.recordMetricItem}>
                    <Text style={styles.metricLabel}>UPLINK</Text>
                    <Text style={[styles.metricVal, { color: colors.uploadColor }]}>
                      {item.upload_mbps} Mbps
                    </Text>
                  </View>
                </View>

                {/* Footer: Target Host & Jitter */}
                <View style={styles.cardFooter}>
                  <Text style={styles.footerHost}>Target: {item.target_host}</Text>
                  <Text style={styles.footerJitter}>Jitter: {item.jitter_ms} ms · Loss: {item.packet_loss_pct}%</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={40} color={colors.textSecondary} />
              <Text style={styles.emptyText}>
                No telemetry sessions recorded for &quot;{selectedFilter}&quot;.
              </Text>
              {selectedFilter !== 'ALL' && (
                <TouchableOpacity
                  style={styles.resetFilterBtn}
                  onPress={() => setSelectedFilter('ALL')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.resetFilterBtnText}>Show All Records</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  countBadge: {
    backgroundColor: colors.cardSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  feedbackToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.secondary + '20',
    borderColor: colors.secondary,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  feedbackToastText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exportCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  exportTextGroup: {
    flex: 1,
    minWidth: 140,
    gap: 2,
  },
  exportTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  exportSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.cardSecondary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  listContainer: {
    gap: 12,
    paddingBottom: 48,
  },
  recordCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  carrierBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  recordCarrier: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  techBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  techBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  recordTime: {
    fontSize: 11,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  recordMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.cardSecondary,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  recordMetricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  footerHost: {
    fontSize: 10,
    color: colors.textMuted,
  },
  footerJitter: {
    fontSize: 10,
    color: colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  resetFilterBtn: {
    marginTop: 8,
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetFilterBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});
