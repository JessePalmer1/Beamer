#!/usr/bin/env python3
# tb_glare_index.py
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import glare_index  # your glare scoring module
from route_visualization import (
    Pt,
    run_glare_simulation_with_durations,
    plot_glare_timeseries_and_route,
)

# -------------------------------
# Define routes
# -------------------------------
ROUTE_1 = [
    Pt(33.7740, -84.2960),  # Decatur-ish (east)
    Pt(33.7490, -84.3800),  # Downtown ATL
    Pt(33.7480, -84.4400),  # West Midtown
    Pt(33.7450, -84.5000),  # Westside
    Pt(33.7450, -84.5600),  # Near Six Flags (west)
]

# A short test route around midtown
ROUTE_2 = [
    Pt(33.777830, -84.389220),
    Pt(33.777820, -84.388780),
    Pt(33.777840, -84.388790),
    Pt(33.776950, -84.393640),
    Pt(33.778290, -84.399170),
]

# -------------------------------
# Segment durations in minutes
# (must match len(route) - 1)
# -------------------------------
SEGMENT_MINUTES_1 = [5, 10, 8, 6]      # example durations for ROUTE_1
SEGMENT_MINUTES_2 = [1, 2, 3, 5]       # example durations for ROUTE_2

# -------------------------------
# Start time (local) – no end time needed
# -------------------------------
TZ = "America/New_York"
START_LOCAL = datetime.now(ZoneInfo(TZ)).replace(hour=19, minute=00, second=0, microsecond=0)

# Step size in seconds for sampling along each segment
STEP_SEC = 10  # sample every 30 seconds


if __name__ == "__main__":
    # Pick which route to test
    ROUTE = ROUTE_2
    SEGMENTS = SEGMENT_MINUTES_2

    res = run_glare_simulation_with_durations(
        route_points=ROUTE,
        segment_minutes=SEGMENTS,
        start_local=START_LOCAL,
        step_seconds=STEP_SEC,
        scorer=glare_index.glare_score,
    )

    print(f"[tb] Samples={len(res['times_local'])}  score range={res['scores'].min():.3f} .. {res['scores'].max():.3f}")

    plot_glare_timeseries_and_route(res, title="Atlanta Route Glare Analysis")
