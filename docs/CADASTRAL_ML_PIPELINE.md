# Cadastral Deep Learning Pipeline: FMB/TSLR Vector & UAV Imagery Processing

**Status:** Technical Specification & Research Architecture  
**Domain:** Automated Cadastral Boundary Extraction, Multi-Temporal Co-Registration, and Topological Parcel Refinement  
**Target Architectures:** High-Resolution Convolutional Neural Networks (HRNet/ConvNeXt) & Vision Transformers (SegFormer, Mask2Former, SAM 2)

---

## 1. Executive Summary & Objective

Automated cadastral mapping requires bridging the semantic and geometric gap between historical, paper-derived revenue maps (Field Measurement Books - FMB, Town Survey Land Records - TSLR) and ultra-high-resolution modern Unmanned Aerial Vehicle (UAV) orthophotomosaics ($\le 2\,\text{cm/px}$ Ground Sample Distance).

Standard semantic segmentation models (e.g., vanilla U-Net, DeepLabv3+) yield rounded mask boundaries, fuzzy corners, and topological illegalities (self-intersections, overlapping slivers, non-closed contours). In cadastre, legal plot boundaries are strictly **planar, planar-partitioned, piecewise-linear polygons** obeying statutory boundary geometry.

This pipeline defines:
1. **Data Ingestion & Multi-Modal Harmonization**: Transforming raw GeoTIFF UAV flights, historical FMB vector/raster sketches, and TSLR cadastral databases into unified spatial frames.
2. **Annotation Engineering**: Generating multi-task ground truth tensors (Binary Interior Mask, Boundary Distance Transform, and Vertex Keypoint Heatmaps).
3. **Deep Learning Model Formulation**: Comparative blueprints for **High-Resolution CNNs (HRNet + OCR)** and **Vision Transformers (SegFormer / Mask2Former / SAM 2)**.
4. **Topological Regularization**: Objective loss formulations enforcing geometric planarity, zero boundary crossing, and shared-edge constraints.
5. **Continuous Active Learning Flywheel**: Integrating web-based surveyor adjustments directly into model retraining.

---

## 2. Dataset Ingestion & Coordinate Harmonization

### 2.1 Multi-Modal Ingestion Matrix

| Data Modality | Spatial Resolution / Scale | Coordinate System | Representation | Primary Information |
| :--- | :--- | :--- | :--- | :--- |
| **UAV Orthomosaic** | $1.0 - 2.5\,\text{cm/px}$ GSD | EPSG:32644 (UTM 44N) | 3-Band GeoTIFF (RGB) / 4-Band (RGB + NIR) | Physical ground truth: compound walls, rooflines, hedges, field bunds |
| **FMB Vectors** | $1:1000$ to $1:2000$ paper | Local Survey Grid | GeoJSON / DXF Polyline | Legal field boundaries, ladder offsets, sub-division tie lines |
| **TSLR Registers** | Tabular / Text | N/A | PostgreSQL / JSON | Survey numbers, sub-divisions, legal extent ($\text{m}^2$), tenure type |
| **Surveyor Adjustments** | Centimeter precision | EPSG:4326 / EPSG:32644 | GeoJSON MultiPolygon | Ground truth boundary peg and rooftop adjustments |

### 2.2 Projection Standardization & Metric Projection
All geographic coordinates ($\text{WGS84}$ / $\text{EPSG:4326}$) must be projected to a conformal, metric coordinate reference system before tiling to prevent geometric distortion:
$$\text{EPSG:4326} \xrightarrow{\quad\text{Project}\quad} \text{EPSG:32644 (WGS 84 / UTM Zone 44N)}$$
In metric space:
- Euclidean distance directly corresponds to meters ($1.0\,\text{unit} = 1.0\,\text{meter}$).
- Geodesic areas and offsets are calculated without ellipsoidal convergence distortion.

### 2.3 Co-Registration & Thin-Plate Spline (TPS) Alignment
Historical FMB records suffer from non-linear physical shrinkage, tears, and perspective distortion. Rigid affine transformation is insufficient.

1. **Feature Matching & Tie-Point Extraction**:
   - Extract invariant ground control points (GCPs): road intersections, historic stone monuments (survey stones), temple corners.
   - Initial 8-DOF Homography ($H \in \mathbb{R}^{3 \times 3}$) solved via RANSAC:
     $$p_{\text{drone}} \sim H \cdot p_{\text{blueprint}}$$
2. **Non-Rigid Thin-Plate Spline (TPS) Warping**:
   - For residual non-linear paper warp, minimize the bending energy matrix:
     $$E_{\text{tps}}(f) = \sum_{i=1}^{K} \|y_i - f(x_i)\|^2 + \lambda \iint \left( \left(\frac{\partial^2 f}{\partial x_1^2}\right)^2 + 2\left(\frac{\partial^2 f}{\partial x_1 \partial x_2}\right)^2 + \left(\frac{\partial^2 f}{\partial x_2^2}\right)^2 \right) dx_1 dx_2$$

---

## 3. Spatial Tiling & Multi-Task Ground-Truth Generation

### 3.1 Overlapping Sliding Window Tiling
Direct inference over multi-gigabyte orthomosaics ($40,000 \times 40,000\,\text{px}$) is impossible on GPU VRAM. Tiling is configured as follows:
- **Tile Dimension**: $1024 \times 1024\,\text{pixels}$ ($18.4\,\text{m} \times 18.4\,\text{m}$ footprint at $1.8\,\text{cm}$ GSD).
- **Stride / Overlap**: $820\,\text{pixels}$ ($20\%$ boundary overlap: $204\,\text{px}$).
- **Border Handling**: Mirror reflection padding to eliminate edge inference artifacting.

```
       1024 px
  ┌─────────────────┬──────┐
  │                 │204 px│
  │   Core Tile     │Over- │
  │   (Valid Area)  │lap   │
  │                 │Zone  │
  ├─────────────────┼──────┤
  │    Overlap      │Corner│
  └─────────────────┴──────┘
```

### 3.2 4-Channel Multi-Task Ground Truth Tensor
Rather than training on a single binary mask, the target label tensor $Y \in \mathbb{R}^{H \times W \times 4}$ encodes multi-scale topological constraints:

1. **Channel 0: Parcel Interior Mask ($\Omega_{\text{interior}}$)**:
   - Binary mask where pixel $p = 1$ if inside a parcel, $0$ for road/common reserves.
2. **Channel 1: 1-Pixel Planar Edge ($\partial\Omega$)**:
   - Rasterized parcel boundary lines skeletonized using the Zhang-Suen thinning algorithm to guarantee strict 1-pixel thickness. Shared boundaries between adjacent plots are represented as exactly one line.
3. **Channel 2: Vertex Keypoint Heatmap ($V$)**:
   - 2D Gaussian distributions centered at each polygon vertex $(x_v, y_v)$:
     $$G(x, y) = \exp\left( -\frac{(x - x_v)^2 + (y - y_v)^2}{2\sigma^2} \right), \quad \sigma = 3\,\text{px}$$
4. **Channel 3: Signed Distance Function / Truncated Distance Map (TDF)**:
   - Euclidean distance from each pixel to the nearest legal boundary, truncated at $D_{\max} = 15\,\text{pixels}$ ($27\,\text{cm}$):
     $$\phi(p) = \text{clip}\left(\frac{\min_{b \in \partial\Omega} \|p - b\|_2}{D_{\max}}, 0, 1\right)$$

---

## 4. Deep Learning Model Architectures

### Architecture Comparison

```
                 PARADIGM 1: High-Resolution CNN (HRNetV2 + OCR)
 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────────────┐
 │ High-Res C1  │────►│ High-Res C1  │────►│ High-Res C1  │────►│ OCR Boundary   │──► [Masks]
 └──────┬───────┘     └──────┬───────┘     └──────┬───────┘     │ Context Head   │──► [Edges]
        │    ▲               │    ▲               │    ▲        └────────────────┘──► [Vertices]
        ▼    │               ▼    │               ▼    │
 ┌──────────┴───┐     ┌──────────┴───┐     ┌──────────┴───┐
 │ Med-Res C2   │────►│ Med-Res C2   │────►│ Med-Res C2   │
 └──────────────┘     └──────────────┘     └──────────────┘
```

```
                 PARADIGM 2: Hierarchical Vision Transformer (SegFormer / SAM 2)
 ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐
 │ Overlapped   │───►│ Multi-Head   │───►│ Multi-Scale  │───►│ MLP / Mask2Former│──► [Polygons]
 │ Patch Embed  │    │ Self-Attn    │    │ Feature Fused│    │ Polygon Decoder │──► [Discrepancy]
 └──────────────┘    └──────────────┘    └──────────────┘    └─────────────────┘
```

### 4.1 Approach A: High-Resolution Network (HRNet-W48 + OCR)
- **Rationale**: Cadastral boundary detection requires millimeter-level boundary localization that standard encoder-decoder CNNs lose during successive downsampling / pooling.
- **Mechanism**: Maintains high-resolution representations across the entire network in parallel with low-resolution representations, performing multi-scale fusions.
- **OCR (Object-Contextual Representation)**: Explicitly models the relationship between pixels and parcel object regions, enhancing edge sharpness around compound walls.

### 4.2 Approach B: Vision Transformer (SegFormer / Mask2Former / SAM 2)
- **Rationale**: Long-range geometric context is essential to determine whether a wall corresponds to a private boundary, a building partition, or a street alignment.
- **Self-Attention Advantage**: Transformer self-attention fields model global rectilinear property lines across building shadows, tree canopies, and temporary obstructions.
- **SAM 2 Promptable Boundary Refinement**: Cadastral FMB vertices can be fed as point prompts to SAM 2, allowing the model to adaptively snap historical survey pegs to physical features in the UAV imagery.

---

## 5. Topological & Geometric Loss Formulations

Standard Cross-Entropy produces rounded corners and fragmented boundaries. The training objective combines classification, boundary sharpness, and topological correctness:

$$\mathcal{L}_{\text{total}} = \lambda_1 \mathcal{L}_{\text{Focal}} + \lambda_2 \mathcal{L}_{\text{Dice}} + \lambda_3 \mathcal{L}_{\text{BoundaryBCE}} + \lambda_4 \mathcal{L}_{\text{SDF}} + \lambda_5 \mathcal{L}_{\text{Topo}}$$

### 5.1 Multi-Task Loss Components
1. **Focal Loss ($\mathcal{L}_{\text{Focal}}$)**: Compensates for severe class imbalance (boundary edges account for $< 2\%$ of image pixels).
2. **Soft Dice Loss ($\mathcal{L}_{\text{Dice}}$)**: Maximizes mask overlap (IoU) of parcel interiors.
3. **Truncated Signed Distance Loss ($\mathcal{L}_{\text{SDF}}$)**: Smooth $L_1$ loss regressing the distance field for sub-pixel boundary positioning:
   $$\mathcal{L}_{\text{SDF}} = \frac{1}{|\Omega|} \sum_{p \in \Omega} \text{Smooth}_{L_1}\left(\hat{\phi}(p) - \phi(p)\right)$$

### 5.2 Topological Regularization Loss ($\mathcal{L}_{\text{Topo}}$)
Enforces planar partition constraints directly during optimization:
$$\mathcal{L}_{\text{Topo}} = \lambda_{\text{corner}} \mathcal{L}_{\text{Orthogonality}} + \lambda_{\text{euler}} \mathcal{L}_{\text{Euler}} + \lambda_{\text{overlap}} \mathcal{L}_{\text{NonOverlap}}$$
- **Orthogonality Loss**: Penalizes non-orthogonal angles on structural building boundaries:
  $$\mathcal{L}_{\text{Orthogonality}} = \sum_{e_i, e_{i+1}} \sin^2(2\theta_{i, i+1})$$
  *(Minimizes at angles $0^\circ, 90^\circ, 180^\circ, 270^\circ$)*.
- **Non-Overlap / Planarity Penalty**: Penalizes spatial intersections between disjoint parcel predictions:
  $$\mathcal{L}_{\text{NonOverlap}} = \sum_{i \ne j} \text{Area}\left(\hat{P}_i \cap \hat{P}_j\right)$$

---

## 6. Vectorization & Polygon Extraction Pipeline

The raster outputs (interior masks, edge maps, vertex heatmaps) are converted back into clean GIS vector polygons using a deterministic 4-stage pipeline:

```
  [Model Predictions]
   ├── Interior Mask (Prob) ──► Morphological Cleaning (Watershed)
   ├── Edge Map (1-px)      ──► Contour Tracing (Topological Graph)
   └── Vertex Heatmap       ──► Non-Maximum Suppression (Corner Snapping)
                                           │
                                           ▼
                               [Douglas-Peucker Simplification]
                                           │
                                           ▼
                               [Topological QC Verification]
                               (topologyValidation.ts Engine)
                                           │
                                           ▼
                               [Valid Cadastral GeoJSON Polygons]
```

1. **Vertex Extraction**: Non-Maximum Suppression (NMS) on Channel 2 selects salient boundary corners.
2. **Skeleton Contour Tracing**: Contour extraction along Channel 1 edges connects vertices into closed linestrings.
3. **Ramer-Douglas-Peucker (RDP) Simplification**: Simplifies redundant vertices within tolerance $\epsilon = 5\,\text{cm}$ ($2.8\,\text{px}$).
4. **Topological Guard Engine**: Runs the `validateTopologyConstraints` verification suite to guarantee:
   - No self-intersections (`isSimple() == true`).
   - No overlaps with adjacent cadastral parcels.
   - Closed-loop boundary consistency ($p_0 = p_n$).

---

## 7. PyTorch Dataset Implementation Reference

The following pipeline script processes raw GeoTIFF tiles and GeoJSON cadastral boundaries into training tensors:

```python
import os
import json
import torch
import numpy as np
import rasterio
from torch.utils.data import Dataset
from shapely.geometry import shape, Polygon, LineString
import cv2

class CadastralDataset(Dataset):
    """
    Cadastral Multi-Task Dataset loader.
    Transforms paired UAV GeoTIFFs and GeoJSON Cadastral Boundaries
    into a 4-channel multi-task tensor (Mask, Edge, Vertex, SDF).
    """
    def __init__(self, tiles_dir, geojson_path, tile_size=1024, transform=None):
        self.tiles_dir = tiles_dir
        self.tile_size = tile_size
        self.transform = transform
        self.tile_files = [f for f in os.listdir(tiles_dir) if f.endswith(('.tif', '.tiff'))]
        
        with open(geojson_path, 'r') as f:
            self.geojson_data = json.load(f)
            
        self.polygons = [shape(feature['geometry']) for feature in self.geojson_data['features']]

    def __len__(self):
        return len(self.tile_files)

    def __getitem__(self, idx):
        tile_path = os.path.join(self.tiles_dir, self.tile_files[idx])
        
        with rasterio.open(tile_path) as src:
            image = src.read([1, 2, 3]) # [3, H, W] RGB
            bounds = src.bounds
            transform = src.transform

        image = np.transpose(image, (1, 2, 0)).astype(np.float32) / 255.0

        # Target channels
        interior_mask = np.zeros((self.tile_size, self.tile_size), dtype=np.uint8)
        edge_mask = np.zeros((self.tile_size, self.tile_size), dtype=np.uint8)
        vertex_heatmap = np.zeros((self.tile_size, self.tile_size), dtype=np.float32)

        tile_poly = Polygon([
            (bounds.left, bounds.bottom),
            (bounds.right, bounds.bottom),
            (bounds.right, bounds.top),
            (bounds.left, bounds.top)
        ])

        for poly in self.polygons:
            if not poly.intersects(tile_poly):
                continue
            
            inter = poly.intersection(tile_poly)
            if inter.is_empty:
                continue

            # Convert geospatial coordinates to pixel coordinates
            if inter.geom_type == 'Polygon':
                geoms = [inter]
            elif inter.geom_type == 'MultiPolygon':
                geoms = list(inter.geoms)
            else:
                continue

            for g in geoms:
                coords = np.array(g.exterior.coords)
                pix_coords = []
                for x, y in coords:
                    col, row = ~transform * (x, y)
                    pix_coords.append([int(np.clip(col, 0, self.tile_size - 1)),
                                       int(np.clip(row, 0, self.tile_size - 1))])
                
                pix_coords = np.array(pix_coords, dtype=np.int32)
                
                # Channel 0: Fill Interior
                cv2.fillPoly(interior_mask, [pix_coords], 1)
                
                # Channel 1: Draw Boundary Line (1px)
                cv2.polylines(edge_mask, [pix_coords], isClosed=True, color=1, thickness=1)
                
                # Channel 2: Render Vertex Heatmaps
                for vx, vy in pix_coords[:-1]:
                    cv2.circle(vertex_heatmap, (vx, vy), radius=3, color=1.0, thickness=-1)

        # Channel 3: Truncated Signed Distance Transform (SDF)
        dist_transform = cv2.distanceTransform(1 - edge_mask, cv2.DIST_L2, 3)
        sdf_channel = np.clip(dist_transform / 15.0, 0.0, 1.0)

        # Blur vertex points into Gaussian representation
        vertex_heatmap = cv2.GaussianBlur(vertex_heatmap, (7, 7), sigmaX=1.5)

        # Stack into [4, H, W] Ground Truth Tensor
        targets = np.stack([
            interior_mask.astype(np.float32),
            edge_mask.astype(np.float32),
            vertex_heatmap,
            sdf_channel
        ], axis=0)

        image_tensor = torch.from_numpy(np.transpose(image, (2, 0, 1))).float()
        target_tensor = torch.from_numpy(targets).float()

        return image_tensor, target_tensor
```

---

## 8. Evaluation Metrics & Certification Benchmarks

Cadastral AI models cannot be evaluated solely on Intersection-over-Union (IoU). A boundary error of $20\,\text{cm}$ can trigger legal disputes. Validation uses four metrics:

| Metric | Target Standard | Definition & Formula |
| :--- | :--- | :--- |
| **Mask mIoU** | $> 94.5\%$ | Standard region overlap: $\frac{|P \cap G|}{|P \cup G|}$ |
| **Boundary F1 (BF1 @ 5cm)** | $> 91.0\%$ | Harmonic mean of boundary precision and recall within $5\,\text{cm}$ buffer |
| **Vertex Root Mean Square Error (RMSE)** | $< 4.5\,\text{cm}$ | Euclidean spatial offset between predicted corners and verified pegs |
| **Topological Validity Rate** | $100\%$ | Proportion of extracted polygons passing planarity (zero self-intersections, zero slivers) |

---

## 9. Active Learning Flywheel & Web Application Feedback Loop

The web application serves as the production annotation flywheel:

```
  ┌──────────────────────────────────────────────────────────────┐
  │                 PRODUCTION INFERENCE FLYWHEEL                │
  └──────────────────────────────────────────────────────────────┘
                                 │
                     [Raw Drone Orthophoto]
                                 │
                                 ▼
                     [SegFormer / HRNet Model]
                                 │
                                 ├── Confidence >= 0.98 ──► [Auto-Title Issuance]
                                 │
                                 ▼ Confidence < 0.98 OR Topology Flag
                     [Web GIS Cadastral Workspace]
                                 │
                                 ▼
                   [Surveyor Inspects Red Markers]
                                 │
                                 ▼
             [Surveyor Drags Vertices (EDIT_VERTEX mode)]
                                 │
                                 ▼
             [Commit Ground Truth (Zero Topology Errors)]
                                 │
                                 ▼
            [Delta Coordinates Saved to Training Bucket]
                                 │
                                 ▼
            [Weekly Scheduled Model Retraining (DVC / MLflow)]
```

1. **Uncertainty Routing**:
   - The model infers boundary masks along with pixel-level epistemic uncertainty maps.
   - Plots with uncertainty scores $\sigma_{\text{epi}} > 0.15$ or topological violations are tagged `REQUIRES_FIELD_INSPECTION`.
2. **Interactive Vertex Editing**:
   - The government surveyor opens the flagged parcel in `MapView.tsx`, activates `EDIT_VERTEX`, and drags the boundary vertices to match the physical compound wall or survey stones.
   - Live visual feedback (`validateTopologyConstraints`) validates the edits in real time.
3. **Hard-Negative Mining**:
   - Saving the approved adjustment triggers a POST request to `/api/parcels/:id/surveyor-adjust`.
   - The delta between the model's prediction and the surveyor's correction is packaged into the active learning training dataset, continuously refining model accuracy on challenging boundary geometries.
