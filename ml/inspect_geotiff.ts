import * as GeoTIFF from "geotiff";
import fs from "fs";

async function inspectGeoTiff(filePath: string) {
    const fileBuffer = fs.readFileSync(filePath);
    
    let tiff: any;
    try {
        tiff = await GeoTIFF.fromArrayBuffer(fileBuffer.buffer);
    } catch (err) {
        console.error(`Invalid TIFF header or unsupported compression: ${(err as Error).message}`);
        return;
    }

    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const samplesPerPixel = image.getSamplesPerPixel();
    const bitsPerSample = image.getBitsPerSample();
    const bitDepth = Array.isArray(bitsPerSample) ? bitsPerSample[0] : (bitsPerSample || 8);

    console.log(`Image size: ${width} x ${height}`);
    console.log(`Samples per pixel: ${samplesPerPixel}`);
    console.log(`Bit depth: ${bitDepth}`);

    // Extract spatial tie points and pixel scale
    const tiePoints = await image.getTiePoints();
    const fileDirectory = (image.getFileDirectory() as unknown) as Record<string, unknown>;
    const pixelScale = fileDirectory.ModelPixelScale as number[] | undefined;
    const modelTransformation = fileDirectory.ModelTransformation as number[] | undefined;
    const geoKeys = ((image.getGeoKeys() as unknown) || {}) as Record<string, number>;

    console.log("\n--- GeoTIFF Metadata ---");
    console.log(`Tie points: ${JSON.stringify(tiePoints, null, 2)}`);
    console.log(`Pixel scale: ${JSON.stringify(pixelScale)}`);
    console.log(`Model transformation: ${JSON.stringify(modelTransformation)}`);
    console.log(`GeoKeys: ${JSON.stringify(geoKeys, null, 2)}`);

    let minX = 0, minY = 0, maxX = 1000, maxY = 1000;
    let pixelWidthMeters = 0.02;
    let nativeEpsg = 32644;

    if (!geoKeys.ProjectedCSTypeGeoKey && geoKeys.GeographicTypeGeoKey) {
        nativeEpsg = geoKeys.GeographicTypeGeoKey;
    } else if (geoKeys.ProjectedCSTypeGeoKey) {
        nativeEpsg = geoKeys.ProjectedCSTypeGeoKey;
    }

    console.log(`\nNative EPSG: ${nativeEpsg}`);

    if (tiePoints && tiePoints.length > 0 && pixelScale) {
        const originX = tiePoints[0].x;
        const originY = tiePoints[0].y;
        pixelWidthMeters = pixelScale[0];
        const pixelHeightMeters = pixelScale[1];

        minX = originX;
        maxX = originX + width * pixelWidthMeters;
        maxY = originY;
        minY = originY - height * pixelHeightMeters;

        console.log(`\nCalculated bounds (native CRS):`);
        console.log(`  minX: ${minX}, maxX: ${maxX}`);
        console.log(`  minY: ${minY}, maxY: ${maxY}`);
        console.log(`  pixelWidthMeters: ${pixelWidthMeters}`);
    } else if (modelTransformation && modelTransformation.length >= 16) {
        const originX = modelTransformation[3];
        const originY = modelTransformation[7];
        pixelWidthMeters = Math.abs(modelTransformation[0]);
        const pixelHeightMeters = Math.abs(modelTransformation[5]);

        minX = originX;
        maxX = originX + width * pixelWidthMeters;
        maxY = originY;
        minY = originY - height * pixelHeightMeters;

        console.log(`\nCalculated bounds from model transformation:`);
        console.log(`  minX: ${minX}, maxX: ${maxX}`);
        console.log(`  minY: ${minY}, maxY: ${maxY}`);
    } else {
        console.log("\nNo valid georeferencing found!");
    }

    // If EPSG is 32644 (UTM Zone 44N), convert to WGS84 for display
    if (nativeEpsg === 32644) {
        // Approximate UTM to lat/lon conversion for display
        console.log(`\nNative CRS: UTM Zone 44N (EPSG:32644)`);
        console.log(`Bounds in UTM meters:`);
        console.log(`  Easting: ${minX.toFixed(2)} to ${maxX.toFixed(2)}`);
        console.log(`  Northing: ${minY.toFixed(2)} to ${maxY.toFixed(2)}`);
    }
}

const filePath = process.argv[2];
if (!filePath) {
    console.error("Usage: node inspect_geotiff.js <path_to_geotiff>");
    process.exit(1);
}

inspectGeoTiff(filePath).catch(console.error);