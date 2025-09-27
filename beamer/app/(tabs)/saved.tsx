import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSavedLocations, SavedLocation } from '@/contexts/SavedLocationsContext';
import { useRoute } from '@/contexts/RouteContext';

export default function SavedLocationsScreen() {
  const { savedLocations, updateSavedLocation, deleteSavedLocation, refreshSavedLocations } = useSavedLocations();
  const { setCurrentRoute, setIsAnalyzing, departureTime } = useRoute();
  const router = useRouter();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingLocation, setEditingLocation] = useState<SavedLocation | null>(null);
  const [editName, setEditName] = useState('');
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

  // Refresh saved locations when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      refreshSavedLocations();
    }, [refreshSavedLocations])
  );

  const deleteLocation = (id: string) => {
    Alert.alert(
      'Delete Location',
      'Are you sure you want to delete this saved location?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSavedLocation(id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete location');
            }
          },
        },
      ]
    );
  };

  const editLocation = (location: SavedLocation) => {
    setEditingLocation(location);
    setEditName(location.name);
    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (!editingLocation || !editName.trim()) return;

    try {
      await updateSavedLocation(editingLocation.id, { name: editName.trim() });
      setEditModalVisible(false);
      setEditingLocation(null);
      setEditName('');
    } catch (error) {
      Alert.alert('Error', 'Failed to update location name');
    }
  };

  const analyzeLocation = async (location: SavedLocation) => {
    setAnalyzingIds(prev => new Set(prev.add(location.id)));

    try {
      // Create route data for the Maps tab
      const routeData = {
        start: {
          latitude: location.startCoordinates.latitude,
          longitude: location.startCoordinates.longitude,
          address: location.startAddress,
        },
        end: {
          latitude: location.endCoordinates.latitude,
          longitude: location.endCoordinates.longitude,
          address: location.endAddress,
        },
        name: location.name,
        departureTime: departureTime.toISOString(),
      };

      // Set the route in context and navigate to Maps tab
      setCurrentRoute(routeData);
      setIsAnalyzing(true);
      
      // Navigate to the maps tab
      router.push('/maps');
      
      // Add a timeout fallback to clear loading state if something goes wrong
      setTimeout(() => {
        setIsAnalyzing(false);
        console.log('Saved location analysis timeout - clearing analyzing state');
      }, 30000); // 30 second fallback timeout
      
      Alert.alert(
        'Route Visualization',
        `Loading "${location.name}" in the Maps tab. You can view the 3D route and terrain visualization.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to prepare route visualization');
      setIsAnalyzing(false); // Clear analyzing state on error
    } finally {
      setAnalyzingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(location.id);
        return newSet;
      });
    }
  };

  const formatCoordinates = (lat: number, lon: number) => {
    return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <IconSymbol name="location.fill" size={28} color="#FFA500" />
          <Text style={styles.title}>Saved Locations</Text>
        </View>
        <Text style={styles.subtitle}>
          {savedLocations.length === 0 
            ? 'No saved locations yet' 
            : `${savedLocations.length} saved location${savedLocations.length === 1 ? '' : 's'}`
          }
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {savedLocations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol name="location.fill" size={64} color="#666" />
            <Text style={styles.emptyTitle}>No Saved Locations</Text>
            <Text style={styles.emptyText}>
              Save your favorite routes from the Sunglare tab to quickly access them later.
            </Text>
          </View>
        ) : (
          savedLocations.map((location) => (
            <View key={location.id} style={styles.locationCard}>
              <View style={styles.locationHeader}>
                <View style={styles.locationNameContainer}>
                  <IconSymbol name="location.fill" size={20} color="#FFA500" />
                  <Text style={styles.locationName}>{location.name}</Text>
                </View>
                <View style={styles.locationActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => editLocation(location)}
                  >
                    <IconSymbol name="pencil" size={16} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => deleteLocation(location.id)}
                  >
                    <IconSymbol name="trash" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.analyzeButton, analyzingIds.has(location.id) && styles.analyzeButtonDisabled]}
                onPress={() => analyzeLocation(location)}
                disabled={analyzingIds.has(location.id)}
              >
                {analyzingIds.has(location.id) ? (
                  <View style={styles.analyzeButtonContent}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.analyzeButtonText}>Analyzing...</Text>
                  </View>
                ) : (
                  <View style={styles.analyzeButtonContent}>
                    <IconSymbol name="sun.max.fill" size={16} color="#fff" />
                    <Text style={styles.analyzeButtonText}>Analyze Sunglare</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.routeInfo}>
                <View style={styles.routePoint}>
                  <View style={styles.routeIndicator}>
                    <View style={[styles.routeDot, styles.startDot]} />
                  </View>
                  <View style={styles.routeDetails}>
                    <Text style={styles.routeLabel}>Start</Text>
                    <Text style={styles.routeAddress}>
                      {location.startAddress || 'Custom coordinates'}
                    </Text>
                    <Text style={styles.routeCoordinates}>
                      {formatCoordinates(location.startCoordinates.latitude, location.startCoordinates.longitude)}
                    </Text>
                  </View>
                </View>

                <View style={styles.routeLine} />

                <View style={styles.routePoint}>
                  <View style={styles.routeIndicator}>
                    <View style={[styles.routeDot, styles.endDot]} />
                  </View>
                  <View style={styles.routeDetails}>
                    <Text style={styles.routeLabel}>End</Text>
                    <Text style={styles.routeAddress}>
                      {location.endAddress || 'Custom coordinates'}
                    </Text>
                    <Text style={styles.routeCoordinates}>
                      {formatCoordinates(location.endCoordinates.latitude, location.endCoordinates.longitude)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.locationFooter}>
                <Text style={styles.savedDate}>Saved {formatDate(location.savedAt)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Location</Text>
            <TouchableOpacity onPress={saveEdit}>
              <Text style={styles.modalSaveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Location Name</Text>
            <TextInput
              style={styles.textInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter location name"
              placeholderTextColor="#666"
              autoFocus
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 40,
  },
  locationCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  locationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  locationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  routeInfo: {
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeIndicator: {
    alignItems: 'center',
    paddingTop: 2,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  startDot: {
    backgroundColor: '#34C759',
  },
  endDot: {
    backgroundColor: '#FF3B30',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#444',
    marginLeft: 5,
    marginVertical: 8,
  },
  routeDetails: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFA500',
    marginBottom: 4,
  },
  routeAddress: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 2,
  },
  routeCoordinates: {
    fontSize: 14,
    color: '#aaa',
    fontFamily: 'monospace',
  },
  locationFooter: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 12,
  },
  savedDate: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalCancelButton: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalSaveButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#444',
  },
  analyzeButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 12,
    alignItems: 'center',
  },
  analyzeButtonDisabled: {
    backgroundColor: '#555',
  },
  analyzeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
