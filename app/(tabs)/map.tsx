import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import MapView, { Marker, Circle, Heatmap } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { getMeasurements, QoSMeasurement } from '../../src/database/measurementsRepository';
import { colors, getSignalColor, getSignalQualityLabel } from '../../src/theme/colors';

export default function CoverageMapScreen() {
  const mapRef = useRef<MapView>(null);
  const [measurements, setMeasurements] = useState<QoSMeasurement[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<QoSMeasurement | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | '5G' | '4G' | '3G' | 'WIFI'>('ALL');
  const [isLocating, setIsLocating] = useState(false);

  const loadMapPoints = useCallback(() => {
    const data = getMeasurements(activeFilter === 'ALL' ? undefined : { networkType: activeFilter });
    setMeasurements(data);
  }, [activeFilter]);

  useFocusEffect(
    useCallback(() => {
      loadMapPoints();
    }, [loadMapPoints])
  );

  // Request location permission and center on device position on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const cached = await Location.getLastKnownPositionAsync();
          if (cached && isMounted && mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: cached.coords.latitude,
              longitude: cached.coords.longitude,
              latitudeDelta: 0.03,
              longitudeDelta: 0.03,
            }, 800);
          }
          const fresh = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>((res) => setTimeout(() => res(null), 4000)),
          ]);
          if (fresh && isMounted && mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: fresh.coords.latitude,
              longitude: fresh.coords.longitude,
              latitudeDelta: 0.03,
              longitudeDelta: 0.03,
            }, 800);
          }
        }
      } catch (err) {
        console.warn('Initial location request error:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLocateMe = async () => {
    if (isLocating) return;
    setIsLocating(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'Please enable location permissions in device settings to center the map on your position.'
        );
        setIsLocating(false);
        return;
      }

      // Step 1: Instant cache resolution for immediate UI response
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        mapRef.current?.animateToRegion({
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        }, 800);
      }

      // Step 2: Fresh position query with 4-second race timeout to prevent hanging indoors
      const freshLoc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((res) => setTimeout(() => res(null), 4000)),
      ]);

      if (freshLoc) {
        mapRef.current?.animateToRegion({
          latitude: freshLoc.coords.latitude,
          longitude: freshLoc.coords.longitude,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        }, 800);
      } else if (!last) {
        Alert.alert('GPS Notice', 'Could not obtain a GPS fix. Please ensure location services are turned on.');
      }
    } catch (e) {
      console.warn('GPS location error:', e);
      Alert.alert('Location Error', 'An unexpected error occurred while requesting GPS position.');
    } finally {
      setIsLocating(false);
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

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          showsUserLocation={true}
          showsMyLocationButton={false}
          initialRegion={{
            latitude: measurements[0]?.latitude ?? -31.3945,
            longitude: measurements[0]?.longitude ?? -58.0215,
            latitudeDelta: 0.045,
            longitudeDelta: 0.045,
          }}
          userInterfaceStyle="dark"
        >
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

        {/* Overlaid Signal Quality Legend Bar */}
        <View style={styles.legendBar}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.signalExcellent }]} />
            <Text style={styles.legendText}>&gt;-80 dBm</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.signalGood }]} />
            <Text style={styles.legendText}>-80..-95</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.signalFair }]} />
            <Text style={styles.legendText}>-95..-105</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.signalPoor }]} />
            <Text style={styles.legendText}>&lt;-105 (Dead)</Text>
          </View>
        </View>

        {/* Floating Locate Button */}
        <TouchableOpacity
          style={styles.gpsFab}
          onPress={handleLocateMe}
          disabled={isLocating}
          activeOpacity={0.8}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="locate" size={22} color={colors.primary} />
          )}
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
              <View style={styles.headerRightBox}>
                <Text style={[styles.infoDbmText, { color: getSignalColor(selectedPoint.signal_strength_dbm) }]}>
                  {selectedPoint.signal_strength_dbm} dBm
                </Text>
                <TouchableOpacity onPress={() => setSelectedPoint(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
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
  legendBar: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(22, 27, 34, 0.92)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  gpsFab: {
    position: 'absolute',
    top: 54,
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
  headerRightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
