<table width="100%" bgcolor="#F9F9F7" border="3" bordercolor="#111111" cellpadding="15" cellspacing="0" style="border: 3px solid #111111; border-collapse: collapse; margin-bottom: 20px;">
  <tr>
    <td align="center" style="padding: 25px 15px;">
      <font face="Times New Roman, serif" size="7"><b>THE SANKET DISPATCH</b></font><br>
      <font face="Times New Roman, serif" size="4"><i>Demo Day Startup & Evaluation Guide — Live Showcase Tracks</i></font><br><br>
      <table width="100%" border="1" bordercolor="#111111" cellpadding="6" cellspacing="0" bgcolor="#F2F2F0" style="border: 1px solid #111111; border-collapse: collapse;">
        <tr>
          <td align="left" style="padding: 5px 10px;"><font face="Helvetica, Arial, sans-serif" size="2"><b>VOL. I ... NO. 2</b></font></td>
          <td align="center" style="padding: 5px 10px;"><font face="Helvetica, Arial, sans-serif" size="2"><b>HACKATHON EVALUATION PLAYBOOK</b></font></td>
          <td align="right" style="padding: 5px 10px;"><font face="Helvetica, Arial, sans-serif" size="2"><b>JUNE 2026</b></font></td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<table width="100%" bgcolor="#F9F9F7" border="1" bordercolor="#111111" cellpadding="0" cellspacing="0" style="border: 1px solid #111111; border-collapse: collapse; margin-bottom: 20px;">
  <tr valign="top">
    <td width="55%" style="text-align: justify; border-right: 2px solid #111111; padding: 20px;">
      <p style="margin-top: 0;"><font face="Times New Roman, serif" size="5"><b>🎙️ Step-by-Step Showcase Script</b></font></p>
      <hr size="1" color="#111111" style="background-color: #111111; height: 1px; border: none; margin-bottom: 15px;">
      <p style="margin-bottom: 20px;"><font face="Georgia, serif" size="3">To showcase Project SANKET to the evaluation panel, guide them through this sequential track demonstrating our editorial Newsprint interface and multilingual contradiction engine:</font></p>
      
      <p style="margin-top: 25px; margin-bottom: 5px;"><font face="Times New Roman, serif" size="4.5"><b>1. Register Consent & Set Up Dialects</b></font></p>
      <ul style="margin-top: 5px; margin-bottom: 20px; margin-left: 15px; padding-left: 0;">
        <li style="margin-bottom: 8px;"><font face="Georgia, serif" size="3">Open the UI at <code>http://localhost:3001</code> to demonstrate the flat <b>newspaper layout</b> (white cards, 1px solid black borders, Lora/Playfair typography).</font></li>
        <li style="margin-bottom: 8px;"><font face="Georgia, serif" size="3">Enter a Session ID and select a regional language from the dropdown menu (e.g. <b>Hindi (hi-IN)</b> or <b>Tamil (ta-IN)</b>).</font></li>
        <li style="margin-bottom: 8px;"><font face="Georgia, serif" size="3">Point out the active <b>Subject / Officer turn-taking toggle</b>. Set Speaking: <b>SUBJECT</b>.</font></li>
        <li style="margin-bottom: 0;"><font face="Georgia, serif" size="3">Click <b>Accept & Start Analysis</b>.</font></li>
      </ul>

      <p style="margin-top: 25px; margin-bottom: 5px;"><font face="Times New Roman, serif" size="4.5"><b>2. Show 60s Calibration Sequence</b></font></p>
      <ul style="margin-top: 5px; margin-bottom: 20px; margin-left: 15px; padding-left: 0;">
        <li style="margin-bottom: 8px;"><font face="Georgia, serif" size="3">On the dashboard, point out the **BASELINE WINDOW STATUS** card.</font></li>
        <li style="margin-bottom: 8px;"><font face="Georgia, serif" size="3">Show the calibration progress bar. SANKET gathers baseline physiological values for exactly **60 seconds**.</font></li>
        <li style="margin-bottom: 8px;"><font face="Georgia, serif" size="3">During these 60 seconds, the explainability attributions box displays: <i>"Baseline collection in progress."</i></font></li>
        <li style="margin-bottom: 0;"><font face="Georgia, serif" size="3">Observe that **after exactly 60 seconds**, the baseline completes, and the UI dynamically clears out the attribution label to show a clean dashboard.</font></li>
      </ul>

      <p style="margin-top: 25px; margin-bottom: 5px;"><font face="Times New Roman, serif" size="4.5"><b>3. Demonstrate Dialect Persistence</b></font></p>
      <ul style="margin-top: 5px; margin-bottom: 20px; margin-left: 15px; padding-left: 0;">
        <li style="margin-bottom: 0;"><font face="Georgia, serif" size="3">Submit or speak regional utterances. Demonstrate that the live transcript blocks **dynamically preserve their specific language tags (e.g. <code>[Subject] (Hindi)</code>)** rather than defaulting back to English.</font></li>
      </ul>

      <p style="margin-top: 25px; margin-bottom: 5px;"><font face="Times New Roman, serif" size="4.5"><b>4. Demonstrate Turn-Taking & Officer Immunity</b></font></p>
      <ul style="margin-top: 5px; margin-bottom: 0; margin-left: 15px; padding-left: 0;">
        <li style="margin-bottom: 8px;"><font face="Georgia, serif" size="3">Toggle the turn-taking switch to **Speaking: OFFICER**.</font></li>
        <li style="margin-bottom: 8px;"><font face="Georgia, serif" size="3">Speak or submit an utterance that opposes a previous subject statement (e.g. location or timing).</font></li>
        <li style="margin-bottom: 0;"><font face="Georgia, serif" size="3">Show the **Officer's immunity**: the card is styled in grey, and the backend completely bypasses NLI checks, ensuring investigator questioning never triggers self-contradiction alerts.</font></li>
      </ul>
    </td>
    <td width="45%" bgcolor="#F2F2F0" style="padding: 20px; vertical-align: top;">
      <p style="margin-top: 0;"><font face="Times New Roman, serif" size="5"><b>🛡️ Programmatic Test Gauntlets</b></font></p>
      <hr size="1" color="#111111" style="background-color: #111111; height: 1px; border: none; margin-bottom: 15px;">
      <p style="margin-bottom: 20px;"><font face="Georgia, serif" size="3">SANKET is evaluated against three core verification tracks to prevent false alarms:</font></p>
      
      <p style="margin-top: 20px; margin-bottom: 5px;"><font face="Helvetica, Arial, sans-serif" size="2.5"><b>Gauntlet A: Echo/Incremental ASR Filter</b></font></p>
      <p style="margin-top: 5px; margin-bottom: 20px;"><font face="Georgia, serif" size="2.5">Submit two highly similar, incremental speech segments (e.g., <i>"I voice eating my lunch"</i> and <i>"I was eating my lunch"</i>). SANKET computes the raw LaBSE cosine similarity, and because the similarity exceeds **0.90**, it filters out the second segment as an incremental whisper correction instead of triggering a contradiction.</font></p>

      <p style="margin-top: 20px; margin-bottom: 5px;"><font face="Helvetica, Arial, sans-serif" size="2.5"><b>Gauntlet B: Multilingual Social Keywords</b></font></p>
      <p style="margin-top: 5px; margin-bottom: 20px;"><font face="Georgia, serif" size="2.5">Submit a statement claiming the subject was alone using a regional keyword (e.g., <i>"मैं बिल्कुल <b>अकेला</b> था"</i> - alone). Next, submit a statement claiming children or family were present (e.g., <i>"मेरे <b>बच्चे</b> भी वहां थे"</i> - kids). SANKET matches these terms to its expanded multilingual dictionary and instantly flags a social context mismatch contradiction.</font></p>

      <p style="margin-top: 20px; margin-bottom: 5px;"><font face="Helvetica, Arial, sans-serif" size="2.5"><b>Gauntlet C: Automated Dossier PDF</b></font></p>
      <p style="margin-top: 5px; margin-bottom: 10px;"><font face="Georgia, serif" size="2.5">Click <b>END INTERVIEW & GET REPORT</b> to compile the ReportLab dossier:</font></p>
      <ul style="margin-left: 15px; padding-left: 0; margin-bottom: 0;">
        <li style="margin-bottom: 8px;"><font face="Georgia, serif" size="2.2"><b>Newsprint Styling</b>: Flat monochromatic layout with 0 corner radii, solid black table gridlines, and Times-Bold serif article headers on a soft off-white canvas <code>#F9F9F7</code>.</font></li>
        <li style="margin-bottom: 8px;"><font face="Georgia, serif" size="2.2"><b>Query Isolation</b>: Every query in <code>@app.get("/report")</code> (including the signed audit log chain) is isolated strictly by <code>session_id</code>.</font></li>
        <li style="margin-bottom: 8px;"><font face="Georgia, serif" size="2.2"><b>Live Session Aggregates</b>: Displays genuine averages of heart rate and maximum brow furrow mapped to the exact timestamps of utterances spoken under each discussion topic.</font></li>
        <li style="margin-bottom: 0;"><font face="Georgia, serif" size="2.2"><b>Accents</b>: High-contrast dark red (<code>#CC0000</code>) is reserved exclusively for confirmed contradictions.</font></li>
      </ul>
    </td>
  </tr>
</table>

<table width="100%" bgcolor="#FFF5F5" border="2" bordercolor="#CC0000" cellpadding="15" cellspacing="0" style="border: 2px dashed #CC0000; border-collapse: collapse; margin-bottom: 20px;">
  <tr>
    <td style="padding: 20px;">
      <p style="margin-top: 0; margin-bottom: 0;"><font face="Times New Roman, serif" size="4" color="#CC0000"><b>⚠️ LIVE TELEMETRY STREAMING COMMANDS</b></font></p>
      <p style="margin-top: 10px; margin-bottom: 0; text-align: justify;"><font face="Georgia, serif" size="3" color="#111111">To feed live data into the evaluation session, open separate terminal windows and execute the mock streaming scripts in the workspace root:</font></p>
    </td>
  </tr>
</table>

```bash
# Terminal 1: Mock Forehead ROI Video & rPPG Ingestion
python project_sanket/scripts/mock_video.py --stream-api --session-id evaluation_session_001 --url http://localhost:8001/frame

# Terminal 2: Mock Audio Ingestion (Transcripts & Pitch)
python project_sanket/scripts/mock_audio.py --stream-api --session-id evaluation_session_001 --url http://localhost:8001/audio
```

<table width="100%" bgcolor="#F9F9F7" border="1" bordercolor="#111111" cellpadding="15" cellspacing="0" style="border: 1px solid #111111; border-collapse: collapse; margin-bottom: 20px;">
  <tr>
    <td style="padding: 20px;">
      <p style="margin-top: 0;"><font face="Times New Roman, serif" size="5"><b>🛠️ Troubleshooting Stack Crashes</b></font></p>
      <hr size="1" color="#111111" style="background-color: #111111; height: 1px; border: none; margin-bottom: 15px;">
      <ul style="margin-left: 15px; padding-left: 0; margin-bottom: 0;">
        <li style="margin-bottom: 10px;"><font face="Georgia, serif" size="3"><b>Exited Backend Container</b>: If the backend container fails to launch, check crash logs with <code>docker compose logs backend</code>. Check for local port collisions on <code>8000</code> or <code>8001</code>.</font></li>
        <li style="margin-bottom: 0;"><font face="Georgia, serif" size="3"><b>Out of Disk Space</b>: Clear cached layers and volumes with <code>docker system prune -a --volumes</code>, and then build cleanly: <code>docker compose build --no-cache backend</code>.</font></li>
      </ul>
    </td>
  </tr>
</table>

<table width="100%" bgcolor="#F9F9F7" border="1" bordercolor="#111111" cellpadding="15" cellspacing="0" style="border: 1px solid #111111; border-collapse: collapse; margin-bottom: 20px;">
  <tr>
    <td style="padding: 20px;">
      <p style="margin-top: 0;"><font face="Times New Roman, serif" size="5"><b>📰 Newsprint HTML Blueprint Reference</b></font></p>
      <hr size="1" color="#111111" style="background-color: #111111; height: 1px; border: none; margin-bottom: 15px;">
      <p style="margin-bottom: 0;"><font face="Georgia, serif" size="3">To display consistent layout styling on GitHub without rendering conflicts, the document structure relies on plain &lt;table&gt;, &lt;tr&gt;, &lt;td&gt;, and &lt;hr&gt; elements with explicit inline styles. Use the following blueprint template for custom sections:</font></p>
    </td>
  </tr>
</table>

```html
<table width="100%" bgcolor="#F9F9F7" border="1" bordercolor="#111111" cellpadding="15" cellspacing="0" style="border: 1px solid #111111; border-collapse: collapse; margin-bottom: 20px;">
  <tr>
    <td style="padding: 20px;">
      <p style="margin-top: 0;"><font face="Times New Roman, serif" size="5"><b>Section Heading</b></font></p>
      <hr size="1" color="#111111" style="background-color: #111111; height: 1px; border: none; margin-bottom: 15px;">
      <p style="margin-bottom: 0;"><font face="Georgia, serif" size="3">Your editorial text here.</font></p>
    </td>
  </tr>
</table>
```
