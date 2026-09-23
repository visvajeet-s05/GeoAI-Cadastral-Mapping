declare module "georaster" {
  export interface GeoRasterInstance {
    maxs: number[];
    mins: number[];
    ranges: number[];
    noDataValue: number | null;
    pixelHeight: number;
    pixelWidth: number;
    projection: number;
    values: number[][][];
    width: number;
    height: number;
    xmin: number;
    xmax: number;
    ymin: number;
    ymax: number;
    numberOfRasters: number;
    toCanvas(options?: {
      width?: number;
      height?: number;
    }): HTMLCanvasElement | Promise<HTMLCanvasElement>;
  }

  export default function parseGeoraster(
    input: ArrayBuffer | string | File | Blob
  ): Promise<GeoRasterInstance>;
}

declare module "georaster-layer-for-leaflet" {
  import * as L from "leaflet";
  import { GeoRasterInstance } from "georaster";

  export interface GeoRasterLayerOptions extends L.GridLayerOptions {
    georaster: GeoRasterInstance;
    opacity?: number;
    pixelValuesToColorFn?: (values: number[]) => string | null;
    resolution?: number;
    debugLevel?: number;
    resampleMethod?: "bilinear" | "nearest";
    mask?: [number, number][];
  }

  export default class GeoRasterLayer extends L.GridLayer {
    constructor(options: GeoRasterLayerOptions);
    georaster: GeoRasterInstance;
    setOpacity(opacity: number): this;
  }
}
