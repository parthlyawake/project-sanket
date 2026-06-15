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

## 🎥 Running the Live Streaming Demo

To show a live demo with real-time telemetry, follow these steps:

### 1. Register Consent and Start a Session
1.  Open the UI at `http://localhost:3001`.
2.  Enter a Session ID: `live_test_session_abc`.
3.  Fill in the volunteer demographics (e.g. Language: `Tamil`, Officer: `officer_priya`).
4.  Click **Accept & Start Analysis**.
5.  The dashboard will open, saying `Awaiting streaming telemetry (Ingesting video/audio chunks)...` and start compiling baseline profiles.

---

### 2. Trigger the Mock Streams (Simultaneously)
Open **two separate terminal windows** in the project root to stream simulated webcam frames and audio segments to the running container.

*   **Terminal 1 (Mock Video Stream):**
    Streams 2D face contours (including gaze shifts, blinks, lip movements, and rPPG color pulse changes) to the `/frame` endpoint:
    ```bash
    python project_sanket/scripts/mock_video.py --stream-api --session-id live_test_session_abc --url http://localhost:8001/frame
    ```

*   **Terminal 2 (Mock Audio Stream):**
    Streams audio segments containing Hindi, Hinglish, Marathi, and Tamil utterances to the `/audio` endpoint, triggering real Whisper-Base translation, acoustic pitch estimation, and semantic contradiction alerts:
    ```bash
    python project_sanket/scripts/mock_audio.py --stream-api --session-id live_test_session_abc --url http://localhost:8001/audio
    ```

*   **Expected Behavior:**
    *   The React UI will poll `/latest-cues/live_test_session_abc` and draw scrolling line graphs.
    *   Rotating CSS spinners will display on each cue card to show active background processing.
    *   A contradiction alert will trigger in the transcript panel when the subject states: *"Actually, manager is my close family friend..."* after claiming to not know him.

---

### 3. Generate and Download the PDF Report
*   Click **END INTERVIEW & GET REPORT** on the bottom left of the tablet UI.
*   This triggers the PDF generator. The generated PDF will show **Execution Mode: LIVE INFERENCE** and display a clean diagonal watermark stating **LIVE INFERENCE MODE**.

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
