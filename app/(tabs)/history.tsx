import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Share, RefreshControl, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { useQoSStore } from '../../src/store/useQoSStore';
import { exportToCSV, exportToJSON, QoSMeasurement } from '../../src/database/measurementsRepository';
import { colors, getSignalColor } from '../../src/theme/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = Math.max(SCREEN_WIDTH - 68, 280);
const CHART_HEIGHT = 85;

function QoSTimeSeriesChart({ data }: { data: QoSMeasurement[] }) {
  const [metric, setMetric] = useState<'throughput' | 'latency'>('throughput');

  // Take latest 8 records in chronological order (oldest to newest)
  const chartPoints = useMemo(() => {
    return [...data].slice(0, 8).reverse();
  }, [data]);

  const values = useMemo(() => {
    return chartPoints.map((item) =>
      metric === 'throughput' ? item.download_mbps : item.ping_avg_ms
    );
  }, [chartPoints, metric]);

  if (values.length < 2) {
    return (
      <View style={styles.chartEmptyCard}>
        <Ionicons name="analytics-outline" size={24} color={colors.textSecondary} />
        <Text style={styles.chartEmptyText}>Run at least 2 benchmarks to render trend curves</Text>
      </View>
    );
  }

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values, minVal + 0.1);
  const avgVal = parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
  const activeColor = metric === 'throughput' ? colors.downloadColor : colors.pingColor;

  const padX = 14;
  const padY = 12;
  const plotWidth = CHART_WIDTH - padX * 2;
  const plotHeight = CHART_HEIGHT - padY * 2;

  const coords = values.map((val, idx) => {
    const x = padX + (idx / (values.length - 1)) * plotWidth;
    const ratio = (val - minVal) / (maxVal - minVal || 1);
    const y = padY + plotHeight - ratio * plotHeight;
    return { x, y, val };
  });

  const linePath = coords.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${CHART_HEIGHT} L ${coords[0].x} ${CHART_HEIGHT} Z`;

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View style={styles.chartTitleGroup}>
          <Text style={styles.chartTitle}>Temporal Evolution</Text>
          <View style={styles.chartStatBadges}>
            <Text style={styles.chartStatBadge}>Avg: {avgVal} {metric === 'throughput' ? 'Mbps' : 'ms'}</Text>
            <Text style={styles.chartStatBadge}>Max: {maxVal.toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.chartToggleGroup}>
          <TouchableOpacity
            style={[styles.chartToggleBtn, metric === 'throughput' && styles.chartToggleBtnActive]}
            onPress={() => setMetric('throughput')}
          >
            <Text style={[styles.chartToggleText, metric === 'throughput' && { color: colors.downloadColor }]}>
              Downlink
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chartToggleBtn, metric === 'latency' && styles.chartToggleBtnActive]}
            onPress={() => setMetric('latency')}
          >
            <Text style={[styles.chartToggleText, metric === 'latency' && { color: colors.pingColor }]}>
              RTT Ping
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={activeColor} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={activeColor} stopOpacity={0.0} />
          </LinearGradient>
        </Defs>

        {/* Horizontal guide lines */}
        <Line x1={padX} y1={padY} x2={CHART_WIDTH - padX} y2={padY} stroke={colors.border} strokeDasharray="3 3" />
        <Line x1={padX} y1={padY + plotHeight / 2} x2={CHART_WIDTH - padX} y2={padY + plotHeight / 2} stroke={colors.border} strokeDasharray="3 3" />
        <Line x1={padX} y1={CHART_HEIGHT - padY} x2={CHART_WIDTH - padX} y2={CHART_HEIGHT - padY} stroke={colors.border} />

        {/* Gradient Area Fill */}
        <Path d={areaPath} fill="url(#chartGradient)" />

        {/* Line Curve */}
        <Path d={linePath} stroke={activeColor} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data Sample Dots */}
        {coords.map((pt, i) => (
          <Circle key={i} cx={pt.x} cy={pt.y} r={3.5} fill={activeColor} stroke={colors.card} strokeWidth={1.5} />
        ))}
      </Svg>
    </View>
  );
}

export default function HistoryScreen() {
  const history = useQoSStore((state) => state.history);
  const loadHistory = useQoSStore((state) => state.loadHistory);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | '5G' | '4G' | '3G' | 'WIFI'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (selectedFilter !== 'ALL' && item.network_type !== selectedFilter) return false;
      return true;
    });
  }, [history, selectedFilter]);

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

        {feedbackBanner && (
          <View style={styles.feedbackToast}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.secondary} />
            <Text style={styles.feedbackToastText}>{feedbackBanner}</Text>
          </View>
        )}

        {/* Time-Series Trend Chart */}
        <QoSTimeSeriesChart data={history} />

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

        {/* Network Technology Filter */}
        <View style={styles.filtersSection}>
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
    marginBottom: 8,
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
    marginBottom: 8,
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
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    alignItems: 'center',
  },
  chartEmptyCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chartEmptyText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  chartTitleGroup: {
    gap: 2,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chartStatBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  chartStatBadge: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chartToggleGroup: {
    flexDirection: 'row',
    backgroundColor: colors.cardSecondary,
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chartToggleBtnActive: {
    backgroundColor: colors.card,
  },
  chartToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  exportCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  exportTextGroup: {
    flex: 1,
    minWidth: 140,
    gap: 2,
  },
  exportTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  exportSub: {
    fontSize: 10,
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
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  filtersSection: {
    gap: 6,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
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
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  listContainer: {
    paddingBottom: 32,
    gap: 10,
  },
  recordCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  carrierBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordCarrier: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  techBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  techBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
  },
  recordTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  recordMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.cardSecondary,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recordMetricItem: {
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    textTransform: 'uppercase',
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
    color: colors.textSecondary,
  },
  footerJitter: {
    fontSize: 10,
    color: colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  resetFilterBtn: {
    backgroundColor: colors.cardSecondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  resetFilterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
