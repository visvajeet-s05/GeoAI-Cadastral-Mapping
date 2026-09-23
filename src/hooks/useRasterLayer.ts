import { useEffect, useRef, useState, useCallback } from "react";
import * as L from "leaflet";
import parseGeoraster, { GeoRasterInstance } from "georaster";
import GeoRasterLayer, { GeoRasterLayerOptions } from "georaster-layer-for-leaflet";
import {
  ActiveRasterLayerConfig,
  RasterSpatialMetadata,
  BoundingBoxTuple,
} from "../types/raster";
import { transformNativeBoundsToLeaflet, getBoundingBoxCenter } from "../lib/projections";

interface UseRasterLayerParams {
  map: L.Map | null;
  config: ActiveRasterLayerConfig | null;
  onMetadataExtracted?: (metadata: RasterSpatialMetadata) => void;
  onError?: (errorMessage: string) => void;
}

interface UseRasterLayerReturn {
  isLoading: boolean;
  metadata: RasterSpatialMetadata | null;
  zoomToExtent: () => void;
  setOpacity: (opacity: number) => void;
  removeLayer: () => void;
}

export function useRasterLayer({
  map,
  config,
  onMetadataExtracted,
  onError,
}: UseRasterLayerParams): UseRasterLayerReturn {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [metadata, setMetadata] = useState<RasterSpatialMetadata | null>(null);

  // References to active Leaflet layers
  const activeGeoRasterLayerRef = useRef<GeoRasterLayer | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const currentBoundsRef = useRef<BoundingBoxTuple | null>(null);

  // Safe layer cleanup function to prevent memory leaks
  const removeLayer = useCallback(() => {
    if (!map) return;

    if (activeGeoRasterLayerRef.current) {
      try {
        map.removeLayer(activeGeoRasterLayerRef.current);
      } catch (err) {
        console.warn("Failed to remove GeoRasterLayer:", err);
      }
      activeGeoRasterLayerRef.current = null;
    }

    if (activeTileLayerRef.current) {
      try {
        map.removeLayer(activeTileLayerRef.current);
      } catch (err) {
        console.warn("Failed to remove TileLayer:", err);
      }
      activeTileLayerRef.current = null;
    }
  }, [map]);

  // Zoom map to the current raster's geographic bounds
  const zoomToExtent = useCallback(() => {
    if (!map || !currentBoundsRef.current) return;
    const [sw, ne] = currentBoundsRef.current;
    const latLngBounds = L.latLngBounds([sw[0], sw[1]], [ne[0], ne[1]]);
    map.fitBounds(latLngBounds, {
      padding: [40, 40],
      maxZoom: 21,
      animate: true,
    });
  }, [map]);

  // Dynamically update opacity without rebuilding the layer
  const setOpacity = useCallback(
    (opacity: number) => {
      const clamped = Math.max(0, Math.min(1, opacity));
      if (activeGeoRasterLayerRef.current) {
        activeGeoRasterLayerRef.current.setOpacity(clamped);
      }
      if (activeTileLayerRef.current) {
        activeTileLayerRef.current.setOpacity(clamped);
      }
    },
    []
  );

  // Pixel symbology shader based on active color model
  const createPixelColorShader = useCallback(
    (georaster: GeoRasterInstance, symbology: string) => {
      const numBands = georaster.numberOfRasters;

      return (values: number[]): string | null => {
        // Transparent if no-data
        if (values.length === 0 || values[0] === null || isNaN(values[0])) {
          return null;
        }

        // Multi-band RGB / RGBA
        if (numBands >= 3) {
          let r = values[0];
          let g = values[1];
          let b = values[2];
          let a = numBands >= 4 && values[3] !== undefined ? values[3] / 255 : 1.0;

          // Normalization if 16-bit or 32-bit
          const maxVal = Math.max(georaster.maxs[0] || 255, 255);
          if (maxVal > 255) {
            r = Math.min(255, Math.floor((r / maxVal) * 255));
            g = Math.min(255, Math.floor((g / maxVal) * 255));
            b = Math.min(255, Math.floor((b / maxVal) * 255));
          }

          if (symbology === "INFRARED" && numBands >= 4) {
            // Near-Infrared False Color: NIR -> Red, Red -> Green, Green -> Blue
            const nir = values[3];
            return `rgba(${Math.min(255, nir)}, ${r}, ${g}, 1.0)`;
          }

          if (symbology === "FALSE_COLOR") {
            // High-contrast vegetation / building enhancement
            return `rgba(${b}, ${r}, ${g}, ${a})`;
          }

          return `rgba(${r}, ${g}, ${b}, ${a})`;
        }

        // Single Band Grayscale or Elevation Ramp
        const val = values[0];
        const min = georaster.mins[0] || 0;
        const max = georaster.maxs[0] || 255;
        const norm = Math.max(0, Math.min(1, (val - min) / ((max - min) || 1)));

        if (symbology === "ELEVATION_RAMP") {
          // Viridis-like elevation color ramp
          const red = Math.floor(Math.sin(norm * Math.PI) * 255);
          const green = Math.floor(norm * 255);
          const blue = Math.floor((1 - norm) * 255);
          return `rgba(${red}, ${green}, ${blue}, 0.85)`;
        }

        const gray = Math.floor(norm * 255);
        return `rgba(${gray}, ${gray}, ${gray}, 1.0)`;
      };
    },
    []
  );

  // Main effect: Parse raster and mount layer
  useEffect(() => {
    if (!map || !config || !config.visible) {
      removeLayer();
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const initRaster = async () => {
      try {
        removeLayer();

        // SCENARIO 1: Server-Side Pyramid XYZ Tile Template available
        if (config.tileUrlTemplate) {
          const [sw, ne] = config.bounds;
          const latLngBounds = L.latLngBounds([sw[0], sw[1]], [ne[0], ne[1]]);

          const tileLayer = L.tileLayer(config.tileUrlTemplate, {
            bounds: latLngBounds,
            opacity: config.opacity,
            minZoom: 12,
            maxNativeZoom: 22,
            maxZoom: 24,
            tileSize: 256,
            crossOrigin: true,
          });

          tileLayer.addTo(map);
          activeTileLayerRef.current = tileLayer;
          currentBoundsRef.current = config.bounds;

          setIsLoading(false);
          return;
        }

        // SCENARIO 2: Client-side GeoTIFF parsing via georaster & georaster-layer-for-leaflet
        const inputSource = config.arrayBuffer || config.url;
        if (!inputSource) {
          throw new Error("No raster source provided (missing URL or ArrayBuffer)");
        }

        // Parse georaster data
        const georaster: GeoRasterInstance = await parseGeoraster(inputSource);

        if (!isMounted) return;

        // Extract native spatial metadata
        const nativeEpsg = georaster.projection || config.epsg || 32644;
        const nativeBounds = {
          minX: georaster.xmin,
          minY: georaster.ymin,
          maxX: georaster.xmax,
          maxY: georaster.ymax,
        };

        // Transform bounds to geographic WGS84 for Leaflet
        const geographicBounds = transformNativeBoundsToLeaflet(
          nativeBounds.minX,
          nativeBounds.minY,
          nativeBounds.maxX,
          nativeBounds.maxY,
          nativeEpsg
        );

        const center = getBoundingBoxCenter(geographicBounds);

        // Ground sample distance calculation (meters per pixel)
        const gsdMeters = Math.abs(georaster.pixelWidth) || config.gsdMeters || 0.02;

        const extractedMeta: RasterSpatialMetadata = {
          rasterId: config.id,
          filename: config.name,
          fileSizeBytes: (config.arrayBuffer?.byteLength) || 0,
          width: georaster.width,
          height: georaster.height,
          bands: georaster.numberOfRasters,
          epsg: nativeEpsg,
          projectionName: `EPSG:${nativeEpsg}`,
          nativeBounds,
          geographicBounds,
          center,
          gsdMeters,
          hasSpatialTags: !!georaster.projection,
          bitDepth: 8,
          tileUrlTemplate: "",
          minZoom: 14,
          maxZoom: 22,
          colorModel: georaster.numberOfRasters >= 3 ? "RGB" : "Grayscale",
        };

        setMetadata(extractedMeta);
        currentBoundsRef.current = geographicBounds;

        if (onMetadataExtracted) {
          onMetadataExtracted(extractedMeta);
        }

        // Initialize GeoRasterLayer with bilinear resampling & color symbology
        const layerOptions: GeoRasterLayerOptions = {
          georaster,
          opacity: config.opacity,
          resolution: 256,
          resampleMethod: "bilinear",
          pixelValuesToColorFn: createPixelColorShader(
            georaster,
            config.colorSymbology || "NATURAL_RGB"
          ),
        };

        const geoRasterLayer = new GeoRasterLayer(layerOptions);
        geoRasterLayer.addTo(map);
        activeGeoRasterLayerRef.current = geoRasterLayer;

        setIsLoading(false);
      } catch (err: unknown) {
        if (!isMounted) return;
        setIsLoading(false);
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Failed to initialize Cloud-Optimized GeoTIFF raster overlay";
        console.error("useRasterLayer error:", err);
        if (onError) {
          onError(errorMsg);
        }
      }
    };

    initRaster();

    return () => {
      isMounted = false;
      removeLayer();
    };
  }, [
    map,
    config?.id,
    config?.url,
    config?.arrayBuffer,
    config?.tileUrlTemplate,
    config?.visible,
    config?.colorSymbology,
    removeLayer,
    createPixelColorShader,
    onMetadataExtracted,
    onError,
  ]);

  // Handle dynamic opacity changes smoothly
  useEffect(() => {
    if (config?.opacity !== undefined) {
      setOpacity(config.opacity);
    }
  }, [config?.opacity, setOpacity]);

  return {
    isLoading,
    metadata,
    zoomToExtent,
    setOpacity,
    removeLayer,
  };
}
