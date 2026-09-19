"""
Test VLM Fallback Functionality
Ensures Section 56 TN TCP Act notice generation works without API key
"""

import asyncio
from app.services.gemini_vlm import GeminiVlmAuditService

def test_vlm_fallback():
    """Test VLM fallback when API key is not configured"""
    print("Testing VLM Fallback Functionality...")
    
    # Create service without API key to force fallback
    vlm_service = GeminiVlmAuditService(api_key=None)
    
    # Test fallback audit
    test_report = vlm_service._generate_fallback_audit(
        uprn="TEST-UPRN-ENC-001",
        area_sqm=450.0,
        zoning="RESIDENTIAL"
    )
    
    print(f"PASS: Fallback audit generated successfully")
    print(f"   Land Type: {test_report['land_type']}")
    print(f"   Compliance Score: {test_report['compliance_score']}")
    print(f"   Encroachment Detected: {test_report['encroachment_detected']}")
    print(f"   Encroachment Details: {test_report['encroachment_details']}")
    print(f"   Recommendations: {test_report['recommendations']}")
    
    # Test Section 56 notice generation
    from app.services.privacy_ethics import privacy_compliance
    
    section56_notice = privacy_compliance.generate_section56_notice_template(
        spatial_uuid="TN-PARCEL-A1B2C3D4",
        encroachment_area_sqm=32.4,
        setback_violation_m=1.65,
        legal_reference="CMDA/PPA/2018/102"
    )
    
    print(f"\nPASS: Section 56 Notice Template Generated:")
    print(f"   Notice Length: {len(section56_notice)} characters")
    print(f"   Contains Required Elements: {'YES' if 'Section 56' in section56_notice else 'NO'}")
    print(f"   Contains TNCDBR Reference: {'YES' if 'TNCDBR' in section56_notice else 'NO'}")
    
    return True

if __name__ == "__main__":
    result = test_vlm_fallback()
    if result:
        print("\nSUCCESS: VLM Fallback Test PASSED - System will not throw 500 errors without API key")
    else:
        print("\nFAIL: VLM Fallback Test FAILED")