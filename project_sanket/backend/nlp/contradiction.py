import os
import time
import random
try:
    from audit_log import log_audit_event
except (ImportError, ValueError):
    from ..audit_log import log_audit_event

# Check if transformers and torch are fully functional
REAL_NLP_AVAILABLE = False
try:
    import torch
    from transformers import AutoTokenizer, AutoModel
    # We could load google/muril-base-cased or Helsinki-NLP/LaBSE locally
    # REAL_NLP_AVAILABLE = True
    pass
except ImportError:
    REAL_NLP_AVAILABLE = False

# Heuristic rules for detecting direct contradictions in English, Hindi, and Hinglish
# Maps opposing concepts to flag contradictions
CONTRADICTION_PAIRS = [
    # Alibi locations
    {"words_a": ["home", "घर", "family"], "words_b": ["office", "scene", "वहां", "crime", "spot", "रोड", "road"], "reason": "Location contradiction: Subject previously claimed to be at home, but later mentioned office or crime scene."},
    # Visual sightings
    {"words_a": ["देखा", "saw him", "देखा था"], "words_b": ["नहीं देखा", "never saw", "nhi dekha", "mahit nahi"], "reason": "Visual witness contradiction: Contradictory statements regarding seeing the subject/incident."},
    # Relationships
    {"words_a": ["जानता", "knew him", "friend", "दोस्त"], "words_b": ["अजनबी", "stranger", "never met", "pata nahi", "malum nahi"], "reason": "Relationship contradiction: Subject previously claimed to know the person, but later called them a stranger."},
    # Vehicle details
    {"words_a": ["red car", "लाल गाड़ी", "लाल"], "words_b": ["blue car", "black car", "सफ़ेद", "white", "काली"], "reason": "Description contradiction: Conflicting car color descriptions (Red vs Blue/Black/White)."},
    # Social state
    {"words_a": ["alone", "अकेला", "akele"], "words_b": ["friends", "family", "दोस्तों", "साथ", "with someone"], "reason": "Social context contradiction: Conflicting claims about being alone vs being with others."}
]

# Topic clustering keywords
TOPIC_KEYWORDS = {
    "Background & Identification": ["name", "nam", "नाम", "work", "job", "occupation", "रहता", "engineer", "रहती"],
    "Timeline of Events": ["night", "time", "around", "रात", "कल", "समय", "बजे", "pm", "am", "when"],
    "Alibi & Location": ["home", "घर", "office", "office", "crime", "scene", "वहां", "road", "spot"],
    "Involvement & Relationship": ["know", "meet", "friend", "stranger", "जानता", "देखा", "देखा था", "saw", "criminal"]
}

def identify_topic(utterance: str) -> str:
    """Classifies an utterance into a topic segment based on keyword occurrences."""
    utterance_lower = utterance.lower()
    best_topic = "General Inquiry"
    max_matches = 0
    
    for topic, keywords in TOPIC_KEYWORDS.items():
        matches = sum(1 for kw in keywords if kw in utterance_lower)
        if matches > max_matches:
            max_matches = matches
            best_topic = topic
            
    return best_topic

def detect_contradictions(current_utterance: str, previous_segments: list) -> tuple:
    """
    Compares the current statement against all prior statements in the session.
    Detects semantic contradictions (English/Hindi/Hinglish) using local rule clusters.
    Returns:
        (bool, dict) - Contradiction flag and dictionary containing the contradicting statement and reasoning.
    """
    curr_lower = current_utterance.lower()
    
    # Check current utterance against each previous segment
    for prev in previous_segments:
        prev_text = prev.get("utterance", "").lower()
        if not prev_text:
            continue
            
        for pair in CONTRADICTION_PAIRS:
            # Check if current statement matches list A and previous matches list B (or vice versa)
            match_a_curr = any(wa in curr_lower for wa in pair["words_a"])
            match_b_prev = any(wb in prev_text for wb in pair["words_b"])
            
            match_b_curr = any(wb in curr_lower for wb in pair["words_b"])
            match_a_prev = any(wa in prev_text for wa in pair["words_a"])
            
            if (match_a_curr and match_b_prev) or (match_b_curr and match_a_prev):
                details = {
                    "contradicting_statement": prev.get("utterance"),
                    "reasoning": pair["reason"],
                    "confidence": 0.88,
                    "timestamp": prev.get("timestamp")
                }
                return True, details
                
    return False, None

def analyze_linguistics(current_utterance: str, session_id: str, previous_segments: list) -> dict:
    """
    NLP entry point analyzing linguistic consistency and topic categories.
    Logs inference outputs to the tamper-evident hash chain.
    """
    # 1. Identify Topic
    topic = None
    try:
        import json
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        registry_path = os.path.join(BASE_DIR, "data", "mock_speech_registry.json")
        if os.path.exists(registry_path):
            with open(registry_path, "r", encoding="utf-8") as f:
                registry = json.load(f)
            session_entries = registry.get(session_id, [])
            for entry in session_entries:
                if entry["utterance"] == current_utterance:
                    if "topic" in entry:
                        topic = entry["topic"]
                        break
    except Exception as e:
        print(f"Error checking registry for topic: {e}")
        
    if not topic:
        topic = identify_topic(current_utterance)
    
    # 2. Check for contradictions
    is_contradiction = False
    details = None
    
    try:
        import json
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        registry_path = os.path.join(BASE_DIR, "data", "mock_speech_registry.json")
        if os.path.exists(registry_path):
            with open(registry_path, "r", encoding="utf-8") as f:
                registry = json.load(f)
            session_entries = registry.get(session_id, [])
            for entry in session_entries:
                if entry["utterance"] == current_utterance:
                    if entry.get("contradiction_flag"):
                        is_contradiction = True
                        details = entry.get("contradiction_details")
                        break
    except Exception as e:
        print(f"Error checking registry for contradiction: {e}")
        
    if not is_contradiction:
        is_contradiction, details = detect_contradictions(current_utterance, previous_segments)
        
    log_audit_event(
        event_type="NLP_LINGUISTIC_ANALYSIS",
        details={
            "session_id": session_id,
            "demo_mode": True,
            "topic": topic,
            "is_contradiction": is_contradiction,
            "contradiction_details": details
        },
        model_version="SIMULATION"
    )
    
    return {
        "demo_mode": True,
        "topic": topic,
        "contradiction_flag": is_contradiction,
        "contradiction_details": details
    }
