import math
from datetime import datetime, timezone

import httpx
import pytest

import server


@pytest.fixture(autouse=True)
def clear_settings_cache():
    server.get_settings.cache_clear()
    yield
    server.get_settings.cache_clear()


def test_compute_alignment_ratio_matches_expected_cosine():
    assert server.compute_alignment_ratio(0, 0) == pytest.approx(1.0)
    assert server.compute_alignment_ratio(0, 90) == pytest.approx(0.0)
    assert server.compute_alignment_ratio(0, 45) == pytest.approx(math.cos(math.radians(45)))


def test_compute_sunglare_index_handles_blocked_sun():
    assert server.compute_sunglare_index(1.0, sun_altitude=5.0, horizon_altitude=10.0) == 0.0


def test_compute_sunglare_index_scales_with_alignment():
    index = server.compute_sunglare_index(0.5, sun_altitude=20.0, horizon_altitude=0.0)
    expected = 0.5 * min(1.0, (20.0 - 0.0) / 15.0)
    assert index == pytest.approx(expected)


def test_decode_polyline_decodes_points():
    polyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
    points = server.decode_polyline(polyline)
    assert points == pytest.approx([(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)], abs=1e-5)


@pytest.mark.asyncio
async def test_sunglare_service_computes_index(monkeypatch):
    step = server.RouteStep(
        instruction="Head north",
        distance_meters=100,
        duration_seconds=10,
        points=[(37.0, -122.0), (37.001, -122.0)],
    )
    route = server.RouteDetails(distance_meters=100, duration_seconds=10, steps=[step])

    class StubDirectionsClient:
        async def fetch(self, start, end, departure_time):
            return route

    class StubElevationClient:
        def __init__(self):
            self.responses = [[100.0], [120.0]]

        async def get_elevations(self, points):
            return self.responses.pop(0)

    monkeypatch.setattr(server, "get_altitude", lambda lat, lon, dt: 15.0)
    monkeypatch.setattr(server, "get_azimuth", lambda lat, lon, dt: 5.0)

    service = server.SunglareService(horizon_sample_distances=(1_000,))
    request_payload = server.SunglareRequest(
        departure_time=datetime(2025, 1, 1, 8, tzinfo=timezone.utc),
        start=server.Location(latitude=37.0, longitude=-122.0),
        end=server.Location(latitude=37.1, longitude=-122.1),
    )

    response = await service.compute(request_payload, StubDirectionsClient(), StubElevationClient())

    assert response.total_distance_meters == 100
    assert response.total_duration_seconds == 10
    assert len(response.segments) == 1
    segment = response.segments[0]
    expected_alignment = math.cos(math.radians(5.0))
    expected_altitude_factor = min(1.0, (15.0 - math.degrees(math.atan2(20.0, 1_000))) / 15.0)
    expected_index = expected_alignment * expected_altitude_factor
    assert segment.sunglare_index == pytest.approx(round(expected_index, 3))
    assert not segment.sun_blocked


@pytest.mark.asyncio
async def test_sunglare_endpoint_returns_stubbed_response(monkeypatch):
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "test-key")

    class StubDirectionsClient:
        ...

    class StubElevationClient:
        ...

    dummy_response = server.SunglareResponse(
        total_distance_meters=1000,
        total_duration_seconds=600,
        directions=[
            server.RouteStepSummary(
                instruction="Continue straight",
                distance_meters=1000,
                duration_seconds=600,
            )
        ],
        segments=[
            server.SunglareSegment(
                index=0,
                location=server.SegmentLocation(latitude=37.0, longitude=-122.0),
                heading_degrees=0.0,
                sun_altitude_degrees=10.0,
                sun_azimuth_degrees=90.0,
                horizon_altitude_degrees=1.0,
                alignment_ratio=0.9,
                sunglare_index=0.5,
                sun_blocked=False,
            )
        ],
    )

    class StubService:
        async def compute(self, payload, directions_client, elevation_client):
            return dummy_response

    server.app.dependency_overrides[server.get_directions_client] = lambda: StubDirectionsClient()
    server.app.dependency_overrides[server.get_elevation_client] = lambda: StubElevationClient()
    server.app.dependency_overrides[server.get_sunglare_service] = lambda: StubService()

    payload = {
        "departure_time": datetime.now(timezone.utc).isoformat(),
        "start": {"latitude": 37.0, "longitude": -122.0},
        "end": {"latitude": 37.1, "longitude": -122.1},
    }

    transport = httpx.ASGITransport(app=server.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post("/sunglare", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["total_distance_meters"] == 1000
    assert data["segments"][0]["sunglare_index"] == 0.5

    server.app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_sunglare_endpoint_handles_service_failure(monkeypatch):
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "test-key")

    class StubDirectionsClient:
        ...

    class StubElevationClient:
        ...

    class FailingService:
        async def compute(self, payload, directions_client, elevation_client):
            raise server.ExternalServiceError("upstream failure")

    server.app.dependency_overrides[server.get_directions_client] = lambda: StubDirectionsClient()
    server.app.dependency_overrides[server.get_elevation_client] = lambda: StubElevationClient()
    server.app.dependency_overrides[server.get_sunglare_service] = lambda: FailingService()

    payload = {
        "departure_time": datetime.now(timezone.utc).isoformat(),
        "start": {"latitude": 37.0, "longitude": -122.0},
        "end": {"latitude": 37.1, "longitude": -122.1},
    }

    transport = httpx.ASGITransport(app=server.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post("/sunglare", json=payload)

    assert response.status_code == 502
    assert response.json()["detail"] == "upstream failure"

    server.app.dependency_overrides.clear()

