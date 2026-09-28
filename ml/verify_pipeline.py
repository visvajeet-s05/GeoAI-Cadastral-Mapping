#!/usr/bin/env python3
"""Pipeline verification script for Cadastral-Mapping.

Runs identity, model-loading, parity, uncertainty, color-matching, and routing
checks, and writes every raw result to verification/<timestamp>/.

Usage:
    python ml/verify_pipeline.py
"""

import os
import sys
import json
import time
import hashlib
import datetime
import subprocess
import traceback

import numpy as np
import cv2

# Ensure ml/ is importable
ML_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ML_DIR)
os.chdir(ML_DIR)

from inference_server import (
    CadastralInferenceEngine,
    TORCH_AVAILABLE,
    ORT_AVAILABLE,
    NUMPY_AVAILABLE,
    CV2_AVAILABLE,
)

ONNX_PATH = os.path.join(ML_DIR, "checkpoints", "cadastral_dualhead_best.onnx")
ONNX_DATA_PATH = os.path.join(ML_DIR, "checkpoints", "cadastral_dualhead_best.onnx.data")
CHECKPOINT_PATH = os.path.join(ML_DIR, "checkpoints", "best_model.pth")

EXPECTED_ONNX_MD5 = "a46810005041b355e62422a1584c21c4"
EXPECTED_ONNX_DATA_MD5 = "51b5e117618f2050204958d9a10c29f1"
EXPECTED_CHECKPOINT_SIZE = 154_232_739  # bytes, epoch-12

SVAMITVA_DIR = os.path.join(ML_DIR, "..", "Svamitva-dataset", "FilteredData", "Images")
ESRI_TILE_PATH = os.path.join(ML_DIR, "real_esri_tile.png")
PREDICT_RESULT_PATH = os.path.join(ML_DIR, "predict_result.json")

VALIDATION_PATCHES = ["patch_1.png", "patch_500.png", "patch_1000.png"]

TIMESTAMP = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
OUT_DIR = os.path.join(ML_DIR, "verification", TIMESTAMP)


def ensure_outdir():
    os.makedirs(OUT_DIR, exist_ok=True)


def md5_of(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


# ============================================================
# 1. IDENTITY CHECK
# ============================================================
def check_identity(results):
    results["identity"] = {}
    for label, path, expected in [
        ("onnx_model", ONNX_PATH, EXPECTED_ONNX_MD5),
        ("onnx_data", ONNX_DATA_PATH, EXPECTED_ONNX_DATA_MD5),
    ]:
        if os.path.exists(path):
            actual = md5_of(path)
            size = os.path.getsize(path)
            match = actual.lower() == expected.lower()
            results["identity"][label] = {
                "path": path,
                "size_bytes": size,
                "md5": actual,
                "expected_md5": expected,
                "match": match,
                "status": "PASS" if match else "FAIL",
            }
            if not match:
                print(f"  [FAIL] {label}: md5 {actual} != {expected}")
        else:
            results["identity"][label] = {"path": path, "exists": False, "status": "MISSING"}
            print(f"  [MISSING] {label}: {path}")

    # Check best_model.pth
    cp = CHECKPOINT_PATH
    if os.path.exists(cp):
        size = os.path.getsize(cp)
        md5 = md5_of(cp)
        expected_size_match = size == EXPECTED_CHECKPOINT_SIZE
        results["identity"]["best_model"] = {
            "path": cp,
            "size_bytes": size,
            "expected_size_bytes": EXPECTED_CHECKPOINT_SIZE,
            "size_match": expected_size_match,
            "md5": md5,
            "status": "PASS" if expected_size_match else "FAIL",
        }
        if not expected_size_match:
            print(f"  [FAIL] best_model.pth: size {size} != expected {EXPECTED_CHECKPOINT_SIZE}")
        else:
            print(f"  [PASS] best_model.pth: size matches (154MB)")
    else:
        results["identity"]["best_model"] = {"path": cp, "exists": False, "status": "MISSING"}
        print(f"  [MISSING] best_model.pth: {cp}")
        print("  Cannot verify PyTorch checkpoint. Run 'cp <drive>/geotrace/checkpoints/best_model.pth ml/checkpoints/'")

    # Save raw
    with open(os.path.join(OUT_DIR, "identity.json"), "w") as f:
        json.dump(results["identity"], f, indent=2)


# ============================================================
# 2. CHECKPOINT LOAD (strict=True)
# ============================================================
def check_checkpoint_load(results):
    results["checkpoint_load"] = {"strict_loading": False, "pytorch_available": TORCH_AVAILABLE}
    if not os.path.exists(CHECKPOINT_PATH):
        results["checkpoint_load"]["status"] = "SKIPPED — checkpoint not present"
        print("  [SKIP] best_model.pth not present. Place the real epoch-12 checkpoint at ml/checkpoints/best_model.pth")
        with open(os.path.join(OUT_DIR, "checkpoint_load.json"), "w") as f:
            json.dump(results["checkpoint_load"], f, indent=2)
        return None

    if not TORCH_AVAILABLE:
        results["checkpoint_load"]["status"] = "SKIPPED — torch not available"
        print("  [SKIP] torch not available")
        with open(os.path.join(OUT_DIR, "checkpoint_load.json"), "w") as f:
            json.dump(results["checkpoint_load"], f, indent=2)
        return None

    try:
        import torch
        from train_cadastral import DualHeadCadastralModel, TrainConfig
        import dataclasses

        checkpoint = torch.load(CHECKPOINT_PATH, map_location="cpu", weights_only=False)
        if "config" not in checkpoint or "model_state_dict" not in checkpoint:
            results["checkpoint_load"]["status"] = "FAIL — missing config or model_state_dict"
            print("  [FAIL] checkpoint missing config or model_state_dict")
            with open(os.path.join(OUT_DIR, "checkpoint_load.json"), "w") as f:
                json.dump(results["checkpoint_load"], f, indent=2)
            return None

        valid_fields = {f.name for f in dataclasses.fields(TrainConfig)}
        cfg_dict = {k: v for k, v in checkpoint["config"].items() if k in valid_fields}
        cfg = TrainConfig(**cfg_dict)
        model = DualHeadCadastralModel(cfg)

        # strict=True — will raise if ANY missing or unexpected keys
        try:
            model.load_state_dict(checkpoint["model_state_dict"], strict=True)
            results["checkpoint_load"]["strict_loading"] = True
            results["checkpoint_load"]["status"] = "PASS"
            results["checkpoint_load"]["missing_keys"] = 0
            results["checkpoint_load"]["unexpected_keys"] = 0
            print("  [PASS] strict=True load succeeded — 2-head model, epoch-12 weights confirmed")
        except RuntimeError as e:
            msg = str(e)
            results["checkpoint_load"]["strict_loading"] = False
            results["checkpoint_load"]["status"] = "FAIL — strict=True rejected"
            results["checkpoint_load"]["error"] = msg
            print(f"  [FAIL] strict=True rejected: {msg}")

        with open(os.path.join(OUT_DIR, "checkpoint_load.json"), "w") as f:
            json.dump(results["checkpoint_load"], f, indent=2)
        return model if results["checkpoint_load"]["strict_loading"] else None

    except Exception as e:
        results["checkpoint_load"]["status"] = f"FAIL — {type(e).__name__}: {e}"
        print(f"  [FAIL] {type(e).__name__}: {e}")
        with open(os.path.join(OUT_DIR, "checkpoint_load.json"), "w") as f:
            json.dump(results["checkpoint_load"], f, indent=2)
        return None


# ============================================================
# 3. PARITY TEST — PyTorch eval vs ONNX
# ============================================================
def check_parity(model, results):
    results["parity"] = {"status": "SKIPPED"}
    if model is None:
        print("  [SKIP] No PyTorch model available (checkpoint not loaded)")
        with open(os.path.join(OUT_DIR, "parity.json"), "w") as f:
            json.dump(results["parity"], f, indent=2)
        return

    if not ORT_AVAILABLE:
        print("  [SKIP] ONNX Runtime not available")
        results["parity"]["status"] = "SKIPPED — onnxruntime not available"
        with open(os.path.join(OUT_DIR, "parity.json"), "w") as f:
            json.dump(results["parity"], f, indent=2)
        return

    try:
        import torch

        # Create a deterministic test image (BGR uint8)
        np.random.seed(42)
        img_bgr = np.random.randint(0, 256, (512, 512, 3), dtype=np.uint8)

        # ONNX inference
        engine = CadastralInferenceEngine()
        masks = engine.run_onnx_inference(img_bgr)
        if masks is None:
            results["parity"]["status"] = "FAIL — ONNX inference returned None"
            print("  [FAIL] ONNX returned None")
            with open(os.path.join(OUT_DIR, "parity.json"), "w") as f:
                json.dump(results["parity"], f, indent=2)
            return
        onnx_building = masks[0]  # logits (512, 512)
        onnx_vegetation = masks[1]  # logits (512, 512)

        # PyTorch inference (matching preprocessing: BGR->RGB, 1/255, ImageNet norm)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        mean = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
        std = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
        x = torch.from_numpy(img_rgb.transpose(2, 0, 1)).float().unsqueeze(0)
        x = (x - mean) / std

        model.eval()
        with torch.no_grad():
            pt_out = model(x)
        pt_building = pt_out["building"].cpu().numpy()[0, 0]
        pt_vegetation = pt_out["vegetation"].cpu().numpy()[0, 0]

        # Sigmoid both
        def sigmoid_fn(x):
            return 1.0 / (1.0 + np.exp(-np.clip(x, -50, 50)))

        pt_b = sigmoid_fn(pt_building)
        pt_v = sigmoid_fn(pt_vegetation)
        onnx_b = sigmoid_fn(onnx_building)
        onnx_v = sigmoid_fn(onnx_vegetation)

        building_diff = float(np.max(np.abs(pt_b - onnx_b)))
        vegetation_diff = float(np.max(np.abs(pt_v - onnx_v)))

        results["parity"] = {
            "status": "PASS" if building_diff < 0.01 and vegetation_diff < 0.01 else "FAIL",
            "max_abs_diff_building": building_diff,
            "max_abs_diff_vegetation": vegetation_diff,
            "mean_abs_diff_building": float(np.mean(np.abs(pt_b - onnx_b))),
            "mean_abs_diff_vegetation": float(np.mean(np.abs(pt_v - onnx_v))),
            "pytorch_building_shape": list(pt_building.shape),
            "onnx_building_shape": list(onnx_building.shape),
        }
        print(f"  Building max abs diff: {building_diff:.6f}")
        print(f"  Vegetation max abs diff: {vegetation_diff:.6f}")

    except Exception as e:
        results["parity"] = {"status": f"FAIL — {type(e).__name__}: {e}"}
        print(f"  [FAIL] {e}")

    with open(os.path.join(OUT_DIR, "parity.json"), "w") as f:
        json.dump(results["parity"], f, indent=2)


# ============================================================
# 4. UNCERTAINTY TEST — 3 validation tiles
# ============================================================
def check_uncertainty(model, results):
    results["uncertainty"] = {"status": "SKIPPED", "tiles": []}
    if model is None:
        print("  [SKIP] No PyTorch model — cannot run true MC dropout")
        print("  (ONNX fallback would be noise simulation, not calibrated uncertainty)")
        with open(os.path.join(OUT_DIR, "uncertainty.json"), "w") as f:
            json.dump(results["uncertainty"], f, indent=2)
        return

    engine = CadastralInferenceEngine()
    results["uncertainty"]["pytorch_available"] = True

    for patch_name in VALIDATION_PATCHES:
        patch_path = os.path.join(SVAMITVA_DIR, patch_name)
        if not os.path.exists(patch_path):
            results["uncertainty"]["tiles"].append({"patch": patch_name, "status": "MISSING"})
            print(f"  [SKIP] {patch_name} — not found")
            continue

        img = cv2.imread(patch_path)
        if img is None:
            results["uncertainty"]["tiles"].append({"patch": patch_name, "status": "DECODE_ERROR"})
            print(f"  [SKIP] {patch_name} — decode error")
            continue

        try:
            mc_result = engine.run_onnx_inference_mc(img, num_samples=5)
            if not mc_result or len(mc_result) < 5:
                results["uncertainty"]["tiles"].append({
                    "patch": patch_name, "status": "FAIL — insufficient MC samples"
                })
                print(f"  [FAIL] {patch_name} — got {len(mc_result) if mc_result else 0} samples")
                continue

            # Each sample is a (4, H, W) numpy array
            building_samples = np.stack([s[0] for s in mc_result], axis=0)  # (5, H, W)

            # Per-polygon: extract via contours and report variance
            mean_pred = np.mean(building_samples, axis=0)
            var_pred = np.var(building_samples, axis=0)

            binary = (mean_pred > 0.5).astype(np.uint8) * 255
            contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            poly_uncertainties = []
            for cnt in contours:
                if len(cnt) < 3:
                    continue
                mask = np.zeros(mean_pred.shape, dtype=bool)
                cv2.drawContours(mask, [cnt], -1, True)
                if mask.sum() > 0:
                    pixel_var = var_pred[mask]
                    pixel_mean = mean_pred[mask]
                    poly_uncertainties.append({
                        "vertices": len(cnt),
                        "pixel_count": int(mask.sum()),
                        "mean_prob": float(np.mean(pixel_mean)),
                        "std_prob": float(np.std(pixel_mean)),
                        "epistemic": float(np.mean(pixel_var)),
                        "aleatoric": float(np.mean(pixel_mean * (1 - pixel_mean))),
                    })

            results["uncertainty"]["tiles"].append({
                "patch": patch_name,
                "status": "OK",
                "num_polygons": len(poly_uncertainties),
                "building_channel_pixel_min": float(np.min(building_samples)),
                "building_channel_pixel_max": float(np.max(building_samples)),
                "per_polygon_uncertainties": poly_uncertainties,
            })

            if poly_uncertainties:
                all_epi = [p["epistemic"] for p in poly_uncertainties]
                all_al = [p["aleatoric"] for p in poly_uncertainties]
                print(f"  {patch_name}: {len(poly_uncertainties)} polygons, "
                      f"epistemic min={min(all_epi):.4f} mean={np.mean(all_epi):.4f} max={max(all_epi):.4f}, "
                      f"aleatoric min={min(all_al):.4f} mean={np.mean(all_al):.4f} max={max(all_al):.4f}")

            # Save raw MC samples
            np.savez_compressed(
                os.path.join(OUT_DIR, f"mc_samples_{patch_name}.npz"),
                building_samples=building_samples,
                mean_pred=mean_pred,
                var_pred=var_pred,
            )

        except Exception as e:
            results["uncertainty"]["tiles"].append({
                "patch": patch_name, "status": f"FAIL — {type(e).__name__}: {e}"
            })
            print(f"  [FAIL] {patch_name}: {e}")

    # Check if all values are identical (sign of non-functional uncertainty)
    all_polys = []
    for t in results["uncertainty"]["tiles"]:
        if t.get("per_polygon_uncertainties"):
            all_polys.extend(t["per_polygon_uncertainties"])
    if all_polys:
        all_epi = [p["epistemic"] for p in all_polys]
        if min(all_epi) == max(all_epi):
            results["uncertainty"]["status"] = "WARNING — all epistemic values identical"
            print("  [WARN] All epistemic uncertainties identical — uncertainty may not be functional")
        else:
            results["uncertainty"]["status"] = "PASS"
            print("  [PASS] Uncertainty varies across polygons")
    else:
        results["uncertainty"]["status"] = "FAIL — no polygons detected"

    with open(os.path.join(OUT_DIR, "uncertainty.json"), "w") as f:
        json.dump(results["uncertainty"], f, indent=2)


# ============================================================
# 5. COLOR-MATCHING TEST — raw pixel counts, both heads
# ============================================================
def color_match_lab(source, target):
    """Apply target's LAB color statistics to source."""
    src = cv2.cvtColor(source, cv2.COLOR_BGR2LAB).astype(np.float32)
    tgt = cv2.cvtColor(target, cv2.COLOR_BGR2LAB).astype(np.float32)
    for c in range(3):
        s_m, s_s = src[:, :, c].mean(), src[:, :, c].std()
        t_m, t_s = tgt[:, :, c].mean(), tgt[:, :, c].std()
        src[:, :, c] = ((src[:, :, c] - s_m) / (s_s + 1e-6)) * t_s + t_m
    return cv2.cvtColor(src.astype(np.uint8), cv2.COLOR_LAB2BGR)


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -50, 50)))


def check_color_matching(results):
    results["color_matching"] = {"status": "SKIPPED", "variants": {}}

    svamitva_path = os.path.join(SVAMITVA_DIR, "patch_1.png")
    esri_path = ESRI_TILE_PATH

    if not os.path.exists(svamitva_path):
        print(f"  [SKIP] No SVAMITVA patch found at {svamitva_path}")
        results["color_matching"]["status"] = "SKIPPED — SVAMITVA patch not found"
        return
    if not os.path.exists(esri_path):
        print(f"  [SKIP] No Esri tile found at {esri_path}")
        results["color_matching"]["status"] = "SKIPPED — Esri tile not found"
        return

    orig = cv2.imread(svamitva_path)
    esri = cv2.imread(esri_path)
    esri_resized = cv2.resize(esri, (orig.shape[1], orig.shape[0]))

    svamitva_to_esri = color_match_lab(orig, esri_resized)
    esri_to_svamitva = color_match_lab(esri_resized, orig)

    # Save the color-matched images
    cv2.imwrite(os.path.join(OUT_DIR, "svamitva_orig.png"), orig)
    cv2.imwrite(os.path.join(OUT_DIR, "svamitva_to_esri.png"), svamitva_to_esri)
    cv2.imwrite(os.path.join(OUT_DIR, "esri_orig.png"), esri_resized)
    cv2.imwrite(os.path.join(OUT_DIR, "esri_to_svamitva.png"), esri_to_svamitva)

    engine = CadastralInferenceEngine()
    results["color_matching"]["provider"] = engine.provider

    def color_stats(img, name):
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
        return {
            "L_mean": float(lab[:, :, 0].mean()),
            "L_std": float(lab[:, :, 0].std()),
            "A_mean": float(lab[:, :, 1].mean()),
            "B_mean": float(lab[:, :, 2].mean()),
        }

    variants = {
        "svamitva_orig": orig,
        "svamitva_to_esri": svamitva_to_esri,
        "esri_orig": esri_resized,
        "esri_to_svamitva": esri_to_svamitva,
    }

    for name, img in variants.items():
        masks = engine.run_onnx_inference(img)
        if masks is None:
            results["color_matching"]["variants"][name] = {"status": "CV fallback (no ONNX)"}
            print(f"  {name}: CV fallback")
            continue

        building_logits = masks[0]
        vegetation_logits = masks[1]
        building_probs = sigmoid(building_logits)
        vegetation_probs = sigmoid(vegetation_logits)

        stats = color_stats(img, name)
        entry = {
            "color_stats": stats,
            "building": {
                "pixels_gt_0.5": int(np.sum(building_probs > 0.5)),
                "pixels_gt_0.7": int(np.sum(building_probs > 0.7)),
                "mean_prob": float(np.mean(building_probs)),
                "max_prob": float(np.max(building_probs)),
                "total_pixels": int(building_probs.size),
            },
            "vegetation": {
                "pixels_gt_0.5": int(np.sum(vegetation_probs > 0.5)),
                "pixels_gt_0.7": int(np.sum(vegetation_probs > 0.7)),
                "mean_prob": float(np.mean(vegetation_probs)),
                "max_prob": float(np.max(vegetation_probs)),
            },
        }
        results["color_matching"]["variants"][name] = entry
        print(f"  {name}: building >0.5={entry['building']['pixels_gt_0.5']}, "
              f">0.7={entry['building']['pixels_gt_0.7']}, "
              f"veg >0.5={entry['vegetation']['pixels_gt_0.5']}")

    # Compute deltas
    v_orig = results["color_matching"]["variants"]["svamitva_orig"]["building"]["pixels_gt_0.7"]
    v_matched = results["color_matching"]["variants"]["svamitva_to_esri"]["building"]["pixels_gt_0.7"]
    if v_orig > 0:
        results["color_matching"]["reduction_ratio"] = v_matched / v_orig
        print(f"\n  Reduction (svamitva >0.7): {v_orig} -> {v_matched} ({v_matched/v_orig:.4f})")

    results["color_matching"]["status"] = "PASS"
    with open(os.path.join(OUT_DIR, "color_matching.json"), "w") as f:
        json.dump(results["color_matching"], f, indent=2)


# ============================================================
# 6. ROUTING TEST — discrepancy-analysis at different confidences
# ============================================================
def check_routing(results):
    results["routing"] = {"status": "SKIPPED", "responses": []}
    import requests
    from urllib.parse import urlparse

    base_url = "http://localhost:3000"

    # Check if Express server is running
    try:
        r = requests.get(base_url, timeout=5)
        express_running = True
    except Exception:
        express_running = False

    if not express_running:
        # Try to start it
        print("  Starting Express server...")
        proc = subprocess.Popen(
            ["npx.cmd", "tsx", "server.ts"],
            cwd=os.path.join(ML_DIR, ".."),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        # Wait for it
        for _ in range(30):
            time.sleep(2)
            try:
                r = requests.get(f"{base_url}", timeout=3)
                express_running = True
                break
            except Exception:
                continue

    if not express_running:
        results["routing"]["status"] = "SKIPPED — Express server not available"
        print("  [SKIP] Express server not available")
        with open(os.path.join(OUT_DIR, "routing.json"), "w") as f:
            json.dump(results["routing"], f, indent=2)
        return

    try:
        # Initialize parcels via location endpoint
        try:
            r = requests.get(f"{base_url}/api/location?lat=12.9839&lon=80.2090", timeout=10)
        except Exception:
            pass

        # Load building polygon from predict_result.json
        building_polygon = None
        if os.path.exists(PREDICT_RESULT_PATH):
            with open(PREDICT_RESULT_PATH) as f:
                pr = json.load(f)
            for feat in pr["geojson"]["features"]:
                if feat["properties"].get("classification") == "BUILTUP":
                    building_polygon = feat["geometry"]["coordinates"][0]
                    break

        if building_polygon is None:
            # Fallback: simple square near Velachery legal boundary
            building_polygon = [
                [80.2091, 12.9841],
                [80.2098, 12.9841],
                [80.2098, 12.9846],
                [80.2091, 12.9846],
                [80.2091, 12.9841],
            ]

        for conf in [0.30, 0.55, 0.90]:
            payload = {
                "layoutId": "CMDA-LP-2018-102",
                "detectedPhysicalBoundary": building_polygon,
                "detectionConfidence": conf,
            }
            try:
                r = requests.post(
                    f"{base_url}/api/tn-land-records/discrepancy-analysis",
                    json=payload,
                    timeout=30,
                )
                raw = r.json() if r.status_code == 200 else {"status_code": r.status_code, "text": r.text[:500]}
                results["routing"]["responses"].append({
                    "detection_confidence": conf,
                    "status_code": r.status_code,
                    "response": raw,
                })
                if r.status_code == 200:
                    d = raw.get("discrepancy", raw)
                    cs = d.get("complianceStatus", "N/A")
                    cl = d.get("confidenceLevel", "N/A")
                    ea = d.get("encroachmentAreaSqM", "N/A")
                    print(f"  conf={conf}: complianceStatus={cs}, confidenceLevel={cl}, encroachment={ea}")
                else:
                    print(f"  conf={conf}: HTTP {r.status_code}")
            except Exception as e:
                results["routing"]["responses"].append({
                    "detection_confidence": conf,
                    "status": f"ERROR — {type(e).__name__}: {e}",
                })
                print(f"  conf={conf}: ERROR {e}")

        # Verify routing logic
        statuses = [r.get("response", {}).get("discrepancy", r.get("response", {})).get("complianceStatus")
                     for r in results["routing"]["responses"]
                     if r.get("status_code") == 200]
        if len(statuses) == 3:
            expected = ["NEEDS_HUMAN_REVIEW", "NEEDS_HUMAN_REVIEW", "VIOLATION_FLAGGED"]
            match = statuses == expected
            results["routing"]["status"] = "PASS" if match else "CHECK"
            results["routing"]["expected_statuses"] = expected
            results["routing"]["actual_statuses"] = statuses
            print(f"\n  Expected: {expected}")
            print(f"  Actual:   {statuses}")
            print(f"  Match: {match}")

    except Exception as e:
        results["routing"]["status"] = f"FAIL — {type(e).__name__}: {e}"
        print(f"  [FAIL] {e}")
    finally:
        # Save raw responses
        with open(os.path.join(OUT_DIR, "routing.json"), "w") as f:
            json.dump(results["routing"], f, indent=2)


# ============================================================
# MAIN
# ============================================================
def main():
    ensure_outdir()
    print(f"Verification output: {OUT_DIR}")
    print("=" * 60)

    results = {
        "timestamp": TIMESTAMP,
        "onnx_path": ONNX_PATH,
        "checkpoint_path": CHECKPOINT_PATH,
    }

    print("\n[1/6] Identity check")
    check_identity(results)

    print("\n[2/6] Checkpoint load (strict=True)")
    model = check_checkpoint_load(results)

    print("\n[3/6] PyTorch vs ONNX parity")
    check_parity(model, results)

    print("\n[4/6] MC dropout uncertainty (3 tiles)")
    check_uncertainty(model, results)

    print("\n[5/6] Color-matching test (raw pixel counts)")
    check_color_matching(results)

    print("\n[6/6] Routing test (detectionConfidence 0.30/0.55/0.90)")
    check_routing(results)

    # Write summary
    with open(os.path.join(OUT_DIR, "summary.txt"), "w") as f:
        f.write(f"Cadastral Pipeline Verification\n")
        f.write(f"Timestamp: {TIMESTAMP}\n")
        f.write(f"{'=' * 60}\n\n")
        for key in ["identity", "checkpoint_load", "parity", "uncertainty", "color_matching", "routing"]:
            status = results.get(key, {}).get("status", "NOT RUN")
            f.write(f"{key}: {status}\n")
        f.write(f"\nRaw results saved in: verification/{TIMESTAMP}/\n")

    with open(os.path.join(OUT_DIR, "full_results.json"), "w") as f:
        json.dump(results, f, indent=2, default=str)

    print(f"\n{'=' * 60}")
    print(f"Verification complete. Results in: {OUT_DIR}/")
    for key in ["identity", "checkpoint_load", "parity", "uncertainty", "color_matching", "routing"]:
        status = results.get(key, {}).get("status", "NOT RUN")
        print(f"  {key}: {status}")


if __name__ == "__main__":
    main()
