<table width="100%" bgcolor="#F9F9F7" border="3" bordercolor="#111111" cellpadding="15" cellspacing="0" style="border: 3px solid #111111; border-collapse: collapse;">
  <tr>
    <td align="center">
      <font face="Times New Roman, serif" size="7"><b>THE SANKET DISPATCH</b></font><br>
      <font face="Times New Roman, serif" size="4"><i>Project SANKET: Multimodal Assistive Situational Awareness Platform</i></font><br><br>
      <table width="100%" border="1" bordercolor="#111111" cellpadding="6" cellspacing="0" bgcolor="#F2F2F0" style="border: 1px solid #111111; border-collapse: collapse;">
        <tr>
          <td align="left"><font face="Helvetica, Arial, sans-serif" size="2"><b>VOL. I ... NO. 1</b></font></td>
          <td align="center"><font face="Helvetica, Arial, sans-serif" size="2"><b>ON-PREMISE AGENTIC EDITION</b></font></td>
          <td align="right"><font face="Helvetica, Arial, sans-serif" size="2"><b>JUNE 2026</b></font></td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<br>

<table width="100%" bgcolor="#F9F9F7" border="1" bordercolor="#111111" cellpadding="15" cellspacing="0" style="border: 1px solid #111111; border-collapse: collapse;">
  <tr valign="top">
    <td width="55%" style="text-align: justify; border-right: 1px solid #111111; padding: 15px;">
      <font face="Times New Roman, serif" size="5"><b>🗞️ Decoupled CPU Stack & Host Architecture</b></font>
      <hr size="1" color="#111111" style="background-color: #111111; height: 1px; border: none;">
      <p><font face="Georgia, serif" size="3">Project SANKET is engineered as an on-premises investigative companion running seamlessly on a <b>CPU-only workstation</b>. Heavy machine ASR model inference has been decoupled from the local host loop; real-time transcription is offloaded directly to the client's browser-native <b>Web Speech API</b>. This achieves zero pipeline queue lag, leaving the local host processor dedicated to lightweight digital signal processing (DSP) and weighted Late Bayesian Fusion.</font></p>
      
      <font face="Times New Roman, serif" size="5"><b>🗣️ Multilingual Ingestion & Dialects</b></font>
      <hr size="1" color="#111111" style="background-color: #111111; height: 1px; border: none;">
      <p><font face="Georgia, serif" size="3">SANKET supports <b>5 target regional dialects</b> (English, Hindi, Marathi, Tamil, Telugu) and Indian English (en-IN). Language tags are mapped dynamically in the client-side polling loops so background status updates never overwrite transcript card metadata.</font></p>

      <font face="Times New Roman, serif" size="5"><b>👮 Investigator Turn-Taking Immunity</b></font>
      <hr size="1" color="#111111" style="background-color: #111111; height: 1px; border: none;">
      <p><font face="Georgia, serif" size="3">Toggled via a Ref-backed switch (<code>activeSpeakerRef.current === 'Officer'</code>). Officer statements are logged for conversational context but completely bypass NLI contradiction analysis to protect investigative lines of questioning.</font></p>
    </td>
    <td width="45%" bgcolor="#F2F2F0" style="padding: 15px;">
      <font face="Times New Roman, serif" size="5"><b>📊 Telemetry & DSP Index</b></font>
      <hr size="1" color="#111111" style="background-color: #111111; height: 1px; border: none;">
      <ul>
        <li><font face="Helvetica, Arial, sans-serif" size="2.5"><b>NumPy CHROM rPPG Filter:</b> Pure NumPy and OpenCV forehead ROI tracking with a strict bandpass filter tuned to <b>55-100 BPM</b> (0.92-1.67 Hz) to eliminate motion and light artifacts.</font></li><br>
        <li><font face="Helvetica, Arial, sans-serif" size="2.5"><b>AU4 Brow Furrow Blendshapes:</b> Tracks MediaPipe's dynamic <code>browDownLeft</code> + <code>browDownRight</code> blendshape parameters to natively drive the Brow Furrow graph.</font></li><br>
        <li><font face="Helvetica, Arial, sans-serif" size="2.5"><b>60s Trailing Baseline:</b> Streamlined physiological calibration window of exactly <b>60 seconds</b>, dynamically clearing explainability alerts past the window.</font></li>
      </ul>
      
      <br>
      <font face="Times New Roman, serif" size="5"><b>🏛️ Legal & Compliance Mapping</b></font>
      <hr size="1" color="#111111" style="background-color: #111111; height: 1px; border: none;">
      <table width="100%" border="1" bordercolor="#111111" cellpadding="4" cellspacing="0" bgcolor="#F9F9F7" style="border: 1px solid #111111; border-collapse: collapse; font-family: Helvetica, Arial, sans-serif; font-size: 11px;">
        <tr bgcolor="#111111">
          <th><font color="white">Act</font></th>
          <th><font color="white">Implementation</font></th>
        </tr>
        <tr>
          <td><b>Art. 20(3)</b></td>
          <td>Voluntary gating; locks out if consent refused.</td>
        </tr>
        <tr>
          <td><b>Art. 21</b></td>
          <td>100% on-premises offline local execution.</td>
        </tr>
        <tr>
          <td><b>Selvi (2010)</b></td>
          <td>Calibrated arousal probabilities; no binary lie test.</td>
        </tr>
        <tr>
          <td><b>DPDP 2023</b></td>
          <td>Explicit consent, withdrawal, right to erasure.</td>
        </tr>
        <tr>
          <td><b>BNSS 2023</b></td>
          <td>Safeguards automatically warning on vulnerabilities.</td>
        </tr>
        <tr>
          <td><b>BSA 2023</b></td>
          <td>Ed25519-signed append-only audit log chain.</td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<br>

<table width="100%" bgcolor="#F9F9F7" border="1" bordercolor="#111111" cellpadding="15" cellspacing="0" style="border: 1px solid #111111; border-collapse: collapse;">
  <tr>
    <td>
      <font face="Times New Roman, serif" size="5"><b>🔀 System Logic & Text Routing Flowchart</b></font>
      <hr size="1" color="#111111" style="background-color: #111111; height: 1px; border: none;">
      <pre style="font-family: monospace; font-size: 12px; line-height: 1.2; color: #111111;">
             [ Incoming Speech Segment ]
                         │
                         ▼
               /───────────────────\
              <   Speaker Labeled   >
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
                           \───────/
                               │
                               ▼
                           /───────\
                          < People  > ◄─── Matches PEOPLE_WORDS?
                           \───────/
                               │
                               ▼
               [ Social Context Exclusion Check ]
                (Flag Contradiction if Both Match)
                               │
                               ▼
                   [ XLM-RoBERTa NLI Engine ]
                (Check Semantic Contradiction)
      </pre>
    </td>
  </tr>
</table>

<br>

<table width="100%" bgcolor="#FFF5F5" border="2" bordercolor="#CC0000" cellpadding="15" cellspacing="0" style="border: 2px dashed #CC0000; border-collapse: collapse;">
  <tr>
    <td>
      <font face="Times New Roman, serif" size="4" color="#CC0000"><b>⚠️ LEGAL NOTICE & SAFEGUARD GATEWAY</b></font>
      <p><font face="Georgia, serif" size="3" color="#111111">Under Section 65B of the Indian Evidence Act (Bharatiya Sakshya Adhiniyam, 2023), SANKET is classified as an assistive platform only. Its indicators represent statistical deviations from physiological baselines, not substantiating direct evidence of guilt or deception. Consent is required to start inference pipelines; erasure request permanently purges PostgreSQL records.</font></p>
    </td>
  </tr>
</table>

<br>

<table width="100%" bgcolor="#F9F9F7" border="1" bordercolor="#111111" cellpadding="15" cellspacing="0" style="border: 1px solid #111111; border-collapse: collapse;">
  <tr>
    <td>
      <font face="Times New Roman, serif" size="5"><b>🚀 Quick Start (Docker Compose Detached Mode)</b></font>
      <hr size="1" color="#111111" style="background-color: #111111; height: 1px; border: none;">
      <p><font face="Georgia, serif" size="3">Run from the root directory to spin up the decoupled stack:</font></p>
      <pre style="font-family: monospace; font-size: 12px; background-color: #F2F2F0; padding: 10px; border: 1px solid #111111;">
# Boot the PostgreSQL, MinIO, Nginx static frontend, and FastAPI backend
docker compose up -d

# Verify container statuses (postgres, minio, backend, frontend)
docker compose ps</pre>
    </td>
  </tr>
</table>

<br>

<table width="100%" bgcolor="#F9F9F7" border="1" bordercolor="#111111" cellpadding="15" cellspacing="0" style="border: 1px solid #111111; border-collapse: collapse;">
  <tr>
    <td>
      <font face="Times New Roman, serif" size="5"><b>📊 Dataset Simulation & KPI Validation</b></font>
      <hr size="1" color="#111111" style="background-color: #111111; height: 1px; border: none;">
      <p><font face="Georgia, serif" size="3">Simulate 5 multilingual sessions and verify latency, calibration, and demographic parity KPIs:</font></p>
      <pre style="font-family: monospace; font-size: 12px; background-color: #F2F2F0; padding: 10px; border: 1px solid #111111;">
# Windows UTF-8 encoding command
$env:PYTHONIOENCODING="utf-8"

# Generate sequential mock dataset
python project_sanket/scripts/generate_mock_sessions.py

# Assert programmatic KPI metrics
python project_sanket/scripts/evaluate_kpis.py --sessions session_001 session_002 session_003 session_004 session_005</pre>
    </td>
  </tr>
</table>
