import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { IconSymbol } from './ui/icon-symbol';

interface LocationSuggestion {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  lat?: number;
  lng?: number;
}

interface LocationSearchInputProps {
  label: string;
  value: string;
  onLocationSelect: (location: { latitude: number; longitude: number; address?: string }) => void;
  placeholder: string;
  apiUrl?: string;
}

export function LocationSearchInput({
  label,
  value,
  onLocationSelect,
  placeholder,
  apiUrl = 'http://localhost:8000',
}: LocationSearchInputProps) {
  const [searchText, setSearchText] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCoords, setManualCoords] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const searchPlaces = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/places/autocomplete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: query,
          types: 'geocode'
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.predictions) {
        const formattedSuggestions: LocationSuggestion[] = data.predictions.map((prediction: any) => ({
          place_id: prediction.place_id,
          description: prediction.description,
          main_text: prediction.structured_formatting?.main_text || prediction.description,
          secondary_text: prediction.structured_formatting?.secondary_text || '',
        }));
        setSuggestions(formattedSuggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching places:', error);
      // Fallback to mock suggestions for demo
      generateMockSuggestions(query);
    } finally {
      setLoading(false);
    }
  };

  const generateMockSuggestions = (query: string) => {
    const mockSuggestions: LocationSuggestion[] = [
      {
        place_id: '1',
        description: `${query} - San Francisco, CA, USA`,
        main_text: query,
        secondary_text: 'San Francisco, CA, USA',
        lat: 37.7749,
        lng: -122.4194,
      },
      {
        place_id: '2',
        description: `${query} - Los Angeles, CA, USA`,
        main_text: query,
        secondary_text: 'Los Angeles, CA, USA',
        lat: 34.0522,
        lng: -118.2437,
      },
      {
        place_id: '3',
        description: `${query} - New York, NY, USA`,
        main_text: query,
        secondary_text: 'New York, NY, USA',
        lat: 40.7128,
        lng: -74.0060,
      },
    ];
    setSuggestions(mockSuggestions);
    setShowSuggestions(true);
  };

  const getPlaceDetails = async (placeId: string, suggestion: LocationSuggestion) => {
    if (suggestion.lat && suggestion.lng) {
      // Use mock coordinates
      onLocationSelect({
        latitude: suggestion.lat,
        longitude: suggestion.lng,
        address: suggestion.description,
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/places/details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          place_id: placeId,
          fields: 'geometry'
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.result?.geometry?.location) {
        const { lat, lng } = data.result.geometry.location;
        onLocationSelect({
          latitude: lat,
          longitude: lng,
          address: suggestion.description,
        });
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      Alert.alert('Error', 'Unable to get location details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    setSearchText(text);
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Debounce search
    debounceRef.current = setTimeout(() => {
      searchPlaces(text);
    }, 300);
  };

  const handleSuggestionPress = async (suggestion: LocationSuggestion) => {
    setSearchText(suggestion.description);
    setShowSuggestions(false);
    await getPlaceDetails(suggestion.place_id, suggestion);
  };

  const handleManualCoords = () => {
    const coords = manualCoords.split(',').map(coord => parseFloat(coord.trim()));
    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
      onLocationSelect({
        latitude: coords[0],
        longitude: coords[1],
        address: `${coords[0]}, ${coords[1]}`,
      });
      setSearchText(`${coords[0]}, ${coords[1]}`);
      setShowManualInput(false);
      setManualCoords('');
    } else {
      Alert.alert('Error', 'Please enter valid coordinates in format: latitude,longitude');
    }
  };

  const renderSuggestion = (item: LocationSuggestion) => (
    <TouchableOpacity
      key={item.place_id}
      style={styles.suggestionItem}
      onPress={() => handleSuggestionPress(item)}
    >
        <IconSymbol name="location.fill" size={16} color="#666" />
        <View style={styles.suggestionText}>
          <Text style={styles.mainText}>{item.main_text}</Text>
          {item.secondary_text ? (
            <Text style={styles.secondaryText}>{item.secondary_text}</Text>
          ) : null}
        </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity
          style={styles.coordsButton}
          onPress={() => setShowManualInput(true)}
        >
          <Text style={styles.coordsButtonText}>Enter Coords</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.inputContainer}>
        <IconSymbol name="magnifyingglass" size={16} color="#666" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          value={searchText}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor="#666"
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => searchText.length >= 3 && setShowSuggestions(true)}
        />
        {loading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>...</Text>
          </View>
        )}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            style={styles.suggestionsList}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {suggestions.map(renderSuggestion)}
          </ScrollView>
        </View>
      )}

      <Modal
        visible={showManualInput}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManualInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Coordinates</Text>
            <Text style={styles.modalSubtitle}>Format: latitude,longitude</Text>
            <TextInput
              style={styles.modalInput}
              value={manualCoords}
              onChangeText={setManualCoords}
              placeholder="37.7749,-122.4194"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowManualInput(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleManualCoords}
              >
                <Text style={styles.confirmButtonText}>Use Coords</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  coordsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  coordsButtonText: {
    color: '#FFA500',
    fontSize: 12,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 0,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
  },
  loadingContainer: {
    paddingHorizontal: 8,
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
  },
  suggestionsContainer: {
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  suggestionText: {
    flex: 1,
    marginLeft: 12,
  },
  mainText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  secondaryText: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#444',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
