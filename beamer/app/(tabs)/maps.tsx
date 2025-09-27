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
import { useFocusEffect } from '@react-navigation/native';
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

  // Safety mechanism: If user navigates to maps tab and analyzing has been stuck for >30s, clear it
  useFocusEffect(
    React.useCallback(() => {
      // If analyzing state has been true for too long, clear it
      if (isAnalyzing) {
        const timeoutId = setTimeout(() => {
          console.log('Maps screen focus: clearing stuck analyzing state');
          setIsAnalyzing(false);
        }, 5000); // Clear after 5 seconds if still analyzing when tab focused
        
        return () => clearTimeout(timeoutId);
      }
    }, [isAnalyzing, setIsAnalyzing])
  );

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
      route: route,
      departureTime: currentRoute?.departureTime // Pass departure time to WebView
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
      } else if (data.type === 'glareAnalysis') {
        // Glare analysis data received - calculate per-segment averages
        if (currentRoute?.profile && data.data) {
          const glarePoints = data.data.glare_points;
          const segments = currentRoute.profile.segments;
          
          // Calculate average glare score for each segment
          const segmentsWithGlare = segments.map((segment, segmentIndex) => {
            // Find glare points that belong to this segment
            // This is a simplified approach - in practice you'd need to map glare points to segments more precisely
            const segmentStartIndex = Math.floor((segmentIndex / segments.length) * glarePoints.length);
            const segmentEndIndex = Math.floor(((segmentIndex + 1) / segments.length) * glarePoints.length);
            const segmentGlarePoints = glarePoints.slice(segmentStartIndex, segmentEndIndex);
            
            let avgGlareScore = 0;
            let glareRiskLevel: 'low' | 'medium' | 'high' = 'low';
            
            if (segmentGlarePoints.length > 0) {
              avgGlareScore = segmentGlarePoints.reduce((sum: number, point: any) => sum + point.glare_score, 0) / segmentGlarePoints.length;
              
              // Determine risk level
              if (avgGlareScore >= 0.7) {
                glareRiskLevel = 'high';
              } else if (avgGlareScore >= 0.3) {
                glareRiskLevel = 'medium';
              } else {
                glareRiskLevel = 'low';
              }
            }
            
            return {
              ...segment,
              avgGlareScore,
              glareRiskLevel
            };
          });
          
          // Update route with glare data
          const updatedRoute = {
            ...currentRoute,
            profile: {
              ...currentRoute.profile,
              segments: segmentsWithGlare,
              glareAnalysis: data.data.statistics
            }
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
                            
                            // After processing route data, analyze glare if route segments exist
                            analyzeRouteGlare(result);
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
                        
                        // Demo visualization removed - only using real glare index gradient
                        
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

            // Store glare gradient visualization elements for cleanup
            let sunglareVisible = true;
            let glareGradientPolylines = [];  // Store gradient polylines
            let sunDirectionArrows = [];     // Store sun direction arrows

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
                
                // Clear glare gradient visualization
                clearGlareGradient();
                clearSunDirectionArrows();
                
                currentRoute = null;
                console.log('Route cleared');
                
                // Send route cleared message to React Native
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                    type: 'routeCleared',
                    message: 'Route cleared successfully'
                }));
            }

            // Demo sunglare visualization cleanup removed - using real glare gradient only

            function clearGlareGradient() {
                // Remove all gradient polylines
                glareGradientPolylines.forEach(polyline => {
                    if (polyline) {
                        polyline.setMap(null);
                    }
                });
                glareGradientPolylines = [];
                console.log('Glare gradient cleared');
            }

            function clearSunDirectionArrows() {
                // Remove all sun direction arrows
                sunDirectionArrows.forEach(arrow => {
                    if (arrow) {
                        arrow.setMap(null);
                    }
                });
                sunDirectionArrows = [];
                console.log('Sun direction arrows cleared');
            }

            function toggleSunglareVisualization() {
                sunglareVisible = !sunglareVisible;
                
                if (sunglareVisible) {
                    // Show glare gradient visualization
                    glareGradientPolylines.forEach(element => {
                        if (element) {
                            element.setMap(map);
                        }
                    });
                    
                    // Show sun direction arrows
                    sunDirectionArrows.forEach(arrow => {
                        if (arrow) {
                            arrow.setMap(map);
                        }
                    });
                    
                    console.log('Glare gradient visualization shown');
                } else {
                    // Hide glare gradient visualization
                    glareGradientPolylines.forEach(element => {
                        if (element) {
                            element.setMap(null);
                        }
                    });
                    
                    // Hide sun direction arrows
                    sunDirectionArrows.forEach(arrow => {
                        if (arrow) {
                            arrow.setMap(null);
                        }
                    });
                    
                    console.log('Glare gradient visualization hidden');
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

            // Demo sunglare visualization function removed - using real glare index gradient only

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

            // Analyze route for glare index with real-time solar calculations
            async function analyzeRouteGlare(directionsResult) {
                try {
                    console.log('🌞 Starting glare analysis for route...');
                    
                    if (!directionsResult || !directionsResult.routes || directionsResult.routes.length === 0) {
                        throw new Error('No routes found for glare analysis');
                    }
                    
                    const route = directionsResult.routes[0];
                    const leg = route.legs[0];
                    
                    // Convert Google route data to our API format
                    const segments = leg.steps.map(step => {
                        const polylinePoints = (step.polyline && step.polyline.points) 
                            ? decodePolyline(step.polyline.points) 
                            : [];
                        
                        return {
                            points: polylinePoints.map(p => ({
                                lat: p.lat,
                                lng: p.lng
                            })),
                            distance: (step.distance && step.distance.value) || 0,
                            duration: (step.duration && step.duration.value) || 0,
                            instruction: step.html_instructions || step.instructions || 'Continue'
                        };
                    });
                    
                    // Use departure time from context (passed via route data)
                    const departureTime = window.routeDepartureTime || new Date().toISOString();
                    
                    // Call our glare analysis API
                    const response = await fetch('${config.apiUrl}/api/analyze-glare', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            segments: segments,
                            departure_time: departureTime,
                            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error('Glare analysis API request failed: ' + response.status);
                    }
                    
                    const glareData = await response.json();
                    console.log('🌞 Glare analysis completed:', glareData.statistics);
                    console.log('🌞 Total glare points received:', glareData.glare_points.length);
                    
                    // Log sample of glare data for debugging
                    if (glareData.glare_points.length > 0) {
                        console.log('🌞 Sample glare points:', glareData.glare_points.slice(0, 5));
                    }
                    
                    // Display gradient overlay on map
                    displayGlareGradient(glareData.glare_points);
                    
                    // Display sun direction arrows at start and end points
                    displaySunDirectionArrows(glareData.glare_points, currentRoute);
                    
                    // Send glare data to React Native
                    window.ReactNativeWebView?.postMessage(JSON.stringify({
                        type: 'glareAnalysis',
                        data: glareData
                    }));
                    
                } catch (error) {
                    console.error('🌞 Glare analysis failed:', error);
                    window.ReactNativeWebView?.postMessage(JSON.stringify({
                        type: 'glareError',
                        message: 'Glare analysis failed: ' + error.message
                    }));
                }
            }

            function displayGlareGradient(glarePoints) {
                // Clear existing gradient
                clearGlareGradient();
                
                if (!glarePoints || glarePoints.length === 0) {
                    console.log('No glare points to display');
                    return;
                }
                
                console.log('🌈 Displaying glare gradient with', glarePoints.length, 'points');
                
                // Create individual small polylines for each consecutive pair of points
                // This creates a smooth gradient effect
                for (let i = 0; i < glarePoints.length - 1; i++) {
                    const point1 = glarePoints[i];
                    const point2 = glarePoints[i + 1];
                    
                    // Use the average color and score of the two points
                    const avgScore = (point1.glare_score + point2.glare_score) / 2;
                    
                    // Create polyline for this small segment
                    const polyline = new google.maps.Polyline({
                        path: [
                            { lat: point1.lat, lng: point1.lng },
                            { lat: point2.lat, lng: point2.lng }
                        ],
                        geodesic: true,
                        strokeColor: point1.color, // Use first point's color
                        strokeOpacity: Math.max(0.6, avgScore), // More opaque for higher scores
                        strokeWeight: Math.max(6, 12 * avgScore), // Thicker for higher scores
                        map: map,
                        zIndex: 2000 // Above other route elements
                    });
                    
                    glareGradientPolylines.push(polyline);
                }
                
                // Add markers for high glare areas (every 10th point to avoid clutter)
                let markerCount = 0;
                for (let i = 0; i < glarePoints.length; i += 10) {
                    const point = glarePoints[i];
                    if (point.glare_score > 0.7 && markerCount < 20) { // Limit to 20 markers max
                        const marker = new google.maps.Marker({
                            position: {
                                lat: point.lat,
                                lng: point.lng
                            },
                            map: map,
                            title: 'High Glare Risk: ' + (point.glare_score * 100).toFixed(0) + '%\\nTime: ' + new Date(point.timestamp).toLocaleTimeString() + '\\nSun Elevation: ' + point.sun_elevation.toFixed(1) + '°\\nHeading: ' + point.heading.toFixed(1) + '°',
                            icon: {
                                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                                    '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">' +
                                        '<circle cx="10" cy="10" r="9" fill="' + point.color + '" stroke="white" stroke-width="2"/>' +
                                        '<circle cx="10" cy="10" r="4" fill="yellow" opacity="0.9"/>' +
                                        '<text x="10" y="13" text-anchor="middle" fill="black" font-size="10" font-weight="bold">☀</text>' +
                                    '</svg>'
                                ),
                                scaledSize: new google.maps.Size(20, 20)
                            }
                        });
                        
                        glareGradientPolylines.push(marker); // Store for cleanup
                        markerCount++;
                    }
                }
                
                console.log('🌈 Glare gradient displayed with', glareGradientPolylines.length, 'elements');
                console.log('🌈 Glare score range:', Math.min(...glarePoints.map(p => p.glare_score)).toFixed(3), 'to', Math.max(...glarePoints.map(p => p.glare_score)).toFixed(3));
            }

            function displaySunDirectionArrows(glarePoints, route) {
                // Clear existing arrows
                clearSunDirectionArrows();
                
                if (!glarePoints || glarePoints.length === 0 || !route) {
                    console.log('No glare points or route data for sun arrows');
                    return;
                }
                
                console.log('🌅 Creating sun direction arrows');
                
                // Get start and end points of the route
                const startPoint = {
                    lat: route.start.latitude,
                    lng: route.start.longitude
                };
                const endPoint = {
                    lat: route.end.latitude, 
                    lng: route.end.longitude
                };
                
                // Find glare data for start and end points (use closest available)
                const startGlare = glarePoints[0] || null;
                const endGlare = glarePoints[glarePoints.length - 1] || null;
                
                // Create arrow at start point
                if (startGlare) {
                    createSunArrow(startPoint, startGlare.sun_azimuth, 'Start: Sun Direction', '#34C759');
                }
                
                // Create arrow at end point  
                if (endGlare) {
                    createSunArrow(endPoint, endGlare.sun_azimuth, 'End: Sun Direction', '#FF3B30');
                }
                
                console.log('🌅 Sun direction arrows created');
            }
            
            function createSunArrow(position, sunAzimuth, title, color) {
                // Calculate arrow end point (500 meters in sun direction)
                const arrowLength = 500; // meters
                const earthRadius = 6371000; // meters
                
                // Convert azimuth to radians (Google Maps uses degrees from North, clockwise)
                const azimuthRad = (sunAzimuth * Math.PI) / 180;
                
                // Calculate offset in lat/lng
                const latOffset = (arrowLength * Math.cos(azimuthRad)) / earthRadius * (180 / Math.PI);
                const lngOffset = (arrowLength * Math.sin(azimuthRad)) / earthRadius * (180 / Math.PI) / Math.cos(position.lat * Math.PI / 180);
                
                const arrowEnd = {
                    lat: position.lat + latOffset,
                    lng: position.lng + lngOffset
                };
                
                // Create arrow line
                const arrowLine = new google.maps.Polyline({
                    path: [position, arrowEnd],
                    geodesic: true,
                    strokeColor: color,
                    strokeOpacity: 0.8,
                    strokeWeight: 4,
                    map: map,
                    zIndex: 3000 // Above glare gradient
                });
                
                // Create arrowhead using a marker with custom SVG
                const arrowHead = new google.maps.Marker({
                    position: arrowEnd,
                    map: map,
                    title: title + '\\nSun Azimuth: ' + sunAzimuth.toFixed(1) + '°',
                    icon: {
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                            '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">' +
                                '<defs>' +
                                    '<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">' +
                                        '<polygon points="0 0, 10 3.5, 0 7" fill="' + color + '" />' +
                                    '</marker>' +
                                '</defs>' +
                                '<circle cx="10" cy="10" r="8" fill="' + color + '" stroke="white" stroke-width="2"/>' +
                                '<text x="10" y="13" text-anchor="middle" fill="white" font-size="12" font-weight="bold">☀</text>' +
                            '</svg>'
                        ),
                        scaledSize: new google.maps.Size(20, 20),
                        anchor: new google.maps.Point(10, 10)
                    }
                });
                
                // Store both line and marker for cleanup
                sunDirectionArrows.push(arrowLine);
                sunDirectionArrows.push(arrowHead);
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
                            // Store departure time for glare analysis
                            if (data.departureTime) {
                                window.routeDepartureTime = data.departureTime;
                            }
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
        <script>
            // Fetch Maps API key from our secure server
            fetch('${config.apiUrl}/api/maps-key')
                .then(response => response.json())
                .then(data => {
                    const script = document.createElement('script');
                    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + data.key + '&callback=initMap&libraries=geometry';
                    script.async = true;
                    script.defer = true;
                    document.head.appendChild(script);
                })
                .catch(error => {
                    console.error('Failed to load Maps API key:', error);
                    window.ReactNativeWebView?.postMessage(JSON.stringify({
                        type: 'error',
                        message: 'Failed to load Maps API key: ' + error.message
                    }));
                });
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
