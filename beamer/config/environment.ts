// Environment Configuration
// Add your API keys and configuration here

export const config = {
  // Google Places API Key for location autocomplete
  // Get your API key from: https://developers.google.com/maps/documentation/places/web-service/get-api-key
  // Enable the Places API and Geocoding API in your Google Cloud Console
  googlePlacesApiKey: 'AIzaSyCfLQo_NHdryhaWyggVwxTqJZlj8j4OmLo',

  // Google Maps API Key for 3D map visualization
  // Use the same key as above or create a separate one for Maps JavaScript API
  // Enable the Maps JavaScript API and Directions API in your Google Cloud Console
  googleMapsApiKey: 'AIzaSyANTc-5Evv3xHpW-hv_vxtoBuf0rUDlsFo',

  // Sunglare API Server URL
  // Change this if your server is running on a different host/port
  sunglareApiUrl: 'http://localhost:8000',

  // Demo mode - set to true to use mock location suggestions
  // when Google Places API key is not provided
  demoMode: false,
};

