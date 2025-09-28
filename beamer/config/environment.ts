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
  // API Server URL - our secure backend that proxies Google API calls
  // Change this if your server is running on a different host/port
  apiUrl: getEnvVar('EXPO_PUBLIC_API_URL', 'http://34.73.230.185:8000'),

  // Demo mode - set to true to use mock location suggestions
  // when API server is not available
  demoMode: getBooleanEnvVar('EXPO_PUBLIC_DEMO_MODE', false),
};

