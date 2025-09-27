from __future__ import annotations

import html
import math
import os
import re
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from typing import Iterable, List, Sequence, Tuple

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, status
from pydantic import BaseModel, Field, ValidationInfo, field_validator
from pysolar.solar import get_altitude, get_azimuth


GOOGLE_DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"
EARTH_RADIUS_M = 6_371_000


class Settings(BaseModel):
    google_maps_api_key: str
    elevation_api_url: str = Field(default="https://api.opentopodata.org/v1/srtm90m")
    elevation_batch_size: int = Field(default=100, ge=1, le=512)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_MAPS_API_KEY environment variable is required")
    url = os.getenv("ELEVATION_API_URL", Settings.model_fields['elevation_api_url'].default)
    batch_size = int(os.getenv("ELEVATION_BATCH_SIZE", Settings.model_fields['elevation_batch_size'].default))
    return Settings(google_maps_api_key=api_key, elevation_api_url=url, elevation_batch_size=batch_size)


class Location(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)


class SunglareRequest(BaseModel):
    departure_time: datetime
    start: Location
    end: Location

    @field_validator("departure_time")
    @classmethod
    def ensure_timezone(cls, value: datetime, info: ValidationInfo) -> datetime:
        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            raise ValueError("departure_time must include timezone information")
        return value


class RouteStepSummary(BaseModel):
    instruction: str
    distance_meters: int
    duration_seconds: int


class SegmentLocation(BaseModel):
    latitude: float
    longitude: float


class SunglareSegment(BaseModel):
    index: int
    location: SegmentLocation
    heading_degrees: float
    sun_altitude_degrees: float
    sun_azimuth_degrees: float
    horizon_altitude_degrees: float
    alignment_ratio: float
    sunglare_index: float
    sun_blocked: bool


class SunglareResponse(BaseModel):
    total_distance_meters: int
    total_duration_seconds: int
    directions: List[RouteStepSummary]
    segments: List[SunglareSegment]


class ExternalServiceError(Exception):
    pass


@dataclass
class RouteStep:
    instruction: str
    distance_meters: int
    duration_seconds: int
    points: List[Tuple[float, float]]

    @property
    def representative_point(self) -> Tuple[float, float]:
        midway = len(self.points) // 2
        return self.points[midway]

    @property
    def heading(self) -> float:
        if len(self.points) < 2:
            return 0.0
        return bearing_between(self.points[0], self.points[-1])


@dataclass
class RouteDetails:
    distance_meters: int
    duration_seconds: int
    steps: List[RouteStep]


class DirectionsClient:
    def __init__(self, api_key: str, http_client: httpx.AsyncClient) -> None:
        self._api_key = api_key
        self._http = http_client

    async def fetch(self, start: Location, end: Location, departure_time: datetime) -> RouteDetails:
        params = {
            "origin": f"{start.latitude},{start.longitude}",
            "destination": f"{end.latitude},{end.longitude}",
            "mode": "driving",
            "departure_time": int(departure_time.timestamp()),
            "key": self._api_key,
        }
        response = await self._http.get(GOOGLE_DIRECTIONS_URL, params=params)
        if response.status_code != 200:
            raise ExternalServiceError("Google Directions request failed")
        payload = response.json()
        status_code = payload.get("status")
        if status_code != "OK":
            message = payload.get("error_message") or status_code or "Directions unavailable"
            raise ExternalServiceError(message)
        routes = payload.get("routes", [])
        if not routes:
            raise ExternalServiceError("No routes returned from Google Directions")
        first_route = routes[0]
        legs = first_route.get("legs", [])
        if not legs:
            raise ExternalServiceError("Directions response missing legs data")
        leg = legs[0]
        steps_payload = leg.get("steps", [])
        steps: List[RouteStep] = []
        for raw_step in steps_payload:
            polyline = raw_step.get("polyline", {}).get("points")
            if not polyline:
                continue
            points = decode_polyline(polyline)
            if not points:
                continue
            instruction = strip_html(raw_step.get("html_instructions", ""))
            distance_m = int(raw_step.get("distance", {}).get("value", 0))
            duration_s = int(raw_step.get("duration", {}).get("value", 0))
            steps.append(RouteStep(
                instruction=instruction,
                distance_meters=distance_m,
                duration_seconds=duration_s,
                points=points,
            ))
        if not steps:
            raise ExternalServiceError("No usable steps returned from Google Directions")
        return RouteDetails(
            distance_meters=int(leg.get("distance", {}).get("value", 0)),
            duration_seconds=int(leg.get("duration", {}).get("value", 0)),
            steps=steps,
        )


class ElevationClient:
    def __init__(self, base_url: str, http_client: httpx.AsyncClient, batch_size: int = 100) -> None:
        self._base_url = base_url.rstrip("/")
        self._http = http_client
        self._batch_size = batch_size

    async def get_elevations(self, points: Sequence[Tuple[float, float]]) -> List[float]:
        elevations: List[float] = []
        for chunk in chunked(points, self._batch_size):
            chunk_locations = "|".join(f"{lat:.6f},{lon:.6f}" for lat, lon in chunk)
            response = await self._http.get(self._base_url, params={"locations": chunk_locations})
            if response.status_code != 200:
                raise ExternalServiceError("Elevation request failed")
            payload = response.json()
            results = payload.get("results")
            if not results:
                raise ExternalServiceError("Elevation response missing results")
            for item in results:
                elevation = item.get("elevation")
                if elevation is None:
                    raise ExternalServiceError("Elevation response missing value")
                elevations.append(float(elevation))
        if len(elevations) != len(points):
            raise ExternalServiceError("Elevation response count mismatch")
        return elevations


class SunglareService:
    def __init__(self, horizon_sample_distances: Sequence[int] | None = None) -> None:
        self._horizon_sample_distances = list(horizon_sample_distances or (1_000, 3_000, 5_000, 10_000))

    async def compute(
        self,
        request: SunglareRequest,
        directions_client: DirectionsClient,
        elevation_client: ElevationClient,
    ) -> SunglareResponse:
        departure_utc = request.departure_time.astimezone(timezone.utc)
        route = await directions_client.fetch(request.start, request.end, departure_utc)
        sample_points = [step.representative_point for step in route.steps]
        base_elevations = await elevation_client.get_elevations(sample_points)
        segments: List[SunglareSegment] = []
        for index, (step, base_elevation) in enumerate(zip(route.steps, base_elevations)):
            lat, lon = step.representative_point
            sun_altitude = float(get_altitude(lat, lon, departure_utc))
            sun_azimuth = float(get_azimuth(lat, lon, departure_utc))
            horizon_altitude = await self._compute_horizon_altitude(
                origin=(lat, lon),
                sun_azimuth=sun_azimuth,
                base_elevation=base_elevation,
                elevation_client=elevation_client,
            )
            alignment_ratio = compute_alignment_ratio(step.heading, sun_azimuth)
            sunglare_index = compute_sunglare_index(alignment_ratio, sun_altitude, horizon_altitude)
            segments.append(SunglareSegment(
                index=index,
                location=SegmentLocation(latitude=lat, longitude=lon),
                heading_degrees=round(step.heading, 2),
                sun_altitude_degrees=round(sun_altitude, 2),
                sun_azimuth_degrees=round(sun_azimuth, 2),
                horizon_altitude_degrees=round(horizon_altitude, 2),
                alignment_ratio=round(alignment_ratio, 3),
                sunglare_index=round(sunglare_index, 3),
                sun_blocked=sun_altitude <= horizon_altitude,
            ))
        directions = [
            RouteStepSummary(
                instruction=step.instruction,
                distance_meters=step.distance_meters,
                duration_seconds=step.duration_seconds,
            )
            for step in route.steps
        ]
        return SunglareResponse(
            total_distance_meters=route.distance_meters,
            total_duration_seconds=route.duration_seconds,
            directions=directions,
            segments=segments,
        )

    async def _compute_horizon_altitude(
        self,
        *,
        origin: Tuple[float, float],
        sun_azimuth: float,
        base_elevation: float,
        elevation_client: ElevationClient,
    ) -> float:
        sample_points = [destination_point(origin, sun_azimuth, distance) for distance in self._horizon_sample_distances]
        elevations = await elevation_client.get_elevations(sample_points)
        highest_angle = -90.0
        for distance, elevation in zip(self._horizon_sample_distances, elevations):
            vertical = elevation - base_elevation
            angle = math.degrees(math.atan2(vertical, distance))
            highest_angle = max(highest_angle, angle)
        return highest_angle


def decode_polyline(polyline: str) -> List[Tuple[float, float]]:
    coordinates: List[Tuple[float, float]] = []
    index = 0
    lat = 0
    lon = 0
    length = len(polyline)
    while index < length:
        lat_change, index = _decode_single(polyline, index)
        lon_change, index = _decode_single(polyline, index)
        lat += lat_change
        lon += lon_change
        coordinates.append((lat / 1e5, lon / 1e5))
    return coordinates


def _decode_single(encoded: str, index: int) -> Tuple[int, int]:
    result = 0
    shift = 0
    while True:
        b = ord(encoded[index]) - 63
        index += 1
        result |= (b & 0x1F) << shift
        shift += 5
        if b < 0x20:
            break
    delta = ~(result >> 1) if result & 1 else (result >> 1)
    return delta, index


def strip_html(text: str) -> str:
    cleaned = re.sub(r"<[^>]+>", "", html.unescape(text or ""))
    return re.sub(r"\s+", " ", cleaned).strip()


def chunked(sequence: Sequence[Tuple[float, float]], size: int) -> Iterable[Sequence[Tuple[float, float]]]:
    for index in range(0, len(sequence), size):
        yield sequence[index:index + size]


def bearing_between(start: Tuple[float, float], end: Tuple[float, float]) -> float:
    lat1 = math.radians(start[0])
    lat2 = math.radians(end[0])
    diff_long = math.radians(end[1] - start[1])
    x = math.sin(diff_long) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(diff_long)
    bearing = math.degrees(math.atan2(x, y))
    return (bearing + 360) % 360


def destination_point(origin: Tuple[float, float], bearing_deg: float, distance_m: float) -> Tuple[float, float]:
    lat1 = math.radians(origin[0])
    lon1 = math.radians(origin[1])
    angular_distance = distance_m / EARTH_RADIUS_M
    bearing = math.radians(bearing_deg)
    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_distance)
        + math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), (math.degrees(lon2) + 540) % 360 - 180


def compute_alignment_ratio(heading: float, sun_azimuth: float) -> float:
    diff = abs((heading - sun_azimuth + 180) % 360 - 180)
    if diff >= 90:
        return 0.0
    return max(0.0, math.cos(math.radians(diff)))


def compute_sunglare_index(alignment_ratio: float, sun_altitude: float, horizon_altitude: float) -> float:
    if alignment_ratio == 0.0:
        return 0.0
    if sun_altitude <= horizon_altitude:
        return 0.0
    altitude_factor = min(1.0, max(0.0, (sun_altitude - horizon_altitude) / 15.0))
    return alignment_ratio * altitude_factor


@asynccontextmanager
async def lifespan(app: FastAPI):
    http_client = httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0))
    app.state.http_client = http_client
    settings = None
    try:
        settings = get_settings()
        app.state.directions_client = DirectionsClient(settings.google_maps_api_key, http_client)
        app.state.elevation_client = ElevationClient(settings.elevation_api_url, http_client, settings.elevation_batch_size)
    except RuntimeError:
        app.state.directions_client = None
        app.state.elevation_client = None
    app.state.sunglare_service = SunglareService()
    try:
        yield
    finally:
        await http_client.aclose()


app = FastAPI(lifespan=lifespan)


def get_directions_client(request: Request) -> DirectionsClient:
    client: DirectionsClient | None = getattr(request.app.state, "directions_client", None)
    if client is None:
        settings = get_settings()
        client = DirectionsClient(settings.google_maps_api_key, request.app.state.http_client)
        request.app.state.directions_client = client
    return client


def get_elevation_client(request: Request) -> ElevationClient:
    client: ElevationClient | None = getattr(request.app.state, "elevation_client", None)
    if client is None:
        settings = get_settings()
        client = ElevationClient(settings.elevation_api_url, request.app.state.http_client, settings.elevation_batch_size)
        request.app.state.elevation_client = client
    return client


def get_sunglare_service(request: Request) -> SunglareService:
    return request.app.state.sunglare_service


@app.post("/sunglare", response_model=SunglareResponse)
async def sunglare_endpoint(
    payload: SunglareRequest,
    directions_client: DirectionsClient = Depends(get_directions_client),
    elevation_client: ElevationClient = Depends(get_elevation_client),
    sunglare_service: SunglareService = Depends(get_sunglare_service),
):
    try:
        return await sunglare_service.compute(payload, directions_client, elevation_client)
    except ExternalServiceError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

