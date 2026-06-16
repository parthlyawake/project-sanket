# SANKET - Demo Day Startup Guide 🚀

This guide provides step-by-step instructions to boot the **Project SANKET** system from scratch (assuming a fresh laptop reboot) and run a successful live streaming demo.

---

## 📋 Prerequisites & Initial Checks
Before running any command, ensure that **Docker Desktop** is open and fully running in the background.

---

## ⏱️ Step-by-Step Startup Sequence

### Step 1: Spin Up the Containers
Open your terminal (PowerShell or Bash) in the project root (`C:\Users\Parth\OneDrive\Desktop\sanket`) and start all services in detached mode:
```bash
docker compose up -d
```
*   **Time Estimate:** **10 - 20 seconds** (since image layers are already built).
*   **Verify Containers are Running:**
    ```bash
    docker ps
    ```
    You should see four containers running: `sanket_backend`, `sanket_frontend`, `sanket_postgres`, and `sanket_minio`.

---

### Step 2: Wait for Backend Pre-Warming
The backend automatically executes pre-warming on startup to pre-load Whisper-Base, sentence-transformers, and MediaPipe models into CPU memory.
To check when it finishes pre-loading, run:
```bash
docker compose logs -f backend
```
*   **Time Estimate:** **15 - 30 seconds** on CPU.
*   **Success Indicator:** Keep an eye out for this log line:
    ```
    sanket_backend  | All ML models pre-warmed successfully!
    sanket_backend  | INFO:     Application startup complete.
    ```
    Once you see this, press `Ctrl + C` to exit the log follower.

---

### Step 3: Open the Interfaces
Open your browser and navigate to the following ports:
1.  **React Tablet UI:** [http://localhost:3001](http://localhost:3001)
    *   *Time Estimate:* **2 - 5 seconds** (loads immediately).
2.  **FastAPI Interactive Swagger Docs:** [http://localhost:8001/docs](http://localhost:8001/docs) (used to manually check endpoints).
3.  **MinIO Object Storage Panel:** [http://localhost:9001](http://localhost:9001) (to view raw uploaded audio and reports).

---

## 🎥 Running the Live Streaming Demo & Showcase Script

To showcase a live demo with real-time telemetry, follow this script highlighting SANKET's premium feature set:

### 1. Register Consent in the Newsprint UI
1. Open the UI at `http://localhost:3001` to view the flat, sharp **Newsprint/Editorial Newspaper aesthetic** (pure white cards, 1px solid borders, zero corner radii, and bold Times-Bold headings).
2. Enter a Session ID: `live_test_session_abc`.
3. Select the target language from the **multi-language demographics selector dropdown** (supporting `English (en-IN)`, `Hindi (hi-IN)`, `Marathi (mr-IN)`, `Tamil (ta-IN)`, and `Telugu (te-IN)`).
4. Demonstrate the **Subject / Officer turn-taking toggle** on the demographic screen and live dashboard which dynamically gates officer questioning from self-contradiction analysis.
5. Click **Accept & Start Analysis**. The dashboard will load immediately. The progress bar compiles baseline data during the shortened **60-second baseline collection window**, clearing the progress labels dynamically at 60s session elapsed time.

---

### 2. Trigger the Mock Streams & Verification Gauntlets
Open **two separate terminal windows** in the project root to stream simulated webcam frames and audio segments:

*   **Terminal 1 (Mock Video Stream):**
    Streams 2D face contours (including eye gaze variations, blink dynamics, and forehead color pulse changes for rPPG tracking) to the `/frame` endpoint:
    ```bash
    python project_sanket/scripts/mock_video.py --stream-api --session-id live_test_session_abc --url http://localhost:8001/frame
    ```

*   **Terminal 2 (Mock Audio Stream):**
    Streams audio segments to the `/audio` endpoint, testing our **3 Programmatic NLP Gauntlets**:
    ```bash
    python project_sanket/scripts/mock_audio.py --stream-api --session-id live_test_session_abc --url http://localhost:8001/audio
    ```

#### 🛡️ Showcase the 3 NLP Verification Gauntlets:
1.  **Speaker Gating (Officer Immunity)**: Select "Officer" via the turn-taking toggle and type or speak. Verify that when the speaker is labeled "Officer", the semantic contradiction engine ignores their utterance entirely, preventing officer questions from triggering flags.
2.  **Echo/Incremental ASR Filter**: Submit two highly similar, incremental speech transcripts (e.g., *"I voice eating my lunch"* and *"I was eating my lunch"*). SANKET computes the raw LaBSE cosine similarity, and because the similarity exceeds **0.90**, it ignores the duplicate as an incremental whisper correction instead of flagging a contradiction.
3.  **Cross-Lingual Social Context Match**: Speak or submit a contradiction using Hindi, Marathi, Tamil, or Telugu keywords (e.g., claiming to be alone *"अकेला"* but subsequently mentioning kids *"बच्चे"* or family). SANKET catches the social mismatch and immediately flags the semantic contradiction.

---

### 3. Generate the Monochromatic PDF Dossier
*   Click **END INTERVIEW & GET REPORT** on the bottom left of the tablet UI.
*   This triggers the automated **ReportLab PDF generator**, which outputs a premium document styled directly with the newsprint aesthetic:
    *   Flat geometric styling with 0 corner radii, sharp solid black table grids, and Times-Bold serif article headers on a soft off-white canvas `#F9F9F7`.
    *   **Live Session Aggregates**: Displays genuine calculated averages of heart rate (BPM) and maximum brow furrow (AU4 blendshape) mapped to the exact time bounds of the utterances within each discussion topic.
    *   High-contrast solid dark red (`#CC0000`) is reserved strictly for highlighting confirmed contradictions.

---

## 🛠️ Troubleshooting Container Failures

### 🚨 Case A: Backend Container Fails to Start
*   **Symptoms:** `sanket_backend` container exits immediately or displays `Exited (1)`.
*   **Solution:**
    1. Check the exact crash logs:
       ```bash
       docker compose logs backend
       ```
    2. *Port Conflict:* Ensure no other local service is using port `8001` or `8000`.
    3. *Cache/Storage Issue:* If the container failed because it ran out of disk space downloading model weights:
       ```bash
       docker system prune -a --volumes
       ```
    4. *Rebuild:* Rebuild the container cleanly without using cached layers:
       ```bash
       docker compose build --no-cache backend
       docker compose up -d
       ```

### 🚨 Case B: Database (Postgres) or MinIO Healthy Check Fails
*   **Symptoms:** Backend remains stuck waiting for Postgres or MinIO to become healthy.
*   **Solution:**
    1. Force restart the dependency containers:
       ```bash
       docker compose restart postgres minio
       ```
    2. Check Postgres credentials or volume mounts in `docker-compose.yml` to make sure they match your environment variables (`POSTGRES_PASSWORD`, etc.).
