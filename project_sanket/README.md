# Project SANKET: Multimodal AI Assistant for Investigative Interview Analysis

SANKET ("signal / cue" in Hindi & Sanskrit) is an on-premise, legal-compliant, and ethical assistive platform that surfaces behavioral, vocal, and physiological signals during investigative interviews. It is explicitly designed as an assistive situational awareness tool for investigating officers—**not** a deception detector.

---

## 🏛️ Demographic & Legal Compliance Mapping

| Legal Authority / Standard | System Provision | Code Implementation Reference |
| :--- | :--- | :--- |
| **Article 20(3), Constitution of India** (Protection against self-incrimination) | System is 100% voluntary. No biometric frame/audio analysis begins without explicit subject consent. If consent is refused, the system locks out model inference and enters fallback mode (live notes only). | Gated in [consent.py:L64-80](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/consent.py#L64-L80) and enforced in [app.py:L113-118](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/app.py#L113-L118) and [app.py:L181-186](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/app.py#L181-L186). |
| **Article 21, Constitution of India** (Right to privacy / Puttaswamy doctrine) | Audio and video processing runs strictly on-premises on local agency hardware. No network connections, telemetry, or external cloud API calls are made. | Configured locally in [asr.py:L44-57](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/audio/asr.py#L44-L57) and [contradiction.py:L83-90](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/nlp/contradiction.py#L83-L90). |
| **Selvi v. State of Karnataka (2010)** (Ban on involuntary narco/polygraph tests) | The system observes and surfaces raw cues (AUs, gaze shift, HR, pitch) relative to a personal baseline. No binary "lie/truth" classifications are produced; all outputs are probabilistic arousal indicators. | Calibrated in [fusion.py:L58-94](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/fusion.py#L58-L94) and filtered in [App.js:L415-430](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/frontend/src/App.js#L415-L430). |
| **Digital Personal Data Protection Act, 2023** (DPDP) | Captured via explicit, unambiguous consent notices. Supports immediate consent withdrawal which stops recording loops instantly. Implements the *Right to Erasure*, deleting all session files and database records on demand. | Notices in [App.js:L196-224](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/frontend/src/App.js#L196-L224), withdrawal in [consent.py:L43-62](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/consent.py#L43-L62), and erasure in [consent.py:L82-109](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/consent.py#L82-L109). |
| **Bharatiya Nagarik Suraksha Sanhita, 2023** (BNSS) | Inference is automatically suspended on vulnerable subjects (minors, intoxicated persons, or those in extreme distress). The system triggers a procedural safety warning and halts processing until acknowledged. | Managed in [safeguard.py:L39-84](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/safeguard.py#L39-L84) and gated in [app.py:L127-142](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/app.py#L127-L142). |
| **Bharatiya Sakshya Adhiniyam, 2023** (BSA - Evidence Act) | All reports are watermarked `"ASSISTIVE USE ONLY — NOT EVIDENCE"`. Implements Ed25519 signatures and SHA-256 chaining on logs to prevent manipulation and preserve evidence chain-of-custody. | Watermarks in [app.py:L345-360](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/app.py#L345-L360) and [App.js:L360-370](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/frontend/src/App.js#L360-L370). Hashing in [audit_log.py:L30-80](file:///c:/Users/Parth/OneDrive/Desktop/sanket/project_sanket/backend/audit_log.py#L30-L80). |

---

## 🏗️ System Architecture & File Structure

```
project_sanket/
  ├── backend/               # FastAPI service and model code
  │    ├── app.py            # Main FastAPI service (endpoints, routes, PDF generation)
  │    ├── database.py       # PostgreSQL database connection with SQLite fallback
  │    ├── minio_client.py   # MinIO wrapping service with filesystem folder fallback
  │    ├── consent.py        # Consent tracking & DPDP compliance logic
  │    ├── audit_log.py      # Ed25519-signed append-only log writer
  │    ├── baseline.py       # Configurable 3-5m silent baseline manager
  │    ├── safeguard.py      # Vulnerable subject triggers (minors, distress)
  │    ├── vision/
  │    │    ├── face_cues.py # MediaPipe face mesh & OpenCV Haar Cascade tracker
  │    │    └── ppg.py       # pyVHR remote heart rate estimation
  │    ├── audio/
  │    │    ├── asr.py       # Local ASR model loader & mock registry parser
  │    │    └── opensmile.py # eGeMAPS voice features & NumPy autocorrelation
  │    ├── nlp/
  │    │    └── contradiction.py # XLM-RoBERTa contradiction detector & topic segmenter
  │    ├── fusion.py         # Temperature calibration and Bayesian late fusion
  │    └── test/
  │         └── test_kpis.py # Programmatic verification suite for all KPIs
  ├── frontend/              # Tablet React UI application
  │    ├── public/
  │    │    └── index.html   # Main page importing Outfit font
  │    ├── src/
  │    │    ├── App.js       # App logic, webcam ingestion, timeline rendering
  │    │    ├── index.js     # React mounting script
  │    │    └── index.css    # Card glows, glassmorphism layouts, variables
  │    └── package.json      # React scripts dependencies
  ├── scripts/               # Mock data generators
  │    ├── mock_video.py     # Generates synthetic blinking face video
  │    ├── mock_audio.py     # Generates synthetic WAV chunks & registry
  │    └── evaluate_kpis.py  # Demographic bias test framework
  └── README.md              # Master project README
```

---

## 🚀 Setup & Execution

### Prerequisites
- Python 3.13 (or 3.9+)
- Node.js (v18+)

### 1. Backend Server Setup
Navigate to the root folder, and start the FastAPI service:
```bash
# Start backend (Uvicorn listens on port 8000)
python -m uvicorn project_sanket.backend.app:app --reload --port 8000
```
*Note: The backend will automatically output alerts indicating PostgreSQL / MinIO are offline and that it is using local SQLite (`sanket.db`) and disk folders for object storage.*

### 2. Frontend React Setup
Navigate to the frontend folder, install dependencies, and start the development server:
```bash
cd project_sanket/frontend
npm install
npm start
```
*Note: React will boot at `http://localhost:3000`.*

### 3. Run the KPI Verification Suite
Verify all 10 target KPI thresholds programmatically:
```bash
python -m project_sanket.backend.test.test_kpis
```
