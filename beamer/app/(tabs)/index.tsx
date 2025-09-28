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
import DateTimePickerModal from 'react-native-modal-datetime-picker';

const FIVE_MIN_MS = 5 * 60 * 1000;

const roundUpTo5 = (d: Date) => new Date(Math.ceil(d.getTime() / FIVE_MIN_MS) * FIVE_MIN_MS);

const clampToEarliest = (d: Date) => {
  const earliest = roundUpTo5(new Date());
  return d.getTime() < earliest.getTime() ? earliest : d;
};


const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const isSameYMD = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

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
  const [isDateTimePickerVisible, setDateTimePickerVisible] = useState(false);

  // Precompute day chips (Today → +6 days)
  const today0 = startOfDay(new Date());
  const dayOptions = Array.from({ length: 7 }, (_, i) => addDays(today0, i));
  const selectedDay = startOfDay(departureTime);

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
      // Create route data for the Maps tab (without profile to force fresh analysis)
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
        // Explicitly set profile to undefined to ensure fresh analysis
        profile: undefined,
      };

      console.log('Starting new route analysis:', {
        name: routeData.name,
        departureTime: routeData.departureTime,
        start: routeData.start.address,
        end: routeData.end.address
      });

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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
        <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"

          />
          <View style={styles.titleContainer}>
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

            {/* Quick picks */}
            <View style={styles.inlineDateTimeRow}>
              {[
                { label: 'ASAP', mins: 0 },
                { label: '+10m', mins: 10 },
                { label: '+30m', mins: 30 },
                { label: '+1h', mins: 60 },
              ].map(({ label, mins }) => (
                <TouchableOpacity
                  key={label}
                  style={styles.quickChip}
                  onPress={() => setDepartureTime(roundUpTo5(new Date(Date.now() + mins * 60000)))}
                >
                  <Text style={styles.quickChipText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Day chips (future only) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {dayOptions.map((d) => {
                const selected = isSameYMD(d, departureTime);
                // Keep current H:M when switching days, then clamp forward if needed
                const onSelectDay = () => {
                  const next = new Date(d);
                  next.setHours(departureTime.getHours(), departureTime.getMinutes(), 0, 0);
                  setDepartureTime(clampToEarliest(next));
                };
                const label = isSameYMD(d, today0)
                  ? 'Today'
                  : isSameYMD(d, addDays(today0, 1))
                  ? 'Tomorrow'
                  : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

                return (
                  <TouchableOpacity
                    key={d.toISOString()}
                    onPress={onSelectDay}
                    style={[styles.dayChip, selected && styles.dayChipSelected]}
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* One-tap modal to pick both date & time (future-only) */}
            <TouchableOpacity
              onPress={() => setDateTimePickerVisible(true)}
              style={styles.dateTimeButton}
            >
              <IconSymbol name="calendar.badge.clock" size={20} color="#FFA500" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.dateTimeButtonTitle}>
                  {formatTime(departureTime)}
                </Text>
                <Text style={styles.dateTimeButtonSub}>
                  {formatDate(departureTime)} · Local time
                </Text>
              </View>
            </TouchableOpacity>

            <DateTimePickerModal
              isVisible={isDateTimePickerVisible}
              mode="datetime"
              // If current selection is past (e.g., from old state), default to "now"
              date={departureTime.getTime() < Date.now() ? roundUpTo5(new Date()) : departureTime}
              minimumDate={new Date()}            // ← blocks past dates
              minuteInterval={5}                  // iOS UI hint; we still hard-round after
              is24Hour={false}
              onConfirm={(picked : Date) => {
                setDateTimePickerVisible(false);
                // Round to 5-minute grid & clamp to >= now
                setDepartureTime(clampToEarliest(roundUpTo5(picked)));
              }}
              onCancel={() => setDateTimePickerVisible(false)}
            />
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
                  <IconSymbol name="sun.max.fill" size={20} color="#000" />
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
    width: 150,
    height: 150,
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
    backgroundColor: '#fff',
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
    color: '#000',
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
  quickChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#2b2f3a',
    borderWidth: 1,
    borderColor: '#3a3f4b',
  },
  quickChipText: { color: '#e8e8e8', fontSize: 14, fontWeight: '600' },
  
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#1f2430',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2e3440',
  },
  dayChipSelected: {
    backgroundColor: '#FFA50022',
    borderColor: '#FFA500',
  },
  dayChipText: {
    fontSize: 14,
    color: '#cfd3dc',
  },
  dayChipTextSelected: {
    color: '#FFA500',
    fontWeight: '700',
  },
  
  dateTimeButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444',
    padding: 14,
  },
  dateTimeButtonTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  dateTimeButtonSub: { color: '#aaa', fontSize: 12, marginTop: 2 },
});
