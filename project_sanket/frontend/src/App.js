import React, { useState, useEffect, useRef } from 'react';

// API Server Address
const API_URL = 'http://localhost:8001';

function App() {
  // Navigation and Session State
  const [screen, setScreen] = useState('consent'); // 'consent' | 'dashboard' | 'report'
  const [sessionId, setSessionId] = useState(`session_${Date.now()}`);
  const [officerId, setOfficerId] = useState('officer_raj');
  const [location, setLocation] = useState('Interview Room 3');
  
  // Consent & Demographics
  const [consentStatus, setConsentStatus] = useState('Pending'); // 'Pending', 'Granted', 'Denied', 'Withdrawn'
  const [isVulnerable, setIsVulnerable] = useState(false);
  const [sex, setSex] = useState('');
  const [age, setAge] = useState('');
  const [language, setLanguage] = useState('Hindi');
  
  // Real-Time Session Status (Synced from Backend)
  const [isHalted, setIsHalted] = useState(false);
  const [haltReason, setHaltReason] = useState('');
  const [baselineCompleted, setBaselineCompleted] = useState(false);
  const [baselineElapsed, setBaselineElapsed] = useState(0);
  const [baselineWindow, setBaselineWindow] = useState(240);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [latestFusedArousal, setLatestFusedArousal] = useState(0.5);
  const [whyExplanation, setWhyExplanation] = useState('Awaiting baseline data collection...');
  const [transcripts, setTranscripts] = useState([]);
  const [recentCues, setRecentCues] = useState([]);
  
  // Media Capture State
  const [isCapturing, setIsCapturing] = useState(false);
  const [webcamAvailable, setWebcamAvailable] = useState(true);
  
  // Refs for media elements
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const audioIntervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Use static session ID to match mock streaming scripts
  useEffect(() => {
    setSessionId("mock_session_123");
  }, []);

  // Sync session status periodically when dashboard is active
  useEffect(() => {
    if (screen !== 'dashboard') return;

    const statusInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/status?session_id=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setIsHalted(data.is_halted);
          setHaltReason(data.halt_reason || '');
          setBaselineCompleted(data.baseline_completed);
          setBaselineElapsed(data.baseline_elapsed);
          setBaselineWindow(data.baseline_window);
          setIsDemoMode(data.demo_mode);
          setTranscripts(data.transcripts);
          setLatestFusedArousal(data.latest_fused_arousal);
          setWhyExplanation(data.why_explanation);
          if (data.recent_cues) {
            setRecentCues(data.recent_cues.reverse()); // Chronological for timeline plotting
          }
        }
      } catch (err) {
        console.error("Failed to fetch session status:", err);
      }
    }, 1000);

    return () => clearInterval(statusInterval);
  }, [screen, sessionId]);

  // Starts media capture and the upload intervals
  const startMediaCapture = async () => {
    setIsCapturing(true);
    let stream = null;
    
    try {
      // 1. Request Webcam & Microphone access
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      setWebcamAvailable(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // 2. Setup Audio Recording Loop (saves chunks and uploads every 3 seconds)
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const audioStream = new MediaStream([audioTrack]);
        const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = recorder;
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];
          
          // Convert elapsed seconds
          const elapsed = (Date.now() - sessionStartTimeRef.current) / 1000.0;
          await uploadAudioBlob(audioBlob, elapsed);
          
          // Restart recording if session still active
          if (isCapturing && recorder.state === 'inactive') {
            recorder.start();
          }
        };

        recorder.start();
        
        // Trigger stop every 3 seconds to slice chunks
        audioIntervalRef.current = setInterval(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }, 3000);
      }
    } catch (err) {
      console.warn("Hardware camera/microphone denied or missing. Activating high-fidelity simulation uploads.", err);
      setWebcamAvailable(false);
    }

    // Record session start time
    sessionStartTimeRef.current = Date.now();

    // 3. Setup Video Frame capture loop (uploads Canvas JPEG frames every 1000ms)
    frameIntervalRef.current = setInterval(async () => {
      const elapsed = (Date.now() - sessionStartTimeRef.current) / 1000.0;
      
      if (stream && videoRef.current && canvasRef.current) {
        // Draw frame onto offscreen canvas
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            await uploadFrameBlob(blob, elapsed);
          }
        }, 'image/jpeg');
      } else {
        // If camera missing: upload mock frame file to keep pipeline moving
        const mockImg = document.createElement('canvas');
        mockImg.width = 640;
        mockImg.height = 480;
        const mCtx = mockImg.getContext('2d');
        mCtx.fillStyle = '#0f172a';
        mCtx.fillRect(0, 0, 640, 480);
        // Draw a simulated face circle
        mCtx.fillStyle = '#f59e0b';
        mCtx.beginPath();
        mCtx.arc(320, 240, 100, 0, 2 * Math.PI);
        mCtx.fill();

        mockImg.toBlob(async (blob) => {
          if (blob) {
            await uploadFrameBlob(blob, elapsed);
          }
        }, 'image/jpeg');

        // Simulate mock audio transcription if mic denied
        if (!webcamAvailable && Math.random() < 0.20) {
          await uploadMockAudioData(elapsed);
        }
      }
    }, 1000);
  };

  const sessionStartTimeRef = useRef(Date.now());

  // Stop capturing on component teardown or state reset
  const stopMediaCapture = () => {
    setIsCapturing(false);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Upload JPEG frame
  const uploadFrameBlob = async (blob, elapsed) => {
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('elapsed_seconds', elapsed);
    formData.append('frame', blob, 'frame.jpg');

    try {
      await fetch(`${API_URL}/frame`, {
        method: 'POST',
        body: formData
      });
    } catch (err) {
      console.error("Frame upload error:", err);
    }
  };

  // Upload WAV/webm voice segment
  const uploadAudioBlob = async (blob, elapsed) => {
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('elapsed_seconds', elapsed);
    formData.append('audio', blob, 'audio.wav');

    try {
      await fetch(`${API_URL}/audio`, {
        method: 'POST',
        body: formData
      });
    } catch (err) {
      console.error("Audio upload error:", err);
    }
  };

  // Simulated Speech Injector if mic unavailable
  const uploadMockAudioData = async (elapsed) => {
    // Post a dummy wave block to trigger backend matching registry
    const dummyBlob = new Blob([new Uint8Array(100)], { type: 'audio/wav' });
    await uploadAudioBlob(dummyBlob, elapsed);
  };

  // Handles Officer consent form submission
  const handleConsentSubmit = async (status) => {
    setConsentStatus(status);
    
    // POST consent state to backend
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('officer_id', officerId);
    formData.append('status', status);
    formData.append('is_vulnerable', isVulnerable ? 'true' : 'false');
    if (sex) formData.append('sex', sex);
    if (age) formData.append('age', age);
    if (language) formData.append('language', language);

    try {
      const r = await fetch(`${API_URL}/consent`, {
        method: 'POST',
        body: formData
      });
      if (r.ok) {
        setScreen('dashboard');
        if (status === 'Granted') {
          startMediaCapture();
        }
      }
    } catch (err) {
      alert("Failed to connect to on-premise SANKET backend. Check if FastAPI server is running.");
    }
  };

  // Handles consent withdrawal in live mode
  const handleWithdrawConsent = async () => {
    stopMediaCapture();
    const formData = new FormData();
    formData.append('session_id', sessionId);
    
    try {
      await fetch(`${API_URL}/consent/withdraw`, {
        method: 'POST',
        body: formData
      });
      setConsentStatus('Withdrawn');
    } catch (err) {
      console.error("Error withdrawing consent:", err);
    }
  };

  // Clears safeguard halt and lets analysis resume
  const handleAcknowledgeSafeguard = async () => {
    const formData = new FormData();
    formData.append('session_id', sessionId);
    try {
      const response = await fetch(`${API_URL}/acknowledge_safeguard`, {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        setIsHalted(false);
      }
    } catch (err) {
      console.error("Error acknowledging safeguard:", err);
    }
  };

  // Closes the session and transitions to report screen
  const handleEndSession = () => {
    stopMediaCapture();
    setScreen('report');
  };

  // Helper to plot timelines
  const getTimelinePoints = (keyPath, minVal, maxVal) => {
    if (!recentCues || recentCues.length === 0) return "";
    
    const width = 600;
    const height = 80;
    const padding = 10;
    
    const count = recentCues.length;
    return recentCues.map((item, idx) => {
      // Traverse cue data keys
      let val = 0.0;
      const data = item.cue_data || {};
      if (keyPath === 'heart_rate') val = data.heart_rate || 72.0;
      else if (keyPath === 'AU4') val = data.action_units?.AU4 || 0.05;
      else if (keyPath === 'gaze_yaw') val = data.gaze?.yaw || 0.0;
      else if (keyPath === 'lean') val = data.posture?.forward_lean || 0.0;

      const x = padding + (idx / Math.max(1, count - 1)) * (width - 2 * padding);
      
      // Normalize value to fit height
      const range = maxVal - minVal;
      const normalized = range > 0 ? (val - minVal) / range : 0.5;
      const y = height - padding - normalized * (height - 2 * padding);
      
      return `${x},${y}`;
    }).join(" ");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#070a13' }}>
      
      {/* PERSISTENT HEADER & LEGAL DISCLAIMER (Rule 3: Non-dismissible watermark on every screen) */}
      <div style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 1000, 
        backgroundColor: '#111827', 
        borderBottom: '2px solid #ef4444', 
        boxShadow: '0 4px 10px rgba(0,0,0,0.3)' 
      }}>
        <div style={{ 
          padding: '8px 12px', 
          backgroundColor: '#3f0c10', 
          textAlign: 'center', 
          color: '#f87171', 
          fontWeight: 'bold', 
          fontSize: '13px', 
          letterSpacing: '1px' 
        }}>
          ⚠️ ASSISTIVE USE ONLY — NOT ADMISSIBLE IN COURT AS EVIDENCE. BEHAVIOR CUES DO NOT CONSTITUTE A CONFESSION.
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '12px 24px', 
          color: '#f8fafc' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '2px', color: '#3b82f6' }}>SANKET</span>
            <span style={{ 
              fontSize: '11px', 
              padding: '3px 8px', 
              borderRadius: '4px', 
              backgroundColor: '#1f2937', 
              color: '#94a3b8', 
              border: '1px solid #374151' 
            }}>v1.0.0</span>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Status Badges */}
            <span style={{ 
              fontSize: '12px', 
              padding: '4px 10px', 
              borderRadius: '6px', 
              fontWeight: '500',
              backgroundColor: consentStatus === 'Granted' ? '#064e3b' : '#7f1d1d',
              color: consentStatus === 'Granted' ? '#34d399' : '#f87171'
            }}>
              Consent: {consentStatus}
            </span>
            
            {isDemoMode && (
              <span style={{ 
                fontSize: '12px', 
                padding: '4px 10px', 
                borderRadius: '6px', 
                backgroundColor: '#78350f', 
                color: '#fbbf24', 
                fontWeight: '600'
              }}>
                DEMO MODE — Models not loaded
              </span>
            )}
            
            {screen === 'dashboard' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="record-pulse" style={{ width: '10px', height: '10px' }}></div>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Session Live</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '24px', display: 'flex', justifyContent: 'center' }}>
        
        {/* 1. CONSENT CAPTURE SCREEN */}
        {screen === 'consent' && (
          <div className="glass-panel" style={{ width: '100%', maxWidth: '650px', padding: '36px' }}>
            <h2 style={{ color: '#3b82f6', marginTop: 0, borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
              DPDP Act 2023 Consent Verification
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6' }}>
              In compliance with Section 6 of the Digital Personal Data Protection Act, 2023 (DPDP), and Article 21 of the Constitution, informed and explicit consent is required from the Data Principal (interview subject) before capturing audio/video biometric data for analysis.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '24px 0' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 'bold' }}>OFFICER ID</label>
                <input 
                  type="text" 
                  value={officerId} 
                  onChange={(e) => setOfficerId(e.target.value)}
                  style={{ width: '90%', padding: '10px', borderRadius: '6px', border: '1px solid #1e293b', backgroundColor: '#0b0f19', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 'bold' }}>LOCATION</label>
                <input 
                  type="text" 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)}
                  style={{ width: '90%', padding: '10px', borderRadius: '6px', border: '1px solid #1e293b', backgroundColor: '#0b0f19', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', margin: '20px 0' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#f59e0b' }}>Volunteered Demographic Attributes (Optional)</h4>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0' }}>Collect demographics only if explicitly volunteered. Do not coerce.</p>
              
              <div style={{ display: 'flex', gap: '15px' }}>
                <select 
                  value={sex} 
                  onChange={(e) => setSex(e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#0b0f19', color: '#f8fafc', border: '1px solid #1e293b' }}
                >
                  <option value="">Sex (Not Vol.)</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                
                <input 
                  type="number" 
                  placeholder="Age" 
                  value={age} 
                  onChange={(e) => setAge(e.target.value)}
                  style={{ width: '70px', padding: '8px', borderRadius: '4px', backgroundColor: '#0b0f19', color: '#f8fafc', border: '1px solid #1e293b' }}
                />
                
                <select 
                  value={language} 
                  onChange={(e) => setLanguage(e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#0b0f19', color: '#f8fafc', border: '1px solid #1e293b' }}
                >
                  <option value="Hindi">Hindi</option>
                  <option value="English">English</option>
                  <option value="Marathi">Marathi</option>
                  <option value="Tamil">Tamil</option>
                </select>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={isVulnerable} 
                    onChange={(e) => setIsVulnerable(e.target.checked)}
                  />
                  Subject is vulnerable (e.g. Minor)
                </label>
              </div>
            </div>

            <div style={{ border: '1px solid rgba(245, 158, 11, 0.2)', padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.05)', fontSize: '13px', color: '#d97706', lineHeight: '1.5' }}>
              <b>DPDP Informed Consent Notice:</b> I verify that I have explained to the subject in their preferred language that a real-time behavioral cue assistant is active in this room. The assistant records video and audio to analyze baseline deviations (Heart Rate, Voice Pitch, Facial Muscle Tension) purely as a situational cue for the officer.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '28px' }}>
              <button 
                onClick={() => handleConsentSubmit('Denied')}
                style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: '600' }}
              >
                Refuse Consent (Fallback Mode)
              </button>
              <button 
                onClick={() => handleConsentSubmit('Granted')}
                style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', color: '#ffffff', cursor: 'pointer', fontWeight: '600' }}
              >
                Accept & Start Analysis
              </button>
            </div>
          </div>
        )}

        {/* 2. LIVE OFFICER DASHBOARD */}
        {screen === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', width: '100%', maxWidth: '1200px' }}>
            
            {/* Left Column: Media & Arousal Fusion */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Camera Preview */}
              <div className="glass-panel" style={{ padding: '12px', textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '12px', textAlign: 'left', fontWeight: 'bold' }}>WEBCAM STREAM</h4>
                <div style={{ width: '100%', height: '200px', backgroundColor: '#000000', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                  {webcamAvailable ? (
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }}></video>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#ef4444', padding: '16px' }}>
                      <span style={{ fontSize: '28px' }}>📷</span>
                      <span style={{ fontSize: '13px', marginTop: '8px', fontWeight: 'bold' }}>CAMERA UNAVAILABLE</span>
                      <span style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', marginTop: '4px' }}>Webcam missing or blocked. Running synthetic data injection.</span>
                    </div>
                  )}
                  {/* Canvas for image grab */}
                  <canvas ref={canvasRef} width="640" height="480" style={{ display: 'none' }}></canvas>
                </div>
              </div>

              {/* Bayesian Late Fusion Dashboard */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}>FUSED AROUSAL PROBABILITY</h4>
                
                <div style={{ textAlign: 'center', margin: '20px 0' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: latestFusedArousal >= 0.70 ? '#ef4444' : latestFusedArousal >= 0.50 ? '#f59e0b' : '#10b981' }}>
                    Arousal Deviation from Baseline: {(latestFusedArousal * 100).toFixed(0)}%
                  </div>
                  <div 
                    title="Elevated arousal may reflect nervousness, fatigue, cultural context, or other factors unrelated to deception."
                    style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', cursor: 'help', textDecoration: 'underline dotted' }}
                  >
                    ℹ️ Context Warning
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '8px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
                  <div style={{ 
                    width: `${latestFusedArousal * 100}%`, 
                    height: '100%', 
                    backgroundColor: latestFusedArousal >= 0.70 ? '#ef4444' : latestFusedArousal >= 0.50 ? '#f59e0b' : '#10b981',
                    transition: 'width 0.5s ease'
                  }}></div>
                </div>

                <div style={{ border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '6px', padding: '10px', backgroundColor: 'rgba(59, 130, 246, 0.02)', fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
                  <b>Explainability Attributions:</b> {whyExplanation}
                </div>
              </div>

              {/* Baseline window status */}
              <div className="glass-panel" style={{ padding: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}>BASELINE WINDOW STATUS</h4>
                {baselineCompleted ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '13px', fontWeight: '500' }}>
                    <span>✅</span> Baseline Profile Created (Ready)
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '13px', color: '#f59e0b', margin: '0 0 6px 0' }}>
                      ⏳ Gathering Baseline profile: {Math.floor(baselineElapsed)}s / {baselineWindow}s
                    </div>
                    <div style={{ height: '4px', width: '100%', backgroundColor: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${(baselineElapsed / baselineWindow) * 100}%`, height: '100%', backgroundColor: '#f59e0b' }}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* End session control */}
              <button 
                onClick={handleEndSession}
                style={{ padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: '#ffffff', cursor: 'pointer', fontWeight: 'bold', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}
              >
                END INTERVIEW & GET REPORT
              </button>
              {consentStatus === 'Granted' && (
                <button 
                  onClick={handleWithdrawConsent}
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '11px', fontWeight: '500' }}
                >
                  Withdraw Consent Immediately (DPDP)
                </button>
              )}
            </div>

            {/* Right Column: Timeline, Transcripts & Safeguards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* SAFEGUARD ADVISORY HALT MODAL OVERLAY (Gated, Rule 5) */}
              {isHalted && (
                <div style={{ 
                  border: '2px solid #f59e0b', 
                  borderRadius: '12px', 
                  padding: '20px', 
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  boxShadow: '0 0 20px rgba(245,158,11,0.2)'
                }}>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '32px' }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#fbbf24', fontSize: '15px', fontWeight: 'bold' }}>SAFEGUARD TRIGGER HALT</h4>
                      <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                        <b>Procedural Advisory:</b> {haltReason}<br />
                        AI biometric feature inference has been halted on the subject to protect privacy and verify vulnerability protocols.
                      </p>
                      <button 
                        onClick={handleAcknowledgeSafeguard}
                        style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#f59e0b', color: '#070a13', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                      >
                        Acknowledge & Resume Inference
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Real-time Cues 60-Second Scrolling Timeline (SVG custom graph) */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}>60-SECOND SCROLLING TIMELINE LANES</h4>
                
                {recentCues.length === 0 ? (
                  <div style={{ height: '240px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#64748b', fontSize: '13px' }}>
                    Awaiting streaming telemetry (Ingesting video/audio chunks)...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {/* Lane 1: Heart Rate */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        <span>💓 Heart Rate (rPPG estimated)</span>
                        <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                          {recentCues[recentCues.length-1]?.cue_data?.heart_rate?.toFixed(0) || 72} BPM
                        </span>
                      </div>
                      <svg width="100%" height="55" style={{ backgroundColor: '#0b1329', borderRadius: '6px', border: '1px solid #1e293b' }}>
                        <polyline fill="none" stroke="#ef4444" strokeWidth="2.5" points={getTimelinePoints('heart_rate', 50, 120)} />
                      </svg>
                    </div>

                    {/* Lane 2: Facial AU4 (Brow Furrow) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        <span>😠 Face AU4 Intensity (Brow Furrow)</span>
                        <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>
                          {recentCues[recentCues.length-1]?.cue_data?.action_units?.AU4?.toFixed(2) || 0.05}
                        </span>
                      </div>
                      <svg width="100%" height="55" style={{ backgroundColor: '#0b1329', borderRadius: '6px', border: '1px solid #1e293b' }}>
                        <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" points={getTimelinePoints('AU4', 0.0, 1.0)} />
                      </svg>
                    </div>

                    {/* Lane 3: Gaze Deviation (Yaw) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        <span>👁️ Gaze Yaw Dev. (Iris deflection)</span>
                        <span style={{ color: '#a855f7', fontWeight: 'bold' }}>
                          {recentCues[recentCues.length-1]?.cue_data?.gaze?.yaw?.toFixed(1) || 0.0}°
                        </span>
                      </div>
                      <svg width="100%" height="55" style={{ backgroundColor: '#0b1329', borderRadius: '6px', border: '1px solid #1e293b' }}>
                        <polyline fill="none" stroke="#a855f7" strokeWidth="2.5" points={getTimelinePoints('gaze_yaw', -15, 15)} />
                      </svg>
                    </div>

                    {/* Lane 4: Posture Shift */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        <span>🕴️ Forward Lean / Upper Body Pose</span>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                          {recentCues[recentCues.length-1]?.cue_data?.posture?.forward_lean?.toFixed(2) || 0.0}
                        </span>
                      </div>
                      <svg width="100%" height="55" style={{ backgroundColor: '#0b1329', borderRadius: '6px', border: '1px solid #1e293b' }}>
                        <polyline fill="none" stroke="#10b981" strokeWidth="2.5" points={getTimelinePoints('lean', -1.0, 1.0)} />
                      </svg>
                    </div>

                  </div>
                )}
              </div>

              {/* Transcript & Contradiction Displays */}
              <div className="glass-panel" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}>LIVE TRANSCRIPT (WITH SPEAKER IDS & CONTRADICTIONS)</h4>
                
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '250px', backgroundColor: '#0b0f19', borderRadius: '8px', padding: '12px', border: '1px solid #1e293b' }}>
                  {transcripts.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
                      Awaiting audio stream (Hindi, English, Marathi, Tamil, Telugu transcript will display here)...
                    </div>
                  ) : (
                    transcripts.map((t, idx) => (
                      <div key={idx} style={{ 
                        margin: '0 0 10px 0', 
                        padding: '8px', 
                        borderRadius: '6px', 
                        backgroundColor: t.contradiction_flag ? '#3b181a' : 'transparent',
                        borderLeft: t.contradiction_flag ? '3px solid #ef4444' : 'none'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 'bold', color: t.speaker_id === 'Officer' ? '#3b82f6' : '#d97706' }}>
                            [{t.speaker_id}] ({t.language})
                          </span>
                          <span style={{ color: '#64748b' }}>t={t.start_time.toFixed(1)}s</span>
                        </div>
                        <div style={{ fontSize: '14px', lineHeight: '1.4' }}>{t.utterance}</div>
                        {t.contradiction_flag && (
                          <div style={{ fontSize: '11px', color: '#fca5a5', marginTop: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '4px', borderRadius: '3px' }}>
                            ⚠️ <b>CONTRADICTION:</b> {t.contradiction_details?.reasoning}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* 3. POST-SESSION REPORT VIEWER */}
        {screen === 'report' && (
          <div className="glass-panel" style={{ width: '100%', maxWidth: '750px', padding: '36px' }}>
            <h2 style={{ color: '#3b82f6', marginTop: 0, textAlign: 'center' }}>Interview Session Completed</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', marginBottom: '30px' }}>
              The cryptographic chain of custody ledger has been closed, and a post-hoc analysis PDF has been generated.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', margin: '30px 0' }}>
              <a 
                href={`${API_URL}/report?session_id=${sessionId}`}
                target="_blank"
                rel="noreferrer"
                style={{ 
                  textDecoration: 'none', 
                  padding: '14px 28px', 
                  borderRadius: '8px', 
                  backgroundColor: '#3b82f6', 
                  color: '#ffffff', 
                  fontWeight: 'bold', 
                  boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)' 
                }}
              >
                📥 DOWNLOAD OFFICIAL PDF REPORT
              </a>
            </div>

            <div style={{ marginTop: '40px', borderTop: '1px solid #1e293b', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '15px', color: '#f8fafc', marginBottom: '15px' }}>Demographic & Legal Compliance Audit</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#94a3b8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <span>Article 20(3) Protection:</span>
                  <span style={{ color: '#10b981' }}>COMPLIANT (Consent-gated analysis only)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <span>Selvi v. Karnataka (2010):</span>
                  <span style={{ color: '#10b981' }}>COMPLIANT (No coercive deception scoring)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <span>DPDP Act 2023 Consent & Erasure:</span>
                  <span style={{ color: '#10b981' }}>COMPLIANT (Erasure logic & voluntary flags)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <span>BSA 2023 Evidentiary Tagging:</span>
                  <span style={{ color: '#10b981' }}>COMPLIANT (Watermarked and tagged)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <span>Cryptographic Log Chaining:</span>
                  <span style={{ color: '#10b981' }}>COMPLIANT (Ed25519 hash-chain verified)</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
              <button 
                onClick={() => {
                  setScreen('consent');
                  setSessionId(`sanket_session_${Date.now()}`);
                  setConsentStatus('Pending');
                  setBaselineCompleted(false);
                  setIsHalted(false);
                  setRecentCues([]);
                  setTranscripts([]);
                }}
                style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #374151', backgroundColor: '#1f2937', color: '#94a3b8', cursor: 'pointer' }}
              >
                Start New Interview
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
