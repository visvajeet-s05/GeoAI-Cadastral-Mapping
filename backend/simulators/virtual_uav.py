"""
Virtual UAV Flight Engine (backend/simulators/virtual_uav.py)
-------------------------------------------------------------
Generates waypoint trajectories, calculates dynamic Ground Sampling Distance (GSD),
and streams real-time synthetic telemetry over WebSockets to feed downstream
computer vision, boundary vectorization, and VLM audit pipelines without
requiring physical drone hardware.
"""

import math
import time
import random
import asyncio
from typing import List, Dict, Any, Tuple, Optional


class VirtualUAVFlightEngine:
    """
    Simulates high-precision RTK-enabled survey drone flight operations
    over defined cadastral bounding boxes.
    """

    def __init__(
        self,
        zone: str = "URBAN",
        altitude_agl_m: float = 50.0,
        speed_mps: float = 8.5,
        sensor_width_mm: float = 13.2,     # Standard 1-inch CMOS survey sensor (e.g. DJI Phantom 4 RTK)
        focal_length_mm: float = 8.8,      # Standard 24mm equivalent survey lens
        image_width_px: int = 4000,        # 20MP survey camera resolution
        image_height_px: int = 3000,
    ):
        self.zone = zone.upper()
        self.altitude_agl_m = altitude_agl_m
        self.speed_mps = speed_mps
        self.sensor_width_mm = sensor_width_mm
        self.focal_length_mm = focal_length_mm
        self.image_width_px = image_width_px
        self.image_height_px = image_height_px

        # Trajectory definition per zone
        self.waypoints = self._generate_zone_waypoints(self.zone)
        self.current_waypoint_idx = 0
        self.progress_along_leg = 0.0  # 0.0 to 1.0

        # Current live telemetry state
        start_coord = self.waypoints[0]
        self.latitude = start_coord[1]
        self.longitude = start_coord[0]
        self.heading_deg = 0.0
        self.rtk_status = "FIXED"
        self.satellites_tracked = random.randint(20, 24)
        self.battery_percent = 98.0
        self.frame_index = 0
        self.is_running = False

    def calculate_gsd(self, altitude_m: Optional[float] = None) -> float:
        """
        Dynamically calculates Ground Sampling Distance (GSD) in cm/pixel:
        GSD = (Sensor Width (mm) * Altitude (m) * 100) / (Focal Length (mm) * Image Width (px))
        """
        alt = altitude_m if altitude_m is not None else self.altitude_agl_m
        numerator = self.sensor_width_mm * alt * 100.0
        denominator = self.focal_length_mm * float(self.image_width_px)
        if denominator <= 0:
            return 0.0
        return round(numerator / denominator, 3)

    def calculate_fov_ground_size(self, altitude_m: Optional[float] = None) -> Tuple[float, float]:
        """
        Calculates ground coverage footprint [width_m, height_m] of the camera sensor at current altitude.
        Ground Width (m) = (Sensor Width mm * Altitude m) / Focal Length mm
        """
        alt = altitude_m if altitude_m is not None else self.altitude_agl_m
        ground_w = (self.sensor_width_mm * alt) / self.focal_length_mm
        sensor_h_mm = (self.sensor_width_mm * self.image_height_px) / self.image_width_px
        ground_h = (sensor_h_mm * alt) / self.focal_length_mm
        return round(ground_w, 2), round(ground_h, 2)

    def _generate_zone_waypoints(self, zone: str) -> List[Tuple[float, float]]:
        """
        Generates photogrammetric lawnmower/corridor grid trajectories for different cadastral archetypes.
        Returns list of (lon, lat) tuples.
        """
        if zone == "RURAL":
            # Agricultural zone with wider spacing and irrigation perimeter
            base_lon, base_lat = 77.2100, 28.6120
            return [
                (base_lon - 0.0020, base_lat - 0.0015),
                (base_lon + 0.0020, base_lat - 0.0015),
                (base_lon + 0.0020, base_lat - 0.0005),
                (base_lon - 0.0020, base_lat - 0.0005),
                (base_lon - 0.0020, base_lat + 0.0005),
                (base_lon + 0.0020, base_lat + 0.0005),
                (base_lon + 0.0020, base_lat + 0.0015),
                (base_lon - 0.0020, base_lat + 0.0015),
            ]
        elif zone == "COMMERCIAL":
            # Commercial hub corridor with transit buffer
            base_lon, base_lat = 77.2085, 28.6148
            return [
                (base_lon - 0.0012, base_lat - 0.0012),
                (base_lon + 0.0014, base_lat - 0.0008),
                (base_lon + 0.0016, base_lat + 0.0012),
                (base_lon - 0.0010, base_lat + 0.0014),
                (base_lon - 0.0012, base_lat - 0.0012),
            ]
        else:
            # URBAN - Dense village settlement / Abadi area
            base_lon, base_lat = 77.2093, 28.6140
            return [
                (base_lon - 0.0010, base_lat - 0.0008),
                (base_lon + 0.0010, base_lat - 0.0008),
                (base_lon + 0.0010, base_lat - 0.0002),
                (base_lon - 0.0010, base_lat - 0.0002),
                (base_lon - 0.0010, base_lat + 0.0004),
                (base_lon + 0.0010, base_lat + 0.0004),
                (base_lon + 0.0010, base_lat + 0.0009),
                (base_lon - 0.0010, base_lat + 0.0009),
            ]

    def set_zone(self, zone: str):
        """Switches the flight simulation zone and resets flight path."""
        self.zone = zone.upper()
        self.waypoints = self._generate_zone_waypoints(self.zone)
        self.current_waypoint_idx = 0
        self.progress_along_leg = 0.0
        start = self.waypoints[0]
        self.longitude = start[0]
        self.latitude = start[1]

    def set_altitude(self, altitude_m: float):
        """Sets flight altitude AGL, which dynamically updates GSD and ground footprint."""
        self.altitude_agl_m = max(15.0, min(300.0, float(altitude_m)))

    def step(self, dt_sec: float = 0.5) -> Dict[str, Any]:
        """
        Advances the virtual UAV simulation state by dt_sec (default 500ms).
        Computes new Lat/Lon, Heading, GSD, and RTK diagnostics.
        """
        n_pts = len(self.waypoints)
        if n_pts < 2:
            return self.get_telemetry()

        curr_pt = self.waypoints[self.current_waypoint_idx]
        next_pt = self.waypoints[(self.current_waypoint_idx + 1) % n_pts]

        # Approximate distance in meters between waypoints (at ~28 deg lat)
        d_lon = next_pt[0] - curr_pt[0]
        d_lat = next_pt[1] - curr_pt[1]

        # Meters conversion
        meters_lat = d_lat * 111132.0
        meters_lon = d_lon * (111320.0 * math.cos(math.radians(curr_pt[1])))
        segment_dist_m = math.hypot(meters_lon, meters_lat)

        if segment_dist_m > 0:
            # Heading in degrees clockwise from North
            angle_rad = math.atan2(meters_lon, meters_lat)
            self.heading_deg = round((math.degrees(angle_rad) + 360) % 360, 1)

            # Advance along leg
            step_distance_m = self.speed_mps * dt_sec
            progress_delta = step_distance_m / segment_dist_m
            self.progress_along_leg += progress_delta

            if self.progress_along_leg >= 1.0:
                self.progress_along_leg = 0.0
                self.current_waypoint_idx = (self.current_waypoint_idx + 1) % n_pts
                curr_pt = next_pt
                next_pt = self.waypoints[(self.current_waypoint_idx + 1) % n_pts]

            # Interpolate position
            t = self.progress_along_leg
            self.longitude = curr_pt[0] + (next_pt[0] - curr_pt[0]) * t
            self.latitude = curr_pt[1] + (next_pt[1] - curr_pt[1]) * t

        # Introduce realistic RTK micro-jitter (sub-centimeter)
        jitter_lon = (random.random() - 0.5) * 0.0000005
        jitter_lat = (random.random() - 0.5) * 0.0000005
        self.longitude += jitter_lon
        self.latitude += jitter_lat

        # Update battery and frame index
        self.frame_index += 1
        self.battery_percent = max(12.0, self.battery_percent - 0.015)
        self.satellites_tracked = random.randint(20, 24)

        return self.get_telemetry()

    def get_telemetry(self) -> Dict[str, Any]:
        """
        Returns full standard telemetry payload matching GeoTrace-AI specification.
        """
        gsd = self.calculate_gsd()
        fov_w, fov_h = self.calculate_fov_ground_size()

        # Calculate bounding box footprint of current camera frame in WGS84
        deg_lat = (fov_h / 111132.0) / 2.0
        deg_lon = (fov_w / (111320.0 * math.cos(math.radians(self.latitude)))) / 2.0

        camera_footprint = [
            [round(self.longitude - deg_lon, 7), round(self.latitude - deg_lat, 7)],
            [round(self.longitude + deg_lon, 7), round(self.latitude - deg_lat, 7)],
            [round(self.longitude + deg_lon, 7), round(self.latitude + deg_lat, 7)],
            [round(self.longitude - deg_lon, 7), round(self.latitude + deg_lat, 7)],
            [round(self.longitude - deg_lon, 7), round(self.latitude - deg_lat, 7)],
        ]

        return {
            "latitude": round(self.latitude, 7),
            "longitude": round(self.longitude, 7),
            "altitude_agl": round(self.altitude_agl_m, 1),
            "gsd_cm_px": gsd,
            "rtk_status": self.rtk_status,
            "satellites_tracked": self.satellites_tracked,
            "heading_deg": self.heading_deg,
            "speed_mps": round(self.speed_mps, 1),
            "battery_percent": round(self.battery_percent, 1),
            "zone": self.zone,
            "frame_index": self.frame_index,
            "ground_coverage_m": {"width": fov_w, "height": fov_h},
            "camera_footprint_bbox": camera_footprint,
            "sensor_specs": {
                "sensor_width_mm": self.sensor_width_mm,
                "focal_length_mm": self.focal_length_mm,
                "image_width_px": self.image_width_px,
                "image_height_px": self.image_height_px,
            },
            "timestamp": int(time.time() * 1000),
        }

    async def stream_telemetry_loop(self, broadcast_fn, interval_sec: float = 0.5):
        """
        Asynchronous flight loop streaming telemetry payloads over WebSockets every 500ms.
        """
        self.is_running = True
        try:
            while self.is_running:
                payload = self.step(dt_sec=interval_sec)
                await broadcast_fn({
                    "event": "UAV_TELEMETRY",
                    "telemetry": payload
                })
                await asyncio.sleep(interval_sec)
        except asyncio.CancelledError:
            self.is_running = False
        finally:
            self.is_running = False


# Global singleton flight simulator instance
virtual_uav_engine = VirtualUAVFlightEngine()
