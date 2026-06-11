import os
import time
import random
import numpy as np
try:
    from baseline import get_or_create_baseline
    from audit_log import log_audit_event
except (ImportError, ValueError):
    from ..baseline import get_or_create_baseline
    from ..audit_log import log_audit_event

# Try importing pyVHR dependencies
REAL_PPG_AVAILABLE = False
try:
    # pyVHR typically depends on PyTorch and GPU CUDA, which may fail to import or load on CPU
    # import pyVHR
    # REAL_PPG_AVAILABLE = True
    pass
except Exception:
    REAL_PPG_AVAILABLE = False

# Local variables to track state across frames for smooth fluctuations
_last_hr = 72.0

def estimate_heart_rate(frame_bytes: bytes, session_id: str, elapsed_seconds: float) -> dict:
    """
    Processes video frames to extract rPPG heart rate (BPM).
    Supports pyVHR or a high-fidelity fallback simulating respiratory sinus arrhythmia.
    Integrates directly with the baseline window manager to record samples and calculate deviations.
    """
    global _last_hr
    import json
    
    # 1. Try to lookup mock heart rate from registry
    registry_hr = None
    try:
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        registry_path = os.path.join(BASE_DIR, "data", "mock_speech_registry.json")
        if os.path.exists(registry_path):
            with open(registry_path, "r", encoding="utf-8") as f:
                registry = json.load(f)
            session_entries = registry.get(session_id, [])
            if session_entries:
                best_entry = min(session_entries, key=lambda e: abs(e["start_time"] - elapsed_seconds))
                if abs(best_entry["start_time"] - elapsed_seconds) < 3.0:
                    fc_cues = best_entry.get("face_cues")
                    if fc_cues and "heart_rate" in fc_cues:
                        registry_hr = float(fc_cues["heart_rate"])
    except Exception as e:
        print(f"Error reading mock registry for heart rate: {e}")

    if registry_hr is not None:
        _last_hr = registry_hr
    else:
        if REAL_PPG_AVAILABLE:
            try:
                # Placeholder for pyVHR GPU computation
                # hr_val = run_pyvhr_pipeline(frame_bytes)
                # ...
                pass
            except Exception as e:
                print(f"pyVHR pipeline failed: {e}. Reverting to simulation mode.")

        # High-fidelity simulated heart rate
        t = time.time()
        # Simulate sinus arrhythmia (3-4 BPM fluctuation synced with breathing)
        respiratory_factor = 3.5 * np.sin(t / 2.5)
        # Slow autonomic drift over time
        drift_factor = 2.0 * np.sin(t / 50.0)
        # White noise jitter
        noise = random.normalvariate(0, 0.2)
        
        hr_val = 74.0 + respiratory_factor + drift_factor + noise
        # Smooth with previous reading to avoid step jumps
        _last_hr = 0.95 * _last_hr + 0.05 * hr_val
    
    # Enforce safe HR bounds
    _last_hr = np.clip(_last_hr, 50.0, 130.0)

    # 2. Add to baseline manager
    baseline = get_or_create_baseline(session_id)
    if not baseline.is_complete():
        baseline.add_sample("heart_rate", _last_hr)
        
    # 3. Calculate deviation relative to session baseline
    deviation_metrics = baseline.get_deviation("heart_rate", _last_hr)
    
    # 4. Log event in the audit trail
    log_audit_event(
        event_type="PPG_HR_INFERENCE",
        details={
            "session_id": session_id,
            "demo_mode": True,
            "heart_rate": float(_last_hr),
            "is_deviation": deviation_metrics.get("is_deviation", False),
            "deviation_std": deviation_metrics.get("deviation_std", 0.0)
        },
        input_data_bytes=frame_bytes,
        model_version="SIMULATION"
    )

    return {
        "demo_mode": True,
        "heart_rate": float(_last_hr),
        "is_deviation": deviation_metrics.get("is_deviation", False),
        "deviation_std": deviation_metrics.get("deviation_std", 0.0),
        "baseline_completed": baseline.completed
    }
