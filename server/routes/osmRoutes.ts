import { Router, Request, Response } from "express";

const router = Router();

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

interface OverpassResponse {
  version: number;
  generator: string;
  osmdat: string;
  elements: OverpassElement[];
}

/**
 * Query Overpass API for highways within a bounding box
 * @param bbox [minLon, minLat, maxLon, maxLat] in EPSG:4326
 * @returns GeoJSON FeatureCollection of road geometries
 */
async function fetchRoadsFromOverpass(bbox: [number, number, number, number]): Promise<any> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  
  // Overpass QL query for highways
  const query = `
    [out:json][timeout:25];
    (
      way["highway"](${minLat},${minLon},${maxLat},${maxLon});
      relation["highway"](${minLat},${minLon},${maxLat},${maxLon});
    );
    out body;
    >;
    out skel qt;
  `;

  const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
  
  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "User-Agent": "GeoTrace-AI/1.0 (https://github.com/geotrace-ai)"
      },
      body: new URLSearchParams({ data: query }),
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
    }

    const data: OverpassResponse = await response.json();
    return convertOverpassToGeoJSON(data, bbox);
  } catch (error) {
    console.error("Overpass API fetch failed:", error);
    throw error;
  }
}

/**
 * Convert Overpass API response to GeoJSON FeatureCollection
 */
function convertOverpassToGeoJSON(data: OverpassResponse, bbox: [number, number, number, number]): any {
  const nodes = new Map<number, { lat: number; lon: number }>();
  const ways: any[] = [];
  const relations: any[] = [];

  // First pass: collect nodes
  for (const element of data.elements) {
    if (element.type === "node" && element.lat && element.lon) {
      nodes.set(element.id, { lat: element.lat, lon: element.lon });
    }
  }

  // Second pass: process ways
  for (const element of data.elements) {
    if (element.type === "way" && element.nodes && element.tags) {
      const coords: [number, number][] = [];
      for (const nodeId of element.nodes) {
        const node = nodes.get(nodeId);
        if (node) {
          coords.push([node.lon, node.lat]);
        }
      }
      if (coords.length >= 2) {
        ways.push({
          type: "Feature",
          id: `osm_way_${element.id}`,
          geometry: {
            type: "LineString",
            coordinates: coords,
          },
          properties: {
            osm_id: element.id,
            highway: element.tags.highway,
            name: element.tags.name || "",
            oneway: element.tags.oneway || "no",
            surface: element.tags.surface || "",
            lanes: element.tags.lanes || "",
            maxspeed: element.tags.maxspeed || "",
            source: "OPENSTREETMAP_OVERPASS",
            layer_type: "ROAD_NETWORK",
          },
        });
      }
    }
  }

  // Third pass: process relations (for complex road networks)
  for (const element of data.elements) {
    if (element.type === "relation" && element.tags) {
      // Relations are more complex; for now just log them
      console.log(`[Overpass] Relation ${element.id}: ${element.tags.type || "unknown"}`);
    }
  }

  // Calculate road statistics
  const highwayTypes = new Map<string, number>();
  let totalLength = 0;
  
  for (const way of ways) {
    const hw = way.properties.highway || "unknown";
    highwayTypes.set(hw, (highwayTypes.get(hw) || 0) + 1);
    
    // Approximate length in meters
    let length = 0;
    const coords = way.geometry.coordinates;
    for (let i = 0; i < coords.length - 1; i++) {
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];
      const R = 6371000; // Earth radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      length += R * c;
    }
    way.properties.length_m = Math.round(length);
    totalLength += length;
  }

  return {
    type: "FeatureCollection",
    features: ways,
    metadata: {
      bbox,
      query_time: new Date().toISOString(),
      total_roads: ways.length,
      total_length_m: Math.round(totalLength),
      highway_types: Object.fromEntries(highwayTypes),
      source: "OpenStreetMap via Overpass API (https://overpass-api.de)",
      license: "ODbL 1.0 - © OpenStreetMap contributors",
    },
  };
}

/**
 * GET /api/osm/roads?bbox=minLon,minLat,maxLon,maxLat
 * Fetch road network from OpenStreetMap for a given bounding box
 */
router.get("/roads", async (req: Request, res: Response) => {
  try {
    const bboxParam = req.query.bbox as string;
    if (!bboxParam) {
      return res.status(400).json({ 
        success: false, 
        message: "bbox parameter required (minLon,minLat,maxLon,maxLat)" 
      });
    }

    const bbox = bboxParam.split(",").map(parseFloat);
    if (bbox.length !== 4 || bbox.some(isNaN)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid bbox format. Use: minLon,minLat,maxLon,maxLat" 
      });
    }

    // Validate bbox area (prevent huge queries)
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const areaDeg = (maxLon - minLon) * (maxLat - minLat);
    if (areaDeg > 0.25) { // ~25km x 25km at equator
      return res.status(400).json({ 
        success: false, 
        message: "Bounding box too large. Maximum area: 0.25 deg²" 
      });
    }

    const geojson = await fetchRoadsFromOverpass(bbox as [number, number, number, number]);
    
    res.json({
      success: true,
      data: geojson,
    });
  } catch (error: any) {
    console.error("[OSM Roads] Error:", error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to fetch roads from OpenStreetMap" 
    });
  }
});

/**
 * POST /api/osm/roads-for-parcel
 * Fetch roads for a specific parcel's bounding box
 */
router.post("/roads-for-parcel", async (req: Request, res: Response) => {
  try {
    const { parcelId, bufferMeters = 100 } = req.body;
    
    // Get parcel from store (would need access to PARCEL_STORE)
    // For now, accept explicit bbox
    const { bbox } = req.body;
    
    if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) {
      return res.status(400).json({ 
        success: false, 
        message: "bbox required: [minLon, minLat, maxLon, maxLat]" 
      });
    }

    // Expand bbox by buffer
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const degPerMeter = 1 / 111132; // Approximate at equator
    const bufferDeg = bufferMeters * degPerMeter;
    
    const expandedBbox: [number, number, number, number] = [
      minLon - bufferDeg,
      minLat - bufferDeg,
      maxLon + bufferDeg,
      maxLat + bufferDeg,
    ];

    const geojson = await fetchRoadsFromOverpass(expandedBbox);
    
    res.json({
      success: true,
      data: geojson,
      buffer_meters: bufferMeters,
    });
  } catch (error: any) {
    console.error("[OSM Roads for Parcel] Error:", error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to fetch roads" 
    });
  }
});

export default router;