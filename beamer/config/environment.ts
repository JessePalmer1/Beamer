// Environment Configuration
// This file loads configuration from environment variables
// Create a .env file in the root directory with the following variables:
// EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_google_places_api_key
// EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
// EXPO_PUBLIC_SUNGLARE_API_URL=http://localhost:8000
// EXPO_PUBLIC_DEMO_MODE=false

import Constants from 'expo-constants';

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = Constants.expoConfig?.extra?.[key] || process.env[key];
  if (!value && !defaultValue) {
    console.warn(`Environment variable ${key} is not set`);
  }
  return value || defaultValue || '';
};

const getBooleanEnvVar = (key: string, defaultValue: boolean = false): boolean => {
  const value = getEnvVar(key);
  if (value === '') return defaultValue;
  return value.toLowerCase() === 'true';
};

export const config = {
  // Google Places API Key for location autocomplete
  // Get your API key from: https://developers.google.com/maps/documentation/places/web-service/get-api-key
  // Enable the Places API and Geocoding API in your Google Cloud Console
  googlePlacesApiKey: getEnvVar('EXPO_PUBLIC_GOOGLE_PLACES_API_KEY', 'AIzaSyCfLQo_NHdryhaWyggVwxTqJZlj8j4OmLo'),

  // Google Maps API Key for 3D map visualization
  // Use the same key as above or create a separate one for Maps JavaScript API
  // Enable the Maps JavaScript API and Directions API in your Google Cloud Console
  googleMapsApiKey: getEnvVar('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', 'AIzaSyANTc-5Evv3xHpW-hv_vxtoBuf0rUDlsFo'),

  // Sunglare API Server URL
  // Change this if your server is running on a different host/port
  sunglareApiUrl: getEnvVar('EXPO_PUBLIC_SUNGLARE_API_URL', 'http://localhost:8000'),

  // Demo mode - set to true to use mock location suggestions
  // when Google Places API key is not provided
  demoMode: getBooleanEnvVar('EXPO_PUBLIC_DEMO_MODE', false),
};

