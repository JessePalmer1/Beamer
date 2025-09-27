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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState(new Date().getHours());
  const [selectedMinute, setSelectedMinute] = useState(new Date().getMinutes());

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
      
      Alert.alert(
        'Route Analysis',
        'Route visualization is now loading in the Maps tab. You can view the 3D route and terrain.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to prepare route visualization');
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

  const openDatePicker = () => {
    setSelectedDate(new Date(departureTime));
    setShowDatePicker(true);
  };

  const openTimePicker = () => {
    setSelectedHour(departureTime.getHours());
    setSelectedMinute(departureTime.getMinutes());
    setShowTimePicker(true);
  };

  const confirmDateSelection = () => {
    const newDate = new Date(departureTime);
    newDate.setFullYear(selectedDate.getFullYear());
    newDate.setMonth(selectedDate.getMonth());
    newDate.setDate(selectedDate.getDate());
    setDepartureTime(newDate);
    setShowDatePicker(false);
  };

  const confirmTimeSelection = () => {
    const newDate = new Date(departureTime);
    newDate.setHours(selectedHour);
    newDate.setMinutes(selectedMinute);
    setDepartureTime(newDate);
    setShowTimePicker(false);
  };

  const adjustDate = (days: number) => {
    const newDate = new Date(departureTime);
    newDate.setDate(newDate.getDate() + days);
    setDepartureTime(newDate);
  };

  const adjustTime = (minutes: number) => {
    const newDate = new Date(departureTime);
    newDate.setMinutes(newDate.getMinutes() + minutes);
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
            
            <View style={styles.dateTimeSection}>
              <Text style={styles.dateTimeSubLabel}>Date</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity 
                  style={styles.adjustButton}
                  onPress={() => adjustDate(-1)}
                >
                  <Text style={styles.adjustButtonText}>-</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.dateTimeDisplay}
                  onPress={openDatePicker}
                >
                  <IconSymbol name="calendar" size={16} color="#FFA500" />
                  <Text style={styles.dateTimeText}>{formatDate(departureTime)}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.adjustButton}
                  onPress={() => adjustDate(1)}
                >
                  <Text style={styles.adjustButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.dateTimeSection}>
              <Text style={styles.dateTimeSubLabel}>Time</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity 
                  style={styles.adjustButton}
                  onPress={() => adjustTime(-30)}
                >
                  <Text style={styles.adjustButtonText}>-30m</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.dateTimeDisplay}
                  onPress={openTimePicker}
                >
                  <IconSymbol name="clock" size={16} color="#FFA500" />
                  <Text style={styles.dateTimeText}>{formatTime(departureTime)}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.adjustButton}
                  onPress={() => adjustTime(30)}
                >
                  <Text style={styles.adjustButtonText}>+30m</Text>
                </TouchableOpacity>
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

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Date</Text>
            <TouchableOpacity onPress={confirmDateSelection}>
              <Text style={styles.modalSaveButton}>Confirm</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pickerContainer}>
            <View style={styles.datePickerSection}>
              <Text style={styles.pickerLabel}>Year</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {Array.from({length: 5}, (_, i) => new Date().getFullYear() + i).map(year => (
                  <TouchableOpacity
                    key={year}
                    style={[styles.pickerOption, selectedDate.getFullYear() === year && styles.pickerOptionSelected]}
                    onPress={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setFullYear(year);
                      setSelectedDate(newDate);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, selectedDate.getFullYear() === year && styles.pickerOptionTextSelected]}>
                      {year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.datePickerSection}>
              <Text style={styles.pickerLabel}>Month</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {Array.from({length: 12}, (_, i) => i).map(month => (
                  <TouchableOpacity
                    key={month}
                    style={[styles.pickerOption, selectedDate.getMonth() === month && styles.pickerOptionSelected]}
                    onPress={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setMonth(month);
                      setSelectedDate(newDate);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, selectedDate.getMonth() === month && styles.pickerOptionTextSelected]}>
                      {new Date(2024, month, 1).toLocaleDateString('en-US', { month: 'short' })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.datePickerSection}>
              <Text style={styles.pickerLabel}>Day</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {Array.from({length: new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate()}, (_, i) => i + 1).map(day => (
                  <TouchableOpacity
                    key={day}
                    style={[styles.pickerOption, selectedDate.getDate() === day && styles.pickerOptionSelected]}
                    onPress={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(day);
                      setSelectedDate(newDate);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, selectedDate.getDate() === day && styles.pickerOptionTextSelected]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTimePicker(false)}>
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Time</Text>
            <TouchableOpacity onPress={confirmTimeSelection}>
              <Text style={styles.modalSaveButton}>Confirm</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.timePickerContainer}>
            <View style={styles.timePickerSection}>
              <Text style={styles.pickerLabel}>Hour</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {Array.from({length: 24}, (_, i) => i).map(hour => (
                  <TouchableOpacity
                    key={hour}
                    style={[styles.pickerOption, selectedHour === hour && styles.pickerOptionSelected]}
                    onPress={() => setSelectedHour(hour)}
                  >
                    <Text style={[styles.pickerOptionText, selectedHour === hour && styles.pickerOptionTextSelected]}>
                      {hour.toString().padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.timePickerSection}>
              <Text style={styles.pickerLabel}>Minute</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {Array.from({length: 60}, (_, i) => i).filter(min => min % 5 === 0).map(minute => (
                  <TouchableOpacity
                    key={minute}
                    style={[styles.pickerOption, selectedMinute === minute && styles.pickerOptionSelected]}
                    onPress={() => setSelectedMinute(minute)}
                  >
                    <Text style={[styles.pickerOptionText, selectedMinute === minute && styles.pickerOptionTextSelected]}>
                      {minute.toString().padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.quickTimeButtons}>
            <Text style={styles.quickTimeLabel}>Quick Times</Text>
            <View style={styles.quickTimeRow}>
              {[
                { label: 'Sunrise', hour: 6, minute: 30 },
                { label: 'Morning', hour: 9, minute: 0 },
                { label: 'Noon', hour: 12, minute: 0 },
                { label: 'Afternoon', hour: 15, minute: 0 },
                { label: 'Sunset', hour: 18, minute: 30 },
                { label: 'Evening', hour: 20, minute: 0 },
              ].map(time => (
                <TouchableOpacity
                  key={time.label}
                  style={styles.quickTimeButton}
                  onPress={() => {
                    setSelectedHour(time.hour);
                    setSelectedMinute(time.minute);
                  }}
                >
                  <Text style={styles.quickTimeButtonText}>{time.label}</Text>
                  <Text style={styles.quickTimeButtonTime}>
                    {time.hour.toString().padStart(2, '0')}:{time.minute.toString().padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
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
  dateTimeSection: {
    marginBottom: 12,
  },
  dateTimeSubLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFA500',
    marginBottom: 8,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateTimeDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
  },
  dateTimeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  adjustButton: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  adjustButtonText: {
    color: '#FFA500',
    fontSize: 12,
    fontWeight: '600',
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
  // Date/Time Picker Styles
  pickerContainer: {
    flexDirection: 'row',
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  timePickerContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    height: 300,
  },
  datePickerSection: {
    flex: 1,
    marginHorizontal: 5,
  },
  timePickerSection: {
    flex: 1,
    marginHorizontal: 10,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFA500',
    textAlign: 'center',
    marginBottom: 12,
  },
  pickerScroll: {
    backgroundColor: '#222',
    borderRadius: 12,
    maxHeight: 200,
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    alignItems: 'center',
  },
  pickerOptionSelected: {
    backgroundColor: '#FFA500',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  pickerOptionTextSelected: {
    color: '#000',
    fontWeight: '600',
  },
  quickTimeButtons: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  quickTimeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  quickTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickTimeButton: {
    backgroundColor: '#333',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#555',
  },
  quickTimeButtonText: {
    fontSize: 12,
    color: '#FFA500',
    fontWeight: '600',
    marginBottom: 2,
  },
  quickTimeButtonTime: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
});
