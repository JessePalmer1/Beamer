import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRoute, RouteProfile, RouteSegment } from '@/contexts/RouteContext';
import { config } from '@/config/environment';

interface Route {
  start: {latitude: number; longitude: number; address?: string};
  end: {latitude: number; longitude: number; address?: string};
  name?: string;
}

export default function MapsScreen() {
  const { currentRoute, setCurrentRoute, isAnalyzing, setIsAnalyzing } = useRoute();
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastLoadedRouteId, setLastLoadedRouteId] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  // Update selected route when current route changes (but not when only profile changes)
  React.useEffect(() => {
    if (currentRoute) {
      const route: Route = {
        start: {
          latitude: currentRoute.start.latitude,
          longitude: currentRoute.start.longitude,
          address: currentRoute.start.address,
        },
        end: {
          latitude: currentRoute.end.latitude,
          longitude: currentRoute.end.longitude,
          address: currentRoute.end.address,
        },
        name: currentRoute.name,
      };
      
      // Create a unique identifier for this route (excluding profile data)
      const routeId = `${route.start.latitude},${route.start.longitude}-${route.end.latitude},${route.end.longitude}-${route.name}`;
      
      // Only load the route if it's actually different (not just profile update)
      if (routeId !== lastLoadedRouteId) {
        setSelectedRoute(route);
        setLastLoadedRouteId(routeId);
        
        // Load the route in the WebView once it's ready
        if (!isLoading && webViewRef.current) {
          loadRoute(route);
        }
      }
    } else {
      setSelectedRoute(null);
      setLastLoadedRouteId(null);
    }
  }, [currentRoute?.start.latitude, currentRoute?.start.longitude, currentRoute?.end.latitude, currentRoute?.end.longitude, currentRoute?.name, isLoading, lastLoadedRouteId]);

  const sendMessageToWebView = (message: any) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(message));
    }
  };

  const loadRoute = (route: Route) => {
    setSelectedRoute(route);
    setIsAnalyzing(true);
    sendMessageToWebView({
      type: 'loadRoute',
      route: route
    });
  };

  const clearRoute = () => {
    setSelectedRoute(null);
    setIsAnalyzing(false);
    sendMessageToWebView({
      type: 'clearRoute'
    });
  };

  const fitToRoute = () => {
    if (selectedRoute) {
      sendMessageToWebView({
        type: 'fitToRoute'
      });
    }
  };

  const toggle3DView = () => {
    sendMessageToWebView({
      type: 'toggle3D'
    });
  };

  const toggleSunglareView = () => {
    sendMessageToWebView({
      type: 'toggleSunglare'
    });
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        // Maps WebView is ready
        setIsLoading(false);
        
        // Load current route if available
        if (currentRoute) {
          const route: Route = {
            start: {
              latitude: currentRoute.start.latitude,
              longitude: currentRoute.start.longitude,
              address: currentRoute.start.address,
            },
            end: {
              latitude: currentRoute.end.latitude,
              longitude: currentRoute.end.longitude,
              address: currentRoute.end.address,
            },
            name: currentRoute.name,
          };
          loadRoute(route);
        } else {
          // No route to load, so stop analyzing
          setIsAnalyzing(false);
        }
      } else if (data.type === 'routeProfile') {
        // Route profile received - reduced logging to prevent spam
        
        // Update the current route with profile data without triggering route reload
        if (currentRoute) {
          // Use a more targeted update that preserves the route ID to prevent reload
          const updatedRoute = {
            ...currentRoute,
            profile: data.profile as RouteProfile
          };
          setCurrentRoute(updatedRoute);
        }
      } else if (data.type === 'routeLoaded') {
        // Route loaded successfully - only log once
        setIsAnalyzing(false);
      } else if (data.type === 'routeCleared') {
        // Route cleared successfully
        setIsAnalyzing(false);
        
        // Clear profile data when route is cleared
        if (currentRoute) {
          const clearedRoute = {
            ...currentRoute,
            profile: undefined
          };
          setCurrentRoute(clearedRoute);
        }
      } else if (data.type === 'error') {
        console.error('Maps error:', data.message);
        Alert.alert('Maps Error', data.message);
        setIsAnalyzing(false);
      }
    } catch (error) {
      console.error('Error handling message from WebView:', error);
      setIsAnalyzing(false);
    }
  };

  // Create the HTML content for the WebView with embedded Google Maps
  const mapsHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>3D Maps</title>
        <style>
            body, html {
                margin: 0;
                padding: 0;
                height: 100%;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            
            #map {
                height: 100vh;
                width: 100%;
            }
            
            .controls {
                position: absolute;
                top: 20px;
                right: 20px;
                z-index: 1000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            
            .control-btn {
                background: rgba(0, 0, 0, 0.7);
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                min-width: 80px;
            }
            
            .control-btn:hover {
                background: rgba(0, 0, 0, 0.9);
            }
            
            .clear-btn {
                background: rgba(255, 59, 48, 0.8);
            }
            
            .clear-btn:hover {
                background: rgba(255, 59, 48, 1);
            }
        </style>
    </head>
    <body>
        <div id="map"></div>
        
        <div class="controls">
            <button class="control-btn" onclick="toggle3D()">🌐 3D View</button>
            <button class="control-btn" onclick="fitToRoute()">📍 Fit Route</button>
            <button class="control-btn" onclick="toggleSunglareVisualization()">☀️ Sun Glare</button>
            <button class="control-btn clear-btn" onclick="clearRoute()">Clear</button>
        </div>

        <script>
            let map;
            let directionsService;
            let directionsRenderer;
            let currentRoute = null;
            let is3D = false;

            function initMap() {
                try {
                    // Initialize map centered on San Francisco
                    map = new google.maps.Map(document.getElementById('map'), {
                        center: { lat: 37.7749, lng: -122.4194 },
                        zoom: 13,
                        mapTypeId: 'satellite',
                        tilt: 0,
                        heading: 0,
                        gestureHandling: 'greedy'
                    });

                    // Initialize directions service and renderer
                    directionsService = new google.maps.DirectionsService();
                    directionsRenderer = new google.maps.DirectionsRenderer({
                        map: map,
                        suppressMarkers: false,
                        polylineOptions: {
                            strokeColor: '#007AFF',
                            strokeWeight: 4,
                            strokeOpacity: 0.8
                        }
                    });

                    // Send ready message
                    window.ReactNativeWebView?.postMessage(JSON.stringify({
                        type: 'ready',
                        message: 'Maps initialized successfully'
                    }));

                    console.log('Maps initialized successfully');
                } catch (error) {
                    console.error('Error initializing maps:', error);
                    window.ReactNativeWebView?.postMessage(JSON.stringify({
                        type: 'error',
                        message: 'Failed to initialize maps: ' + error.message
                    }));
                }
            }

            function loadRoute(route) {
                if (!route || !route.start || !route.end) {
                    console.error('Invalid route data');
                    return;
                }

                currentRoute = route;
                
                const request = {
                    origin: new google.maps.LatLng(route.start.latitude, route.start.longitude),
                    destination: new google.maps.LatLng(route.end.latitude, route.end.longitude),
                    travelMode: google.maps.TravelMode.DRIVING
                };

                directionsService.route(request, function(result, status) {
                    if (status === 'OK') {
                        directionsRenderer.setDirections(result);
                        
                        // Add custom markers for start and end
                        new google.maps.Marker({
                            position: request.origin,
                            map: map,
                            title: route.start.address || 'Start Location',
                            icon: {
                                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                                    '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">' +
                                        '<circle cx="10" cy="10" r="8" fill="#34C759" stroke="white" stroke-width="2"/>' +
                                        '<circle cx="10" cy="10" r="3" fill="white"/>' +
                                    '</svg>'
                                ),
                                scaledSize: new google.maps.Size(20, 20)
                            }
                        });

                        new google.maps.Marker({
                            position: request.destination,
                            map: map,
                            title: route.end.address || 'End Location',
                            icon: {
                                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                                    '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">' +
                                        '<circle cx="10" cy="10" r="8" fill="#FF3B30" stroke="white" stroke-width="2"/>' +
                                        '<circle cx="10" cy="10" r="3" fill="white"/>' +
                                    '</svg>'
                                ),
                                scaledSize: new google.maps.Size(20, 20)
                            }
                        });

                        // Process route data for development and sun glare analysis
                        try {
                            processRouteData(result);
                        } catch (profileError) {
                            console.warn('Route profile processing failed, but route still loaded:', profileError);
                            // Send partial route profile with just basic info
                            window.ReactNativeWebView?.postMessage(JSON.stringify({
                                type: 'routeProfile',
                                profile: {
                                    segments: [],
                                    totalDistance: 0,
                                    totalDuration: 0,
                                    polylinePoints: [],
                                    error: 'Profile processing failed: ' + profileError.message
                                }
                            }));
                        }
                        
                        // Add demo 3D red line for sun glare visualization
                        addDemo3DSunglareVisualization(route);
                        
                        // Send route loaded message to React Native
                        window.ReactNativeWebView?.postMessage(JSON.stringify({
                            type: 'routeLoaded',
                            message: 'Route loaded successfully'
                        }));
                    } else {
                        console.error('Directions request failed due to ' + status);
                        window.ReactNativeWebView?.postMessage(JSON.stringify({
                            type: 'error',
                            message: 'Failed to load route: ' + status
                        }));
                    }
                });
            }

            // Store sunglare visualization elements for cleanup
            let sunglarePolylines = [];
            let sunglareMarkers = [];
            let sunglareVisible = true;

            function clearRoute() {
                if (directionsRenderer) {
                    directionsRenderer.setMap(null);
                    directionsRenderer = new google.maps.DirectionsRenderer({
                        map: map,
                        suppressMarkers: false,
                        polylineOptions: {
                            strokeColor: '#007AFF',
                            strokeWeight: 4,
                            strokeOpacity: 0.8
                        }
                    });
                }
                
                // Clear sunglare visualization
                clearSunglareVisualization();
                
                currentRoute = null;
                console.log('Route cleared');
                
                // Send route cleared message to React Native
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                    type: 'routeCleared',
                    message: 'Route cleared successfully'
                }));
            }

            function clearSunglareVisualization() {
                // Remove all sunglare polylines
                sunglarePolylines.forEach(polyline => {
                    if (polyline) {
                        polyline.setMap(null);
                    }
                });
                sunglarePolylines = [];

                // Remove all sunglare markers
                sunglareMarkers.forEach(marker => {
                    if (marker) {
                        marker.setMap(null);
                    }
                });
                sunglareMarkers = [];

                console.log('Sunglare visualization cleared');
            }

            function toggleSunglareVisualization() {
                sunglareVisible = !sunglareVisible;
                
                if (sunglareVisible) {
                    // Show sunglare visualization
                    sunglarePolylines.forEach(polyline => {
                        if (polyline) {
                            polyline.setMap(map);
                        }
                    });
                    sunglareMarkers.forEach(marker => {
                        if (marker) {
                            marker.setMap(map);
                        }
                    });
                    
                    // If no visualization exists and we have a route, create it
                    if (sunglarePolylines.length === 0 && currentRoute) {
                        addDemo3DSunglareVisualization(currentRoute);
                    }
                    
                    console.log('Sunglare visualization shown');
                } else {
                    // Hide sunglare visualization
                    sunglarePolylines.forEach(polyline => {
                        if (polyline) {
                            polyline.setMap(null);
                        }
                    });
                    sunglareMarkers.forEach(marker => {
                        if (marker) {
                            marker.setMap(null);
                        }
                    });
                    
                    console.log('Sunglare visualization hidden');
                }
            }

            function fitToRoute() {
                if (currentRoute && map) {
                    const bounds = new google.maps.LatLngBounds();
                    bounds.extend(new google.maps.LatLng(currentRoute.start.latitude, currentRoute.start.longitude));
                    bounds.extend(new google.maps.LatLng(currentRoute.end.latitude, currentRoute.end.longitude));
                    map.fitBounds(bounds, 50);
                    console.log('Fitted to route bounds');
                }
            }

            function toggle3D() {
                if (map) {
                    is3D = !is3D;
                    if (is3D) {
                        map.setTilt(45);
                        map.setMapTypeId('hybrid');
                        console.log('Enabled 3D view');
                    } else {
                        map.setTilt(0);
                        map.setMapTypeId('satellite');
                        console.log('Disabled 3D view');
                    }
                }
            }

            function addDemo3DSunglareVisualization(route) {
                if (!route || !route.start || !route.end) {
                    console.error('Invalid route for sunglare visualization');
                    return;
                }

                // Create demo coordinates for the 3D line
                // This simulates sun glare intensity along the route
                const demoSunglarePoints = [];
                const startLat = route.start.latitude;
                const startLng = route.start.longitude;
                const endLat = route.end.latitude;
                const endLng = route.end.longitude;

                // Generate points along the route with varying elevations to simulate sun glare intensity
                const numPoints = 20; // Number of points along the route
                for (let i = 0; i <= numPoints; i++) {
                    const ratio = i / numPoints;
                    const lat = startLat + (endLat - startLat) * ratio;
                    const lng = startLng + (endLng - startLng) * ratio;
                    
                    // Simulate varying sun glare intensity with elevation
                    // Higher elevation = more intense sun glare
                    const sunglareIntensity = Math.sin(ratio * Math.PI * 3) * 0.5 + 0.5; // 0 to 1
                    const elevation = sunglareIntensity * 200; // 0 to 200 meters above ground
                    
                    demoSunglarePoints.push({
                        lat: lat,
                        lng: lng,
                        elevation: elevation
                    });
                }

                // Clear any existing sunglare visualization first
                clearSunglareVisualization();

                // Create the 3D polyline for sun glare visualization
                const sunglarePolyline = new google.maps.Polyline({
                    path: demoSunglarePoints.map(point => ({
                        lat: point.lat,
                        lng: point.lng
                    })),
                    geodesic: true,
                    strokeColor: '#FF0000', // Red color for sun glare
                    strokeOpacity: 0.8,
                    strokeWeight: 6,
                    map: map,
                    zIndex: 1000 // Ensure it appears above other elements
                });

                // Add a semi-transparent tube effect for better 3D visualization
                const sunglarePolylineShadow = new google.maps.Polyline({
                    path: demoSunglarePoints.map(point => ({
                        lat: point.lat + 0.0002, // Slight offset for shadow effect
                        lng: point.lng + 0.0002
                    })),
                    geodesic: true,
                    strokeColor: '#FF4444',
                    strokeOpacity: 0.3,
                    strokeWeight: 8,
                    map: map,
                    zIndex: 999
                });

                // Store polylines for cleanup
                sunglarePolylines.push(sunglarePolyline);
                sunglarePolylines.push(sunglarePolylineShadow);

                // Add markers at high sun glare intensity points
                demoSunglarePoints.forEach((point, index) => {
                    if (point.elevation > 100) { // High intensity points
                        const marker = new google.maps.Marker({
                            position: { lat: point.lat, lng: point.lng },
                            map: map,
                            title: 'High Sun Glare Intensity: ' + Math.round(point.elevation) + 'm',
                            icon: {
                                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                                    '<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">' +
                                        '<circle cx="6" cy="6" r="5" fill="#FF0000" stroke="white" stroke-width="1"/>' +
                                        '<circle cx="6" cy="6" r="2" fill="yellow"/>' +
                                    '</svg>'
                                ),
                                scaledSize: new google.maps.Size(12, 12)
                            }
                        });
                        
                        // Store marker for cleanup
                        sunglareMarkers.push(marker);
                    }
                });

                // Demo 3D sun glare visualization added
            }

            // Polyline decoder function
            function decodePolyline(encoded) {
                if (!encoded || typeof encoded !== 'string' || encoded.length === 0) {
                    console.warn('Invalid polyline data:', encoded);
                    return [];
                }
                
                let points = [];
                let index = 0, len = encoded.length;
                let lat = 0, lng = 0;

                try {
                    while (index < len) {
                        let b, shift = 0, result = 0;
                        do {
                            b = encoded.charCodeAt(index++) - 63;
                            result |= (b & 0x1f) << shift;
                            shift += 5;
                        } while (b >= 0x20);
                        
                        let dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
                        lat += dlat;
                        
                        shift = 0;
                        result = 0;
                        do {
                            b = encoded.charCodeAt(index++) - 63;
                            result |= (b & 0x1f) << shift;
                            shift += 5;
                        } while (b >= 0x20);
                        
                        let dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
                        lng += dlng;
                        
                        points.push({
                            lat: lat / 1e5,
                            lng: lng / 1e5
                        });
                    }
                } catch (error) {
                    console.error('Error decoding polyline:', error);
                    return [];
                }
                
                return points;
            }

            // Process route data for development/sun glare analysis
            function processRouteData(directionsResult) {
                try {
                    if (!directionsResult || !directionsResult.routes || directionsResult.routes.length === 0) {
                        throw new Error('No routes found in directions result');
                    }
                    
                    const route = directionsResult.routes[0];
                    if (!route || !route.legs || route.legs.length === 0) {
                        throw new Error('No legs found in route');
                    }
                    
                    const leg = route.legs[0];
                    if (!leg.steps || leg.steps.length === 0) {
                        throw new Error('No steps found in route leg');
                    }
                    
                    // Extract segments from each step
                    const segments = leg.steps.map((step, index) => {
                        // Check if polyline data exists
                        const polylinePoints = (step.polyline && step.polyline.points) 
                            ? decodePolyline(step.polyline.points) 
                            : [];
                        
                        // Safely get instruction text
                        const instruction = step.html_instructions || step.instructions || 'Turn instruction';
                        const cleanInstruction = typeof instruction === 'string' 
                            ? instruction.replace(/<[^>]*>/g, '') 
                            : String(instruction);
                        
                        return {
                            points: polylinePoints,
                            distance: (step.distance && step.distance.value) || 0,
                            duration: (step.duration && step.duration.value) || 0,
                            instruction: cleanInstruction
                        };
                    });
                    
                    // Get all polyline points for the entire route
                    const allPolylinePoints = (route.overview_polyline && route.overview_polyline.points)
                        ? decodePolyline(route.overview_polyline.points)
                        : [];
                    
                    const routeProfile = {
                        segments: segments,
                        totalDistance: (leg.distance && leg.distance.value) || 0,
                        totalDuration: (leg.duration && leg.duration.value) || 0,
                        polylinePoints: allPolylinePoints,
                        rawDirectionsData: directionsResult // For debugging
                    };
                    
                    // Send route profile back to React Native
                    window.ReactNativeWebView?.postMessage(JSON.stringify({
                        type: 'routeProfile',
                        profile: routeProfile
                    }));
                    
                    // Route profile processed successfully
                    
                } catch (error) {
                    console.error('Error processing route data:', error, directionsResult);
                    window.ReactNativeWebView?.postMessage(JSON.stringify({
                        type: 'error',
                        message: 'Failed to process route profile: ' + error.message
                    }));
                }
            }

            // Handle messages from React Native
            window.addEventListener('message', function(event) {
                try {
                    const data = JSON.parse(event.data);
                    console.log('Received message:', data);
                    
                    switch(data.type) {
                        case 'loadRoute':
                            loadRoute(data.route);
                            break;
                        case 'clearRoute':
                            clearRoute();
                            break;
                        case 'fitToRoute':
                            fitToRoute();
                            break;
                        case 'toggle3D':
                            toggle3D();
                            break;
                        case 'toggleSunglare':
                            toggleSunglareVisualization();
                            break;
                        default:
                            console.log('Unknown message type:', data.type);
                    }
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });

            // Initialize when Google Maps API is loaded
            window.initMap = initMap;
        </script>
        
        <!-- Load Google Maps API -->
        <script async defer 
            src="https://maps.googleapis.com/maps/api/js?key=${config.googleMapsApiKey}&callback=initMap&libraries=geometry">
        </script>
    </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <IconSymbol name="map" size={28} color="#FFA500" />
          <Text style={styles.title}>Route Visualization</Text>
        </View>
        <Text style={styles.subtitle}>
          {isAnalyzing ? 'Loading route...' : 
           selectedRoute ? `Route: ${selectedRoute.name || 'Selected Route'}` : 
           'Select a route from Sunglare or Saved tabs to visualize'}
        </Text>
      </View>

      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: mapsHtml }}
          style={styles.webView}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          bounces={false}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
        
        {(isLoading || isAnalyzing) && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>
              {isAnalyzing ? 'Loading Route...' : 'Loading 3D Maps...'}
            </Text>
            <Text style={styles.loadingSubtext}>
              {isAnalyzing ? 'Preparing route visualization' : 'Initializing Google Maps'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.controlButton} onPress={toggle3DView}>
          <IconSymbol name="globe" size={20} color="#fff" />
          <Text style={styles.controlButtonText}>3D View</Text>
        </TouchableOpacity>
        
        {selectedRoute && (
          <>
            <TouchableOpacity style={styles.controlButton} onPress={fitToRoute}>
              <IconSymbol name="location.fill" size={20} color="#fff" />
              <Text style={styles.controlButtonText}>Fit Route</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.controlButton, styles.sunglareButton]} onPress={toggleSunglareView}>
              <IconSymbol name="sun.max.fill" size={20} color="#fff" />
              <Text style={styles.controlButtonText}>Sun Glare</Text>
            </TouchableOpacity>
          </>
        )}
        
        <TouchableOpacity 
          style={[styles.controlButton, styles.clearButton]} 
          onPress={clearRoute}
        >
          <Text style={styles.controlButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>3D Map Features</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <IconSymbol name="sun.max.fill" size={16} color="#FFA500" />
            <Text style={styles.infoText}>Satellite View</Text>
          </View>
          <View style={styles.infoItem}>
            <IconSymbol name="globe" size={16} color="#FFA500" />
            <Text style={styles.infoText}>3D Buildings</Text>
          </View>
          <View style={styles.infoItem}>
            <IconSymbol name="location.fill" size={16} color="#FFA500" />
            <Text style={styles.infoText}>Route Display</Text>
          </View>
          <View style={styles.infoItem}>
            <IconSymbol name="map" size={16} color="#FFA500" />
            <Text style={styles.infoText}>Pan & Zoom</Text>
          </View>
        </View>
        
        <Text style={styles.instructionsText}>
          Drag to pan, pinch to zoom, use 3D View button to tilt the map. Toggle Sun Glare to see demo sunglare visualization.
        </Text>
      </View>
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
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  loadingSubtext: {
    color: '#aaa',
    fontSize: 14,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 80,
    justifyContent: 'center',
  },
  clearButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  sunglareButton: {
    backgroundColor: 'rgba(255, 165, 0, 0.8)',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: '#111',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '48%',
    marginBottom: 8,
  },
  infoText: {
    color: '#ccc',
    fontSize: 14,
  },
  instructionsText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
