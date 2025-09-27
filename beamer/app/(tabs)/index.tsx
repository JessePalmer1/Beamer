import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
// Using custom date/time picker components
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LocationSearchInput } from '@/components/LocationSearchInput';
import { config } from '@/config/environment';
import { useSavedLocations } from '@/contexts/SavedLocationsContext';
import { useRoute } from '@/contexts/RouteContext';

export default function SunglareScreen() {
  const { addSavedLocation } = useSavedLocations();
  const { setCurrentRoute, setIsAnalyzing, departureTime, setDepartureTime } = useRoute();
  const router = useRouter();
  const [startLocation, setStartLocation] = useState<{latitude: number; longitude: number; address?: string} | null>(null);
  const [endLocation, setEndLocation] = useState<{latitude: number; longitude: number; address?: string} | null>(null);
  const [startLocationText, setStartLocationText] = useState('');
  const [endLocationText, setEndLocationText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleStartLocationSelect = (location: {latitude: number; longitude: number; address?: string}) => {
    setStartLocation(location);
    setStartLocationText(location.address || `${location.latitude}, ${location.longitude}`);
  };

  const handleEndLocationSelect = (location: {latitude: number; longitude: number; address?: string}) => {
    setEndLocation(location);
    setEndLocationText(location.address || `${location.latitude}, ${location.longitude}`);
  };

  const analyzeSunglare = async () => {
    if (!startLocation || !endLocation) {
      Alert.alert('Error', 'Please select both start and end locations');
      return;
    }

    setLoading(true);
    try {
      // Create route data for the Maps tab
      const routeData = {
        start: {
          latitude: startLocation.latitude,
          longitude: startLocation.longitude,
          address: startLocation.address,
        },
        end: {
          latitude: endLocation.latitude,
          longitude: endLocation.longitude,
          address: endLocation.address,
        },
        name: `${startLocationText.split(',')[0]} to ${endLocationText.split(',')[0]}`,
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
        console.log('Sunglare analysis timeout - clearing analyzing state');
      }, 30000); // 30 second fallback timeout
      
      Alert.alert(
        'Route Analysis',
        'Route visualization is now loading in the Maps tab. You can view the 3D route and terrain.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to prepare route visualization');
      setIsAnalyzing(false); // Clear analyzing state on error
    } finally {
      setLoading(false);
    }
  };

  const saveLocation = async () => {
    if (!startLocation || !endLocation || !saveName.trim()) {
      Alert.alert('Error', 'Please enter a name for this location');
      return;
    }

    try {
      const savedLocation = {
        id: Date.now().toString(),
        name: saveName.trim(),
        startAddress: startLocationText,
        endAddress: endLocationText,
        startCoordinates: startLocation,
        endCoordinates: endLocation,
        savedAt: new Date().toISOString(),
      };

      await addSavedLocation(savedLocation);
      
      setSaveModalVisible(false);
      setSaveName('');
      Alert.alert('Success', 'Location saved successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save location');
    }
  };

  const openSaveModal = () => {
    if (!startLocation || !endLocation) {
      Alert.alert('Error', 'Please select both start and end locations first');
      return;
    }
    
    // Generate a default name
    const defaultName = `${startLocationText.split(',')[0]} to ${endLocationText.split(',')[0]}`;
    setSaveName(defaultName);
    setSaveModalVisible(true);
  };

  const updateHour = (hour: number) => {
    const newDate = new Date(departureTime);
    newDate.setHours(hour);
    setDepartureTime(newDate);
  };

  const updateMinute = (minute: number) => {
    const newDate = new Date(departureTime);
    newDate.setMinutes(minute);
    setDepartureTime(newDate);
  };

  const updateDay = (dayOffset: number) => {
    const newDate = new Date(departureTime);
    newDate.setDate(newDate.getDate() + dayOffset);
    setDepartureTime(newDate);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
        <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.titleContainer}>
            <IconSymbol name="sun.max.fill" size={32} color="#FFA500" />
            <Text style={styles.title}>Beamed</Text>
          </View>
          <Text style={styles.subtitle}>Sunglare Analysis for Safe Driving</Text>
        </View>

        <View style={styles.formContainer}>
          <LocationSearchInput
            label="Start Location"
            value={startLocationText}
            onLocationSelect={handleStartLocationSelect}
            placeholder="Search for start location or enter coordinates"
            apiUrl={config.apiUrl}
          />
          
          <LocationSearchInput
            label="End Location"
            value={endLocationText}
            onLocationSelect={handleEndLocationSelect}
            placeholder="Search for destination or enter coordinates"
            apiUrl={config.apiUrl}
          />

          <View style={styles.departureTimeContainer}>
            <Text style={styles.departureTimeLabel}>Departure Time</Text>
            
            {/* Date Selector */}
            <View style={styles.inlineDateTimeRow}>
              <TouchableOpacity style={styles.dayButton} onPress={() => updateDay(-1)}>
                <Text style={styles.dayButtonText}>Yesterday</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dayButton} onPress={() => updateDay(0)}>
                <Text style={styles.dayButtonText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dayButton} onPress={() => updateDay(1)}>
                <Text style={styles.dayButtonText}>Tomorrow</Text>
              </TouchableOpacity>
            </View>

            {/* Time Pickers */}
            <View style={styles.timePickerRow}>
              {/* Hour Picker */}
              <View style={styles.timePickerColumn}>
                <Text style={styles.timeLabel}>Hour</Text>
                <ScrollView style={styles.timePicker} showsVerticalScrollIndicator={false}>
                  {Array.from({length: 24}, (_, i) => i).map(hour => (
                    <TouchableOpacity
                      key={hour}
                      style={[styles.timeOption, departureTime.getHours() === hour && styles.timeOptionSelected]}
                      onPress={() => updateHour(hour)}
                    >
                      <Text style={[styles.timeOptionText, departureTime.getHours() === hour && styles.timeOptionTextSelected]}>
                        {hour.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Minute Picker */}
              <View style={styles.timePickerColumn}>
                <Text style={styles.timeLabel}>Min</Text>
                <ScrollView style={styles.timePicker} showsVerticalScrollIndicator={false}>
                  {Array.from({length: 12}, (_, i) => i * 5).map(minute => {
                    const isSelected = Math.floor(departureTime.getMinutes() / 5) * 5 === minute;
                    return (
                      <TouchableOpacity
                        key={minute}
                        style={[styles.timeOption, isSelected && styles.timeOptionSelected]}
                        onPress={() => updateMinute(minute)}
                      >
                        <Text style={[styles.timeOptionText, isSelected && styles.timeOptionTextSelected]}>
                          {minute.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Current Time Display */}
              <View style={styles.currentTimeDisplay}>
                <IconSymbol name="clock" size={20} color="#FFA500" />
                <Text style={styles.currentTimeText}>
                  {formatTime(departureTime)}
                </Text>
                <Text style={styles.currentDateText}>
                  {formatDate(departureTime)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.analyzeButton, loading && styles.disabledButton]}
              onPress={analyzeSunglare}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.loadingText}>Analyzing route...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <IconSymbol name="sun.max.fill" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Analyze Sunglare</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={openSaveModal}
              disabled={!startLocation || !endLocation}
            >
              <View style={styles.buttonContent}>
                <IconSymbol name="location.fill" size={18} color={startLocation && endLocation ? "#FFA500" : "#666"} />
                <Text style={[styles.saveButtonText, (!startLocation || !endLocation) && styles.disabledButtonText]}>
                  Save Route
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={saveModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSaveModalVisible(false)}>
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Save Route</Text>
            <TouchableOpacity onPress={saveLocation}>
              <Text style={styles.modalSaveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Route Name</Text>
            <TextInput
              style={styles.textInput}
              value={saveName}
              onChangeText={setSaveName}
              placeholder="Enter a name for this route"
              placeholderTextColor="#666"
              autoFocus
            />

            <View style={styles.routePreview}>
              <Text style={styles.previewTitle}>Route Preview</Text>
              
              <View style={styles.previewRoute}>
                <View style={styles.previewPoint}>
                  <View style={[styles.previewDot, styles.startDot]} />
                  <View style={styles.previewDetails}>
                    <Text style={styles.previewLabel}>Start</Text>
                    <Text style={styles.previewAddress}>{startLocationText}</Text>
                  </View>
                </View>

                <View style={styles.previewLine} />

                <View style={styles.previewPoint}>
                  <View style={[styles.previewDot, styles.endDot]} />
                  <View style={styles.previewDetails}>
                    <Text style={styles.previewLabel}>End</Text>
                    <Text style={styles.previewAddress}>{endLocationText}</Text>
                  </View>
                </View>
              </View>
            </View>
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
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
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
  formContainer: {
    marginBottom: 30,
  },
  departureTimeContainer: {
    marginBottom: 20,
  },
  departureTimeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  inlineDateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  dayButton: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555',
  },
  dayButtonText: {
    color: '#FFA500',
    fontSize: 14,
    fontWeight: '500',
  },
  timePickerRow: {
    flexDirection: 'row',
    height: 120,
    gap: 12,
  },
  timePickerColumn: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFA500',
    textAlign: 'center',
    marginBottom: 8,
  },
  timePicker: {
    backgroundColor: '#222',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  timeOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  timeOptionSelected: {
    backgroundColor: '#FFA500',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  timeOptionTextSelected: {
    color: '#000',
    fontWeight: '600',
  },
  currentTimeDisplay: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentTimeText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    marginTop: 8,
  },
  currentDateText: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 4,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 20,
  },
  analyzeButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  disabledButton: {
    backgroundColor: '#555',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#FFA500',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#666',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  resultsContainer: {
    marginTop: 20,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sunglareCard: {
    backgroundColor: '#2a1f00',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFA500',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 4,
  },
  segmentsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 16,
  },
  segmentCard: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    color: '#fff',
  },
  riskLevel: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  highRisk: {
    backgroundColor: '#ff3333',
    color: '#fff',
  },
  mediumRisk: {
    backgroundColor: '#ff9933',
    color: '#fff',
  },
  lowRisk: {
    backgroundColor: '#33cc33',
    color: '#fff',
  },
  segmentText: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 2,
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
    marginBottom: 24,
  },
  routePreview: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  previewRoute: {
    gap: 8,
  },
  previewPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  previewDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 2,
  },
  startDot: {
    backgroundColor: '#34C759',
  },
  endDot: {
    backgroundColor: '#FF3B30',
  },
  previewLine: {
    width: 2,
    height: 16,
    backgroundColor: '#444',
    marginLeft: 5,
  },
  previewDetails: {
    flex: 1,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFA500',
    marginBottom: 4,
  },
  previewAddress: {
    fontSize: 14,
    color: '#fff',
  },
});
