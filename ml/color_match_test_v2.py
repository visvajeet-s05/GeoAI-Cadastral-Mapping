#!/usr/bin/env python3
"""
Real 2x2 Color-Domain-Shift Test against deployed EfficientNet-B3 dual-head model.

Tests 4 variants through raw ONNX inference (NO post-processing):
  A: Native SVAMITVA (no transform)
  B: SVAMITVA color-matched TO Esri statistics (forward)
  C: Native Esri tile (no transform)
  D: Esri color-matched TO SVAMITVA statistics (reverse)

Reports pixel-level probability metrics for BOTH heads (building, vegetation).
Saves 8 raw probability maps as grayscale PNGs.
"""

import os
import sys
import hashlib
import numpy as np
import cv2
import onnxruntime as ort
from pathlib import Path

# ==============================================================================
# 1. VERIFY MODEL IDENTITY
# ==============================================================================
ONNX_PATH = Path("ml/checkpoints/cadastral_dualhead_best.onnx")
DATA_PATH = Path("ml/checkpoints/cadastral_dualhead_best.onnx.data")

EXPECTED_ONNX_MD5 = "a46810005041b355e62422a1584c21c4"
EXPECTED_DATA_MD5 = "51b5e117618f2050204958d9a10c29f1"

def file_md5(path: Path) -> str:
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()

print("=" * 70)
print("MODEL IDENTITY VERIFICATION")
print("=" * 70)

onnx_md5 = file_md5(ONNX_PATH)
data_md5 = file_md5(DATA_PATH)

print(f"ONNX md5: {onnx_md5}  (expected: {EXPECTED_ONNX_MD5})")
print(f"DATA md5: {data_md5}  (expected: {EXPECTED_DATA_MD5})")

if onnx_md5 != EXPECTED_ONNX_MD5 or data_md5 != EXPECTED_DATA_MD5:
    print("❌ CHECKSUM MISMATCH — NOT THE VERIFIED MODEL. STOPPING.")
    sys.exit(1)

print("Checksums match. Proceeding.")

# ==============================================================================
# 2. LOAD ONNX MODEL & VERIFY OUTPUTS
# ==============================================================================
print("\n" + "=" * 70)
print("LOADING ONNX MODEL")
print("=" * 70)

session = ort.InferenceSession(str(ONNX_PATH), providers=["CPUExecutionProvider"])
input_name = session.get_inputs()[0].name
output_names = [o.name for o in session.get_outputs()]

print(f"Input name: {input_name}")
print(f"Output names: {output_names}")

EXPECTED_OUTPUTS = ["building", "vegetation"]
if output_names != EXPECTED_OUTPUTS:
    print(f"❌ UNEXPECTED OUTPUTS: got {output_names}, expected {EXPECTED_OUTPUTS}. STOPPING.")
    sys.exit(1)

print("Outputs confirmed: {output_names}")

# ==============================================================================
# 3. LOAD SOURCE IMAGES (same as prior test)
# ==============================================================================
print("\n" + "=" * 70)
print("LOADING SOURCE IMAGES")
print("=" * 70)

SVAMITVA_PATH = Path("Svamitva-dataset/FilteredData/Images/patch_1.png")
ESRI_PATH = Path("ml/real_esri_tile.png")

svamitva_bgr = cv2.imread(str(SVAMITVA_PATH))
esri_bgr = cv2.imread(str(ESRI_PATH))

if svamitva_bgr is None or esri_bgr is None:
    print("❌ Failed to load source images. STOPPING.")
    sys.exit(1)

# Resize Esri to match SVAMITVA (as done in prior test)
esri_bgr = cv2.resize(esri_bgr, (svamitva_bgr.shape[1], svamitva_bgr.shape[0]))

print(f"SVAMITVA: {svamitva_bgr.shape}, mean={svamitva_bgr.mean(axis=(0,1)).round(2)}, std={svamitva_bgr.std(axis=(0,1)).round(2)}")
print(f"Esri:     {esri_bgr.shape}, mean={esri_bgr.mean(axis=(0,1)).round(2)}, std={esri_bgr.std(axis=(0,1)).round(2)}")

# ==============================================================================
# 4. REINHARD COLOR TRANSFER (LAB mean/std matching)
# Copied from ml/color_match_test.py lines 31-42
# ==============================================================================
def color_match(source_bgr: np.ndarray, target_bgr: np.ndarray) -> np.ndarray:
    """Apply target's color statistics to source (mean/std matching in LAB space)."""
    src_lab = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    tgt_lab = cv2.cvtColor(target_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    
    for c in range(3):
        src_mean, src_std = src_lab[:,:,c].mean(), src_lab[:,:,c].std()
        tgt_mean, tgt_std = tgt_lab[:,:,c].mean(), tgt_lab[:,:,c].std()
        src_lab[:,:,c] = (src_lab[:,:,c] - src_mean) / (src_std + 1e-6) * tgt_std + tgt_mean
    
    matched = cv2.cvtColor(src_lab.astype(np.uint8), cv2.COLOR_LAB2BGR)
    return matched

# Create 4 variants
variant_a = svamitva_bgr  # Native SVAMITVA
variant_b = color_match(svamitva_bgr, esri_bgr)  # SVAMITVA -> Esri stats
variant_c = esri_bgr  # Native Esri
variant_d = color_match(esri_bgr, svamitva_bgr)  # Esri -> SVAMITVA stats

variants = {
    "A_native_svamitva": variant_a,
    "B_svamitva_to_esri": variant_b,
    "C_native_esri": variant_c,
    "D_esri_to_svamitva": variant_d,
}

print("\nVariant color statistics:")
for name, img in variants.items():
    print(f"  {name}: mean={img.mean(axis=(0,1)).round(2)}, std={img.std(axis=(0,1)).round(2)}")

# ==============================================================================
# 5. PREPROCESSING — EXACT COPY from inference_server.py lines 358-367
# (identical to train_cadastral.py lines 358-367)
# ==============================================================================
def preprocess_bgr_to_tensor(img_bgr: np.ndarray) -> np.ndarray:
    """
    Preprocess BGR image to ONNX input tensor.
    Exact copy from inference_server.py:358-367 / train_cadastral.py:358-367
    """
    # Resize to 512x512, convert BGR->RGB, normalize [0, 1]
    resized = cv2.resize(img_bgr, (512, 512))
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    
    # 3-channel RGB only (in_channels=3 for deployed model)
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    norm = (rgb - mean) / std
    tensor = np.transpose(norm, (2, 0, 1))[np.newaxis, ...]  # (1, 3, 512, 512)
    return tensor

# ==============================================================================
# 6. RUN RAW ONNX INFERENCE & COLLECT METRICS
# ==============================================================================
print("\n" + "=" * 70)
print("RUNNING RAW ONNX INFERENCE (4 variants x 2 heads)")
print("=" * 70)

output_dir = Path("ml/verification/color_match_v2")
output_dir.mkdir(parents=True, exist_ok=True)

results = {}

for variant_name, img_bgr in variants.items():
    print(f"\n--- {variant_name} ---")
    
    tensor = preprocess_bgr_to_tensor(img_bgr)
    
    # Run ONNX inference
    outputs = session.run(None, {input_name: tensor})
    # outputs[0] = building logits (1, 1, 512, 512)
    # outputs[1] = vegetation logits (1, 1, 512, 512)
    
    building_logits = outputs[0][0, 0]  # (512, 512)
    vegetation_logits = outputs[1][0, 0]  # (512, 512)
    
    # Apply sigmoid (CRITICAL — prior bug used raw logits directly)
    building_prob = 1.0 / (1.0 + np.exp(-np.clip(building_logits, -60.0, 60.0)))
    vegetation_prob = 1.0 / (1.0 + np.exp(-np.clip(vegetation_logits, -60.0, 60.0)))
    
    # Save raw probability maps as grayscale PNGs (0-255)
    cv2.imwrite(str(output_dir / f"{variant_name}_building_prob.png"), (building_prob * 255).astype(np.uint8))
    cv2.imwrite(str(output_dir / f"{variant_name}_vegetation_prob.png"), (vegetation_prob * 255).astype(np.uint8))
    
    # Compute metrics for both heads
    for head_name, prob_map in [("building", building_prob), ("vegetation", vegetation_prob)]:
        px_gt_05 = int(np.sum(prob_map > 0.5))
        px_gt_07 = int(np.sum(prob_map > 0.7))
        mean_prob = float(prob_map.mean())
        std_prob = float(prob_map.std())
        
        key = f"{variant_name}_{head_name}"
        results[key] = {
            "variant": variant_name,
            "head": head_name,
            "px_gt_05": px_gt_05,
            "px_gt_07": px_gt_07,
            "mean_prob": mean_prob,
            "std_prob": std_prob,
        }
        
        print(f"  {head_name:12s}: px>0.5={px_gt_05:7d}  px>0.7={px_gt_07:7d}  mean={mean_prob:.4f}  std={std_prob:.4f}")

# ==============================================================================
# 7. REPORT RESULTS TABLE
# ==============================================================================
print("\n" + "=" * 70)
print("RESULTS TABLE (4 variants x 2 heads x 4 metrics)")
print("=" * 70)

# Table header
print(f"{'Variant':<25} {'Head':<12} {'px>0.5':>10} {'px>0.7':>10} {'mean_prob':>10} {'std_prob':>10}")
print("-" * 80)

# Sort for consistent output
for variant_name in ["A_native_svamitva", "B_svamitva_to_esri", "C_native_esri", "D_esri_to_svamitva"]:
    for head_name in ["building", "vegetation"]:
        key = f"{variant_name}_{head_name}"
        r = results[key]
        print(f"{r['variant']:<25} {r['head']:<12} {r['px_gt_05']:>10d} {r['px_gt_07']:>10d} {r['mean_prob']:>10.4f} {r['std_prob']:>10.4f}")

# ==============================================================================
# 8. ACCEPTANCE INTERPRETATION
# ==============================================================================
print("\n" + "=" * 70)
print("ACCEPTANCE INTERPRETATION")
print("=" * 70)

# Extract key comparisons
a_bld = results["A_native_svamitva_building"]
b_bld = results["B_svamitva_to_esri_building"]
c_bld = results["C_native_esri_building"]
d_bld = results["D_esri_to_svamitva_building"]

a_veg = results["A_native_svamitva_vegetation"]
b_veg = results["B_svamitva_to_esri_vegetation"]
c_veg = results["C_native_esri_vegetation"]
d_veg = results["D_esri_to_svamitva_vegetation"]

print("\nBuilding head:")
print(f"  Native SVAMITVA (A):     mean={a_bld['mean_prob']:.4f}, px>0.5={a_bld['px_gt_05']}, px>0.7={a_bld['px_gt_07']}")
print(f"  SVAMITVA->Esri (B):      mean={b_bld['mean_prob']:.4f}, px>0.5={b_bld['px_gt_05']}, px>0.7={b_bld['px_gt_07']}")
print(f"  Native Esri (C):         mean={c_bld['mean_prob']:.4f}, px>0.5={c_bld['px_gt_05']}, px>0.7={c_bld['px_gt_07']}")
print(f"  Esri->SVAMITVA (D):      mean={d_bld['mean_prob']:.4f}, px>0.5={d_bld['px_gt_05']}, px>0.7={d_bld['px_gt_07']}")

print("\nVegetation head:")
print(f"  Native SVAMITVA (A):     mean={a_veg['mean_prob']:.4f}, px>0.5={a_veg['px_gt_05']}, px>0.7={a_veg['px_gt_07']}")
print(f"  SVAMITVA->Esri (B):      mean={b_veg['mean_prob']:.4f}, px>0.5={b_veg['px_gt_05']}, px>0.7={b_veg['px_gt_07']}")
print(f"  Native Esri (C):         mean={c_veg['mean_prob']:.4f}, px>0.5={c_veg['px_gt_05']}, px>0.7={c_veg['px_gt_07']}")
print(f"  Esri->SVAMITVA (D):      mean={d_veg['mean_prob']:.4f}, px>0.5={d_veg['px_gt_05']}, px>0.7={d_veg['px_gt_07']}")

# Compute deltas for interpretation
def delta(x, y):
    return abs(x - y)

bld_d_to_a = delta(d_bld['mean_prob'], a_bld['mean_prob'])
bld_d_to_c = delta(d_bld['mean_prob'], c_bld['mean_prob'])
veg_d_to_a = delta(d_veg['mean_prob'], a_veg['mean_prob'])
veg_d_to_c = delta(d_veg['mean_prob'], c_veg['mean_prob'])

print(f"\nDelta(D, A) building:  {bld_d_to_a:.4f}  |  Delta(D, C) building:  {bld_d_to_c:.4f}")
print(f"Delta(D, A) vegetation: {veg_d_to_a:.4f}  |  Delta(D, C) vegetation: {veg_d_to_c:.4f}")

print("\n" + "=" * 70)
print("CONCLUSION")
print("=" * 70)

if bld_d_to_a < bld_d_to_c and veg_d_to_a < veg_d_to_c:
    conclusion = (
        "Variant D (Esri color-matched to SVAMITVA) lands closer to Variant A "
        "(native SVAMITVA) than to Variant C (native Esri) for BOTH heads. "
        "Color-normalization IS a viable ingest fix."
    )
elif bld_d_to_c < bld_d_to_a and veg_d_to_c < veg_d_to_a:
    conclusion = (
        "Variant D (Esri color-matched to SVAMITVA) lands closer to Variant C "
        "(native Esri) than to Variant A (native SVAMITVA) for BOTH heads. "
        "Spectral shift alone does NOT explain the domain gap; color-normalization would NOT help."
    )
else:
    conclusion = (
        "Mixed outcome: building head favors one side, vegetation head favors the other. "
        f"Building: D->A={bld_d_to_a:.4f} vs D->C={bld_d_to_c:.4f}. "
        f"Vegetation: D->A={veg_d_to_a:.4f} vs D->C={veg_d_to_c:.4f}. "
        "Color-normalization helps one head but not the other."
    )

print(conclusion)
print(f"\nSaved 8 probability maps to: {output_dir}")

# Also save CSV for reproducibility
import csv
csv_path = output_dir / "results.csv"
with open(csv_path, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["variant", "head", "px_gt_05", "px_gt_07", "mean_prob", "std_prob"])
    for variant_name in ["A_native_svamitva", "B_svamitva_to_esri", "C_native_esri", "D_esri_to_svamitva"]:
        for head_name in ["building", "vegetation"]:
            key = f"{variant_name}_{head_name}"
            r = results[key]
            writer.writerow([r['variant'], r['head'], r['px_gt_05'], r['px_gt_07'], r['mean_prob'], r['std_prob']])
print(f"Saved CSV to: {csv_path}")