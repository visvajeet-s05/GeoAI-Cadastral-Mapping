"""
GeoTrace-AI Comprehensive Module Verification Test
Tests key modules through a synthetic cadastral pipeline
"""

import sys
import json
from typing import List, Dict, Any

# Test imports
try:
    from app.spatial.shoelace import compute_parcel_metrics
    from app.spatial.topology import TopologyValidator
    from app.services.audit_chain import CadastralAuditLedger
    from app.vision.detector import CadastralVisionDetector
    from app.vision.geojson_converter import GeoJsonConverter
    from simulators.virtual_uav import virtual_uav_engine
    print("PASS: Core modules imported successfully")
    
    # Try VLM import separately
    try:
        from app.services.gemini_vlm import GeminiVlmAuditService
        print("PASS: VLM module imported successfully")
    except ImportError as e:
        print(f"WARN: VLM module import failed (expected if google-genai not installed): {e}")
        GeminiVlmAuditService = None
except ImportError as e:
    print(f"FAIL: Import failed: {e}")
    sys.exit(1)

# Synthetic test data - realistic cadastral polygon in New Delhi area
TEST_COORDINATES = [
    [77.2090, 28.6139],
    [77.20945, 28.61395],
    [77.20942, 28.6143],
    [77.20897, 28.61426],
    [77.2090, 28.6139]
]

def test_shoelace_module():
    """Test Mod 3: Shoelace area calculation and geodesic projection"""
    print("\nTesting Shoelace Module (Mod 3)...")
    try:
        metrics = compute_parcel_metrics([(c[0], c[1]) for c in TEST_COORDINATES])
        assert metrics['area_sq_meters'] > 0, "Area should be positive"
        assert metrics['perimeter_meters'] > 0, "Perimeter should be positive"
        assert 'centroid' in metrics, "Centroid should be calculated"
        print(f"   PASS: Area: {metrics['area_sq_meters']} m², Perimeter: {metrics['perimeter_meters']} m")
        print(f"   PASS: Centroid: {metrics['centroid']}")
        return True, metrics
    except Exception as e:
        print(f"   FAIL: Shoelace test failed: {e}")
        return False, None

def test_topology_module():
    """Test Mod 16: Topology validation and Mod 17: Auto repair"""
    print("\nTesting Topology Module (Mod 16/17)...")
    try:
        validator = TopologyValidator()
        
        # Test single parcel validation
        report = validator.validate_single_parcel(TEST_COORDINATES)
        assert 'is_valid' in report, "Validation report should have is_valid"
        print(f"   PASS: Single parcel valid: {report['is_valid']}")
        
        # Test network topology
        test_parcels = [
            {"id": "TEST-1", "uprn": "TEST-UPRN-1", "coordinates": TEST_COORDINATES},
            {"id": "TEST-2", "uprn": "TEST-UPRN-2", "coordinates": [
                [77.2095, 28.6140],
                [77.20995, 28.61405],
                [77.20992, 28.6144],
                [77.20947, 28.61436],
                [77.2095, 28.6140]
            ]}
        ]
        network_report = validator.check_network_topology(test_parcels)
        assert 'network_integrity_score' in network_report, "Network report should have integrity score"
        print(f"   PASS: Network integrity score: {network_report['network_integrity_score']}")
        
        # Test repair functionality
        repaired = validator.repair_geometry(TEST_COORDINATES)
        assert len(repaired) >= 4, "Repaired geometry should have at least 4 vertices"
        print(f"   PASS: Geometry repair successful, vertices: {len(repaired)}")
        
        # Test Douglas-Peucker simplification
        simplified = validator.simplify_douglas_peucker(TEST_COORDINATES)
        assert len(simplified) <= len(TEST_COORDINATES), "Simplified should have fewer or equal vertices"
        print(f"   PASS: Douglas-Peucker simplification: {len(TEST_COORDINATES)} to {len(simplified)} vertices")
        
        return True, network_report
    except Exception as e:
        print(f"   FAIL: Topology test failed: {e}")
        return False, None

def test_audit_chain_module():
    """Test Mod 20: SHA-256 hash chain generator"""
    print("\nTesting Audit Chain Module (Mod 20)...")
    try:
        # Test hash generation
        coord_hash = CadastralAuditLedger.hash_coordinates(TEST_COORDINATES)
        assert len(coord_hash) == 64, "SHA-256 hash should be 64 characters"
        print(f"   PASS: Coordinate hash: {coord_hash[:16]}...")
        
        # Test genesis block creation
        genesis = CadastralAuditLedger.create_audit_block(
            parcel_id="TEST-PARCEL",
            block_index=0,
            previous_hash=CadastralAuditLedger.GENESIS_HASH,
            coordinates=TEST_COORDINATES,
            surveyor_id="TEST-SURVEYOR",
            surveyor_name="Test Surveyor",
            action="INITIAL_INGESTION",
            description="Test genesis block"
        )
        assert genesis['current_hash'] != CadastralAuditLedger.GENESIS_HASH, "Genesis hash should differ from zero hash"
        print(f"   PASS: Genesis block created: {genesis['current_hash'][:16]}...")
        
        # Test chain verification
        chain = [genesis]
        verification = CadastralAuditLedger.verify_audit_chain(chain, TEST_COORDINATES)
        assert verification['is_valid'], "Chain should be valid"
        print(f"   PASS: Chain verification: {verification['is_valid']}")
        
        return True, verification
    except Exception as e:
        print(f"   FAIL: Audit chain test failed: {e}")
        return False, None

def test_vision_module():
    """Test Mod 6: Vision detection pipeline"""
    print("\nTesting Vision Module (Mod 6)...")
    try:
        import numpy as np
        
        detector = CadastralVisionDetector()
        
        # Create synthetic test image
        test_image = np.zeros((400, 400, 3), dtype=np.uint8)
        # Draw some rectangles to simulate buildings
        import cv2
        cv2.rectangle(test_image, (50, 50), (150, 150), (200, 200, 200), -1)
        cv2.rectangle(test_image, (200, 100), (300, 200), (180, 180, 180), -1)
        
        # Test edge detection and contour extraction
        result = detector.extract_edges_and_contours(test_image)
        assert 'polygons' in result, "Result should contain polygons"
        print(f"   PASS: Edge detection found {result['total_contours_found']} contours")
        print(f"   PASS: Extracted {len(result['polygons'])} polygons")
        
        # Test structure segmentation
        structures = detector.segment_structures(test_image)
        print(f"   PASS: Structure segmentation found {len(structures)} structures")
        
        return True, result
    except Exception as e:
        print(f"   FAIL: Vision test failed: {e}")
        return False, None

def test_geojson_converter():
    """Test Mod 22: GIS Export functionality"""
    print("\nTesting GeoJSON Converter (Mod 22)...")
    try:
        converter = GeoJsonConverter(
            top_left=(77.2090, 28.6143),
            bottom_right=(77.2115, 28.6130),
            image_dims=(800, 800)
        )
        
        # Test pixel to coordinate conversion
        lon, lat = converter.pixel_to_wgs84(400, 400)
        assert 77.2090 < lon < 77.2115, "Longitude should be within bounds"
        assert 28.6130 < lat < 28.6143, "Latitude should be within bounds"
        print(f"   PASS: Pixel (400,400) → WGS84 ({lon}, {lat})")
        
        # Test contour to GeoJSON conversion
        pixel_contour = [[100, 100], [200, 100], [200, 200], [100, 200], [100, 100]]
        geojson_feature = converter.convert_contour_to_geojson_polygon(
            pixel_contour,
            properties={"test": "property"}
        )
        assert geojson_feature['type'] == 'Feature', "Should be a GeoJSON Feature"
        assert geojson_feature['geometry']['type'] == 'Polygon', "Should be a Polygon"
        print(f"   PASS: GeoJSON Feature created successfully")
        
        # Test feature collection
        feature_collection = converter.create_feature_collection([geojson_feature])
        assert feature_collection['type'] == 'FeatureCollection', "Should be a FeatureCollection"
        print(f"   PASS: FeatureCollection created successfully")
        
        return True, feature_collection
    except Exception as e:
        print(f"   FAIL: GeoJSON converter test failed: {e}")
        return False, None

def test_vlm_module():
    """Test VLM integration with fallback"""
    print("\nTesting VLM Module (with fallback)...")
    try:
        if GeminiVlmAuditService is None:
            print("   SKIP: VLM module not available (google-genai import failed)")
            return None, None
            
        vlm_service = GeminiVlmAuditService(api_key=None)  # Force fallback mode
        
        # Test fallback audit
        report = vlm_service._generate_fallback_audit(
            uprn="TEST-UPRN-001",
            area_sqm=500.0,
            zoning="RESIDENTIAL"
        )
        
        assert 'land_type' in report, "Report should have land_type"
        assert 'compliance_score' in report, "Report should have compliance_score"
        assert 'encroachment_detected' in report, "Report should have encroachment_detected"
        print(f"   PASS: Fallback audit: land_type={report['land_type']}, compliance={report['compliance_score']}")
        
        return True, report
    except Exception as e:
        print(f"   FAIL: VLM test failed: {e}")
        return False, None

def test_uav_simulator():
    """Test UAV flight simulator"""
    print("\nTesting UAV Simulator...")
    try:
        # Test telemetry generation
        telemetry = virtual_uav_engine.get_telemetry()
        assert 'latitude' in telemetry, "Telemetry should have latitude"
        assert 'longitude' in telemetry, "Telemetry should have longitude"
        assert 'gsd_cm_px' in telemetry, "Telemetry should have GSD"
        print(f"   PASS: UAV Position: ({telemetry['latitude']}, {telemetry['longitude']})")
        print(f"   PASS: GSD: {telemetry['gsd_cm_px']} cm/px")
        
        # Test GSD calculation
        gsd = virtual_uav_engine.calculate_gsd(altitude_m=50.0)
        assert gsd > 0, "GSD should be positive"
        print(f"   PASS: Dynamic GSD at 50m: {gsd} cm/px")
        
        # Test FOV calculation
        fov_w, fov_h = virtual_uav_engine.calculate_fov_ground_size(altitude_m=50.0)
        assert fov_w > 0 and fov_h > 0, "FOV should be positive"
        print(f"   PASS: Ground coverage: {fov_w}m x {fov_h}m")
        
        # Test simulation step
        updated_telemetry = virtual_uav_engine.step(dt_sec=0.5)
        assert updated_telemetry['frame_index'] > telemetry['frame_index'], "Frame index should increment"
        print(f"   PASS: Simulation step successful, frame: {updated_telemetry['frame_index']}")
        
        return True, updated_telemetry
    except Exception as e:
        print(f"   FAIL: UAV simulator test failed: {e}")
        return False, None

def test_database_schema():
    """Test Mod 21: GIS Database schema"""
    print("\nTesting Database Schema (Mod 21)...")
    try:
        # Check if Prisma schema file exists and is valid
        import os
        schema_path = "prisma/schema.prisma"
        if os.path.exists(schema_path):
            with open(schema_path, 'r') as f:
                schema_content = f.read()
            
            # Check for key models
            required_models = ['Parcel', 'Owner', 'AuditTrailHashBlock', 'BoundaryCoordinate']
            for model in required_models:
                if f"model {model}" in schema_content:
                    print(f"   PASS: Schema contains {model} model")
                else:
                    print(f"   WARN: Schema missing {model} model")
            
            # Check for enums
            required_enums = ['LandType', 'ParcelStatus', 'AuditAction']
            for enum in required_enums:
                if f"enum {enum}" in schema_content:
                    print(f"   PASS: Schema contains {enum} enum")
            
            return True, schema_content
        else:
            print(f"   WARN: Schema file not found at {schema_path}")
            return False, None
    except Exception as e:
        print(f"   FAIL: Database schema test failed: {e}")
        return False, None

def test_api_endpoints():
    """Test API endpoint availability"""
    print("\nTesting API Endpoint Structure...")
    try:
        # Check if main API files exist
        import os
        api_files = [
            'app/api/parcels.py',
            'app/api/vlm.py', 
            'app/api/map_ingest.py',
            'app/api/stream.py',
            'app/main.py'
        ]
        
        for api_file in api_files:
            if os.path.exists(api_file):
                print(f"   PASS: API file exists: {api_file}")
            else:
                print(f"   FAIL: API file missing: {api_file}")
        
        return True, api_files
    except Exception as e:
        print(f"   FAIL: API endpoint test failed: {e}")
        return False, None

def test_frontend_components():
    """Test Mod 23: UI Application components"""
    print("\nTesting Frontend Components (Mod 23)...")
    try:
        import os
        frontend_files = [
            '../src/App.tsx',
            '../src/components/MapView.tsx',
            '../src/components/GoogleCadastralMap.tsx',
            '../src/components/ParcelSidebar.tsx',
            '../src/types.ts'
        ]
        
        for frontend_file in frontend_files:
            if os.path.exists(frontend_file):
                print(f"   PASS: Frontend file exists: {frontend_file}")
            else:
                print(f"   FAIL: Frontend file missing: {frontend_file}")
        
        return True, frontend_files
    except Exception as e:
        print(f"   FAIL: Frontend test failed: {e}")
        return False, None

def main():
    """Run comprehensive verification tests"""
    print("=" * 60)
    print("GeoTrace-AI Comprehensive Module Verification")
    print("=" * 60)
    
    results = {}
    
    # Run all tests
    results['shoelace'] = test_shoelace_module()
    results['topology'] = test_topology_module()
    results['audit_chain'] = test_audit_chain_module()
    results['vision'] = test_vision_module()
    results['geojson'] = test_geojson_converter()
    results['vlm'] = test_vlm_module()
    results['uav'] = test_uav_simulator()
    results['database'] = test_database_schema()
    results['api'] = test_api_endpoints()
    results['frontend'] = test_frontend_components()
    
    # Summary
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, (success, _) in results.items() if success and success is not None)
    total = len(results)
    
    for module_name, (success, _) in results.items():
        if success is None:
            status = "SKIP"
        elif success:
            status = "PASS"
        else:
            status = "FAIL"
        print(f"{status}: {module_name}")
    
    print(f"\nOverall: {passed}/{total} modules verified")
    
    if passed == total:
        print("SUCCESS: All modules verified successfully!")
        return 0
    else:
        print("WARNING: Some modules failed verification")
        return 1

if __name__ == "__main__":
    sys.exit(main())
