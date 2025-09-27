import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRoute } from '@/contexts/RouteContext';

export default function ProfileScreen() {
  const { currentRoute, isAnalyzing } = useRoute();

  // Debug logging to understand profile state
  React.useEffect(() => {
    console.log('👤 Profile screen - route state:', {
      hasRoute: !!currentRoute,
      hasProfile: !!currentRoute?.profile,
      isAnalyzing,
      routeName: currentRoute?.name,
      profileSegments: currentRoute?.profile?.segments?.length || 0,
      hasGlareAnalysis: !!currentRoute?.profile?.glareAnalysis,
      profileError: currentRoute?.profile?.error
    });
  }, [currentRoute, isAnalyzing]);

  const getGlareColor = (glareScore: number) => {
    if (glareScore >= 0.7) return '#FF3B30'; // Red for high glare
    if (glareScore >= 0.3) return '#FF9500'; // Orange for medium glare
    return '#34C759'; // Green for low glare
  };

  const getGlareRiskText = (riskLevel: 'low' | 'medium' | 'high') => {
    switch (riskLevel) {
      case 'high': return 'High Risk';
      case 'medium': return 'Medium Risk';
      case 'low': return 'Low Risk';
      default: return 'Unknown';
    }
  };

  const copyToClipboard = async () => {
    if (!currentRoute?.profile) {
      Alert.alert('No Data', 'No route profile data available to copy');
      return;
    }

    try {
      // Create a clean JSON object for development use
      const profileData = {
        route: {
          name: currentRoute.name,
          start: currentRoute.start,
          end: currentRoute.end,
          departureTime: currentRoute.departureTime,
        },
        profile: {
          totalDistance: currentRoute.profile.totalDistance,
          totalDuration: currentRoute.profile.totalDuration,
          segmentCount: currentRoute.profile.segments.length,
          segments: currentRoute.profile.segments.map((segment, index) => ({
            index,
            instruction: segment.instruction,
            distance: segment.distance,
            duration: segment.duration,
            pointCount: segment.points.length,
            startPoint: segment.points[0],
            endPoint: segment.points[segment.points.length - 1],
            allPoints: segment.points, // All lat/lng points for this road segment
          })),
          polylinePoints: currentRoute.profile.polylinePoints,
          totalPoints: currentRoute.profile.polylinePoints.length,
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          purpose: 'Sun glare detection development',
          description: 'Route segments with lat/lng points for each stretch of road',
        },
      };

      const jsonString = JSON.stringify(profileData, null, 2);

      // For now, just show in alert (you could use Clipboard API in production)
      Alert.alert(
        'Profile Data',
        'Route profile data has been formatted. Check console for full JSON.',
        [{ text: 'OK' }]
      );

      console.log('Route Profile JSON:', jsonString);
    } catch (error) {
      Alert.alert('Error', 'Failed to process profile data');
    }
  };

  // Helper added above renderProfileSummary
  const getWeightedAvgGlare = (segments: any[] = []) => {
    const totalDuration = segments.reduce((sum, s) => sum + (s?.duration || 0), 0);
    if (!totalDuration) return 0;
    const weightedSum = segments.reduce(
      (sum, s) => sum + ((s?.avgGlareScore || 0) * (s?.duration || 0)),
      0
    );
    return weightedSum / totalDuration;
  };

  const renderProfileSummary = () => {
    if (!currentRoute?.profile) return null;

    const profile = currentRoute.profile;
    const weightedAvg = getWeightedAvgGlare(profile.segments);

    return (
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Route Profile Summary</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Distance:</Text>
          <Text style={styles.summaryValue}>
            {(profile.totalDistance / 1000).toFixed(2)} km
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Duration:</Text>
          <Text style={styles.summaryValue}>
            {Math.round(profile.totalDuration / 60)} min
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Road Segments:</Text>
          <Text style={styles.summaryValue}>{profile.segments.length}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Points:</Text>
          <Text style={styles.summaryValue}>{profile.polylinePoints.length}</Text>
        </View>

        {/* New weighted glare row */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Avg Glare Score (weighted):</Text>
          <Text
            style={[
              styles.summaryValue,
              { color: getGlareColor(weightedAvg) }
            ]}
          >
            {(weightedAvg * 100).toFixed(1)}%
          </Text>
        </View>

        {profile.glareAnalysis && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>High Glare Points:</Text>
            <Text style={styles.summaryValue}>
              {profile.glareAnalysis.highGlarePoints}
            </Text>
          </View>
        )}
      </View>
    );
  };


  const renderSegmentsList = () => {
    if (!currentRoute?.profile?.segments) return null;

    return (
      <View style={styles.segmentsContainer}>
        <Text style={styles.segmentsTitle}>Route Segments</Text>
        {currentRoute.profile.segments.map((segment, index) => (
          <View key={index} style={styles.segmentCard}>
            <View style={styles.segmentHeader}>
              <Text style={styles.segmentIndex}>Segment {index + 1}</Text>
              <Text style={styles.segmentDistance}>
                {(segment.distance / 1000).toFixed(2)} km
              </Text>
            </View>

            <Text style={styles.segmentInstruction}>{segment.instruction}</Text>

            <View style={styles.segmentDetails}>
              <Text style={styles.segmentDetail}>
                Points: {segment.points.length}
              </Text>
              <Text style={styles.segmentDetail}>
                Duration: {Math.round(segment.duration / 60)} min
              </Text>
              {segment.avgGlareScore !== undefined && (
                <Text style={styles.segmentDetail}>
                  Avg Glare: <Text style={{ color: getGlareColor(segment.avgGlareScore) }}>
                    {(segment.avgGlareScore * 100).toFixed(1)}%
                  </Text>
                </Text>
              )}
            </View>

            {segment.glareRiskLevel && (
              <View style={styles.glareRiskContainer}>
                <Text style={styles.glareRiskLabel}>Sun Glare Risk:</Text>
                <Text style={[styles.glareRiskValue, { color: getGlareColor(segment.avgGlareScore || 0) }]}>
                  {getGlareRiskText(segment.glareRiskLevel)}
                </Text>
              </View>
            )}

            <View style={styles.segmentCoords}>
              <Text style={styles.coordLabel}>Start:</Text>
              <Text style={styles.coordValue}>
                {segment.points[0]?.lat.toFixed(6)}, {segment.points[0]?.lng.toFixed(6)}
              </Text>
            </View>

            <View style={styles.segmentCoords}>
              <Text style={styles.coordLabel}>End:</Text>
              <Text style={styles.coordValue}>
                {segment.points[segment.points.length - 1]?.lat.toFixed(6)}, {segment.points[segment.points.length - 1]?.lng.toFixed(6)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <IconSymbol name="list.bullet" size={32} color="#FFA500" />
            <Text style={styles.title}>Route Profile</Text>
          </View>
          <Text style={styles.subtitle}>Development & Sun Glare Analysis</Text>
        </View>

        {!currentRoute ? (
          <View style={styles.emptyState}>
            <IconSymbol name="magnifyingglass" size={48} color="#666" />
            <Text style={styles.emptyTitle}>No Route Analyzed</Text>
            <Text style={styles.emptySubtitle}>
              Analyze a route in the Sunglare tab to see detailed profile data
            </Text>
          </View>
        ) : !currentRoute.profile ? (
          <View style={styles.emptyState}>
            <IconSymbol name="globe" size={48} color="#666" />
            <Text style={styles.emptyTitle}>Loading Profile Data</Text>
            <Text style={styles.emptySubtitle}>
              {isAnalyzing ? 'Analyzing route...' : 'Profile data will appear when route is fully loaded'}
            </Text>
          </View>
        ) : currentRoute.profile?.error ? (
          <View style={styles.emptyState}>
            <IconSymbol name="magnifyingglass" size={48} color="#FF6B6B" />
            <Text style={styles.emptyTitle}>Profile Processing Error</Text>
            <Text style={styles.emptySubtitle}>
              {currentRoute.profile?.error}
            </Text>
            <TouchableOpacity style={styles.exportButton} onPress={() => {
              Alert.alert('Debug Info', JSON.stringify(currentRoute.profile?.rawDirectionsData || {}, null, 2));
            }}>
              <Text style={styles.exportButtonText}>View Debug Data</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.routeInfo}>
              <Text style={styles.routeName}>{currentRoute.name}</Text>
              <Text style={styles.routeDetails}>
                From: {currentRoute.start.address || `${currentRoute.start.latitude}, ${currentRoute.start.longitude}`}
              </Text>
              <Text style={styles.routeDetails}>
                To: {currentRoute.end.address || `${currentRoute.end.latitude}, ${currentRoute.end.longitude}`}
              </Text>
            </View>

            {renderProfileSummary()}

            <TouchableOpacity style={styles.exportButton} onPress={copyToClipboard}>
              <View style={styles.buttonContent}>
                <IconSymbol name="paperplane.fill" size={18} color="#fff" />
                <Text style={styles.exportButtonText}>Export JSON Profile</Text>
              </View>
            </TouchableOpacity>

            {renderSegmentsList()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 22,
  },
  routeInfo: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  routeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  routeDetails: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 4,
  },
  summaryCard: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#aaa',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFA500',
  },
  exportButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  segmentsContainer: {
    marginTop: 10,
  },
  segmentsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  segmentCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  segmentIndex: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFA500',
  },
  segmentDistance: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  segmentInstruction: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 12,
    lineHeight: 18,
  },
  segmentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  segmentDetail: {
    fontSize: 12,
    color: '#aaa',
  },
  segmentCoords: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  coordLabel: {
    fontSize: 12,
    color: '#aaa',
    width: 40,
  },
  coordValue: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'monospace',
  },
  glareRiskContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  glareRiskLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFA500',
  },
  glareRiskValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});
