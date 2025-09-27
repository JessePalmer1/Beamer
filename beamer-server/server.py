from __future__ import annotations

import math
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Import glare calculation functions
from glare_index import glare_score, _angdiff, _clip, _elev_term, _solar
import glare_index

# Override glare parameters for more practical driving application
# Original: THETA_H = 25.0 (too narrow for practical use)
# New: THETA_H = 60.0 (wider azimuth range for more realistic glare detection)
PRACTICAL_THETA_H = 60.0  # Degrees - azimuth range where glare can occur
PRACTICAL_THETA_E = 20.0  # Degrees - elevation range (slightly increased)

def practical_heading_term(delta):
    """Modified heading term with wider azimuth range"""
    if delta >= PRACTICAL_THETA_H: 
        return 0.0
    return _clip(1.0 - (delta / PRACTICAL_THETA_H) ** 2)

def practical_elev_term(el):
    """Modified elevation term with practical range"""
    if el <= 0: 
        return 0.0
    primary = _clip(1.0 - el / PRACTICAL_THETA_E)
    # Add tail for gradual falloff
    tail = 0.0
    if PRACTICAL_THETA_E < el < PRACTICAL_THETA_E + 10.0:
        tail = (1.0 - (el - PRACTICAL_THETA_E) / 10.0) * 0.35
    return _clip(primary + tail)

def practical_glare_score(lat, lon, when, heading_deg):
    """Glare score calculation with practical parameters for driving"""
    az, el = _solar(lat, lon, when)
    elev = practical_elev_term(el)
    delta = _angdiff(az, heading_deg)
    head = practical_heading_term(delta)
    score = _clip(elev * head)
    
    return {
        "score": score,
        "azimuth_deg": az,
        "elevation_deg": el,
        "delta_heading_deg": delta,
        "elevation_term": elev,
        "heading_term": head
    }


class Settings(BaseModel):
    google_places_api_key: str
    google_maps_api_key: str
    
    @classmethod
    def from_env(cls) -> "Settings":
        places_key = os.getenv("GOOGLE_PLACES_API_KEY")
        maps_key = os.getenv("GOOGLE_MAPS_API_KEY")
        
        if not places_key:
            raise RuntimeError("GOOGLE_PLACES_API_KEY environment variable is required")
        if not maps_key:
            raise RuntimeError("GOOGLE_MAPS_API_KEY environment variable is required")
            
        return cls(
            google_places_api_key=places_key,
            google_maps_api_key=maps_key
        )


# Request/Response models
class PlacesAutocompleteRequest(BaseModel):
    input: str = Field(..., min_length=1, max_length=200)
    types: Optional[str] = "geocode"


class PlaceDetailsRequest(BaseModel):
    place_id: str = Field(..., min_length=1)
    fields: Optional[str] = "geometry"


class DirectionsRequest(BaseModel):
    origin_lat: float = Field(..., ge=-90, le=90)
    origin_lng: float = Field(..., ge=-180, le=180)
    destination_lat: float = Field(..., ge=-90, le=90)
    destination_lng: float = Field(..., ge=-180, le=180)
    travel_mode: Optional[str] = "DRIVING"


class RoutePoint(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class RouteSegment(BaseModel):
    points: List[RoutePoint]
    distance: float = Field(..., ge=0)  # meters
    duration: float = Field(..., ge=0)  # seconds
    instruction: str


class GlareAnalysisRequest(BaseModel):
    segments: List[RouteSegment]
    departure_time: str  # ISO format datetime string
    timezone: Optional[str] = "UTC"  # e.g., "America/New_York"


class GlarePoint(BaseModel):
    lat: float
    lng: float
    timestamp: str  # ISO format
    glare_score: float  # 0.0 to 1.0
    sun_azimuth: float  # degrees
    sun_elevation: float  # degrees
    heading: float  # degrees
    color: str  # hex color for visualization


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize HTTP client
    app.state.http_client = httpx.AsyncClient(timeout=httpx.Timeout(10.0))
    
    # Load settings
    try:
        app.state.settings = Settings.from_env()
        print("✅ Google API keys loaded successfully")
    except RuntimeError as e:
        print(f"❌ Error loading settings: {e}")
        app.state.settings = None
    
    yield
    
    # Cleanup
    await app.state.http_client.aclose()


app = FastAPI(
    title="Beamer API",
    description="Secure proxy for Google Maps APIs",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware for React Native
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your app's domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple rate limiting (in production, use Redis or similar)
request_counts: Dict[str, Dict[str, int]] = {}
RATE_LIMIT_REQUESTS = 60  # requests per minute
RATE_LIMIT_WINDOW = 60  # seconds


def check_rate_limit(client_ip: str) -> bool:
    """Simple rate limiting check"""
    current_time = int(time.time())
    current_window = current_time // RATE_LIMIT_WINDOW
    
    if client_ip not in request_counts:
        request_counts[client_ip] = {}
    
    # Clean old windows (keep only current and previous window)
    for window in list(request_counts[client_ip].keys()):
        if window < current_window - 1:
            del request_counts[client_ip][window]
    
    # Count requests in current window
    current_requests = request_counts[client_ip].get(current_window, 0)
    
    if current_requests >= RATE_LIMIT_REQUESTS:
        return False
    
    # Increment counter
    request_counts[client_ip][current_window] = current_requests + 1
    return True


# Utility functions for route analysis


def calculate_heading(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate bearing/heading from point 1 to point 2 in degrees"""
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlon_rad = math.radians(lon2 - lon1)
    
    y = math.sin(dlon_rad) * math.cos(lat2_rad)
    x = math.cos(lat1_rad) * math.sin(lat2_rad) - math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlon_rad)
    
    bearing_rad = math.atan2(y, x)
    bearing_deg = math.degrees(bearing_rad)
    return (bearing_deg + 360) % 360  # Normalize to 0-360


def score_to_color(score: float) -> str:
    """Convert glare score (0-1) to hex color (green to red)"""
    # Green (0) to Yellow (0.5) to Red (1)
    if score <= 0.5:
        # Green to Yellow
        r = int(255 * (score * 2))  # 0 to 255
        g = 255
        b = 0
    else:
        # Yellow to Red
        r = 255
        g = int(255 * (2 - score * 2))  # 255 to 0
        b = 0
    
    return f"#{r:02x}{g:02x}{b:02x}"


@app.get("/")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "message": "Beamer API is running"}


@app.post("/api/places/autocomplete")
async def places_autocomplete(request: PlacesAutocompleteRequest, req: Request):
    """Proxy endpoint for Google Places Autocomplete API"""
    if not req.app.state.settings:
        raise HTTPException(status_code=500, detail="Google API keys not configured")
    
    # Rate limiting
    client_ip = req.client.host
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    try:
        url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
        params = {
            "input": request.input,
            "key": req.app.state.settings.google_places_api_key,
            "types": request.types
        }
        
        response = await req.app.state.http_client.get(url, params=params)
        response.raise_for_status()
        
        return response.json()
        
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch places: {str(e)}")


@app.post("/api/places/details")
async def place_details(request: PlaceDetailsRequest, req: Request):
    """Proxy endpoint for Google Place Details API"""
    if not req.app.state.settings:
        raise HTTPException(status_code=500, detail="Google API keys not configured")
    
    # Rate limiting
    client_ip = req.client.host
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    try:
        url = "https://maps.googleapis.com/maps/api/place/details/json"
        params = {
            "place_id": request.place_id,
            "fields": request.fields,
            "key": req.app.state.settings.google_places_api_key
        }
        
        response = await req.app.state.http_client.get(url, params=params)
        response.raise_for_status()
        
        return response.json()
        
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch place details: {str(e)}")


@app.post("/api/directions")
async def directions(request: DirectionsRequest, req: Request):
    """Proxy endpoint for Google Directions API"""
    if not req.app.state.settings:
        raise HTTPException(status_code=500, detail="Google API keys not configured")
    
    # Rate limiting
    client_ip = req.client.host
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    try:
        url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            "origin": f"{request.origin_lat},{request.origin_lng}",
            "destination": f"{request.destination_lat},{request.destination_lng}",
            "mode": request.travel_mode.lower(),
            "key": req.app.state.settings.google_maps_api_key
        }
        
        response = await req.app.state.http_client.get(url, params=params)
        response.raise_for_status()
        
        return response.json()
        
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch directions: {str(e)}")


@app.get("/api/maps-key")
async def get_maps_key(req: Request):
    """Endpoint to get Google Maps JavaScript API key for WebView
    
    Note: This still exposes the key to the client, but at least it's behind our server.
    For maximum security, consider implementing a token-based system instead.
    """
    if not req.app.state.settings:
        raise HTTPException(status_code=500, detail="Google API keys not configured")
    
    # Rate limiting
    client_ip = req.client.host
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    return {"key": req.app.state.settings.google_maps_api_key}


@app.post("/api/analyze-glare")
async def analyze_route_glare(request: GlareAnalysisRequest, req: Request):
    """Analyze glare index along a route with time progression"""
    # Rate limiting
    client_ip = req.client.host
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    try:
        # Parse departure time
        try:
            if request.timezone != "UTC":
                # Parse with timezone
                tz = ZoneInfo(request.timezone)
                departure_dt = datetime.fromisoformat(request.departure_time.replace('Z', '')).replace(tzinfo=tz)
            else:
                departure_dt = datetime.fromisoformat(request.departure_time.replace('Z', '')).replace(tzinfo=timezone.utc)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid departure_time format: {str(e)}")
        
        # Calculate total route duration
        total_duration = sum(segment.duration for segment in request.segments)
        
        glare_points: List[GlarePoint] = []
        current_time = departure_dt
        
        for segment in request.segments:
            points = segment.points
            segment_duration = segment.duration
            segment_distance = segment.distance
            
            if len(points) < 1:
                continue  # Skip segments with no points
            
            # Create a linspace of points along this segment for better granularity
            # Use more points for longer segments to get smooth gradient
            # 1 point every ~50 meters, minimum 10 points, maximum 100 points per segment
            num_analysis_points = max(10, min(100, int(segment_distance / 50)))
            
            # Create interpolated points along the segment
            for i in range(num_analysis_points):
                ratio = i / (num_analysis_points - 1) if num_analysis_points > 1 else 0
                
                # Interpolate along the segment polyline
                if len(points) == 1:
                    # Single point segment
                    interpolated_point = points[0]
                    heading = 0.0
                else:
                    # Find which polyline segment this ratio falls into
                    total_polyline_points = len(points)
                    polyline_index = min(int(ratio * (total_polyline_points - 1)), total_polyline_points - 2)
                    local_ratio = (ratio * (total_polyline_points - 1)) - polyline_index
                    
                    # Interpolate between two consecutive polyline points
                    p1 = points[polyline_index]
                    p2 = points[polyline_index + 1] if polyline_index + 1 < len(points) else points[polyline_index]
                    
                    # Linear interpolation
                    lat = p1.lat + (p2.lat - p1.lat) * local_ratio
                    lng = p1.lng + (p2.lng - p1.lng) * local_ratio
                    
                    # Calculate heading direction from p1 to p2
                    if polyline_index + 1 < len(points):
                        heading = calculate_heading(p1.lat, p1.lng, p2.lat, p2.lng)
                    else:
                        # Last point, use previous heading if available
                        if polyline_index > 0:
                            prev_p = points[polyline_index - 1]
                            heading = calculate_heading(prev_p.lat, prev_p.lng, p1.lat, p1.lng)
                        else:
                            heading = 0.0
                    
                    # Create interpolated point
                    interpolated_point = RoutePoint(lat=lat, lng=lng)
                
                # Calculate time for this point
                point_time = current_time + timedelta(seconds=ratio * segment_duration)
                
                # Calculate glare score using practical parameters
                glare_result = practical_glare_score(interpolated_point.lat, interpolated_point.lng, point_time, heading)
                
                # Debug: Log first few points for troubleshooting
                if len(glare_points) < 5:
                    print(f"Debug glare point {len(glare_points)}:")
                    print(f"  Location: {interpolated_point.lat:.6f}, {interpolated_point.lng:.6f}")
                    print(f"  Time: {point_time}")
                    print(f"  Heading: {heading:.1f}°")
                    print(f"  Sun azimuth: {glare_result['azimuth_deg']:.1f}°")
                    print(f"  Sun elevation: {glare_result['elevation_deg']:.1f}°")
                    print(f"  Glare score: {glare_result['score']:.3f}")
                    print(f"  Color: {score_to_color(glare_result['score'])}")
                
                # Create glare point with color mapping
                glare_point = GlarePoint(
                    lat=interpolated_point.lat,
                    lng=interpolated_point.lng,
                    timestamp=point_time.isoformat(),
                    glare_score=glare_result["score"],
                    sun_azimuth=glare_result["azimuth_deg"],
                    sun_elevation=glare_result["elevation_deg"],
                    heading=heading,
                    color=score_to_color(glare_result["score"])
                )
                glare_points.append(glare_point)
            
            # Advance current time by segment duration
            current_time += timedelta(seconds=segment_duration)
        
        # Calculate statistics
        scores = [p.glare_score for p in glare_points]
        stats = {
            "total_points": len(glare_points),
            "max_glare": max(scores) if scores else 0.0,
            "min_glare": min(scores) if scores else 0.0,
            "avg_glare": sum(scores) / len(scores) if scores else 0.0,
            "high_glare_points": len([s for s in scores if s > 0.7]),  # Score > 0.7 is high risk
            "total_duration_minutes": total_duration / 60,
            "departure_time": departure_dt.isoformat(),
            "arrival_time": (departure_dt + timedelta(seconds=total_duration)).isoformat()
        }
        
        # Debug: Log statistics
        print(f"Glare analysis complete:")
        print(f"  Total points: {stats['total_points']}")
        print(f"  Score range: {stats['min_glare']:.3f} - {stats['max_glare']:.3f}")
        print(f"  Average score: {stats['avg_glare']:.3f}")
        print(f"  High glare points: {stats['high_glare_points']}")
        
        # Test color mapping with various scores
        print(f"Color mapping test:")
        for test_score in [0.0, 0.2, 0.5, 0.8, 1.0]:
            print(f"  Score {test_score}: {score_to_color(test_score)}")
        
        return {
            "glare_points": glare_points,
            "statistics": stats
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze glare: {str(e)}")


@app.get("/api/test-glare")
async def test_glare():
    """Test endpoint to verify glare calculations with known high-glare scenario"""
    # Test scenario: Driving west in San Francisco at sunset
    test_lat = 37.7749  # San Francisco
    test_lng = -122.4194
    test_heading = 270.0  # Due west
    
    # Sunset time (approximate)
    sunset_time = datetime(2024, 6, 21, 19, 30, tzinfo=timezone.utc)  # Summer solstice sunset
    
    # Test glare calculation with both original and practical parameters
    original_result = glare_score(test_lat, test_lng, sunset_time, test_heading)
    practical_result = practical_glare_score(test_lat, test_lng, sunset_time, test_heading)
    
    return {
        "test_scenario": "Driving west in SF at sunset",
        "location": f"{test_lat}, {test_lng}",
        "heading": f"{test_heading}° (west)",
        "time": sunset_time.isoformat(),
        "original_glare": {
            "result": original_result,
            "color": score_to_color(original_result["score"]),
            "note": f"Original THETA_H=25° (narrow range)"
        },
        "practical_glare": {
            "result": practical_result,
            "color": score_to_color(practical_result["score"]),
            "note": f"Practical THETA_H={PRACTICAL_THETA_H}° (wider range)"
        },
        "expected": "Practical should show higher glare (red/orange color)"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
