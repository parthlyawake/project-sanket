# 🏛️ Project SANKET

> **Multimodal AI Assistant for Investigative Interview Analysis**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python Version](https://img.shields.io/badge/python-3.9%20%7C%203.10%20%7C%203.13-blue.svg)](https://www.python.org/)
[![React Version](https://img.shields.io/badge/react-18.x-cyan.svg)](https://react.dev/)
[![Docker Compose](https://img.shields.io/badge/docker--compose-active-green.svg)](https://www.docker.com/)

**SANKET** (संकेत - meaning *"signal / cue"* in Sanskrit and Hindi) is a legal-compliant, secure, and ethical **on-premise assistive platform** designed to surface behavioral, vocal, and physiological cues during investigative interviews. 

It is strictly engineered as an **assistive situational awareness tool** for investigating officers—fully aligned with the **Selvi v. Karnataka (2010)** ruling to prevent involuntary self-incrimination and deception classification.

---

## 🏛️ Legal & Compliance Mapping

| Legal framework | System Provision | Code Implementation |
| :--- | :--- | :--- |
| **Article 20(3), Indian Constitution** | biometrics-based frame/audio processing is 100% voluntary; locks out inference if consent is refused. | [consent.py](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/consent.py#L64-L80) & [app.py](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/app.py#L161-L167) |
| **Article 21 (Puttaswamy Privacy)** | 100% on-premises offline hardware execution; zero cloud connections or external APIs. | [asr.py](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/audio/asr.py#L44-L57) & [contradiction.py](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/nlp/contradiction.py#L83-L90) |
| **Selvi v. State of Karnataka (2010)** | Observes raw baseline deviations. No binary "lie/truth" outputs; surfaces probability-calibrated arousal indicators. | [fusion.py](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/fusion.py#L70-L125) & [App.js](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/frontend/src/App.js#L415-L430) |
| **DPDP Act, 2023** | Captures explicit consent notices, implements immediate withdrawal, and right to erasure (permanent data wiping). | [consent.py](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/consent.py#L82-L109) & [App.js](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/frontend/src/App.js#L196-L224) |
| **BNSS, 2023** | Safeguard gates automatically halt processing for vulnerable subjects (minors, distress, intoxication). | [safeguard.py](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/safeguard.py#L39-L84) & [app.py](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/app.py#L179-L189) |
| **BSA, 2023** | Enforces Ed25519-signed append-only audit ledgers and SHA-256 chain logs for custody verification. | [audit_log.py](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/audit_log.py#L45-L115) & [app.py](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/app.py#L526-L587) |

---

## 🏗️ System Architecture & File Structure

```
sanket/
  ├── logs/                  # Local volume mount for cryptographic audit logs
  ├── project_sanket/        # Main application folder
  │    ├── backend/          # FastAPI backend server
  │    │    ├── audio/       # ASR (Whisper) & openSMILE voice stress analysis
  │    │    ├── vision/      # Face AU mesh tracker & pyVHR rPPG heart rate estimator
  │    │    ├── nlp/         # XLM-RoBERTa NLI contradiction & topic segmenter
  │    │    ├── test/        # Programmatic KPI verification unit tests
  │    │    ├── app.py       # FastAPI core routes & ReportLab PDF generator
  │    │    ├── database.py  # PostgreSQL ORM connection with SQLite fallback
  │    │    └── fusion.py    # Weighted Late Bayesian Fusion & temperature scaling
  │    ├── frontend/         # React tablet interface application
  │    │    ├── src/         # Webcam streams, timeline rendering & glassmorphic UI
  │    │    └── package.json # NPM react-scripts dependencies
  │    └── scripts/          # Automation and evaluation scripts
  │         ├── generate_mock_sessions.py  # Sequential mock session generator
  │         ├── evaluate_kpis.py           # Multi-session demographic parity and ECE validator
  │         ├── mock_audio.py              # Mock audio streaming client
  │         └── mock_video.py              # Mock frame streaming client
  ├── docker-compose.yml     # CPU/Production Docker Compose configurations
  ├── docker-compose.gpu.yml # Optional GPU overrides
  ├── .env                   # On-premise environment variables
  └── .gitignore             # Git exclusion rules
```

---

## 🚀 Quick Start (Docker Compose)

The easiest way to boot the complete ecosystem is using Docker. By default, ports are mapped to avoid collisions:
- **FastAPI Backend:** [http://localhost:8001](http://localhost:8001) (Swagger docs at `/docs`)
- **React Frontend:** [http://localhost:3001](http://localhost:3001)
- **MinIO Dashboard:** [http://localhost:9001](http://localhost:9001)

### 1. Launch Services
Run from the root directory:
```bash
# Start all containers in the background (CPU Mode)
docker-compose up -d
```

### 2. Verify Health
Ensure all four containers (`postgres`, `minio`, `backend`, `frontend`) are up and healthy:
```bash
docker-compose ps
```

---

## 📊 Dataset Simulation & KPI Validation

Project SANKET includes scripts to simulate a dataset of 5 multilingual sessions (Hindi, Tamil, Marathi, Hinglish, Bengali) and execute verification audits.

### 1. Generate the Multilingual Mock Dataset
Stream telemetries sequentially, generate PDF reports, and write data logs:
```bash
# Enable UTF-8 console output for Indic scripts on Windows
$env:PYTHONIOENCODING="utf-8"

# Execute mock generator
python project_sanket/scripts/generate_mock_sessions.py
```
This generates session directories under `project_sanket/data/sessions/` and compiles the dataset manifest at `project_sanket/data/dataset_manifest.json`.

### 2. Validate Multi-Session KPIs
Run the validation suite across all generated sessions to assert latency, ECE calibration, demographic parity, and log chaining limits:
```bash
python project_sanket/scripts/evaluate_kpis.py --sessions session_001 session_002 session_003 session_004 session_005
```

**Example Validation Dashboard Output:**
```
--- SANKET MULTI-SESSION KPI VALIDATION ---

===============================================================================================
Session ID      | p95 Latency   | ECE Calib  | Demo Parity  | Audit Log  | Status  
-----------------------------------------------------------------------------------------------
session_001     | 72.5ms (PASS) | 0.038 (PASS) | 0.000 (PASS) | PASS       | SUCCESS 
session_002     | 75.7ms (PASS) | 0.038 (PASS) | 0.000 (PASS) | PASS       | SUCCESS 
session_003     | 73.9ms (PASS) | 0.038 (PASS) | 0.000 (PASS) | PASS       | SUCCESS 
session_004     | 74.4ms (PASS) | 0.038 (PASS) | 0.000 (PASS) | PASS       | SUCCESS 
session_005     | 75.5ms (PASS) | 0.038 (PASS) | 0.000 (PASS) | PASS       | SUCCESS 
===============================================================================================
Overall Multi-Session Validation: SUCCESS
```

### 3. Run Core Verification Tests
Run the unit test suite inside the backend container:
```bash
docker-compose exec backend python -m unittest test/test_kpis.py
```

---

## 🔧 Streamlined CPU Telemetry & Multi-lingual Processing Pipelines

SANKET has been overhauled to support seamless execution on CPU-only edge hardware by decoupling heavy models and offloading speech pipeline workloads:

1. **Streamlined CPU Target Infrastructure**:
   - Running entirely on CPU-only local workstations by integrating lightweight containerized components (FastAPI backend + Nginx static frontend).
   - Decoupled heavy local machine ASR inference models by leveraging the browser's native **Web Speech API** for real-time speech-to-text.
   - Whisper-tiny is configured as a silent, fallback container ASR pipeline to capture audio chunks only when native APIs are restricted.

2. **Multi-lingual Ingestion & Localized ASR**:
   - Integrates native browser speech diarization targeting **Indian English (en-IN)**.
   - Provides full ingestion support for **5 target languages** (English, Hindi, Marathi, Tamil, Telugu) selectable via a Demographics interface dropdown.
   - Enforces language locale mappings that persist in real-time across the tablet dashboard panel elements.

3. **Optimized Physiology & Face Contours Telemetry**:
   - **rPPG CHROM Filtering (`ppg.py`)**: A pure NumPy and OpenCV-based CHROM rPPG algorithm that processes forehead ROI color pulse variations using a strict bandpass filter tuned to `0.92 - 1.67 Hz` (corresponding to a clean **55 - 100 BPM** physiological heart rate band) to completely filter out ambient light and head-motion artifacts.
   - **AU4 Brow Furrow Blendshapes (`face_cues.py`)**: Replaced raw face landmark coordinates with MediaPipe's dynamic Face Blendshapes tracking system (`browDownLeft` + `browDownRight`) to natively drive the AU4 Brow Furrow intensity graph.

4. **Shortened Baseline Calibration**:
   - The trailing physiological baseline calibration window has been shortened down to exactly **60 seconds** to optimize baseline profiling. The UI dynamically clears the "Baseline collection in progress" explainability attributions panel past this 60s active operational window to show a clean dashboard.

---

## 💻 Manual Developer Setup (Non-Docker)

### 1. Backend Server Setup
```bash
# Install Python packages
pip install -r project_sanket/backend/requirements.txt

# Start FastAPI (listens on port 8000 locally)
python -m uvicorn project_sanket.backend.app:app --reload --port 8000
```

### 2. Frontend React Setup
```bash
# Navigate to the frontend directory
cd project_sanket/frontend

# Install dependencies and start local server (runs on port 3000 locally)
npm install
npm start
```
