import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, Heatmap } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { getHeatmapData, getMeasurements, QoSMeasurement } from '../../src/database/measurementsRepository';
import { colors, getSignalColor, getSignalQualityLabel } from '../../src/theme/colors';

export default function CoverageMapScreen() {
  const mapRef = useRef<MapView>(null);
  const [measurements, setMeasurements] = useState<QoSMeasurement[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<QoSMeasurement | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | '5G' | '4G' | '3G' | 'WIFI'>('ALL');

  useEffect(() => {
    loadMapPoints();
  }, [activeFilter]);

  const loadMapPoints = () => {
    const data = getMeasurements(activeFilter === 'ALL' ? undefined : { networkType: activeFilter });
    setMeasurements(data);
    if (data.length > 0 && !selectedPoint) {
      setSelectedPoint(data[0]);
    }
  };

  const handleLocateMe = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }, 800);
    } catch (e) {
      console.warn('GPS location error:', e);
    }
  };

  const heatmapPoints = measurements
    .filter((m) => m.latitude !== null && m.longitude !== null)
    .map((m) => ({
      latitude: m.latitude!,
      longitude: m.longitude!,
      weight: Math.min(Math.max((m.signal_strength_dbm + 120) / 60, 0.2), 1.0),
    }));

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Coverage Heatmap</Text>
          <Text style={styles.subtitle}>Georeferenced Signal Quality & Dead Zones</Text>
        </View>
        <View style={styles.pointsPill}>
          <Ionicons name="location-outline" size={14} color={colors.primary} />
          <Text style={styles.pointsText}>{measurements.length} Points</Text>
        </View>
      </View>

      {/* Network Type Filter Pills */}
      <View style={styles.filtersBar}>
        {(['ALL', '5G', '4G', '3G', 'WIFI'] as const).map((tech) => (
          <TouchableOpacity
            key={tech}
            style={[styles.filterPill, activeFilter === tech && styles.filterPillActive]}
            onPress={() => setActiveFilter(tech)}
          >
            <Text style={[styles.filterText, activeFilter === tech && styles.filterTextActive]}>
              {tech}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Interactive Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: -31.3945,
            longitude: -58.0215,
            latitudeDelta: 0.045,
            longitudeDelta: 0.045,
          }}
          userInterfaceStyle="dark"
        >
          {/* Heatmap Layer (Android & iOS) */}
          {heatmapPoints.length > 0 && Platform.OS !== 'web' && (
            <Heatmap
              points={heatmapPoints}
              radius={40}
              opacity={0.7}
              gradient={{
                colors: [colors.signalPoor, colors.signalFair, colors.signalGood, colors.signalExcellent],
                startPoints: [0.1, 0.4, 0.7, 1.0],
                colorMapSize: 256,
              }}
            />
          )}

          {/* Individual Survey Markers with Circles */}
          {measurements.map((m) => {
            if (!m.latitude || !m.longitude) return null;
            const markerColor = getSignalColor(m.signal_strength_dbm);

            return (
              <React.Fragment key={m.id}>
                <Circle
                  center={{ latitude: m.latitude, longitude: m.longitude }}
                  radius={200}
                  fillColor={markerColor + '30'}
                  strokeColor={markerColor}
                  strokeWidth={1}
                />
                <Marker
                  coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                  onPress={() => setSelectedPoint(m)}
                >
                  <View style={[styles.markerPin, { backgroundColor: markerColor }]}>
                    <Ionicons name="radio" size={12} color="#000" />
                  </View>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapView>

        {/* Floating GPS Button */}
        <TouchableOpacity
          style={styles.gpsFab}
          onPress={handleLocateMe}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={22} color={colors.primary} />
        </TouchableOpacity>

        {/* Selected Point Inspection Card */}
        {selectedPoint && (
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <View style={styles.infoCarrierBox}>
                <View style={[styles.statusDot, { backgroundColor: getSignalColor(selectedPoint.signal_strength_dbm) }]} />
                <Text style={styles.infoCarrierName}>{selectedPoint.operator}</Text>
                <Text style={styles.infoNetworkBadge}>{selectedPoint.network_type}</Text>
              </View>
              <Text style={[styles.infoDbmText, { color: getSignalColor(selectedPoint.signal_strength_dbm) }]}>
                {selectedPoint.signal_strength_dbm} dBm
              </Text>
            </View>

            <View style={styles.infoMetricsRow}>
              <View style={styles.infoMetric}>
                <Text style={styles.infoLabel}>Quality</Text>
                <Text style={styles.infoVal}>{getSignalQualityLabel(selectedPoint.signal_strength_dbm)}</Text>
              </View>
              <View style={styles.infoMetric}>
                <Text style={styles.infoLabel}>Latency</Text>
                <Text style={styles.infoVal}>{selectedPoint.ping_avg_ms} ms</Text>
              </View>
              <View style={styles.infoMetric}>
                <Text style={styles.infoLabel}>Download</Text>
                <Text style={styles.infoVal}>{selectedPoint.download_mbps} Mbps</Text>
              </View>
              <View style={styles.infoMetric}>
                <Text style={styles.infoLabel}>Jitter</Text>
                <Text style={styles.infoVal}>{selectedPoint.jitter_ms} ms</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
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
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pointsText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  filtersBar: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingBottom: 10,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
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
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
  },
  gpsFab: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 4,
  },
  infoCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    elevation: 5,
  },
  infoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoCarrierBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoCarrierName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  infoNetworkBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  infoDbmText: {
    fontSize: 16,
    fontWeight: '800',
  },
  infoMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.cardSecondary,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoMetric: {
    alignItems: 'center',
    gap: 2,
  },
  infoLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
