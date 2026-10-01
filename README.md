<div align="center">

# GeoAI-Cadastral-Mapping

**AI-Powered Cadastral Boundary Extraction & Land Management System**

A cutting-edge geospatial AI platform that bridges historical cadastral records (FMB/TSLR) with modern UAV imagery using deep learning for automated boundary detection, encroachment monitoring, and land compliance verification.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 18+](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/react-19-61DAFB.svg)](https://reactjs.org/)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Running the Application](#-running-the-application)
- [ML Pipeline](#-ml-pipeline)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Verification & Testing](#-verification--testing)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

GeoAI-Cadastral-Mapping is an advanced cadastral management system that leverages:
- **Deep Learning**: Dual-head neural networks for building and vegetation segmentation
- **Computer Vision**: Multi-task learning with boundary detection and uncertainty quantification
- **Geospatial Processing**: UAV orthophoto analysis with metric coordinate systems
- **Real-time Inference**: ONNX-optimized models for production deployment
- **Interactive GIS**: Web-based parcel inspection and boundary editing

The system automatically extracts cadastral boundaries from high-resolution drone imagery, detects encroachments, and provides compliance routing based on detection confidence levels.

---

## ✨ Key Features

### AI-Powered Detection
- **Dual-Head Segmentation**: Simultaneous building and vegetation boundary extraction
- **Uncertainty Quantification**: Epistemic and aleatoric uncertainty estimation via perturbation-based confidence
- **Multi-Modal Inference**: PyTorch and ONNX models for flexible deployment
- **Color-Matching Resilience**: Robust to satellite imagery color profiles (Svamitva vs ESRI)

### Geospatial Capabilities
- **Metric Coordinate Systems**: UTM projection (EPSG:32644) for accurate measurements
- **Multi-Source Data**: FMB vectors, TSLR registers, and UAV orthophotos
- **Topological Validation**: Planar partition constraints and boundary verification
- **Interactive Mapping**: Leaflet-based GIS with dual-stream visualization

### Compliance & Routing
- **Confidence-Based Routing**: Automatic classification based on detection confidence
  - `confidence >= 0.90`: VIOLATION_FLAGGED (HIGH confidence)
  - `confidence < 0.90`: NEEDS_HUMAN_REVIEW (LOW confidence)
- **Encroachment Calculation**: Automated percentage computation
- **Real-time Validation**: Topological constraint checking

### Web Application
- **Drone Ingestion**: Upload and process UAV imagery
- **Parcel Inspection**: Interactive boundary visualization and editing
- **Title Certificate Generation**: Automated document creation
- **Cockpit View**: Dual-stream cadastral monitoring interface

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Web Application Layer                     │
│  (React 19 + TypeScript + Tailwind CSS + Leaflet)           │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/WebSocket
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express Server (Node.js)                  │
│  - API Routes (parcels, districts, compliance)              │
│  - WebSocket (real-time updates)                             │
│  - Static Asset Serving                                      │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              ML Inference Service (FastAPI)                  │
│  - ONNX Runtime (CPU/GPU)                                    │
│  - PyTorch Model (training & verification)                   │
│  - Perturbation-based Confidence                            │
│  - Uncertainty Quantification                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Deep Learning Models                       │
│  - Dual-Head Cadastral Model (best_model.pth)               │
│  - ONNX Export (cadastral_dualhead_best.onnx)                │
│  - Building Head + Vegetation Head                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
- **React 19**: UI framework
- **TypeScript**: Type-safe development
- **Tailwind CSS v4**: Styling
- **Leaflet**: Interactive maps
- **D3.js**: Data visualization
- **Motion**: Animations
- **Lucide React**: Icons

### Backend
- **Node.js 18+**: Runtime
- **Express**: Web server
- **FastAPI**: ML inference API
- **WebSocket**: Real-time communication
- **Multer**: File uploads

### ML/AI
- **PyTorch 2.0+**: Deep learning framework
- **ONNX Runtime**: Model deployment
- **Segmentation Models PyTorch**: Model architectures
- **OpenCV**: Image processing
- **Shapely**: Geometric operations
- **Rasterio**: GeoTIFF handling
- **WandB**: Experiment tracking

### Geospatial
- **GeoTIFF**: Satellite imagery format
- **GeoJSON**: Vector data format
- **Proj4**: Coordinate transformations
- **Turf.js**: Geospatial analysis

---

## 📦 Prerequisites

- **Node.js**: 18.0 or higher
- **Python**: 3.8 or higher
- **Git**: For version control
- **CUDA** (optional): For GPU-accelerated inference

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/visvajeet-s05/GeoAI-Cadastral-Mapping.git
cd GeoAI-Cadastral-Mapping
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Set Up Python Virtual Environment

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On Linux/Mac:
source .venv/bin/activate
```

### 4. Install ML Dependencies

```bash
cd ml
pip install -r requirements.txt
cd ..
```

### 5. Configure Environment Variables

Copy the example environment file and add your API keys:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add:
```env
GEMINI_API_KEY=your_gemini_api_key_here
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
VITE_GOOGLE_MAPS_MAP_ID=your_google_maps_map_id_here
```

### 6. Download Model Checkpoints

The ML models should be placed in `ml/checkpoints/`:
- `best_model.pth`: PyTorch model (154MB)
- `cadastral_dualhead_best.onnx`: ONNX model for inference
- `model_card.json`: Model metadata

**Note**: Due to file size, these are not included in the repository. Contact the maintainers or train your own model using the training pipeline.

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key for AI features | Yes |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps JavaScript API key | Yes |
| `VITE_GOOGLE_MAPS_MAP_ID` | Google Maps Map ID for custom styling | Yes |

### ML Model Configuration

Model configuration is stored in the checkpoint files:
- Input channels: 3 (RGB)
- Output heads: 2 (building, vegetation)
- Architecture: Dual-head segmentation model
- Training epoch: 12 (best model)

---

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

This starts:
- **Express server** on `http://0.0.0.0:3000`
- **ML Inference Service** on `http://127.0.0.1:8001`
- **Frontend** with hot-reload

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

### ML Inference Service (Standalone)

```bash
cd ml
python inference_server.py
```

The inference service will start on `http://127.0.0.1:8001`

---

## 🧠 ML Pipeline

### Model Architecture

The system uses a dual-head segmentation model:

```
Input (3xHxW RGB)
    │
    ▼
Shared Encoder (ConvNeXt/ResNet)
    │
    ├─────────────────┬─────────────────┐
    ▼                 ▼                 ▼
Building Head    Vegetation Head  Confidence Head
    │                 │                 │
    ▼                 ▼                 ▼
Building Mask   Vegetation Mask   Uncertainty Map
```

### Training

Train the model using:

```bash
cd ml
python train_cadastral.py --config config.yaml
```

### ONNX Export

Export the model to ONNX for production deployment:

```bash
cd ml
python export_onnx.py --checkpoint ml/checkpoints/best_model.pth
```

### Verification

Run the verification pipeline to ensure model integrity:

```bash
cd ml
python verify_pipeline.py
```

This checks:
1. Checkpoint identity and size
2. Model loading (strict mode)
3. PyTorch vs ONNX parity
4. Perturbation-based confidence
5. Color-matching robustness
6. Compliance routing logic

---

## 📁 Project Structure

```
GeoAI-Cadastral-Mapping/
├── ml/                          # Machine Learning Pipeline
│   ├── checkpoints/            # Model weights and ONNX exports
│   ├── verification/          # Verification outputs
│   ├── train_cadastral.py      # Training script
│   ├── export_onnx.py          # ONNX export
│   ├── inference_server.py     # FastAPI inference service
│   ├── verify_pipeline.py      # Verification pipeline
│   └── requirements.txt        # Python dependencies
├── src/                         # React Frontend
│   ├── components/            # React components
│   │   ├── DualStreamCadastralCockpit.tsx
│   │   ├── FloatingParcelInspector.tsx
│   │   ├── PropertyInspectionModal.tsx
│   │   └── ...
│   ├── lib/                   # Utilities
│   │   └── api/
│   │       └── mlClient.ts    # ML API client
│   └── data/                  # Data management
│       └── cadastralDataset.ts
├── server/                     # Express Backend Routes
├── data/                       # Static Data
│   └── districts.json         # District boundaries
├── docs/                       # Documentation
│   └── CADASTRAL_ML_PIPELINE.md
├── public/                     # Static Assets
├── server.ts                   # Express Server Entry
├── index.html                  # HTML Entry
├── package.json                # Node.js dependencies
├── tsconfig.json              # TypeScript config
├── vite.config.ts             # Vite build config
├── Dockerfile                 # Docker configuration
├── .env.example               # Environment template
├── .gitignore                # Git ignore rules
└── README.md                 # This file
```

---

## 🔧 Development

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for React and TypeScript
- **Prettier**: Code formatting (if configured)

### Git Workflow

1. Create a feature branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes and commit:
```bash
git add .
git commit -m "feat: add your feature description"
```

3. Push and create a pull request:
```bash
git push origin feature/your-feature-name
```

### Commit Message Convention

Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Maintenance tasks

---

## ✅ Verification & Testing

### ML Pipeline Verification

The verification script (`ml/verify_pipeline.py`) performs comprehensive checks:

```bash
python ml/verify_pipeline.py
```

Expected output:
```
[1/6] Identity check
  [PASS] best_model.pth: size matches (154MB)

[2/6] Checkpoint load (strict=True)
  [PASS] strict=True load succeeded — 2-head model, epoch-12 weights confirmed

[3/6] PyTorch vs ONNX parity
  Building max abs diff: 0.000004
  Vegetation max abs diff: 0.000004

[4/6] Perturbation-based confidence (3 tiles)
  [PASS] Uncertainty varies across polygons

[5/6] Color-matching test (raw pixel counts)
  [PASS] Reduction (svamitva ›0.7): 191359 -› 154 (0.0008)

[6/6] Routing test (detectionConfidence 0.30/0.55/0.90)
  [PASS] Match: True
```

### Frontend Testing

```bash
# Type checking
npm run lint

# Build verification
npm run build
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and verification
5. Submit a pull request

### Guidelines

- Write clear, descriptive commit messages
- Add tests for new features
- Update documentation as needed
- Follow the existing code style
- Ensure all verification checks pass

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 📞 Support

For questions, issues, or contributions:
- Open an issue on GitHub
- Contact: visvajeet-s05
- Documentation: See `docs/CADASTRAL_ML_PIPELINE.md` for detailed ML pipeline documentation

---

## 🙏 Acknowledgments

- **Segmentation Models PyTorch**: For the model architectures
- **OpenCV**: For image processing utilities
- **Leaflet**: For the interactive mapping library
- **Google Maps**: For base map tiles
- **WandB**: For experiment tracking

---

<div align="center">

**Built with ❤️ for cadastral mapping innovation**

</div>
