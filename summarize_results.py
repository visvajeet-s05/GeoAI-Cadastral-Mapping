import json, glob

files = sorted(glob.glob('ml/degraded_patch_*_result.json')) + ['ml/predict_result.json']
for f in files:
    with open(f) as fh:
        d = json.load(fh)
    feats = d.get('geojson', {}).get('features', [])
    bld = [x for x in feats if x['properties'].get('classification') == 'BUILTUP']
    veg = [x for x in feats if x['properties'].get('classification') == 'VEGETATION']
    confs = [x['properties'].get('confidence', 0) for x in bld]
    areas = [x['properties'].get('area_sqm', 0) for x in bld]
    ale = [x['properties'].get('uncertainty', {}).get('aleatoric', 0) for x in bld]
    epis = [x['properties'].get('uncertainty', {}).get('epistemic', 0) for x in bld]
    avg_conf = sum(confs) / max(1, len(confs))
    avg_area = sum(areas) / max(1, len(areas))
    avg_ale = sum(ale) / max(1, len(ale))
    avg_epi = sum(epis) / max(1, len(epis))
    execp = d.get('execution_provider', 'N/A')
    print(f'{f}: parcels={len(feats)} builtup={len(bld)} veg={len(veg)} avg_conf={avg_conf:.3f} avg_area={avg_area:.1f} avg_aleatoric={avg_ale:.3f} avg_epistemic={avg_epi:.3f} exec={execp}')
