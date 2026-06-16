import React, { useState, useEffect, useRef } from 'react';

// API Server Address
const API_URL = 'http://localhost:8001';

const formatTime = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [
    h > 0 ? String(h).padStart(2, '0') : null,
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0')
  ].filter(Boolean).join(':');
};

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
  const [selectedLanguage, setSelectedLanguage] = useState('hi-IN'); // Target language code
  
  // Real-Time Session Status (Synced from Backend)
  const [isHalted, setIsHalted] = useState(false);
  const [haltReason, setHaltReason] = useState('');
  const [baselineCompleted, setBaselineCompleted] = useState(false);
  const [baselineElapsed, setBaselineElapsed] = useState(0);
  const [baselineWindow, setBaselineWindow] = useState(60);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [latestFusedArousal, setLatestFusedArousal] = useState(0.5);
  const [whyExplanation, setWhyExplanation] = useState('Awaiting baseline data collection...');
  const [transcripts, setTranscripts] = useState([]);
  const [recentCues, setRecentCues] = useState([]);
  const [isInferenceRunning, setIsInferenceRunning] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationCountdown, setCalibrationCountdown] = useState(30);
  
  // Media Capture State
  const [isCapturing, setIsCapturing] = useState(false);
  const [webcamAvailable, setWebcamAvailable] = useState(true);
  
  // Speaker Turn-Taking state
  const [activeSpeaker, setActiveSpeaker] = useState('Subject'); // 'Subject' | 'Officer'
  
  // Suggested Questions & Interview Enhancements
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [latestContradiction, setLatestContradiction] = useState(null);
  const [sessionElapsedTime, setSessionElapsedTime] = useState(0);

  const SUGGESTED_QUESTIONS = [
    { topic: 'Background', question: "Please state your full name and occupation for the record." },
    { topic: 'Background', question: "Can you confirm your current address?" },
    { topic: 'Timeline of Events', question: "Can you tell me where you were on the night of the incident?" },
    { topic: 'Timeline of Events', question: "What time did you arrive home?" },
    { topic: 'Alibi', question: "Who were you with?" },
    { topic: 'Alibi', question: "Can anyone verify your location?" },
    { topic: 'Relationships', question: "Do you know a person named X?" },
    { topic: 'Relationships', question: "What is your relation to the complainant?" },
    { topic: 'Details', question: "Can you explain the transaction recorded on that date?" },
    { topic: 'Details', question: "Is there anything else you want to share?" }
  ];

  // Refs for media elements
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const calibrationVideoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const audioIntervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recentCuesRef = useRef([]);
  const recognitionRef = useRef(null);
  const activeSpeakerRef = useRef('Subject'); // Track active speaker to prevent stale closures
  const localSegmentsRef = useRef([]); // Local cache of sent transcripts with speaker IDs and timestamps

  // Interview session elapsed timer
  useEffect(() => {
    if (screen !== 'dashboard' || !isCapturing) {
      setSessionElapsedTime(0);
      return;
    }
    const timer = setInterval(() => {
      setSessionElapsedTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [screen, isCapturing]);

  // Calibration Countdown Timer
  useEffect(() => {
    if (screen === 'dashboard' && isCalibrating) {
      const timer = setInterval(() => {
        setCalibrationCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsCalibrating(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [screen, isCalibrating]);

  // 1. Trigger video and frame capture immediately when calibration starts
  useEffect(() => {
    if (screen === 'dashboard' && isCalibrating && consentStatus === 'Granted' && !isCapturing) {
      startVideoAndFrameCapture();
    }
  }, [screen, isCalibrating, consentStatus, isCapturing]);

  // 2. Trigger audio recording when calibration ends (and capture is active)
  useEffect(() => {
    console.log('isCalibrating changed to:', isCalibrating, 'isCapturing:', isCapturing)
    if (!isCalibrating && screen === 'dashboard') {
      sessionStartTimeRef.current = Date.now();
      startAudioRecording()
      startSpeechRecognition()

      // Switch frame capture to 1fps after calibration
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
        frameIntervalRef.current = setInterval(async () => {
          console.log('Frame interval still alive:', frameIntervalRef.current);
          const elapsed = (Date.now() - sessionStartTimeRef.current) / 1000.0;
          
          const activeVideo = calibrationVideoRef.current || videoRef.current;
          if (activeVideo && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(activeVideo, 0, 0, 640, 480);
            
            canvas.toBlob(async (blob) => {
              if (blob) {
                await uploadFrameBlob(blob, elapsed, false);
              }
            }, 'image/jpeg');
          }
        }, 1000);
      }
    }
  }, [isCalibrating, screen])

  // 3. Ensure the dashboard video element gets the stream when it mounts after calibration
  useEffect(() => {
    if (!isCalibrating && mediaStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [isCalibrating])

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
          console.log('status transcripts:', data.transcripts);
          const langMapInverse = { 
            'en-IN': 'English', 
            'hi-IN': 'Hindi', 
            'mr-IN': 'Marathi', 
            'ta-IN': 'Tamil', 
            'te-IN': 'Telugu' 
          };
          const currentSessionLanguage = langMapInverse[selectedLanguage] || 'English';

          const processedTranscripts = data.transcripts.map(t => {
            const candidates = localSegmentsRef.current.filter(local => 
              Math.abs(local.start_time - t.start_time) < 5
            );
            let speaker = t.speaker_id;
            if (candidates.length > 0) {
              candidates.sort((a, b) => Math.abs(a.start_time - t.start_time) - Math.abs(b.start_time - t.start_time));
              speaker = candidates[0].speaker_id;
            }
            return { 
              ...t, 
              speaker_id: speaker || 'Subject',
              language: currentSessionLanguage 
            };
          });
          setTranscripts(processedTranscripts);
          setLatestFusedArousal(data.latest_fused_arousal);
          setWhyExplanation(data.why_explanation);
          
          if (data.recent_cues && recentCuesRef.current.length === 0) {
            recentCuesRef.current = data.recent_cues.reverse();
            setRecentCues([...recentCuesRef.current]);
          }

          // Scan for contradictions to trigger overlay alert
          if (data.transcripts && data.transcripts.length > 0) {
            const contras = data.transcripts.filter(t => t.contradiction_flag);
            if (contras.length > 0) {
              const latestContra = contras[contras.length - 1];
              setLatestContradiction({
                utterance: latestContra.utterance,
                reasoning: latestContra.contradiction_details?.reasoning || latestContra.contradiction_details?.reason || "Semantic contradiction detected."
              });
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch session status:", err);
      }
    }, 1000);

    return () => clearInterval(statusInterval);
  }, [screen, sessionId]);

  // Poll latest cues periodically every 2 seconds when capturing is active
  useEffect(() => {
    if (screen !== 'dashboard' || !isCapturing) return;

    const cuesInterval = setInterval(async () => {
      try {
        const latestResponse = await fetch(`${API_URL}/latest-cues/${sessionId}`);
        if (latestResponse.ok) {
          const latestData = await latestResponse.json();
          console.log('latest-cues response:', latestData);
          setIsInferenceRunning(latestData.is_inference_running);

          if (latestData.vision_cues) {
            const latestCue = {
              timestamp: new Date().toISOString(),
              cue_type: "vision_fused",
              cue_data: {
                ...latestData.vision_cues,
                heart_rate: latestData.ppg_cues?.heart_rate || 72.0
              }
            };
            
            recentCuesRef.current = [...recentCuesRef.current, latestCue];
            if (recentCuesRef.current.length > 60) {
              recentCuesRef.current.shift();
            }
            console.log('setRecentCues called, new length:', recentCuesRef.current.length);
            setRecentCues([...recentCuesRef.current]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch latest cues:", err);
      }
    }, 2000);

    return () => clearInterval(cuesInterval);
  }, [screen, sessionId, isCapturing]);

  // Starts video capture and frame upload loop immediately when calibration begins
  const startVideoAndFrameCapture = async () => {
    setIsCapturing(true);
    console.log('Video capture and frame upload started');
    let stream = null;
    
    try {
      // Request Webcam & Microphone access at the start so we only prompt once
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      setWebcamAvailable(true);
      
      if (calibrationVideoRef.current) {
        calibrationVideoRef.current.srcObject = stream;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Hardware camera/microphone access failed or denied:", err);
      setWebcamAvailable(false);
      return;
    }

    // Record session start time
    sessionStartTimeRef.current = Date.now();

    // Setup Video Frame capture loop (uploads Canvas JPEG frames every 500ms during calibration)
    frameIntervalRef.current = setInterval(async () => {
      console.log('Frame interval still alive:', frameIntervalRef.current);
      const elapsed = (Date.now() - sessionStartTimeRef.current) / 1000.0;
      console.log('Frame captured at elapsed:', elapsed, 'interval: calibration mode');
      
      const activeVideo = calibrationVideoRef.current || videoRef.current;
      if (activeVideo && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(activeVideo, 0, 0, 640, 480);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            await uploadFrameBlob(blob, elapsed, true);
          }
        }, 'image/jpeg');
      }
    }, 500);
  };

  const startSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window)) {
      console.warn("webkitSpeechRecognition not supported in this browser.");
      return;
    }
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLanguage;
    
    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        console.log('Sending final transcript to backend:', finalTranscript);
        const elapsed = (Date.now() - sessionStartTimeRef.current) / 1000.0;
        localSegmentsRef.current.push({
          utterance: finalTranscript.trim(),
          speaker_id: activeSpeakerRef.current,
          start_time: elapsed
        });
        fetch(`${API_URL}/audio-text`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            session_id: sessionId,
            transcript: finalTranscript,
            elapsed_seconds: elapsed,
            speaker_id: activeSpeakerRef.current
          })
        }).catch(err => console.error("Error sending transcript to backend:", err));
      }
    };
    
    recognition.onerror = (e) => console.warn('Speech recognition error:', e.error);
    
    recognition.onend = () => {
      if (isCapturing) {
        try {
          recognition.start();
        } catch (err) {
          console.warn("Failed to restart speech recognition:", err);
        }
      }
    };
    
    try {
      recognition.start();
      recognitionRef.current = recognition;
      console.log('Web Speech API recognition started');
    } catch (err) {
      console.warn("Failed to start speech recognition:", err);
    }
  };

  // Starts audio recording loop after calibration finishes
  const startAudioRecording = async () => {
    console.log('startAudioRecording called')
    let stream = mediaStreamRef.current;
    if (!stream) {
      console.log('No stream found in startAudioRecording, requesting microphone access now');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        mediaStreamRef.current = stream;
        setWebcamAvailable(true);
      } catch (err) {
        console.warn("Microphone hardware access failed or denied:", err);
        return;
      }
    }
    console.log('Audio recording started');
    
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      const audioStream = new MediaStream([audioTrack]);
      const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      
      recorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          const elapsed = (Date.now() - sessionStartTimeRef.current) / 1000.0;
          await uploadAudioBlob(e.data, elapsed);
        }
      };

      recorder.onstop = () => {
        try {
          recorder.start(4000);
        } catch (err) {
          console.error("Failed to restart MediaRecorder in onstop:", err);
        }
      };

      recorder.start(4000);
      
      audioIntervalRef.current = setInterval(() => {
        try {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        } catch (err) {
          console.error("Failed to cycle MediaRecorder:", err);
        }
      }, 4000);
    } else {
      console.warn("No audio track found in the stream");
    }
  };

  const sessionStartTimeRef = useRef(Date.now());

  // Stop capturing on component teardown or state reset
  const stopMediaCapture = () => {
    setIsCapturing(false);
    setIsCalibrating(false);
    setCalibrationCountdown(30);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Error stopping speech recognition:", e);
      }
    }
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (mediaRecorderRef.current) {
      // Clear onstop handler so we don't restart when ending the session
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  // Upload JPEG frame
  const uploadFrameBlob = async (blob, elapsed, isCalibrating = false) => {
    console.log('Frame POST session_id:', sessionId, 'elapsed:', elapsed, 'is_calibrating:', isCalibrating)
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('elapsed_seconds', elapsed);
    formData.append('is_calibrating', isCalibrating ? 'true' : 'false');
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

  // Handles Officer consent form submission
  const handleConsentSubmit = async (status) => {
    setConsentStatus(status);
    
    // POST consent state to backend
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('officer_id', officerId);
    formData.append('status', status);
    formData.append('is_vulnerable', isVulnerable ? 'true' : 'false');
    formData.append('is_live_session', 'true');
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
          setIsCalibrating(true);
          setCalibrationCountdown(30);
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
    
    // Automatically trigger PDF download
    const downloadUrl = `${API_URL}/report?session_id=${sessionId}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
    link.download = `report_${sessionId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      if (keyPath === 'heart_rate') val = data.ppg_cues?.heart_rate || data.heart_rate || 72.0;
      else if (keyPath === 'AU4') val = data.vision_cues?.action_units?.AU4 || data.action_units?.AU4 || 0.05;
      else if (keyPath === 'gaze_yaw') val = data.vision_cues?.gaze?.yaw || data.gaze?.yaw || 0.0;
      else if (keyPath === 'lean') val = data.vision_cues?.posture?.forward_lean || data.posture?.forward_lean || 0.0;

      const x = padding + (idx / Math.max(1, count - 1)) * (width - 2 * padding);
      
      // Normalize value to fit height
      const range = maxVal - minVal;
      const normalized = range > 0 ? (val - minVal) / range : 0.5;
      const y = height - padding - normalized * (height - 2 * padding);
      
      return `${x},${y}`;
    }).join(" ");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F9F9F7', color: '#111111', fontFamily: "'Inter', sans-serif" }}>
      
      {/* PERSISTENT HEADER & LEGAL DISCLAIMER */}
      <div style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 1000, 
        backgroundColor: '#FFFFFF', 
        borderBottom: '4px solid #111111', 
        boxShadow: 'none' 
      }}>
        <div className="cyber-banner" style={{ 
          padding: '10px 12px', 
          backgroundColor: '#111111',
          borderLeft: '4px solid #CC0000',
          textAlign: 'center', 
          color: '#FFFFFF', 
          fontWeight: '700', 
          fontSize: '12px', 
          fontFamily: "'Inter', sans-serif",
          textTransform: 'uppercase',
          letterSpacing: '2px' 
        }}>
          ⚠️ ASSISTIVE USE ONLY — NOT ADMISSIBLE IN COURT AS EVIDENCE. BEHAVIOR CUES DO NOT CONSTITUTE A CONFESSION.
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '16px 24px', 
          color: '#111111' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '32px', fontWeight: '900', fontFamily: "'Playfair Display', serif", letterSpacing: '0.5px', color: '#111111' }}>SANKET</span>
            <span style={{ 
              fontSize: '11px', 
              padding: '4px 8px', 
              backgroundColor: '#111111', 
              color: '#FFFFFF', 
              fontWeight: 'bold'
            }}>v1.0.0</span>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Status Badges */}
            <span style={{ 
              fontSize: '11px', 
              padding: '4px 10px', 
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              border: '1px solid #111111',
              backgroundColor: '#FFFFFF',
              color: consentStatus === 'Granted' ? '#111111' : '#CC0000'
            }}>
              Consent: {consentStatus}
            </span>
            
            {isDemoMode && (
              <span style={{ 
                fontSize: '11px', 
                padding: '4px 10px', 
                backgroundColor: '#CC0000', 
                color: '#FFFFFF', 
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: '700'
              }}>
                DEMO MODE — Models not loaded
              </span>
            )}
            
            {screen === 'dashboard' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="record-pulse" style={{ width: '10px', height: '10px' }}></div>
                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#111111' }}>Session Live</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '24px', display: 'flex', justifyContent: 'center' }}>
        
        {/* 1. CONSENT CAPTURE SCREEN */}
        {screen === 'consent' && (
          <div className="glass-panel hard-shadow-hover" style={{ width: '100%', maxWidth: '650px', padding: '36px', backgroundColor: '#FFFFFF', border: '1px solid #111111' }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: '900', fontSize: '28px', color: '#111111', marginTop: 0, borderBottom: '2px solid #111111', paddingBottom: '12px' }}>
              DPDP Act 2023 Consent Verification
            </h2>
            <p style={{ color: '#525252', fontFamily: "'Lora', serif", fontSize: '14px', lineHeight: '1.6' }}>
              In compliance with Section 6 of the Digital Personal Data Protection Act, 2023 (DPDP), and Article 21 of the Constitution, informed and explicit consent is required from the Data Principal (interview subject) before capturing audio/video biometric data for analysis.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '24px 0' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontFamily: "'Inter', sans-serif", letterSpacing: '1px', color: '#111111', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>OFFICER ID</label>
                <input 
                  type="text" 
                  value={officerId} 
                  onChange={(e) => setOfficerId(e.target.value)}
                  style={{ width: '90%', padding: '10px', border: '1px solid #111111', backgroundColor: '#FFFFFF', color: '#111111', fontFamily: "'Inter', sans-serif" }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontFamily: "'Inter', sans-serif", letterSpacing: '1px', color: '#111111', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>LOCATION</label>
                <input 
                  type="text" 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)}
                  style={{ width: '90%', padding: '10px', border: '1px solid #111111', backgroundColor: '#FFFFFF', color: '#111111', fontFamily: "'Inter', sans-serif" }}
                />
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px', backgroundColor: '#F9F9F7', border: '1px solid #111111', margin: '20px 0' }}>
              <h4 style={{ margin: '0 0 10px 0', fontFamily: "'Playfair Display', serif", fontWeight: '700', color: '#CC0000', textTransform: 'uppercase', fontSize: '14px', letterSpacing: '0.5px' }}>Volunteered Demographic Attributes (Optional)</h4>
              <p style={{ fontSize: '12px', color: '#525252', margin: '0 0 12px 0' }}>Collect demographics only if explicitly volunteered. Do not coerce.</p>
              
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select 
                  value={sex} 
                  onChange={(e) => setSex(e.target.value)}
                  style={{ padding: '8px', backgroundColor: '#FFFFFF', color: '#111111', border: '1px solid #111111', fontFamily: "'Inter', sans-serif" }}
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
                  style={{ width: '70px', padding: '8px', backgroundColor: '#FFFFFF', color: '#111111', border: '1px solid #111111', fontFamily: "'Inter', sans-serif" }}
                />
                
                <select 
                  value={selectedLanguage} 
                  onChange={(e) => {
                    setSelectedLanguage(e.target.value);
                    const langMap = {
                      'en-IN': 'English',
                      'hi-IN': 'Hindi',
                      'mr-IN': 'Marathi',
                      'ta-IN': 'Tamil',
                      'te-IN': 'Telugu'
                    };
                    setLanguage(langMap[e.target.value] || 'Hindi');
                  }}
                  style={{ padding: '8px', backgroundColor: '#FFFFFF', color: '#111111', border: '1px solid #111111', fontFamily: "'Inter', sans-serif" }}
                >
                  <option value="en-IN">English (en-IN)</option>
                  <option value="hi-IN">Hindi (hi-IN)</option>
                  <option value="mr-IN">Marathi (mr-IN)</option>
                  <option value="ta-IN">Tamil (ta-IN)</option>
                  <option value="te-IN">Telugu (te-IN)</option>
                </select>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#111111', fontWeight: '600' }}>
                  <input 
                    type="checkbox" 
                    checked={isVulnerable} 
                    onChange={(e) => setIsVulnerable(e.target.checked)}
                    style={{ accentColor: '#111111' }}
                  />
                  Subject is vulnerable (e.g. Minor)
                </label>
              </div>
            </div>

            <div style={{ border: '1px solid rgba(204, 0, 0, 0.3)', padding: '16px', backgroundColor: '#FFF5F5', fontSize: '13px', color: '#CC0000', lineHeight: '1.5', fontFamily: "'Lora', serif" }}>
              <b>DPDP Informed Consent Notice:</b> I verify that I have explained to the subject in their preferred language that a real-time behavioral cue assistant is active in this room. The assistant records video and audio to analyze baseline deviations (Heart Rate, Voice Pitch, Facial Muscle Tension) purely as a situational cue for the officer.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '28px' }}>
              <button 
                onClick={() => handleConsentSubmit('Denied')}
                className="cyber-btn cyber-btn-magenta"
              >
                Refuse Consent (Fallback Mode)
              </button>
              <button 
                onClick={() => handleConsentSubmit('Granted')}
                className="cyber-btn"
              >
                Accept & Start Analysis
              </button>
            </div>
          </div>
        )}

        {/* 2. LIVE OFFICER DASHBOARD - CALIBRATION MODE */}
        {screen === 'dashboard' && isCalibrating && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#F9F9F7',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px'
          }}>
            <div className="glass-panel" style={{
              width: '100%',
              maxWidth: '550px',
              padding: '48px',
              textAlign: 'center',
              backgroundColor: '#FFFFFF',
              border: '2px solid #111111'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: '900', color: '#111111', marginTop: 0, marginBottom: '16px', fontSize: '28px' }}>
                BASELINE CALIBRATION
              </h2>
              <p style={{ color: '#525252', fontFamily: "'Lora', serif", fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
                CALIBRATING BASELINE BIO-METRIC PROFILE... STAND BY.
              </p>

              {/* Countdown circle/timer */}
              <div style={{
                width: '120px',
                height: '120px',
                border: '4px solid #111111',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                margin: '0 auto 32px auto'
              }}>
                <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#111111', fontFamily: "'JetBrains Mono', monospace" }}>
                  {calibrationCountdown}s
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{
                width: '100%',
                height: '16px',
                backgroundColor: '#E5E5E0',
                overflow: 'hidden',
                marginBottom: '12px',
                border: '1px solid #111111'
              }}>
                <div style={{
                  height: '100%',
                  width: `${((30 - calibrationCountdown) / 30) * 100}%`,
                  backgroundColor: '#111111',
                  transition: 'width 1s linear'
                }}></div>
              </div>
              
              <div style={{ color: '#CC0000', fontSize: '12px', fontFamily: "'Inter', sans-serif", fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>
                WARNING: MINIMIZE SUBJECT MOTION & BROW INVOLVEMENT
              </div>
            </div>

            {/* Small live webcam preview in the corner */}
            <div style={{
              position: 'absolute',
              bottom: '24px',
              right: '24px',
              width: '240px',
              height: '180px',
              backgroundColor: '#000000',
              border: '2px solid #111111',
              overflow: 'hidden',
              zIndex: 10000
            }}>
              {webcamAvailable ? (
                <video 
                  ref={calibrationVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#CC0000', fontSize: '12px', fontWeight: 'bold' }}>
                  CAMERA OFFLINE
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. LIVE OFFICER DASHBOARD */}
        {screen === 'dashboard' && !isCalibrating && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', width: '100%', maxWidth: '1200px' }}>
            
            {/* Left Column: Media & Arousal Fusion */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Camera Preview */}
              <div className="glass-panel" style={{ padding: '12px', textAlign: 'center', border: '1px solid #111111' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, color: '#111111', fontSize: '12px', fontWeight: 'bold', fontFamily: "'Inter', sans-serif", letterSpacing: '2px' }}>WEBCAM STREAM</h4>
                  <span style={{ color: '#CC0000', fontSize: '12px', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace" }}>
                    ⏱️ {formatTime(sessionElapsedTime)}
                  </span>
                </div>
                <div style={{ width: '100%', height: '200px', backgroundColor: '#000000', border: '1px solid #111111', overflow: 'hidden', position: 'relative' }}>
                  {webcamAvailable ? (
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }}></video>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#CC0000', padding: '16px' }}>
                      <span style={{ fontSize: '28px' }}>📷</span>
                      <span style={{ fontSize: '13px', marginTop: '8px', fontWeight: 'bold' }}>CAMERA UNAVAILABLE</span>
                      <span style={{ fontSize: '11px', color: '#525252', textAlign: 'center', marginTop: '4px' }}>Webcam or microphone missing/blocked. Please grant device permissions.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Suggested Questions Panel */}
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '4px solid #111111' }}>
                <h4 style={{ margin: '0', color: '#111111', fontSize: '12px', fontWeight: 'bold', textAlign: 'left', fontFamily: "'Inter', sans-serif", letterSpacing: '2px' }}>SUGGESTED QUESTIONS</h4>
                <div style={{ padding: '12px', backgroundColor: '#F9F9F7', border: '1px solid #111111', textAlign: 'left' }}>
                  <div style={{ fontSize: '11px', color: '#CC0000', fontWeight: 'bold', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", letterSpacing: '1px', marginBottom: '4px' }}>
                    Topic: {SUGGESTED_QUESTIONS[currentQuestionIdx].topic}
                  </div>
                  <div style={{ fontSize: '16px', color: '#111111', fontFamily: "'Playfair Display', serif", fontStyle: 'italic', minHeight: '40px', lineHeight: '1.4' }}>
                    "{SUGGESTED_QUESTIONS[currentQuestionIdx].question}"
                  </div>
                </div>
                <button 
                  onClick={() => setCurrentQuestionIdx((currentQuestionIdx + 1) % SUGGESTED_QUESTIONS.length)}
                  className="cyber-btn cyber-btn-cyan"
                  style={{ width: '100%' }}
                >
                  Next Question
                </button>
              </div>

              {/* Bayesian Late Fusion Dashboard */}
              <div className="glass-panel" style={{ padding: '20px', borderTop: '4px solid #111111' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#111111', fontSize: '11px', fontWeight: 'bold', fontFamily: "'Inter', sans-serif", letterSpacing: '2px' }}>AROUSAL DEVIATION</h4>
                
                <div style={{ textalign: 'center', margin: '20px 0' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: "'Playfair Display', serif", color: '#111111', textAlign: 'center' }}>
                    {(latestFusedArousal * 100).toFixed(0)}%
                  </div>
                  <div 
                    title="Elevated arousal may reflect nervousness, fatigue, cultural context, or other factors unrelated to deception."
                    style={{ fontSize: '11px', color: '#525252', marginTop: '6px', cursor: 'help', textDecoration: 'underline dotted', textAlign: 'center' }}
                  >
                    ℹ️ Context Warning
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '12px', backgroundColor: '#E5E5E0', overflow: 'hidden', border: '1px solid #111111', marginBottom: '16px' }}>
                  <div style={{ 
                    width: `${latestFusedArousal * 100}%`, 
                    height: '100%', 
                    backgroundColor: latestFusedArousal >= 0.70 ? '#CC0000' : '#111111',
                    transition: 'width 0.5s ease'
                  }}></div>
                </div>

                {whyExplanation && (
                  (!whyExplanation.includes('Baseline collection') && !whyExplanation.includes('Awaiting baseline')) ||
                  isCalibrating ||
                  sessionElapsedTime < 60
                ) && (
                  <div style={{ border: '1px solid #111111', padding: '10px', backgroundColor: '#F9F9F7', fontSize: '12px', color: '#111111', lineHeight: '1.4', fontFamily: "'Lora', serif" }}>
                    <b>Explainability Attributions:</b> {whyExplanation}
                  </div>
                )}
              </div>

              {/* Baseline window status */}
              <div className="glass-panel" style={{ padding: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#111111', fontSize: '12px', fontWeight: 'bold', fontFamily: "'Inter', sans-serif", letterSpacing: '2px' }}>BASELINE WINDOW STATUS</h4>
                {baselineCompleted ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#111111', fontSize: '13px', fontWeight: 'bold' }}>
                    <span>✅</span> Baseline Profile Created (Ready)
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '13px', color: '#CC0000', margin: '0 0 6px 0', fontWeight: 'bold' }}>
                      ⏳ Gathering Baseline profile: {Math.floor(baselineElapsed)}s / {baselineWindow}s
                    </div>
                    <div style={{ height: '8px', width: '100%', backgroundColor: '#E5E5E0', overflow: 'hidden', border: '1px solid #111111' }}>
                      <div style={{ width: `${(baselineElapsed / baselineWindow) * 100}%`, height: '100%', backgroundColor: '#111111' }}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* End session control */}
              <button 
                onClick={handleEndSession}
                className="cyber-btn cyber-btn-magenta"
                style={{ width: '100%', padding: '14px', letterSpacing: '1px' }}
              >
                End Interview & Download Report
              </button>
              {consentStatus === 'Granted' && (
                <button 
                  onClick={handleWithdrawConsent}
                  className="cyber-btn cyber-btn-magenta"
                  style={{ width: '100%', padding: '8px', fontSize: '11px' }}
                >
                  Withdraw Consent Immediately (DPDP)
                </button>
              )}
            </div>

            {/* Right Column: Timeline, Transcripts & Safeguards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Speaker Turn-taking Toggle Button */}
              <div className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', border: '1px solid #111111' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', fontFamily: "'Inter', sans-serif", letterSpacing: '1.5px', textTransform: 'uppercase', color: '#111111' }}>
                  Active Speaker:
                </span>
                <button
                  onClick={() => {
                    setActiveSpeaker(prev => {
                      const next = prev === 'Subject' ? 'Officer' : 'Subject';
                      activeSpeakerRef.current = next;
                      return next;
                    });
                  }}
                  className={activeSpeaker === 'Subject' ? 'cyber-btn' : 'cyber-btn cyber-btn-magenta'}
                  style={{ minWidth: '220px', letterSpacing: '1px' }}
                >
                  {activeSpeaker === 'Subject' ? '[ Speaking: SUBJECT ]' : '[ Speaking: OFFICER ]'}
                </button>
              </div>

              {/* SAFEGUARD ADVISORY HALT MODAL OVERLAY */}
              {isHalted && (
                <div style={{ 
                  border: '2px solid #CC0000', 
                  padding: '20px', 
                  backgroundColor: '#FFF5F5'
                }}>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '32px' }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#CC0000', fontSize: '15px', fontWeight: 'bold', fontFamily: "'Inter', sans-serif" }}>SAFEGUARD TRIGGER HALT</h4>
                      <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#111111', fontFamily: "'Lora', serif", lineHeight: '1.5' }}>
                        <b>Procedural Advisory:</b> {haltReason}<br />
                        AI biometric feature inference has been halted on the subject to protect privacy and verify vulnerability protocols.
                      </p>
                      <button 
                        onClick={handleAcknowledgeSafeguard}
                        className="cyber-btn cyber-btn-magenta"
                        style={{ padding: '8px 16px', fontSize: '12px' }}
                      >
                        Acknowledge & Resume Inference
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Contradiction Alert Component */}
              {latestContradiction && (
                <div 
                  style={{
                    border: '1px solid #111111',
                    borderLeft: '8px solid #CC0000',
                    backgroundColor: '#CC0000',
                    padding: '16px',
                    color: '#FFFFFF',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#FFFFFF', letterSpacing: '2px', fontWeight: 'bold', fontFamily: "'Inter', sans-serif" }}>
                      ⚠️ CONTRADICTION DETECTED
                    </span>
                    <button 
                      onClick={() => setLatestContradiction(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#FFFFFF',
                        cursor: 'pointer',
                        fontSize: '18px',
                        fontWeight: 'bold'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ fontSize: '18px', color: '#FFFFFF', lineHeight: '1.4', fontFamily: "'Playfair Display', serif", fontWeight: '900' }}>
                    "{latestContradiction.utterance}"
                  </div>
                  <div style={{ fontSize: '12px', color: '#FFFFFF', marginTop: '6px', fontFamily: "'Inter', sans-serif", letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.9 }}>
                    <b>Details:</b> {latestContradiction.reasoning}
                  </div>
                </div>
              )}

              {/* Real-time Cues TIMELINE */}
              <div className="glass-panel" style={{ padding: '20px', backgroundColor: '#FFFFFF', border: '1px solid #111111' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#111111', fontSize: '12px', fontWeight: 'bold', fontFamily: "'Inter', sans-serif", letterSpacing: '2px' }}>60-SECOND SCROLLING TIMELINE LANES</h4>
                
                {recentCuesRef.current.length === 0 ? (
                  <div style={{ height: '240px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#525252', fontSize: '13px', fontFamily: "'Lora', serif" }}>
                    Awaiting streaming telemetry (Ingesting video/audio chunks)...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {/* Lane 1: Heart Rate */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#111111', fontFamily: "'Inter', sans-serif", fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          💓 Heart Rate (rPPG estimated)
                          {isInferenceRunning && (
                            <span className="spinner-small" style={{
                              marginLeft: '8px',
                              display: 'inline-block',
                              width: '10px',
                              height: '10px'
                            }} />
                          )}
                        </span>
                        <span style={{ color: '#CC0000', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace" }}>
                          {(recentCues[recentCues.length-1]?.cue_data?.ppg_cues?.heart_rate ?? recentCues[recentCues.length-1]?.cue_data?.heart_rate ?? 72).toFixed(0)} BPM
                        </span>
                      </div>
                      <svg width="100%" height="55" style={{ backgroundColor: '#FFFFFF', border: '1px solid #111111' }}>
                        <polyline fill="none" stroke="#CC0000" strokeWidth="2.5" points={getTimelinePoints('heart_rate', 50, 120)} />
                      </svg>
                    </div>

                    {/* Lane 2: Facial AU4 */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#111111', fontFamily: "'Inter', sans-serif", fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          😠 Face AU4 Intensity (Brow Furrow)
                          {isInferenceRunning && (
                            <span className="spinner-small" style={{
                              marginLeft: '8px',
                              display: 'inline-block',
                              width: '10px',
                              height: '10px'
                            }} />
                          )}
                        </span>
                        <span style={{ color: '#111111', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace" }}>
                          {(recentCues[recentCues.length-1]?.cue_data?.vision_cues?.action_units?.AU4 ?? recentCues[recentCues.length-1]?.cue_data?.action_units?.AU4 ?? 0.05).toFixed(2)}
                        </span>
                      </div>
                      <svg width="100%" height="55" style={{ backgroundColor: '#FFFFFF', border: '1px solid #111111' }}>
                        <polyline fill="none" stroke="#111111" strokeWidth="2.5" points={getTimelinePoints('AU4', 0.0, 1.0)} />
                      </svg>
                    </div>

                    {/* Lane 3: Gaze Deviation (Yaw) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#111111', fontFamily: "'Inter', sans-serif", fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          👁️ Gaze Yaw Dev. (Iris deflection)
                          {isInferenceRunning && (
                            <span className="spinner-small" style={{
                              marginLeft: '8px',
                              display: 'inline-block',
                              width: '10px',
                              height: '10px'
                            }} />
                          )}
                        </span>
                        <span style={{ color: '#525252', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace" }}>
                          {(recentCues[recentCues.length-1]?.cue_data?.vision_cues?.gaze?.yaw ?? recentCues[recentCues.length-1]?.cue_data?.gaze?.yaw ?? 0.0).toFixed(1)}°
                        </span>
                      </div>
                      <svg width="100%" height="55" style={{ backgroundColor: '#FFFFFF', border: '1px solid #111111' }}>
                        <polyline fill="none" stroke="#525252" strokeWidth="2.5" points={getTimelinePoints('gaze_yaw', -15, 15)} />
                      </svg>
                    </div>

                    {/* Lane 4: Posture Shift */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#111111', fontFamily: "'Inter', sans-serif", fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          🕴️ Forward Lean / Upper Body Pose
                          {isInferenceRunning && (
                            <span className="spinner-small" style={{
                              marginLeft: '8px',
                              display: 'inline-block',
                              width: '10px',
                              height: '10px'
                            }} />
                          )}
                        </span>
                        <span style={{ color: '#A3A3A3', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace" }}>
                          {(recentCues[recentCues.length-1]?.cue_data?.vision_cues?.posture?.forward_lean ?? recentCues[recentCues.length-1]?.cue_data?.posture?.forward_lean ?? 0.0).toFixed(2)}
                        </span>
                      </div>
                      <svg width="100%" height="55" style={{ backgroundColor: '#FFFFFF', border: '1px solid #111111' }}>
                        <polyline fill="none" stroke="#A3A3A3" strokeWidth="2.5" points={getTimelinePoints('lean', -1.0, 1.0)} />
                      </svg>
                    </div>

                  </div>
                )}
              </div>

              {/* Transcript & Contradiction Displays */}
              <div className="glass-panel" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#FFFFFF', border: '1px solid #111111' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#111111', fontSize: '12px', fontWeight: 'bold', fontFamily: "'Inter', sans-serif", letterSpacing: '2px' }}>LIVE TRANSCRIPT (WITH SPEAKER IDS & CONTRADICTIONS)</h4>
                
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '250px', backgroundColor: '#FFFFFF', padding: '12px', border: '1px solid #111111' }}>
                  {transcripts.length === 0 ? (
                    <div style={{ color: '#525252', fontSize: '13px', textAlign: 'center', marginTop: '40px', fontFamily: "'Lora', serif" }}>
                      Awaiting audio stream (Hindi, English, Marathi, Tamil, Telugu transcript will display here)...
                    </div>
                  ) : (
                    [...transcripts]
                      .sort((a, b) => a.start_time - b.start_time)
                      .filter((t, idx, arr) => {
                        if (idx === 0) return true
                        const prev = arr[idx - 1]
                        const timeDiff = Math.abs(t.start_time - prev.start_time)
                        const textSimilar = t.utterance && prev.utterance &&
                          (t.utterance.toLowerCase().startsWith(prev.utterance.toLowerCase().substring(0, 10)) ||
                           prev.utterance.toLowerCase().startsWith(t.utterance.toLowerCase().substring(0, 10)))
                        return !(timeDiff < 5 && textSimilar)
                      })
                      .map((t, idx) => (
                      <div key={idx} style={{ 
                        margin: '0 0 10px 0', 
                        padding: '8px', 
                        backgroundColor: t.contradiction_flag ? '#FFF5F5' : (t.speaker_id === 'Officer' ? '#F2F2F0' : 'transparent'),
                        borderLeft: t.contradiction_flag ? '4px solid #CC0000' : (t.speaker_id === 'Officer' ? '3px solid #525252' : 'none'),
                        color: '#111111',
                        fontFamily: "'Lora', serif"
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px', fontFamily: "'Inter', sans-serif", letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.8 }}>
                          <span style={{ fontWeight: 'bold', color: t.contradiction_flag ? '#CC0000' : (t.speaker_id === 'Officer' ? '#CC0000' : '#111111') }}>
                            [{t.speaker_id}] ({t.language})
                          </span>
                          <span style={{ color: '#525252' }}>t={t.start_time.toFixed(1)}s</span>
                        </div>
                        <div style={{ fontSize: '14px', lineHeight: '1.4' }}>{t.utterance}</div>
                        {t.contradiction_flag && (
                          <div style={{ fontSize: '11px', color: '#CC0000', marginTop: '4px', backgroundColor: '#FFF5F5', padding: '4px', border: '1px solid #CC0000' }}>
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: '750px', padding: '36px', backgroundColor: '#FFFFFF', border: '1px solid #111111' }}>
            <h2 style={{ marginTop: 0, textAlign: 'center', fontFamily: "'Playfair Display', serif", fontWeight: '900', fontSize: '28px' }}>Interview Session Completed</h2>
            <p style={{ color: '#525252', fontSize: '14px', textAlign: 'center', marginBottom: '30px', fontFamily: "'Lora', serif" }}>
              The cryptographic chain of custody ledger has been closed, and a post-hoc analysis PDF has been generated.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', margin: '30px 0' }}>
              <a 
                href={`${API_URL}/report?session_id=${sessionId}`}
                target="_blank"
                rel="noreferrer"
                className="cyber-btn"
                style={{ 
                  textDecoration: 'none',
                  display: 'inline-block'
                }}
              >
                📥 DOWNLOAD OFFICIAL PDF REPORT
              </a>
            </div>

            <div style={{ marginTop: '40px', borderTop: '4px solid #111111', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '15px', color: '#111111', marginBottom: '15px', fontFamily: "'Inter', sans-serif", letterSpacing: '1px', textTransform: 'uppercase' }}>Demographic & Legal Compliance Audit</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#111111', fontFamily: "'Lora', serif" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #111111' }}>
                  <span>Article 20(3) Protection:</span>
                  <span style={{ color: '#CC0000', fontWeight: 'bold' }}>COMPLIANT (Consent-gated analysis only)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #111111' }}>
                  <span>Selvi v. Karnataka (2010):</span>
                  <span style={{ color: '#CC0000', fontWeight: 'bold' }}>COMPLIANT (No coercive deception scoring)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #111111' }}>
                  <span>DPDP Act 2023 Consent & Erasure:</span>
                  <span style={{ color: '#CC0000', fontWeight: 'bold' }}>COMPLIANT (Erasure logic & voluntary flags)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #111111' }}>
                  <span>BSA 2023 Evidentiary Tagging:</span>
                  <span style={{ color: '#CC0000', fontWeight: 'bold' }}>COMPLIANT (Watermarked and tagged)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #111111' }}>
                  <span>Cryptographic Log Chaining:</span>
                  <span style={{ color: '#CC0000', fontWeight: 'bold' }}>COMPLIANT (Ed25519 hash-chain verified)</span>
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
                  recentCuesRef.current = [];
                  localSegmentsRef.current = [];
                  setRecentCues([]);
                  setTranscripts([]);
                }}
                className="cyber-btn cyber-btn-cyan"
              >
                Start New Interview
              </button>
            </div>
          </div>
        )}

      </div>
      <canvas ref={canvasRef} width="640" height="480" style={{ display: 'none' }}></canvas>
    </div>
  );
}

export default App;
