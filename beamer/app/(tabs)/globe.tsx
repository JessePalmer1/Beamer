import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';

const threeTerrainHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Three.js Terrain Viewer</title>
    <style>
        html, body {
            width: 100%; 
            height: 100%; 
            margin: 0; 
            padding: 0; 
            overflow: hidden;
            background-color: #000;
        }
        #terrainContainer {
            width: 100%;
            height: 100vh;
        }
        .loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-family: Arial, sans-serif;
            font-size: 16px;
        }
        .error {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #ff6b6b;
            font-family: Arial, sans-serif;
            font-size: 14px;
            text-align: center;
            max-width: 80%;
        }
    </style>
</head>
<body>
    <div id="terrainContainer"></div>
    <div id="loadingText" class="loading">Loading terrain...</div>
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script>
        let scene, camera, renderer;
        let terrain = null;
        let sunSphere = null;
        let sunRay = null;
        let currentLocation = { lat: 37.7749, lon: -122.4194, name: 'San Francisco' };
        let terrainRadius = 5.0; // km - configurable radius
        let isLoading = false; // Prevent multiple simultaneous loads
        let loadingTimeout = null; // Timeout to reset loading flag
        
        function hideLoading() {
            const loadingEl = document.getElementById('loadingText');
            if (loadingEl) loadingEl.style.display = 'none';
        }
        
        function showError(message) {
            hideLoading();
            const container = document.getElementById('terrainContainer');
            container.innerHTML = '<div class="error">Error: ' + message + '</div>';
        }
        
        function checkThreeJS() {
            if (typeof THREE === 'undefined') {
                showError('Three.js library failed to load. Please check your internet connection.');
                return false;
            }
            return true;
        }
        
        async function fetchElevationData(location, gridSize) {
            try {
                console.log('Fetching real elevation data for:', location, 'radius:', terrainRadius + 'km');
                
                // Create a grid of coordinates around the location
                const radius = terrainRadius / 111.0; // Convert km to degrees (roughly)
                const step = (radius * 2) / (gridSize - 1);
                const coordinates = [];
                
                for (let i = 0; i < gridSize; i++) {
                    for (let j = 0; j < gridSize; j++) {
                        const lat = location.lat - radius + (i * step);
                        const lon = location.lon - radius + (j * step);
                        coordinates.push([lat, lon]);
                    }
                }
                
                // Split into batches of 100 (API limit)
                const batchSize = 100;
                const elevations = [];
                
                for (let i = 0; i < coordinates.length; i += batchSize) {
                    const batch = coordinates.slice(i, i + batchSize);
                    const locationStr = batch.map(coord => coord[0].toFixed(6) + ',' + coord[1].toFixed(6)).join('|');
                    
                    const response = await fetch('https://api.opentopodata.org/v1/srtm90m?locations=' + encodeURIComponent(locationStr));
                    
                    if (!response.ok) {
                        throw new Error('Elevation API request failed: ' + response.status);
                    }
                    
                    const data = await response.json();
                    
                    if (!data.results || data.results.length === 0) {
                        throw new Error('No elevation data returned');
                    }
                    
                    // Extract elevations, use 0 for null values (water/missing data)
                    const batchElevations = data.results.map(result => result.elevation || 0);
                    elevations.push(...batchElevations);
                    
                    // Add small delay between requests to be nice to the API
                    if (i + batchSize < coordinates.length) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
                
                console.log('Successfully fetched', elevations.length, 'elevation points');
                return elevations;
                
            } catch (error) {
                console.error('Failed to fetch elevation data:', error);
                // Fallback to procedural generation if API fails
                return generateFallbackTerrain(gridSize, location);
            }
        }
        
        function generateFallbackTerrain(size, location) {
            console.log('Using fallback terrain generation for', location.name);
            const elevations = [];
            
            // Use location coordinates to create unique terrain patterns
            const latSeed = location.lat * 100;
            const lonSeed = location.lon * 100;
            
            for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) {
                    const x = (i - size/2) * 0.1;
                    const z = (j - size/2) * 0.1;
                    
                    // Create location-specific terrain patterns
                    let height = 0;
                    
                    // Primary terrain features based on location
                    height += Math.sin(x * 0.2 + latSeed * 0.001) * 300;
                    height += Math.cos(z * 0.15 + lonSeed * 0.001) * 250;
                    
                    // Secondary features for complexity
                    height += Math.sin(x * 0.5 + latSeed * 0.002) * 150;
                    height += Math.cos(z * 0.4 + lonSeed * 0.002) * 100;
                    
                    // Fine detail based on location
                    height += Math.sin(x * 1.2 + latSeed * 0.01) * Math.cos(z * 1.1 + lonSeed * 0.01) * 80;
                    
                    // Add location-specific randomness
                    const locationRandom = Math.sin(latSeed + lonSeed + i * 0.1 + j * 0.1);
                    height += locationRandom * 60;
                    
                    // Different base heights for different regions
                    let baseHeight = 100;
                    if (Math.abs(location.lat) > 60) baseHeight = 200; // Polar regions
                    if (Math.abs(location.lat) < 20) baseHeight = 50;  // Tropical regions
                    
                    // Ensure non-negative heights
                    height = Math.max(10, height + baseHeight);
                    
                    elevations.push(height);
                }
            }
            
            console.log('Generated fallback terrain with elevation range:', 
                       Math.min(...elevations), 'to', Math.max(...elevations), 'meters');
            
            return elevations;
        }
        
        // Calculate tile coordinates for satellite imagery
        function getTileCoordinates(lat, lon, zoom) {
            const latRad = lat * Math.PI / 180;
            const n = Math.pow(2, zoom);
            const x = Math.floor((lon + 180) / 360 * n);
            const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n);
            return { x, y, z: zoom };
        }

        // Load satellite imagery texture with multiple tile sources
        async function loadSatelliteTexture(location, zoom = 14) {
            try {
                console.log('Loading satellite imagery for:', location.name, 'at zoom level', zoom);
                
                // Calculate center tile coordinates
                const centerTile = getTileCoordinates(location.lat, location.lon, zoom);
                
                // Define multiple free satellite imagery sources
                const imageSources = [
                    {
                        name: 'ESRI World Imagery',
                        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + centerTile.z + '/' + centerTile.y + '/' + centerTile.x,
                        attribution: 'ESRI'
                    },
                    {
                        name: 'OpenStreetMap Standard',
                        url: 'https://tile.openstreetmap.org/' + centerTile.z + '/' + centerTile.x + '/' + centerTile.y + '.png',
                        attribution: 'OpenStreetMap'
                    },
                    {
                        name: 'CartoDB Positron',
                        url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/' + centerTile.z + '/' + centerTile.x + '/' + centerTile.y + '.png',
                        attribution: 'CartoDB'
                    }
                ];
                
                // Try each source until one works
                for (const source of imageSources) {
                    console.log('Trying imagery source:', source.name, '-', source.url);
                    
                    const texture = await tryLoadTexture(source.url);
                    if (texture) {
                        console.log('Successfully loaded satellite imagery from:', source.name);
                        return texture;
                    }
                }
                
                console.warn('All satellite imagery sources failed, using fallback');
                return null;
                
            } catch (error) {
                console.error('Error setting up satellite texture:', error);
                return null;
            }
        }

        // Helper function to try loading a texture
        function tryLoadTexture(url) {
            return new Promise((resolve) => {
                const textureLoader = new THREE.TextureLoader();
                
                // Set a timeout for the request
                const timeoutId = setTimeout(() => {
                    console.warn('Texture loading timeout for:', url);
                    resolve(null);
                }, 10000); // 10 second timeout
                
                textureLoader.load(
                    url,
                    function(texture) {
                        clearTimeout(timeoutId);
                        
                        // Configure texture for optimal terrain mapping
                        texture.wrapS = THREE.ClampToEdgeWrapping;
                        texture.wrapT = THREE.ClampToEdgeWrapping;
                        texture.minFilter = THREE.LinearFilter;
                        texture.magFilter = THREE.LinearFilter;
                        texture.flipY = false;
                        
                        // Enhance contrast and saturation for terrain visibility
                        texture.encoding = THREE.sRGBEncoding;
                        
                        resolve(texture);
                    },
                    function(progress) {
                        // Progress callback
                        if (progress.total > 0) {
                            const percent = Math.round((progress.loaded / progress.total) * 100);
                            console.log('Loading satellite imagery:', percent + '%');
                        }
                    },
                    function(error) {
                        clearTimeout(timeoutId);
                        console.error('Failed to load texture from:', url, error);
                        resolve(null);
                    }
                );
            });
        }

        async function createTerrain(location) {
            const size = 64; // Grid resolution
            const terrainSize = terrainRadius * 2000; // Scale terrain size based on radius
            
            // Fetch real elevation data
            const elevations = await fetchElevationData(location, size);
            
            // Find min/max elevations for scaling
            const minElevation = Math.min(...elevations);
            const maxElevation = Math.max(...elevations);
            const elevationRange = maxElevation - minElevation;
            
            console.log('Elevation range for', location.name + ':', minElevation, 'to', maxElevation, 'meters');
            console.log('Creating 3D terrain with', elevations.length, 'elevation points');
            
            // Create geometry
            const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, size - 1, size - 1);
            const vertices = geometry.attributes.position.array;
            
            // Apply real elevation data to create 3D terrain
            for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) {
                    const elevationIndex = i * size + j;
                    
                    // Calculate vertex index in the geometry array
                    // PlaneGeometry vertices are arranged differently than our grid
                    const vertexIndex = (i * size + j) * 3;
                    
                    if (vertexIndex + 2 < vertices.length && elevationIndex < elevations.length) {
                        // Scale elevation for better visibility
                        let height = elevations[elevationIndex];
                        
                        // Normalize to relative height and amplify
                        if (elevationRange > 0) {
                            height = ((height - minElevation) / elevationRange) * Math.max(1000, elevationRange * 3);
                        } else {
                            height = 0; // Flat terrain
                        }
                        
                        // Apply height to Z coordinate (height in the plane)
                        vertices[vertexIndex + 2] = height;
                    }
                }
            }
            
            // Update geometry
            geometry.attributes.position.needsUpdate = true;
            geometry.computeVertexNormals();
            
            // Load satellite imagery texture
            console.log('SATELLITE IMAGERY: Loading satellite imagery for terrain...');
            const satelliteTexture = await loadSatelliteTexture(location, 14);
            
            let material;
            if (satelliteTexture) {
                // Create material with satellite imagery
                material = new THREE.MeshLambertMaterial({
                    map: satelliteTexture,
                    side: THREE.DoubleSide
                });
                console.log('SATELLITE IMAGERY: Successfully applied satellite imagery to terrain');
            } else {
                // Fallback to height-based coloring if texture loading fails
                console.log('Falling back to height-based terrain coloring');
                material = new THREE.MeshLambertMaterial({
                    vertexColors: false,
                    side: THREE.DoubleSide
                });
                
                // Add vertex colors based on elevation
                const colors = new Float32Array(vertices.length);
                for (let i = 0; i < vertices.length; i += 3) {
                    const height = vertices[i + 2];
                    const normalizedHeight = elevationRange > 0 ? 
                        height / Math.max(1000, elevationRange * 3) : 0;
                    
                    // Color based on height: blue (low) -> green (mid) -> brown (high)
                    if (normalizedHeight < 0.3) {
                        colors[i] = 0.2 + normalizedHeight;     // R
                        colors[i + 1] = 0.6 + normalizedHeight; // G
                        colors[i + 2] = 0.3;                   // B
                    } else if (normalizedHeight < 0.7) {
                        colors[i] = 0.4 + normalizedHeight * 0.3;     // R
                        colors[i + 1] = 0.8;                         // G
                        colors[i + 2] = 0.2;                         // B
                    } else {
                        colors[i] = 0.6 + normalizedHeight * 0.4;     // R
                        colors[i + 1] = 0.4 + normalizedHeight * 0.2; // G
                        colors[i + 2] = 0.2;                         // B
                    }
                }
                
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                material.vertexColors = true;
            }
            
            // Create terrain mesh
            const terrainMesh = new THREE.Mesh(geometry, material);
            
            // Rotate to be horizontal (looking down at terrain)
            terrainMesh.rotation.x = -Math.PI / 2;
            terrainMesh.receiveShadow = true;
            terrainMesh.castShadow = true;
            
            // Create terrain group (no wireframe needed with satellite imagery)
            const terrainGroup = new THREE.Group();
            terrainGroup.add(terrainMesh);
            
            // Store elevation info for camera positioning
            terrainGroup.userData = {
                elevationRange: elevationRange,
                maxHeight: Math.max(1000, elevationRange * 3),
                size: terrainSize,
                hasSatelliteImagery: !!satelliteTexture
            };
            
            return terrainGroup;
        }
        
        function forceCleanupScene() {
            console.log('FORCE CLEANUP: Starting aggressive scene cleanup');
            
            // Log scene before cleanup
            logSceneStats();
            
            // Get all objects that are not lights
            const objectsToRemove = [];
            scene.traverse((child) => {
                if (child !== scene && !child.isLight && child !== camera) {
                    objectsToRemove.push(child);
                    console.log('MARKED FOR REMOVAL:', child.constructor.name, child.uuid);
                }
            });
            
            console.log('FORCE CLEANUP: Found', objectsToRemove.length, 'objects to remove');
            
            // Remove and dispose of all objects
            let disposedGeometries = 0;
            let disposedMaterials = 0;
            
            objectsToRemove.forEach((object, index) => {
                console.log('REMOVING OBJECT', index + 1, '/', objectsToRemove.length, ':', object.constructor.name);
                
                if (object.parent) {
                    object.parent.remove(object);
                }
                
                // Dispose of geometry and materials
                if (object.geometry) {
                    object.geometry.dispose();
                    disposedGeometries++;
                }
                
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => {
                            if (material.map) material.map.dispose();
                            material.dispose();
                            disposedMaterials++;
                        });
                    } else {
                        if (object.material.map) object.material.map.dispose();
                        object.material.dispose();
                        disposedMaterials++;
                    }
                }
            });
            
            // Clear ALL references
            terrain = null;
            sunSphere = null;
            sunRay = null;
            
            // Force multiple renders to ensure cleanup is applied
            if (renderer) {
                renderer.render(scene, camera);
                renderer.render(scene, camera);
                renderer.render(scene, camera);
            }
            
            console.log('FORCE CLEANUP: Disposed', disposedGeometries, 'geometries and', disposedMaterials, 'materials');
            console.log('FORCE CLEANUP: Scene cleaned, logging final state:');
            
            // Log scene after cleanup
            logSceneStats();
        }

        function disposeTerrain() {
            console.log('Disposing terrain - current scene children:', scene.children.length);
            
            // Use aggressive cleanup
            forceCleanupScene();
        }

        function disposeSunObjects() {
            console.log('Disposing of sun objects');
            
            // Dispose sun sphere
            if (sunSphere) {
                if (sunSphere.geometry) sunSphere.geometry.dispose();
                if (sunSphere.material) sunSphere.material.dispose();
                scene.remove(sunSphere);
                sunSphere = null;
                console.log('Sun sphere disposed');
            }
            
            // Dispose sun ray
            if (sunRay) {
                if (sunRay.geometry) sunRay.geometry.dispose();
                if (sunRay.material) sunRay.material.dispose();
                scene.remove(sunRay);
                sunRay = null;
                console.log('Sun ray disposed');
            }
        }

        function createSunSphere() {
            // Clean up existing sun objects first
            disposeSunObjects();
            
            // Create sun sphere
            const sunGeometry = new THREE.SphereGeometry(200, 16, 16);
            const sunMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xffff00,
                emissive: 0xffaa00,
                emissiveIntensity: 0.3
            });
            sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
            
            // Position sun above and to the side of terrain (simulating sunglare angle)
            const sunDistance = 8000;
            const sunHeight = 6000;
            sunSphere.position.set(sunDistance * 0.7, sunHeight, sunDistance * 0.7);
            scene.add(sunSphere);
            
            // Create raycast line from sun to terrain center
            const rayGeometry = new THREE.BufferGeometry();
            const rayPoints = [
                sunSphere.position.clone(),
                new THREE.Vector3(0, 0, 0) // Terrain center
            ];
            rayGeometry.setFromPoints(rayPoints);
            
            const rayMaterial = new THREE.LineBasicMaterial({ 
                color: 0xffff00,
                transparent: true,
                opacity: 0.6,
                linewidth: 2
            });
            
            sunRay = new THREE.Line(rayGeometry, rayMaterial);
            scene.add(sunRay);
            
            console.log('Sun sphere and raycast created');
        }
        
        function updateSunPosition(azimuth, altitude) {
            if (!sunSphere || !terrain) return;
            
            // Convert sun angles to 3D position
            const sunDistance = 8000;
            const azimuthRad = (azimuth * Math.PI) / 180;
            const altitudeRad = (altitude * Math.PI) / 180;
            
            const x = sunDistance * Math.cos(altitudeRad) * Math.sin(azimuthRad);
            const y = sunDistance * Math.sin(altitudeRad);
            const z = sunDistance * Math.cos(altitudeRad) * Math.cos(azimuthRad);
            
            sunSphere.position.set(x, y, z);
            
            // Update raycast
            if (sunRay) {
                const rayGeometry = sunRay.geometry;
                const rayPoints = [
                    sunSphere.position.clone(),
                    new THREE.Vector3(0, 0, 0) // Terrain center
                ];
                rayGeometry.setFromPoints(rayPoints);
                rayGeometry.attributes.position.needsUpdate = true;
            }
        }
        
        function initThreeJS() {
            try {
                console.log('Checking Three.js availability...');
                if (!checkThreeJS()) return;
                
                console.log('Three.js loaded successfully, version:', THREE.REVISION);
                
                const container = document.getElementById('terrainContainer');
                
                // Scene
                scene = new THREE.Scene();
                scene.background = new THREE.Color(0x001122);
                
                // Camera - set up for 3D terrain viewing
                camera = new THREE.PerspectiveCamera(
                    75, 
                    window.innerWidth / window.innerHeight, 
                    1, 
                    50000
                );
                camera.position.set(8000, 4000, 8000);
                camera.lookAt(0, 0, 0);
                
                // Renderer
                renderer = new THREE.WebGLRenderer({ antialias: true });
                renderer.setSize(window.innerWidth, window.innerHeight);
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                container.appendChild(renderer.domElement);
                
                // Lighting for 3D terrain
                const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
                scene.add(ambientLight);
                
                // Main directional light (sun)
                const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
                directionalLight.position.set(5000, 8000, 3000);
                directionalLight.castShadow = true;
                directionalLight.shadow.mapSize.width = 4096;
                directionalLight.shadow.mapSize.height = 4096;
                directionalLight.shadow.camera.near = 1000;
                directionalLight.shadow.camera.far = 20000;
                directionalLight.shadow.camera.left = -8000;
                directionalLight.shadow.camera.right = 8000;
                directionalLight.shadow.camera.top = 8000;
                directionalLight.shadow.camera.bottom = -8000;
                scene.add(directionalLight);
                
                // Secondary light to fill shadows
                const fillLight = new THREE.DirectionalLight(0xaaaaff, 0.3);
                fillLight.position.set(-3000, 4000, -3000);
                scene.add(fillLight);
                
                // Basic controls (mouse interaction)
                setupMouseControls();
                
                // Resize handler
                window.addEventListener('resize', onWindowResize, false);
                
                console.log('Three.js initialized successfully');
                loadTerrain();
                
            } catch (error) {
                console.error('Three.js initialization error:', error);
                showError('Failed to initialize 3D viewer: ' + error.message);
            }
        }
        
        function setupMouseControls() {
            let isMouseDown = false;
            let mouseX = 0, mouseY = 0;
            let spherical = new THREE.Spherical();
            let target = new THREE.Vector3(0, 0, 0);
            
            // Initialize spherical coordinates for orbital camera
            spherical.radius = 8000;  // Distance from target
            spherical.phi = Math.PI * 0.3;    // Vertical angle (0 = top, PI = bottom)
            spherical.theta = 0;              // Horizontal angle
            
            const minDistance = 500;
            const maxDistance = 25000;
            const minPolarAngle = 0.1; // Prevent camera from going too high
            const maxPolarAngle = Math.PI * 0.8; // Prevent camera from going underground
            
            // Touch handling for pinch-to-zoom
            let touches = [];
            let lastTouchDistance = 0;
            
            renderer.domElement.addEventListener('mousedown', (event) => {
                isMouseDown = true;
                mouseX = event.clientX;
                mouseY = event.clientY;
            });
            
            renderer.domElement.addEventListener('mousemove', (event) => {
                if (!isMouseDown) return;
                
                const deltaX = event.clientX - mouseX;
                const deltaY = event.clientY - mouseY;
                
                // Rotate around the terrain
                spherical.theta -= deltaX * 0.01;  // Horizontal rotation
                spherical.phi += deltaY * 0.01;    // Vertical rotation
                
                // Constrain vertical rotation
                spherical.phi = Math.max(minPolarAngle, Math.min(maxPolarAngle, spherical.phi));
                
                mouseX = event.clientX;
                mouseY = event.clientY;
            });
            
            renderer.domElement.addEventListener('mouseup', () => {
                isMouseDown = false;
            });
            
            renderer.domElement.addEventListener('wheel', (event) => {
                const delta = event.deltaY;
                const zoomSpeed = 0.95;
                
                if (delta > 0) {
                    spherical.radius = Math.min(spherical.radius / zoomSpeed, maxDistance);
                } else {
                    spherical.radius = Math.max(spherical.radius * zoomSpeed, minDistance);
                }
                
                event.preventDefault();
            });
            
            // Touch events with pinch-to-zoom support
            function getTouchDistance(touches) {
                const dx = touches[0].clientX - touches[1].clientX;
                const dy = touches[0].clientY - touches[1].clientY;
                return Math.sqrt(dx * dx + dy * dy);
            }
            
            renderer.domElement.addEventListener('touchstart', (event) => {
                touches = Array.from(event.touches);
                
                if (touches.length === 1) {
                    // Single finger - rotation
                    isMouseDown = true;
                    mouseX = touches[0].clientX;
                    mouseY = touches[0].clientY;
                } else if (touches.length === 2) {
                    // Two fingers - pinch to zoom
                    isMouseDown = false;
                    lastTouchDistance = getTouchDistance(touches);
                }
                event.preventDefault();
            });
            
            renderer.domElement.addEventListener('touchmove', (event) => {
                touches = Array.from(event.touches);
                
                if (touches.length === 1 && isMouseDown) {
                    // Single finger rotation
                    const deltaX = touches[0].clientX - mouseX;
                    const deltaY = touches[0].clientY - mouseY;
                    
                    spherical.theta -= deltaX * 0.008;  // Slightly slower for better control
                    spherical.phi += deltaY * 0.008;
                    spherical.phi = Math.max(minPolarAngle, Math.min(maxPolarAngle, spherical.phi));
                    
                    mouseX = touches[0].clientX;
                    mouseY = touches[0].clientY;
                } else if (touches.length === 2) {
                    // Two finger pinch-to-zoom
                    const currentDistance = getTouchDistance(touches);
                    const deltaDistance = currentDistance - lastTouchDistance;
                    
                    // Scale zoom speed appropriately
                    const zoomSpeed = 0.02;
                    const scaleFactor = 1 - (deltaDistance * zoomSpeed);
                    
                    spherical.radius = Math.max(minDistance, Math.min(maxDistance, spherical.radius * scaleFactor));
                    lastTouchDistance = currentDistance;
                }
                event.preventDefault();
            });
            
            renderer.domElement.addEventListener('touchend', (event) => {
                touches = Array.from(event.touches);
                
                if (touches.length < 2) {
                    isMouseDown = false;
                }
                if (touches.length === 1) {
                    // Reset single finger tracking
                    mouseX = touches[0].clientX;
                    mouseY = touches[0].clientY;
                    isMouseDown = true;
                }
                event.preventDefault();
            });
            
            // Update camera position based on spherical coordinates
            function updateCamera() {
                if (terrain) {
                    // Convert spherical to cartesian coordinates
                    const position = new THREE.Vector3();
                    position.setFromSpherical(spherical);
                    position.add(target);
                    
                    camera.position.copy(position);
                    camera.lookAt(target);
                }
                requestAnimationFrame(updateCamera);
            }
            updateCamera();
        }
        
        async function loadTerrain() {
            // Prevent multiple simultaneous loads
            if (isLoading) {
                console.log('LOAD TERRAIN: Already loading, skipping request');
                return;
            }
            
            isLoading = true;
            console.log('LOAD TERRAIN: Starting load for:', currentLocation);
            
            // Set timeout to reset loading flag if operation gets stuck
            if (loadingTimeout) {
                clearTimeout(loadingTimeout);
            }
            loadingTimeout = setTimeout(() => {
                console.warn('LOAD TERRAIN: Loading timeout - resetting loading flag');
                isLoading = false;
                loadingTimeout = null;
            }, 30000); // 30 second timeout
            
            try {
                // FORCE cleanup before loading new terrain
                console.log('LOAD TERRAIN: Force cleaning scene before load');
                forceCleanupScene();
                
                // Add a small delay to ensure cleanup is complete
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Show loading message in console
                console.log('Fetching elevation data...');
                
                // Create terrain with real elevation data (this is async now)
                terrain = await createTerrain(currentLocation);
                scene.add(terrain);
                
                // Position terrain at origin
                terrain.position.set(0, 0, 0);
                
                // Adjust camera based on terrain characteristics
                const terrainData = terrain.userData;
                const maxHeight = terrainData.maxHeight || 1000;
                const terrainSize = terrainData.size || 10000;
                
                // Set camera at a good distance and angle to view the terrain
                const cameraDistance = Math.max(terrainSize * 0.8, maxHeight * 8);
                camera.position.set(cameraDistance * 0.7, maxHeight * 2, cameraDistance * 0.7);
                camera.lookAt(0, maxHeight * 0.3, 0); // Look slightly above the terrain base
                
                console.log('Camera positioned at distance:', cameraDistance, 'height:', maxHeight);
                
                // Create sun sphere and raycast
                createSunSphere();
                
                hideLoading();
                animate();
                
                // Send ready message
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'ready',
                        message: 'Real terrain loaded for ' + currentLocation.name + ' (elevation range: ' + 
                                terrainData.elevationRange + 'm, radius: ' + terrainRadius + 'km)'
                    }));
                }
                
                console.log('LOAD TERRAIN: Successfully loaded for', currentLocation.name);
                
            } catch (error) {
                console.error('LOAD TERRAIN: Error loading terrain:', error);
                showError('Failed to load terrain: ' + error.message);
                
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'error',
                        message: 'Failed to load terrain: ' + error.message
                    }));
                }
            } finally {
                // Clear timeout and reset loading flag
                if (loadingTimeout) {
                    clearTimeout(loadingTimeout);
                    loadingTimeout = null;
                }
                isLoading = false;
                console.log('LOAD TERRAIN: Loading flag reset');
            }
        }
        
        function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }
        
        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        function logSceneStats() {
            if (scene) {
                console.log('=== SCENE STATISTICS ===');
                console.log('Total children count:', scene.children.length);
                
                let meshCount = 0;
                let geometryCount = 0;
                let materialCount = 0;
                let lightCount = 0;
                let groupCount = 0;
                
                scene.traverse((child) => {
                    if (child.isMesh) {
                        meshCount++;
                        console.log('- Mesh found:', child.constructor.name, child.uuid);
                        if (child.geometry) geometryCount++;
                        if (child.material) materialCount++;
                    } else if (child.isLight) {
                        lightCount++;
                        console.log('- Light found:', child.constructor.name);
                    } else if (child.isGroup) {
                        groupCount++;
                        console.log('- Group found:', child.constructor.name, 'children:', child.children.length);
                    } else if (child !== scene) {
                        console.log('- Other object:', child.constructor.name, child.uuid);
                    }
                });
                
                console.log('SUMMARY: Meshes:', meshCount, 'Groups:', groupCount, 'Lights:', lightCount);
                console.log('RESOURCES: Geometries:', geometryCount, 'Materials:', materialCount);
                console.log('TERRAIN REF:', terrain ? 'EXISTS' : 'NULL');
                console.log('SUN REF:', sunSphere ? 'EXISTS' : 'NULL');
                console.log('========================');
            }
        }

        function cleanupAll() {
            console.log('Cleaning up all Three.js objects');
            logSceneStats();
            
            // Dispose terrain and sun objects
            disposeTerrain();
            disposeSunObjects();
            
            // Clean up renderer
            if (renderer) {
                renderer.dispose();
                if (renderer.domElement && renderer.domElement.parentNode) {
                    renderer.domElement.parentNode.removeChild(renderer.domElement);
                }
            }
            
            // Clear scene
            if (scene) {
                scene.clear();
            }
            
            console.log('Cleanup completed');
            logSceneStats();
            
            // Force garbage collection if available (development only)
            if (window.gc) {
                window.gc();
                console.log('Manual garbage collection triggered');
            }
        }
        
        // Handle messages from React Native
        window.addEventListener('message', function(event) {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'loadLocation' && data.coordinates) {
                    console.log('LOAD LOCATION: Changing location');
                    
                    currentLocation = {
                        lat: data.coordinates.latitude,
                        lon: data.coordinates.longitude,
                        name: data.name || 'Unknown Location'
                    };
                    
                    console.log('LOAD LOCATION: New location set to:', currentLocation);
                    
                    // Force cleanup before loading new location
                    console.log('LOAD LOCATION: Force cleaning before location change');
                    forceCleanupScene();
                    
                    // Load new location
                    loadTerrain();
                } else if (data.type === 'updateRadius' && data.radius) {
                    console.log('UPDATE RADIUS: Changing from', terrainRadius, 'to', data.radius, 'km');
                    terrainRadius = data.radius;
                    
                    // Force cleanup before loading new radius
                    console.log('UPDATE RADIUS: Force cleaning before radius change');
                    forceCleanupScene();
                    
                    // Load new terrain with updated radius
                    loadTerrain();
                } else if (data.type === 'updateSun' && data.azimuth !== undefined && data.altitude !== undefined) {
                    updateSunPosition(data.azimuth, data.altitude);
                } else if (data.type === 'toggleSun') {
                    if (sunSphere && sunRay) {
                        const visible = data.visible !== undefined ? data.visible : !sunSphere.visible;
                        sunSphere.visible = visible;
                        sunRay.visible = visible;
                        console.log('Sun visibility toggled to:', visible);
                    }
                } else if (data.type === 'cleanup') {
                    cleanupAll();
                }
                
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });
        
        // Add cleanup event listeners to prevent memory leaks
        window.addEventListener('beforeunload', cleanupAll);
        window.addEventListener('unload', cleanupAll);
        
        // Initialize when page loads and Three.js is available
        function tryInit() {
            if (typeof THREE !== 'undefined') {
                initThreeJS();
            } else {
                console.log('Waiting for Three.js to load...');
                setTimeout(tryInit, 100);
            }
        }
        
        window.addEventListener('load', tryInit);
        
    </script>
</body>
</html>
`;

export default function TerrainScreen() {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<string>('San Francisco');
  const [terrainRadius, setTerrainRadius] = useState<number>(5.0); // km
  const [sunVisible, setSunVisible] = useState<boolean>(true);
  const [sunAzimuth, setSunAzimuth] = useState<number>(135); // degrees
  const [sunAltitude, setSunAltitude] = useState<number>(45); // degrees
  const loadingTimeoutRef = useRef<number | null>(null);

  const sendMessageToWebView = (message: any) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(message));
    }
  };

  const loadLocationTerrain = (longitude: number, latitude: number, name: string) => {
    setCurrentLocation(name);
    setIsLoading(true);
    sendMessageToWebView({
      type: 'loadLocation',
      coordinates: { longitude, latitude },
      name: name
    });
  };

  const updateTerrainRadius = (radius: number) => {
    setTerrainRadius(radius);
    setIsLoading(true); // Show loading immediately when changing radius
    sendMessageToWebView({
      type: 'updateRadius',
      radius: radius
    });
  };

  const updateSunPosition = (azimuth: number, altitude: number) => {
    setSunAzimuth(azimuth);
    setSunAltitude(altitude);
    sendMessageToWebView({
      type: 'updateSun',
      azimuth: azimuth,
      altitude: altitude
    });
  };

  const toggleSun = () => {
    const newVisible = !sunVisible;
    setSunVisible(newVisible);
    sendMessageToWebView({
      type: 'toggleSun',
      visible: newVisible
    });
  };

  const cleanupWebView = () => {
    sendMessageToWebView({
      type: 'cleanup'
    });
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'ready') {
        console.log('Terrain ready:', data.message || 'Ready');
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
        setIsLoading(false);
      } else if (data.type === 'error') {
        console.error('Terrain error:', data.message);
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
        Alert.alert('Terrain Error', data.message);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
      setIsLoading(false);
    }
  };

  // Add loading timeout - longer for real elevation data
  useEffect(() => {
    if (isLoading) {
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('Terrain loading timeout');
        Alert.alert('Loading Timeout', 'The terrain is taking too long to load. This may be due to slow internet or the elevation API being unavailable. The app will fall back to simulated terrain.');
        setIsLoading(false);
      }, 60000); // 60 second timeout for real elevation data
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [isLoading]);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      console.log('TerrainScreen unmounting, cleaning up WebView...');
      cleanupWebView();
    };
  }, []);

  const quickLocations = [
    { name: 'San Francisco', coordinates: [-122.4194, 37.7749] },
    { name: 'Longs Peak 14er', coordinates: [-105.6151, 40.2550] },
    { name: 'New York', coordinates: [-74.0060, 40.7128] },
    { name: 'London', coordinates: [-0.1276, 51.5074] },
    { name: 'Tokyo', coordinates: [139.6917, 35.6895] },
    { name: 'Sydney', coordinates: [151.2093, -33.8688] },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <IconSymbol name="globe" size={28} color="#FFA500" />
          <Text style={styles.title}>Terrain Explorer</Text>
        </View>
        <Text style={styles.subtitle}>
          {isLoading ? 'Loading 3D Terrain + Satellite Imagery...' : `Viewing: ${currentLocation}`}
        </Text>
      </View>

      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: threeTerrainHtml }}
          style={styles.webView}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          scrollEnabled={false}
          bounces={false}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="compatibility"
          onLoadStart={() => {
            console.log('WebView started loading');
          }}
          onLoadEnd={() => {
            console.log('WebView finished loading');
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error: ', nativeEvent);
            Alert.alert('WebView Error', `Failed to load the terrain viewer: ${nativeEvent.description}`);
            setIsLoading(false);
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView HTTP error: ', nativeEvent);
            Alert.alert('HTTP Error', `Network error: ${nativeEvent.statusCode}`);
          }}
          onRenderProcessGone={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView render process gone: ', nativeEvent);
            Alert.alert('WebView Crashed', 'The terrain viewer has crashed. Please try again.');
          }}
        />
        
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Loading 3D Terrain + Satellite Imagery...</Text>
            <Text style={styles.loadingSubtext}>Fetching elevation data & satellite imagery</Text>
          </View>
        )}
      </View>

        <ScrollView style={styles.controlsContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.quickLocations}>
            <Text style={styles.quickLocationsTitle}>Load Terrain</Text>
            <View style={styles.locationButtons}>
              {quickLocations.map((location, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.locationButton,
                    currentLocation === location.name && styles.activeLocationButton
                  ]}
                  onPress={() => loadLocationTerrain(location.coordinates[0], location.coordinates[1], location.name)}
                >
                  <IconSymbol name="location.fill" size={14} color={currentLocation === location.name ? "#FFA500" : "#666"} />
                  <Text style={[
                    styles.locationButtonText,
                    currentLocation === location.name && styles.activeLocationButtonText
                  ]}>
                    {location.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.controlSection}>
            <Text style={styles.controlTitle}>Terrain Radius: {terrainRadius.toFixed(1)} km</Text>
            <Slider
              style={styles.slider}
              minimumValue={1.0}
              maximumValue={15.0}
              step={0.5}
              value={terrainRadius}
              onValueChange={updateTerrainRadius}
              minimumTrackTintColor="#FFA500"
              maximumTrackTintColor="#666"
            />
          </View>

          <View style={styles.controlSection}>
            <View style={styles.sunHeader}>
              <Text style={styles.controlTitle}>Sun Position</Text>
              <TouchableOpacity style={styles.toggleButton} onPress={toggleSun}>
                <Text style={[styles.toggleButtonText, { color: sunVisible ? "#FFA500" : "#666" }]}>
                  {sunVisible ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.sliderLabel}>Azimuth: {sunAzimuth}°</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={360}
              step={5}
              value={sunAzimuth}
              onValueChange={(value) => updateSunPosition(value, sunAltitude)}
              minimumTrackTintColor="#FFFF00"
              maximumTrackTintColor="#666"
            />
            
            <Text style={styles.sliderLabel}>Altitude: {sunAltitude}°</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={90}
              step={1}
              value={sunAltitude}
              onValueChange={(value) => updateSunPosition(sunAzimuth, value)}
              minimumTrackTintColor="#FFFF00"
              maximumTrackTintColor="#666"
            />
          </View>
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '500',
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  loadingSubtext: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '400',
  },
  quickLocations: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  quickLocationsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  locationButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#222',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#444',
  },
  activeLocationButton: {
    backgroundColor: '#2a1f00',
    borderColor: '#FFA500',
  },
  locationButtonText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '500',
  },
  activeLocationButtonText: {
    color: '#FFA500',
    fontWeight: '600',
  },
  controlsContainer: {
    backgroundColor: '#111',
    maxHeight: 200,
    paddingHorizontal: 16,
  },
  controlSection: {
    marginBottom: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  controlTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  sunHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#666',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabel: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 8,
    marginTop: 8,
  },
});
