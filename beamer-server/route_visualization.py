#!/usr/bin/env python3
# route_visualization.py
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Callable, Dict, List

import numpy as np
import matplotlib.pyplot as plt

# -------------------------------
# Data structures
# -------------------------------
@dataclass
class Pt:
    lat: float
    lon: float

# -------------------------------
# Geodesy / interpolation helpers
# -------------------------------
def bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial bearing from (lat1,lon1) -> (lat2,lon2) in degrees [0,360)."""
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dλ = math.radians(lon2 - lon1)
    y = math.sin(dλ) * math.cos(φ2)
    x = math.cos(φ1) * math.sin(φ2) - math.sin(φ1) * math.cos(φ2) * math.cos(dλ)
    θ = math.degrees(math.atan2(y, x))
    return (θ + 360.0) % 360.0

def run_glare_simulation_with_durations(
    route_points: List[Pt],
    segment_minutes: List[float],
    start_local: datetime,
    step_seconds: int,
    scorer: Callable[[float, float, datetime, float], Dict[str, float]],
) -> Dict[str, np.ndarray | List[datetime]]:
    """
    Progress along each polyline segment using per-segment durations (in minutes).
    The end time is implied by start_local + sum(segment_minutes).
    `step_seconds` controls temporal sampling inside each segment.

    Returns the same dict shape as `run_glare_simulation`.
    """
    if len(route_points) < 2:
        raise ValueError("Need at least two route points")
    if len(segment_minutes) != len(route_points) - 1:
        raise ValueError("segment_minutes must have length len(route_points)-1")

    times_local: List[datetime] = []
    lats: List[float] = []
    lons: List[float] = []
    hdgs: List[float] = []
    scores: List[float] = []
    sun_azs: List[float] = []
    sun_els: List[float] = []
    deltas: List[float] = []

    t_cursor = start_local

    for i in range(len(route_points) - 1):
        p1, p2 = route_points[i], route_points[i + 1]
        seg_secs_total = max(1, int(round(segment_minutes[i] * 60)))
        steps = max(1, seg_secs_total // max(1, int(step_seconds)))
        hdg_seg = bearing_deg(p1.lat, p1.lon, p2.lat, p2.lon)

        for k in range(steps):
            r = k / max(steps, 1)  # [0,1)
            lat = p1.lat + (p2.lat - p1.lat) * r
            lon = p1.lon + (p2.lon - p1.lon) * r
            when = t_cursor + timedelta(seconds=k * step_seconds)

            res = scorer(lat, lon, when, hdg_seg)
            times_local.append(when)
            lats.append(lat); lons.append(lon); hdgs.append(hdg_seg)
            scores.append(float(res["score"]))
            sun_azs.append(float(res["azimuth_deg"]))
            sun_els.append(float(res["elevation_deg"]))
            deltas.append(float(res["delta_heading_deg"]))

        # advance to end of segment
        t_cursor += timedelta(seconds=seg_secs_total)

    # Add a final sample at the route end / final time
    lat_f, lon_f = route_points[-1].lat, route_points[-1].lon
    hdg_f = hdgs[-1] if hdgs else 0.0
    when_f = t_cursor
    res_f = scorer(lat_f, lon_f, when_f, hdg_f)

    times_local.append(when_f)
    lats.append(lat_f); lons.append(lon_f); hdgs.append(hdg_f)
    scores.append(float(res_f["score"]))
    sun_azs.append(float(res_f["azimuth_deg"]))
    sun_els.append(float(res_f["elevation_deg"]))
    deltas.append(float(res_f["delta_heading_deg"]))

    return {
        "times_local": times_local,
        "lats": np.array(lats),
        "lons": np.array(lons),
        "hdgs": np.array(hdgs),
        "scores": np.array(scores),
        "sun_azs": np.array(sun_azs),
        "sun_els": np.array(sun_els),
        "deltas": np.array(deltas),
    }


# -------------------------------
# Visualization
# -------------------------------
def score_to_color_hex(score: float) -> str:
    """Green->Yellow->Red mapping."""
    s = max(0.0, min(1.0, float(score)))
    if s <= 0.4:
        r = int(255 * (s * 2))
        g = 255
    else:
        r = 255
        g = int(255 * (2 - s * 2))
    b = 0
    return f"#{r:02x}{g:02x}{b:02x}"


def plot_glare_timeseries_and_route(res: Dict[str, np.ndarray | List[datetime]], title: str = "") -> None:
    """Make 3-panel figure: score vs time, (sun el & Δ) vs time, route colored by score."""
    times = res["times_local"]
    scores = res["scores"]; sun_els = res["sun_els"]; deltas = res["deltas"]
    lats = res["lats"]; lons = res["lons"]
    colors = [score_to_color_hex(s) for s in scores]  # type: ignore

    fig = plt.figure(figsize=(12, 9))
    gs = fig.add_gridspec(2, 2, height_ratios=[1.2, 1.0], hspace=0.3, wspace=0.25)

    # 1) Glare score vs time
    ax1 = fig.add_subplot(gs[0, 0])
    ax1.plot(times, scores, lw=2)
    ax1.set_title("Glare score vs Time (local)")
    ax1.set_ylabel("Glare score [0..1]")
    ax1.set_ylim(0, 1.0)
    ax1.grid(True, alpha=0.3)

    # 2) Sun elevation and Δ heading vs time
    ax2 = fig.add_subplot(gs[0, 1])
    ax2.plot(times, sun_els, label="Sun elevation (deg)", lw=2)
    ax2.plot(times, deltas, label="Δ heading (deg)", lw=2, alpha=0.85)
    ax2.set_title("Sun Elevation & Δ Heading vs Time")
    ax2.set_ylabel("Degrees")
    ax2.grid(True, alpha=0.3)
    ax2.legend()

    # 3) Route colored by glare score
    ax3 = fig.add_subplot(gs[1, :])
    for i in range(len(lats) - 1):
        ax3.plot([lons[i], lons[i+1]], [lats[i], lats[i+1]], color=colors[i], lw=4, solid_capstyle="round")
    ax3.scatter(lons[0], lats[0], c="k", s=30, label="Start")
    ax3.scatter(lons[-1], lats[-1], c="k", s=30, marker="x", label="End")
    ax3.set_title("Route (colored by glare score)")
    ax3.set_xlabel("Longitude"); ax3.set_ylabel("Latitude")
    ax3.grid(True, alpha=0.3); ax3.legend()

    for ax in (ax1, ax2):
        ax.tick_params(axis="x", rotation=25)

    if title:
        plt.suptitle(title, fontsize=14, y=0.98)
    plt.tight_layout()
    plt.show()
