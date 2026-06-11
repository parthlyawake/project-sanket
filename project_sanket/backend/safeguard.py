import datetime
from database import SessionLocal, SessionModel
from audit_log import log_audit_event

# In-memory registry to track safeguard states per session
_session_safeguard_states = {}

class SafeguardState:
    """
    Tracks safety and halt state for a single interview session.
    """
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.is_halted = False
        self.trigger_reason = None
        self.timestamp_triggered = None
        self.acknowledged_by_officer = False

    def trigger_halt(self, reason: str):
        """Halts inference and records the safety advisory reason."""
        self.is_halted = True
        self.trigger_reason = reason
        self.timestamp_triggered = datetime.datetime.utcnow().isoformat()
        self.acknowledged_by_officer = False
        
        # Log to cryptographic audit chain
        log_audit_event(
            event_type="SAFEGUARD_HALT",
            details={"reason": reason, "timestamp": self.timestamp_triggered},
            model_version="SYSTEM"
        )
        print(f"[SAFEGUARD ALERT] Session {self.session_id} HALTED: {reason}")

    def acknowledge(self):
        """Officer acknowledges the advisory and resumes inference."""
        self.is_halted = False
        self.acknowledged_by_officer = True
        log_audit_event(
            event_type="SAFEGUARD_ACKNOWLEDGED",
            details={
                "previous_reason": self.trigger_reason,
                "timestamp_cleared": datetime.datetime.utcnow().isoformat()
            },
            model_version="SYSTEM"
        )
        print(f"[SAFEGUARD INFO] Session {self.session_id} safeguard acknowledged and resumed by officer.")

def get_or_create_safeguard(session_id: str) -> SafeguardState:
    """Retrieves or registers a safeguard state tracker for a session."""
    if session_id not in _session_safeguard_states:
        _session_safeguard_states[session_id] = SafeguardState(session_id)
    return _session_safeguard_states[session_id]

def check_and_apply_safeguards(session_id: str, vision_data: dict = None, audio_data: dict = None, transcript_data: dict = None) -> bool:
    """
    Monitors incoming cues for vulnerability triggers (DPDP Act & Ethics safeguarding):
      1. Age-limit check: Subject is a minor (explicitly volunteered or detected).
      2. Acute Distress: High heart rate or crying/pain signatures.
      3. Intoxication: Extreme gait/gaze deviation combined with slurred speech rate.
    Returns:
      bool: True if inference is halted, False otherwise.
    """
    safeguard = get_or_create_safeguard(session_id)
    
    # 1. Database check (if volunteered data explicitly flags minor)
    db = SessionLocal()
    try:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if session:
            # Check volunteered demographics
            dem = session.demographics_volunteered or {}
            age = dem.get("age")
            if age is not None:
                try:
                    if int(age) < 18:
                        if not safeguard.is_halted and not safeguard.acknowledged_by_officer:
                            safeguard.trigger_halt("Subject is a minor (Age < 18). Interviewing minors requires specialized procedures.")
                            session.is_vulnerable = True
                            db.commit()
                except ValueError:
                    pass
    except Exception as e:
        print(f"Error checking safeguard session info: {e}")
    finally:
        db.close()

    # If already halted and not yet acknowledged, return True
    if safeguard.is_halted:
        return True

    # 2. Vision Distress Triggers (e.g., highly elevated facial Action Units indicating distress)
    # AU4 (brow lowerer) and AU15 (lip corner depressor) are correlated with negative affect/distress
    if vision_data:
        aus = vision_data.get("action_units", {})
        au4 = aus.get("AU4", 0.0)
        au15 = aus.get("AU15", 0.0)
        gaze_instability = vision_data.get("gaze_instability", 0.0)
        
        # Trigger on extreme distress
        if au4 > 0.85 and au15 > 0.85:
            safeguard.trigger_halt("Acute emotional distress detected (high brow furrow and lip depression).")
            return True
            
        # Trigger on extreme physiological arousal (e.g. simulated heart rate spike > 120 bpm)
        heart_rate = vision_data.get("heart_rate", 80.0)
        if heart_rate > 120.0:
            safeguard.trigger_halt("Extreme physiological arousal detected (estimated Heart Rate > 120 BPM). Check for distress.")
            return True

    # 3. Audio & ASR Intoxication Triggers
    if audio_data:
        # Slow slurred speech combined with speech rate deviations
        speech_rate = audio_data.get("speech_rate", 120)  # words per minute
        voice_tremor = audio_data.get("voice_tremor", 0.0)
        if speech_rate > 0 and speech_rate < 50 and voice_tremor > 0.8:
            safeguard.trigger_halt("Potential subject impairment or intoxication detected (highly slurred speech rate with tremors).")
            return True

    return safeguard.is_halted
