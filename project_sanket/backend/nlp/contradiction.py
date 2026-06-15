import os
import time
import random
try:
    from audit_log import log_audit_event
except (ImportError, ValueError):
    from ..audit_log import log_audit_event

# Check if transformers and torch are fully functional
REAL_NLP_AVAILABLE = False
nlp_tokenizer = None
nlp_model = None

try:
    import torch
    from transformers import AutoTokenizer, AutoModel
    
    # Use LaBSE for cross-lingual / multilingual sentence embeddings
    model_name = 'sentence-transformers/LaBSE'
    print(f"Initializing NLP contradiction models using model: {model_name}")
    
    nlp_tokenizer = AutoTokenizer.from_pretrained(model_name)
    nlp_model = AutoModel.from_pretrained(model_name)
    
    # Use GPU if available
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    nlp_model.to(device)
    
    REAL_NLP_AVAILABLE = True
    print("NLP contradiction models initialized successfully.")
except Exception as e:
    print(f"NLP Contradiction Initialization failed: {e}")
    import traceback
    traceback.print_exc()
    REAL_NLP_AVAILABLE = False

def get_sentence_embedding(text: str) -> "torch.Tensor":
    """Computes the sentence embedding for a given text using LaBSE."""
    if not REAL_NLP_AVAILABLE or nlp_tokenizer is None or nlp_model is None:
        raise RuntimeError("NLP models are not available")
    
    import torch
    inputs = nlp_tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=128)
    
    # Move inputs to same device as model
    device = next(nlp_model.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}
    
    with torch.no_grad():
        outputs = nlp_model(**inputs)
        
    # Standard CLS mean pooling
    attention_mask = inputs["attention_mask"]
    token_embeddings = outputs.last_hidden_state
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
    sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
    mean_embeddings = sum_embeddings / sum_mask
    
    # Normalize to unit length
    mean_embeddings = mean_embeddings / torch.norm(mean_embeddings, p=2, dim=1, keepdim=True)
    return mean_embeddings[0]

def compute_cosine_similarity(emb1: "torch.Tensor", emb2: "torch.Tensor") -> float:
    import torch
    return torch.dot(emb1, emb2).item()

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
    "Alibi & Location": ["home", "घर", "office", "office", "crime", "scene", "वहां", "road", "spot", "indoors"],
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

import re

def is_time_bounded_location(text):
    # Detects patterns like 'at home for lunch', 'at office in morning', 'was there during evening'
    # Looks for preposition + place + time preposition + time noun structure
    time_prep_pattern = r'\b(for|during|at|in|on)\s+\w+\s*(morning|afternoon|evening|night|noon|lunch|dinner|breakfast|supper|midnight|today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|weekday|january|february|march|april|may|june|july|august|september|october|november|december)\b'
    return bool(re.search(time_prep_pattern, text.lower()))

def extract_time_words(text):
    # Extract ALL time-related words from text
    time_pattern = r'\b(morning|afternoon|evening|night|noon|lunch|dinner|breakfast|supper|midnight|today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|january|february|march|april|may|june|july|august|september|october|november|december|last\s+\w+|this\s+\w+|next\s+\w+|\d+\s*(?:am|pm|oclock|o\'clock)|\d+:\d+)\b'
    return set(re.findall(time_pattern, text.lower()))

def detect_contradictions(current_utterance: str, session_id: str, previous_segments: list = None) -> tuple:
    """
    Compares the current statement against all prior statements in the session.
    Detects semantic contradictions (English/Hindi/Hinglish) using local rule clusters and LaBSE embeddings.
    Queries the PostgreSQL database directly to fetch the last 10 real transcript segments.
    Returns:
        (bool, dict) - Contradiction flag and dictionary containing the contradicting statement and reasoning.
    """
    if not current_utterance or not current_utterance.strip():
        return False, None

    # 1. Load the last 10 real transcripts for the current session from the database
    db_segments = []
    try:
        from database import SessionLocal, TranscriptSegmentModel
        db = SessionLocal()
        try:
            prev_rows = db.query(TranscriptSegmentModel).filter(
                TranscriptSegmentModel.session_id == session_id
            ).order_by(TranscriptSegmentModel.timestamp.desc()).limit(10).all()
            
            # Formulate segments list (reversed to be in chronological order)
            db_segments = [
                {"utterance": row.utterance, "timestamp": row.timestamp.isoformat()}
                for row in reversed(prev_rows)
            ]
        finally:
            db.close()
    except Exception as e:
        print(f"Error querying database for contradiction detection: {e}")
        # Fallback to previous_segments argument if database call fails
        if previous_segments is not None:
            db_segments = previous_segments

    # 2. Heuristic Negation Check (Fix 2)
    negation_keywords = ["don't have", "never had", "dont have", "do not have"]
    curr_lower = current_utterance.lower()
    for prev in db_segments:
        prev_text = prev.get("utterance", "")
        if not prev_text:
            continue
        if len(current_utterance.split()) < 5 or len(prev_text.split()) < 5:
            continue
        prev_lower = prev_text.lower()
        
        # Check time references context
        time_words_curr = extract_time_words(current_utterance)
        time_words_prev = extract_time_words(prev_text)
        if time_words_curr and time_words_prev and not time_words_curr.intersection(time_words_prev):
            continue  # different time contexts, not a contradiction

        has_neg_curr = any(neg in curr_lower for neg in negation_keywords)
        has_neg_prev = any(neg in prev_lower for neg in negation_keywords)
        
        if (has_neg_curr and not has_neg_prev) or (has_neg_prev and not has_neg_curr):
            nouns = ["kids", "children", "wife", "husband", "car", "bike", "job", "money", "license", "son", "daughter"]
            for noun in nouns:
                if noun in curr_lower and noun in prev_lower:
                    reason = f"CONTRADICTION DETECTED (Negation check): Subject said '{current_utterance}' but earlier stated '{prev_text}'"
                    return True, {
                        "contradicting_statement": prev_text,
                        "reasoning": reason,
                        "confidence": 0.95,
                        "timestamp": prev.get("timestamp")
                    }

    # 3. Use real semantic comparison if available
    if REAL_NLP_AVAILABLE and db_segments:
        try:
            curr_topic = identify_topic(current_utterance)
            # Only do same-topic consistency check for specific topics (exclude General Inquiry)
            if curr_topic != "General Inquiry":
                curr_emb = get_sentence_embedding(current_utterance)
                
                for prev in db_segments:
                    prev_text = prev.get("utterance", "")
                    if not prev_text or prev_text.strip() == "":
                        continue
                    if len(current_utterance.split()) < 5 or len(prev_text.split()) < 5:
                        continue
                    
                    # Check time references context
                    time_words_curr = extract_time_words(current_utterance)
                    time_words_prev = extract_time_words(prev_text)
                    if time_words_curr and time_words_prev and not time_words_curr.intersection(time_words_prev):
                        continue  # different time contexts, not a contradiction

                    prev_topic = identify_topic(prev_text)
                    if prev_topic == curr_topic:
                        prev_emb = get_sentence_embedding(prev_text)
                        raw_similarity = compute_cosine_similarity(curr_emb, prev_emb)
                        # Scale raw similarity so that 0.76 maps to 0.3
                        scaled_sim = 10.0 * (raw_similarity - 0.76) + 0.3
                        print(f"Semantic match check: '{current_utterance}' vs '{prev_text}' -> Raw Cosine Similarity: {raw_similarity:.4f}, Scaled Similarity: {scaled_sim:.4f}")
                        
                        # Threshold of 0.7 or lower means low similarity (contradiction in the same topic)
                        if scaled_sim <= 0.7:  # was 0.3 or 0.5
                            reason = f"CONTRADICTION DETECTED: Subject said '{current_utterance}' but earlier stated '{prev_text}'"
                            return True, {
                                "contradicting_statement": prev_text,
                                "reasoning": reason,
                                "confidence": round(1.0 - raw_similarity, 2),
                                "timestamp": prev.get("timestamp")
                            }
        except Exception as e:
            print(f"Real semantic contradiction detection failed: {e}")

    # 3. Heuristic Rules Fallback
    curr_lower = current_utterance.lower()
    for prev in db_segments:
        prev_text = prev.get("utterance", "").lower()
        if not prev_text:
            continue
        if len(current_utterance.split()) < 5 or len(prev_text.split()) < 5:
            continue
            
        # Check time references context
        time_words_curr = extract_time_words(current_utterance)
        time_words_prev = extract_time_words(prev_text)
        if time_words_curr and time_words_prev and not time_words_curr.intersection(time_words_prev):
            continue  # different time contexts, not a contradiction

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

def analyze_linguistics(current_utterance: str, session_id: str, previous_segments: list = None) -> dict:
    """
    NLP entry point analyzing linguistic consistency and topic categories.
    Logs inference outputs to the tamper-evident hash chain.
    """
    # Query database to check if the session is a live browser session
    is_live = True
    try:
        from database import SessionLocal, SessionModel
        db = SessionLocal()
        try:
            session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
            if session:
                is_live = session.is_live_session
        finally:
            db.close()
    except Exception as e:
        print(f"Error querying session is_live_session in NLP: {e}")

    topic = None
    is_contradiction = False
    details = None

    # 1. If NOT a live session, check mock_speech_registry.json first
    if not is_live:
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
                        if entry.get("contradiction_flag"):
                            is_contradiction = True
                            details = entry.get("contradiction_details")
                        break
        except Exception as e:
            print(f"Error checking registry for topic/contradiction: {e}")

    # 2. Identify Topic if not set
    if not topic:
        topic = identify_topic(current_utterance)

    # 3. Check for contradictions if not set
    if not is_contradiction:
        is_contradiction, details = detect_contradictions(current_utterance, session_id, previous_segments)
        
    demo_mode = not REAL_NLP_AVAILABLE
    log_audit_event(
        event_type="NLP_LINGUISTIC_ANALYSIS",
        details={
            "session_id": session_id,
            "demo_mode": demo_mode,
            "topic": topic,
            "is_contradiction": is_contradiction,
            "contradiction_details": details
        },
        model_version="LaBSE" if REAL_NLP_AVAILABLE else "SIMULATION"
    )
    
    return {
        "demo_mode": demo_mode,
        "topic": topic,
        "contradiction_flag": is_contradiction,
        "contradiction_details": details
    }
