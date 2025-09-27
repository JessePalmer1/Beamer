# minimal_glare_anim.py
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
from pysolar.solar import get_altitude, get_azimuth

THETA_H = 25.0
THETA_E = 15.0
TAIL_E  = 10.0

def _clip(x, a=0.0, b=1.0): return max(a, min(b, x))
def _angdiff(a, b):
    d = abs((a - b) % 360.0)
    return d if d <= 180.0 else 360.0 - d
def _to_utc(t: datetime) -> datetime:
    if t.tzinfo is None: raise ValueError("`when` must be timezone-aware")
    return t.astimezone(timezone.utc)

def _solar(lat, lon, when):
    t_utc = _to_utc(when)
    az = get_azimuth(lat, lon, t_utc) % 360.0
    el = get_altitude(lat, lon, t_utc)
    return az, el

def _elev_term(el):
    if el <= 0: return 0.0
    primary = _clip(1.0 - el / THETA_E)
    tail = 0.0
    if THETA_E < el < THETA_E + TAIL_E:
        tail = (1.0 - (el - THETA_E) / TAIL_E) * 0.35
    return _clip(primary + tail)

def _heading_term(delta):
    if delta >= THETA_H: return 0.0
    return _clip(1.0 - (delta / THETA_H) ** 2)

def glare_score(lat, lon, when, heading_deg):
    az, el = _solar(lat, lon, when)
    elev = _elev_term(el)
    delta = _angdiff(az, heading_deg)
    head = _heading_term(delta)
    return {
        "score": _clip(elev * head),
        "azimuth_deg": az,
        "elevation_deg": el,
        "delta_heading_deg": delta,
    }

def _enu_vec_heading(hdg_deg):
    r = math.radians(hdg_deg)
    return np.array([math.sin(r), math.cos(r), 0.0])  # E,N,U

def _enu_vec_sun(az_deg, el_deg):
    az = math.radians(az_deg); el = math.radians(el_deg)
    ce, se = math.cos(el), math.sin(el)
    return np.array([ce*math.sin(az), ce*math.cos(az), se])  # E,N,U

def _arc_shortest_deg(a1, a2, n=64):
    d = ((a2 - a1 + 180.0) % 360.0) - 180.0
    return np.linspace(a1, a1 + d, n)

def _draw_frame(ax, lat, lon, when, heading_deg):
    az, el = _solar(lat, lon, when)
    g = glare_score(lat, lon, when, heading_deg)
    v_h = _enu_vec_heading(heading_deg)
    v_s = _enu_vec_sun(az, el)
    v_sh = _enu_vec_sun(az, 0.0)

    ax.clear()
    ax.set_box_aspect([1,1,1])
    L = 1.15
    ax.set_xlim(-L, L); ax.set_ylim(-L, L); ax.set_zlim(0, L)
    ax.set_xlabel("East"); ax.set_ylabel("North"); ax.set_zlabel("Up")

    t = np.linspace(0, 2*np.pi, 200)
    ax.plot(np.cos(t), np.sin(t), 0*t, lw=0.8, alpha=0.6)

    ax.quiver(0,0,0, 1,0,0, color='k', length=1.0, normalize=True)
    ax.quiver(0,0,0, 0,1,0, color='k', length=1.0, normalize=True)
    ax.quiver(0,0,0, 0,0,1, color='k', length=1.0, normalize=True)
    ax.text(1.05,0,0,"E"); ax.text(0,1.05,0,"N"); ax.text(0,0,1.05,"U")

    ax.quiver(0,0,0, *v_h, color='tab:blue', length=1.0, normalize=True)
    ax.text(*(0.9*v_h), "Heading", color='tab:blue')
    ax.quiver(0,0,0, *v_s, color='tab:red', length=1.0, normalize=True)
    ax.text(*(0.9*v_s), "Sun", color='tab:red')
    ax.plot([0, v_sh[0]], [0, v_sh[1]], [0, 0], ls='--', color='tab:red', alpha=0.6)

    arc_h = _arc_shortest_deg(heading_deg, az, n=80)
    arc_h_rad = np.radians(arc_h)
    ax.plot(np.sin(arc_h_rad)*0.5, np.cos(arc_h_rad)*0.5, np.zeros_like(arc_h_rad),
            color='tab:purple', lw=2)

    if el > 0:
        elevs = np.linspace(0, math.radians(el), 80)
        ex, nx = math.sin(math.radians(az)), math.cos(math.radians(az))
        x = np.cos(elevs)*ex*0.5
        y = np.cos(elevs)*nx*0.5
        z = np.sin(elevs)*0.5
        ax.plot(x, y, z, color='tab:orange', lw=2)

    dt_str = when.astimezone().strftime("%Y-%m-%d %H:%M %Z")
    ax.set_title(f"({lat:.4f}, {lon:.4f})  {dt_str}\n"
                 f"hdg={heading_deg:.1f}°, sun az/el={az:.1f}°/{el:.1f}°, Δψ={g['delta_heading_deg']:.1f}°, index={g['score']:.2f}")
    ax.text2D(0.02, 0.95, f"Glare index: {g['score']:.2f}", transform=ax.transAxes,
              bbox=dict(boxstyle="round,pad=0.2", fc="w", ec="0.6"))

def animate_glare(lat, lon, start_time, heading_deg, minutes=60, step_min=2, interval_ms=120, save_path=None):
    times = [start_time + timedelta(minutes=m) for m in range(0, minutes+1, step_min)]
    fig = plt.figure(figsize=(7.5, 6))
    ax = fig.add_subplot(111, projection="3d")

    def update(i):
        _draw_frame(ax, lat, lon, times[i], heading_deg)

    anim = FuncAnimation(fig, update, frames=len(times), interval=interval_ms, blit=False, repeat=True)
    if save_path:
        if save_path.lower().endswith(".gif"):
            anim.save(save_path, writer="pillow", fps=max(1, 1000//interval_ms))
        else:
            anim.save(save_path, writer="ffmpeg", fps=max(1, 1000//interval_ms))
    else:
        plt.show()
    return anim

# Demo
if __name__ == "__main__":
    lat, lon = 33.781, -84.388,
    t0 = datetime(2025, 9, 27, 17, 45, tzinfo=ZoneInfo("America/New_York"))
    t0 = datetime.now(timezone.utc)
    animate_glare(lat, lon, t0, heading_deg=270.0, minutes=290, step_min=2, interval_ms=120)
