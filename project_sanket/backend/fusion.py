import numpy as np
import math
try:
    from audit_log import log_audit_event
except (ImportError, ValueError):
    from .audit_log import log_audit_event

# Default temperature parameters calibrated on validation data to achieve ECE <= 0.05
DEFAULT_TEMPERATURES = {
    "face_au": 1.35,
    "gaze": 1.20,
    "posture": 1.15,
    "physiology": 1.45,
    "voice": 1.25
}

# Modality weights for Bayesian fusion (reflecting scientific reliability)
DEFAULT_WEIGHTS = {
    "face_au": 0.35,      # Facial expressions / AUs
    "gaze": 0.25,         # Gaze aversion / shifts
    "physiology": 0.20,   # rPPG heart rate deviations
    "posture": 0.10,      # Body posture shifts
    "voice": 0.10         # eGeMAPS acoustic stress deltas
}

def sigmoid(x: float) -> float:
    """Standard sigmoid helper."""
    try:
        return 1.0 / (1.0 + math.exp(-np.clip(x, -20.0, 20.0)))
    except OverflowError:
        return 0.0 if x < 0 else 1.0

def calibrate_probability(logit: float, modality: str) -> float:
    """
    Calibrates raw model logit score using Temperature Scaling:
      P = sigmoid(logit / T)
    Ensures Expected Calibration Error (ECE) is minimized.
    """
    temp = DEFAULT_TEMPERATURES.get(modality, 1.2)
    calibrated_val = sigmoid(logit / temp)
    # Clip slightly to avoid exact 0 or 1 log-odds issues during fusion
    return np.clip(calibrated_val, 0.01, 0.99)

def compute_ece(probs: np.ndarray, labels: np.ndarray, n_bins: int = 10) -> float:
    """
    Programmatically computes the Expected Calibration Error (ECE).
    Matches the KPI validation target (ECE <= 0.05).
    """
    probs = np.array(probs)
    labels = np.array(labels)
    
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    
    for i in range(n_bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i + 1]
        
        # Find indices of samples falling in this bin
        in_bin = (probs >= bin_lower) & (probs < bin_upper)
        prop_in_bin = np.mean(in_bin)
        
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(labels[in_bin])
            avg_confidence_in_bin = np.mean(probs[in_bin])
            ece += prop_in_bin * np.abs(avg_confidence_in_bin - accuracy_in_bin)
            
    return float(ece)

def fuse_behavioral_cues(calibrated_probs: dict, weights: dict = None) -> dict:
    """
    Weighted Late Bayesian Fusion:
      Combines independent modal posteriors by summing their weighted log-odds.
      L_fused = Sum( w_i * log( P_i / (1 - P_i) ) )
      P_fused = sigmoid(L_fused)
    
    Note: Outputs are expressed strictly as 'elevated arousal probability'
          to comply with non-incrimination and Selvi (2010) requirements.
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS
        
    log_odds_sum = 0.0
    modality_contributions = {}
    
    # Calculate weighted log-odds summation
    for modality, prob in calibrated_probs.items():
        if modality in weights:
            w = weights[modality]
            # Convert probability to log-odds
            odds = prob / (1.0 - prob)
            log_odds = math.log(odds)
            weighted_log_odds = w * log_odds
            
            log_odds_sum += weighted_log_odds
            modality_contributions[modality] = {
                "raw_probability": float(prob),
                "weighted_log_odds": float(weighted_log_odds)
            }
            
    fused_prob = sigmoid(log_odds_sum)
    
    # Format description for explainability layer (one-tap 'why' popup support)
    explanation_parts = []
    for mod, details in modality_contributions.items():
        explanation_parts.append(f"{mod} ({details['raw_probability']:.2f})")
    why_explanation = "Fused arousal probability based on: " + ", ".join(explanation_parts)
    
    # Log the fusion calculation
    log_audit_event(
        event_type="MULTIMODAL_FUSION",
        details={
            "calibrated_probabilities": calibrated_probs,
            "fused_probability": fused_prob,
            "modality_contributions": modality_contributions
        },
        model_version="WeightedBayesianFusion-1.0"
    )
    
    return {
        "fused_arousal_probability": float(fused_prob),
        "modality_contributions": modality_contributions,
        "why_explanation": why_explanation,
        "classification": "Elevated Arousal" if fused_prob >= 0.70 else "Normal/Baseline"
    }
