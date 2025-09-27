import { config } from '@/config/environment';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface SunglareRequest {
  departure_time: string; // ISO string
  start: Location;
  end: Location;
}

export interface RouteStepSummary {
  instruction: string;
  distance_meters: number;
  duration_seconds: number;
}

export interface SegmentLocation {
  latitude: number;
  longitude: number;
}

export interface SunglareSegment {
  index: number;
  location: SegmentLocation;
  heading_degrees: number;
  sun_altitude_degrees: number;
  sun_azimuth_degrees: number;
  horizon_altitude_degrees: number;
  alignment_ratio: number;
  sunglare_index: number;
  sun_blocked: boolean;
}

export interface SunglareResponse {
  total_distance_meters: number;
  total_duration_seconds: number;
  directions: RouteStepSummary[];
  segments: SunglareSegment[];
}

export class SunglareApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = config.sunglareApiUrl) {
    this.baseUrl = baseUrl;
  }

  async analyzeSunglare(request: SunglareRequest): Promise<SunglareResponse> {
    const response = await fetch(`${this.baseUrl}/sunglare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  formatDistance(meters: number): string {
    const km = meters / 1000;
    if (km >= 1) {
      return `${km.toFixed(1)} km`;
    }
    return `${meters} m`;
  }
}

export const sunglareApi = new SunglareApiClient();
