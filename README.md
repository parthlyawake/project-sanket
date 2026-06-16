# THE SANKET DISPATCH

## Project SANKET: Multimodal Assistive Situational Awareness Platform

> **INTELLIGENCE DIVISION AUTOMATION PROTOCOL**
>
> * **VOL. I ... NO. 1**
> * **ON-PREMISE AGENTIC EDITION**
> * **JUNE 2026**

---

### 🗞️ Decoupled CPU Stack & Host Architecture

Project SANKET is engineered as an on-premises investigative companion running seamlessly on a **CPU-only workstation**. Heavy machine ASR model inference has been decoupled from the local host loop; real-time transcription is offloaded directly to the client's browser-native **Web Speech API**. This achieves zero pipeline queue lag, leaving the local host processor dedicated to lightweight digital signal processing (DSP) and weighted Late Bayesian Fusion.

---

### 🗣️ Multilingual Ingestion & Dialects

SANKET supports **5 target regional dialects** (English, Hindi, Marathi, Tamil, Telugu) and Indian English (en-IN). Language tags are mapped dynamically in the client-side polling loops so background status updates never overwrite transcript card metadata.

---

### 👮 Investigator Turn-Taking Immunity

Toggled via a Ref-backed switch (`activeSpeakerRef.current === 'Officer'`). Officer statements are logged for conversational context but completely bypass NLI contradiction analysis to protect investigative lines of questioning.

---

### 📊 Telemetry & DSP Index

* **NumPy CHROM rPPG Filter**: Pure NumPy and OpenCV forehead ROI tracking with a strict bandpass filter tuned to **55-100 BPM** (0.92-1.67 Hz) to eliminate motion and light artifacts.
* **AU4 Brow Furrow Blendshapes**: Tracks MediaPipe's dynamic `browDownLeft` + `browDownRight` blendshape parameters to natively drive the Brow Furrow graph.
* **60s Trailing Baseline**: Streamlined physiological calibration window of exactly **60 seconds**, dynamically clearing explainability alerts past the window.

---

### 🏛️ Legal & Compliance Mapping

| Act / Precedent | Implementation / Safeguard |
| :--- | :--- |
| **Art. 20(3)** | Voluntary gating; locks out if consent refused. |
| **Art. 21** | 100% on-premises offline local execution. |
| **Selvi (2010)** | Calibrated arousal probabilities; no binary lie test. |
| **DPDP 2023** | Explicit consent, withdrawal, right to erasure. |
| **BNSS 2023** | Safeguards automatically warning on vulnerabilities. |
| **BSA 2023** | Ed25519-signed append-only audit log chain. |

---

### 🔀 System Logic & Text Routing Flowchart

```text
             [ Incoming Speech Segment ]
                         │
                         ▼
               /───────────────────\
              <    Speaker Labeled    >
               \  "Officer"?       /
                 \───────────────/
                   │           │
           YES     │           │  NO (Subject)
                   ▼           ▼
             [ LOG ONLY ]  [ Echo Filter ] ─── Raw similarity > 0.90? ──► [ SKIP ]
            (Immunity Gated)   │
                               │ NO (New Utterance)
                               ▼
                           /───────\
                          <  Alone  > ◄─── Matches ALONE_WORDS?
                           /───────\
                               │
                               ▼
                           /───────\
                          < People  > ◄─── Matches PEOPLE_WORDS?
                           /───────/
                               │
                               ▼
               [ Social Context Exclusion Check ]
                (Flag Contradiction if Both Match)
                               │
                               ▼
                   [ XLM-RoBERTa NLI Engine ]
                (Check Semantic Contradiction)
```

---

> ⚠️ **LEGAL NOTICE & SAFEGUARD GATEWAY**
>
> Under Section 65B of the Indian Evidence Act (Bharatiya Sakshya Adhiniyam, 2023), SANKET is classified as an assistive platform only. Its indicators represent statistical deviations from physiological baselines, not substantiating direct evidence of guilt or deception. Consent is required to start inference pipelines; erasure request permanently purges PostgreSQL records.

---

### 🚀 Quick Start (Docker Compose Detached Mode)

Run from the root directory to spin up the decoupled stack:

```bash
# Boot the PostgreSQL, MinIO, Nginx static frontend, and FastAPI backend
docker compose up -d

# Verify container statuses (postgres, minio, backend, frontend)
docker compose ps
```

---

### 📊 Dataset Simulation & KPI Validation

Simulate 5 multilingual sessions and verify latency, calibration, and demographic parity KPIs:

```powershell
# Windows UTF-8 encoding command
$env:PYTHONIOENCODING="utf-8"

# Generate sequential mock dataset
python project_sanket/scripts/generate_mock_sessions.py

# Assert programmatic KPI metrics
python project_sanket/scripts/evaluate_kpis.py --sessions session_001 session_002 session_003 session_004 session_005
```
