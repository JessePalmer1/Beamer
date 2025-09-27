# Beamed - Sunglare Analysis App

A React Native app that analyzes sunglare conditions for driving routes using a sleek dark theme interface and intelligent location search.

## Features

### 🎨 User Interface
- **Dark Theme UI**: Clean, modern dark interface optimized for visibility
- **Custom Logo**: Branded header with your logo and sunglare-themed design
- **Responsive Design**: Works seamlessly on iOS, Android, and web platforms

### 📍 Smart Location Input
- **Autocomplete Search**: Google Places API integration for intelligent location suggestions
- **Manual Coordinates**: Fallback option to enter precise latitude/longitude coordinates
- **Dual Input Methods**: Choose between searching places or entering coordinates
- **Demo Mode**: Works with mock suggestions when Google API key is not configured

### 🔍 Analysis Features
- **Real-time Analysis**: Connects to sunglare analysis server for route computation
- **Save Routes**: Save favorite routes with custom names for quick access later
- **Loading Animation**: Enhanced loading indicator with progress text
- **Risk Assessment**: Color-coded risk levels (High/Medium/Low) for route segments
- **Detailed Results**: Shows sunglare index, sun position, and blocked segments
- **Route Summary**: Total distance, duration, and segment-by-segment analysis

### 📍 Saved Locations
- **Route Management**: Save and organize frequently used routes with custom names
- **Real-time Updates**: Saved locations refresh immediately when new routes are added
- **Quick Analysis**: Each saved route has its own "Analyze Sunglare" button for instant analysis
- **Beautiful UI**: Clean cards showing start/end locations with visual route indicators
- **Edit & Delete**: Rename saved routes or remove unwanted ones with intuitive controls
- **Route Preview**: Visual route representation in save modal with start/end points
- **Persistent Storage**: Routes saved locally using AsyncStorage for offline access
- **Loading States**: Visual feedback when analyzing routes with loading indicators
- **Context Management**: Centralized state management for seamless data flow across tabs

### 🏔️ 3D Terrain Explorer with Satellite Imagery
- **Real 3D Terrain**: Fetches actual elevation data and renders as interactive 3D landscape
- **🛰️ Satellite Imagery**: Overlays real satellite imagery showing roads, buildings, and terrain features
- **Multiple Image Sources**: ESRI World Imagery, OpenStreetMap, CartoDB with automatic fallback
- **No API Keys Required**: Uses free, open-access satellite imagery sources
- **Advanced Touch Controls**: Single finger rotation + two-finger pinch-to-zoom with proper scaling
- **Location-Specific Data**: Each location shows unique topography based on real satellite data
- **Configurable Terrain Radius**: Adjustable 1-15km radius with live terrain reloading
- **Smart Camera Positioning**: Automatically adjusts view distance based on terrain characteristics
- **Sun Sphere Visualization**: Interactive 3D sun with raycast to terrain center
- **Sun Position Controls**: Real-time azimuth (0-360°) and altitude (0-90°) sliders
- **Longs Peak 14er**: Dramatic Colorado mountain terrain showcasing extreme elevation changes
- **Mobile-Optimized**: Full touch controls with proper gesture recognition
- **Intelligent Fallback**: Height-based coloring if satellite imagery fails to load
- **Memory Management**: Aggressive cleanup system prevents terrain object stacking
- **Performance Optimized**: Force disposal of ALL non-light objects when changing terrain/radius
- **Load Protection**: Prevents multiple simultaneous terrain loads with timeout protection
- **Sunglare Foundation**: Perfect base for overlaying sunglare analysis visualization

### 🗺️ Google Maps 3D Visualization
- **Google Maps Integration**: Full Google Maps SDK with satellite imagery and 3D buildings
- **Route Visualization**: Display selected routes with start/end markers and path lines
- **3D Perspective**: Two-finger gestures for tilting and rotating the map view
- **Interactive Controls**: Pan, zoom, and rotate with smooth touch controls
- **Satellite View**: High-resolution satellite imagery showing real terrain and roads
- **Building Rendering**: 3D building models for realistic urban visualization
- **Custom Markers**: Color-coded start (green) and end (red) location markers
- **Route Polylines**: Dashed blue lines showing the path between locations
- **Control Overlay**: Floating buttons for 3D view help, route fitting, and clearing
- **User Location**: Built-in GPS location display with compass and scale
- **Responsive Layout**: Optimized for both portrait and landscape orientations
- **Real-time Updates**: Map updates automatically when new routes are selected

## Setup & Configuration

### 1. Start the App
```bash
npm start
```

### 2. Google Places API (Optional but Recommended)
For enhanced location search with real address autocomplete:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Places API
   - Geocoding API
4. Create credentials (API Key)
5. Restrict the API key to your bundle ID/package name for security
6. Add your API key to `config/environment.ts`:
   ```typescript
   export const config = {
     googlePlacesApiKey: 'YOUR_API_KEY_HERE',
     // ... other config
   };
   ```

### 3. 3D Terrain Explorer with Satellite Imagery (No Setup Required)
The 3D terrain functionality works out of the box using:

- **Real satellite elevation data** from OpenTopoData's free SRTM dataset
- **🛰️ Satellite imagery overlay** from ESRI World Imagery, OpenStreetMap, and CartoDB
- **No API keys required** - uses free, open-access imagery sources with automatic fallback
- **Interactive 3D rendering** with orbital camera controls and real satellite textures
- **Advanced touch controls** - single finger rotation, two-finger pinch-to-zoom
- **Configurable terrain radius** - adjust coverage area from 1-15km with real-time reloading
- **Sun sphere visualization** - 3D sun with raycast for sunglare analysis preparation
- **Location-specific terrain** - each city shows its actual topography with satellite imagery
- **Smart camera positioning** that adapts to terrain characteristics
- **Intelligent fallback** to height-based coloring if imagery fails to load

Controls:
- **Single finger drag**: Rotate around terrain
- **Two-finger pinch**: Zoom in/out with proper scaling limits
- **Terrain Radius Slider**: Change coverage area (reloads terrain + imagery)
- **Sun Position Controls**: Adjust azimuth (0-360°) and altitude (0-90°)
- **Sun Toggle**: Show/hide sun sphere and raycast

Each location renders its unique 3D landscape with real satellite imagery automatically!

### 4. Usage Options

**Option A: Smart Location Search (with Google API)**
- Start typing any address or place name
- Select from intelligent autocomplete suggestions
- Automatically gets precise coordinates

**Option B: Manual Coordinates**
- Tap "Enter Coords" button next to any location field
- Enter coordinates in format: `latitude,longitude`
- Example: `37.7749,-122.4194`

**Option C: Demo Mode**
- Works out of the box without API keys
- Provides mock location suggestions for testing

## API Integration

The app connects to a FastAPI sunglare analysis server that:
- Fetches route data from Google Directions API
- Calculates sun position and horizon altitude
- Computes sunglare index for each route segment
- Returns comprehensive analysis results

**Default Server**: `http://localhost:8000`

To change the server URL, modify the `sunglareApiUrl` in `config/environment.ts`.

## Results Display

- **Route Summary**: Total distance and duration with formatted units
- **Sunglare Analysis**: Maximum index and comprehensive risk statistics
- **Route Segments**: Detailed metrics for each segment:
  - Sunglare Index (0.0 - 1.0 scale)
  - Sun Altitude in degrees
  - Sun visibility status (blocked/visible)
  - Color-coded risk levels (High/Medium/Low)
  - Location coordinates for each segment

## Architecture

### Technology Stack
- **Platform**: React Native with Expo
- **Navigation**: Expo Router with tab-based navigation
- **Styling**: React Native StyleSheet with custom dark theme
- **Location Services**: Google Places API with manual coordinate fallback
- **API Client**: Fetch-based service with full TypeScript interfaces
- **Icons**: SF Symbols (iOS) / Material Icons (Android/Web)

### Key Components
- `SunglareScreen`: Main analysis interface with logo, enhanced UI, and route saving functionality
- `SavedLocationsScreen`: Beautiful route management interface with real-time updates and analyze buttons
- `MapsScreen`: Google Maps 3D visualization with route display and interactive controls
- `TerrainScreen`: Advanced 3D terrain visualization with real elevation data, sun sphere, and interactive controls
- `SavedLocationsContext`: Centralized state management for saved routes across all tabs
- `LocationSearchInput`: Smart location input with autocomplete and manual entry
- `SunglareApiClient`: Robust API service layer with error handling
- `IconSymbol`: Cross-platform icon component with mapping system
- `react-native-maps`: Google Maps SDK integration for 3D map visualization
- `@react-native-community/slider`: Terrain radius and sun position controls
- `AsyncStorage`: Persistent storage for saved routes and user data

### Configuration
- `config/environment.ts`: Centralized configuration for API keys and settings
- Easy setup for Google Places API integration
- Google Maps API configuration for 3D map visualization
- Configurable server endpoints and demo mode

### Google Maps Setup (Optional)
The Maps tab works with a demo route by default, but for full functionality:
1. Get a Google Maps API key from Google Cloud Console
2. Enable Maps SDK for Android/iOS and Places API
3. Add the API key to your environment configuration
4. The app gracefully falls back to basic functionality without API keys

### Features Highlights
- **Intelligent UX**: Seamless switching between search and coordinate entry
- **Robust Error Handling**: Graceful fallbacks and user-friendly error messages
- **Performance Optimized**: Debounced search, efficient API calls
- **Cross-Platform**: Consistent experience across iOS, Android, and web
- **Accessibility**: Proper labeling and intuitive navigation

The app follows clean architecture principles with clear separation of concerns, making it easy to maintain and extend.