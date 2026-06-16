# THE SANKET DISPATCH

## Demo Day Startup & Evaluation Guide — Live Showcase Tracks

> **HACKATHON EVALUATION PLAYBOOK**
>
> * **VOL. I ... NO. 2**
> * **JUNE 2026**

---

### 🎙️ Step-by-Step Showcase Script

To showcase Project SANKET to the evaluation panel, guide them through this sequential track demonstrating our editorial Newsprint interface and multilingual contradiction engine:

#### 1. Register Consent & Set Up Dialects
* Open the UI at `http://localhost:3001` to demonstrate the flat newspaper layout (white cards, 1px solid black borders, Lora/Playfair typography).
* Enter a Session ID and select a regional language from the demographics language selector dropdown menu (e.g. **Hindi (hi-IN)** or **Tamil (ta-IN)**).
* Point out the active **Subject / Officer turn-taking toggle**. Set Speaking: **SUBJECT**.
* Click **Accept & Start Analysis**.

#### 2. Show 60s Calibration Sequence
* On the dashboard, point out the **BASELINE WINDOW STATUS** card.
* Show the calibration progress bar. SANKET gathers baseline physiological values for exactly **60 seconds**.
* During these 60 seconds, the explainability attributions box displays: *Explainability Attributions: Baseline collection in progress.*
* Observe that **after exactly 60 seconds**, the baseline completes, and the UI dynamically clears out the attribution label to show a clean dashboard.

#### 3. Demonstrate Dialect Persistence
* Submit or speak regional utterances. Demonstrate that the live transcript blocks **dynamically preserve their specific language tags (e.g. `[Subject] (Hindi)`)** rather than defaulting back to English.

#### 4. Demonstrate Turn-Taking & Officer Immunity
* Toggle the turn-taking switch to **Speaking: OFFICER**.
* Speak or submit an utterance that opposes a previous subject statement (e.g. location or timing).
* Show the **Officer's immunity**: the card is styled in grey, and the backend completely bypasses NLI checks, ensuring investigator questioning never triggers self-contradiction alerts.

---

### 🛡️ Programmatic Test Gauntlets

SANKET is evaluated against three core verification tracks to prevent false alarms:

#### Gauntlet A: Echo/Incremental ASR Filter
* Submit two highly similar, incremental speech segments (e.g., *"I voice eating my lunch"* and *"I was eating my lunch"*).
* SANKET computes the raw LaBSE cosine similarity, and because the similarity exceeds **0.90**, it filters out the second segment as an incremental whisper correction instead of triggering a contradiction.

#### Gauntlet B: Multilingual Social Keywords
* Submit a statement claiming the subject was alone using a regional keyword (e.g., *"मैं बिल्कुल अकेला था"* - alone).
* Next, submit a statement claiming children or family were present (e.g., *"मेरे बच्चे भी वहां थे"* - kids).
* SANKET matches these terms to its expanded multilingual dictionary and instantly flags a social context mismatch contradiction.

#### Gauntlet C: Automated Dossier PDF
* Click **END INTERVIEW & GET REPORT** to compile the ReportLab dossier:
  * **Newsprint Styling**: Flat monochromatic layout with 0 corner radii, solid black table gridlines, and Times-Bold serif article headers on a soft off-white canvas `#F9F9F7`.
  * **Query Isolation**: Every query in `@app.get("/report")` (including the signed audit log chain) is isolated strictly by `session_id`.
  * **Live Session Aggregates**: Displays genuine averages of heart rate and maximum brow furrow mapped to the exact timestamps of utterances spoken under each discussion topic.
  * **Accents**: High-contrast dark red (`#CC0000`) is reserved exclusively for confirmed contradictions.

---

### ⚠️ LIVE TELEMETRY STREAMING COMMANDS

To feed live data into the evaluation session, open separate terminal windows and execute the mock streaming scripts in the workspace root:

```bash
# Terminal 1: Mock Forehead ROI Video & rPPG Ingestion
python project_sanket/scripts/mock_video.py --stream-api --session-id evaluation_session_001 --url http://localhost:8001/frame

# Terminal 2: Mock Audio Ingestion (Transcripts & Pitch)
python project_sanket/scripts/mock_audio.py --stream-api --session-id evaluation_session_001 --url http://localhost:8001/audio
```

---

### 🛠️ Troubleshooting Stack Crashes

* **Exited Backend Container**: If the backend container fails to launch, check crash logs with `docker compose logs backend`. Check for local port collisions on `8000` or `8001`.
* **Out of Disk Space**: Clear cached layers and volumes with `docker system prune -a --volumes`, and then build cleanly: `docker compose build --no-cache backend`.
