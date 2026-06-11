import os
import json
import wave
import struct
import math
import argparse
import requests
import time

# Pre-defined test transcripts for mock sessions (includes Hindi, Hinglish, English, Marathi, Tamil)
MOCK_TRANSCRIPT_TIMELINE = [
    {"start_time": 0.0, "end_time": 3.0, "speaker_id": "Officer", "utterance": "Please state your full name and occupation for the record.", "language": "English"},
    {"start_time": 4.0, "end_time": 7.0, "speaker_id": "Subject", "utterance": "My name is Raj Malhotra, and I work as a software engineer.", "language": "English"},
    {"start_time": 8.0, "end_time": 11.0, "speaker_id": "Officer", "utterance": "But witnesses say you were near the crime scene. Explain that.", "language": "English"},
    {"start_time": 12.0, "end_time": 15.0, "speaker_id": "Subject", "utterance": "सर, मैं कल रात normal time पर घर आ गया था, around 9 PM.", "language": "Hinglish"},
    {"start_time": 16.0, "end_time": 19.0, "speaker_id": "Subject", "utterance": "वो झूठ बोल रहे हैं, I was completely at home with my family.", "language": "Hinglish"},
    {"start_time": 20.0, "end_time": 23.0, "speaker_id": "Officer", "utterance": "या गुन्ह्याविषयी तुला काय माहिती आहे का?", "language": "Marathi"},
    {"start_time": 24.0, "end_time": 27.0, "speaker_id": "Subject", "utterance": "मी तिथे गेलो नव्हतो, मला याबद्दल काहीच माहित नाही.", "language": "Marathi"},
    {"start_time": 28.0, "end_time": 31.0, "speaker_id": "Subject", "utterance": "எனக்கு இந்த விஷயத்தில் எந்த சம்பந்தமும் இல்லை.", "language": "Tamil"}
]

def generate_synthetic_tone(file_path: str, duration_sec: float = 3.0, freq: int = 440, sample_rate: int = 16000):
    """
    Generates a standard mono 16-bit PCM WAV audio file containing a pure sine tone.
    Uses only Python standard libraries to prevent external dependency failures.
    """
    num_samples = int(duration_sec * sample_rate)
    with wave.open(file_path, "wb") as wav_file:
        # Parameters: nchannels=1 (mono), sampwidth=2 (16-bit), framerate=16000, nframes, comptype, compname
        wav_file.setparams((1, 2, sample_rate, num_samples, "NONE", "not compressed"))
        for i in range(num_samples):
            # Calculate sine wave value scaled to 16-bit integer bounds
            val = int(16384.0 * math.sin(2.0 * math.pi * freq * i / sample_rate))
            wav_file.writeframes(struct.pack("<h", val))

def main():
    parser = argparse.ArgumentParser(description="SANKET Mock Audio Streamer and File Generator")
    parser.add_argument("--save-files", action="store_true", help="Generates WAV files on disk")
    parser.add_argument("--stream-api", action="store_true", help="Streams chunks to the backend endpoint")
    parser.add_argument("--session-id", default="mock_session_123", help="Session ID for audio streaming")
    parser.add_argument("--url", default="http://localhost:8000/audio", help="API audio endpoint")
    args = parser.parse_args()

    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(BASE_DIR, "data")
    backend_data_dir = os.path.join(BASE_DIR, "backend", "data")
    
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(backend_data_dir, exist_ok=True)

    # 1. Populate the mock speech registry JSON so the fallback ASR is 100% aligned
    registry_path = os.path.join(backend_data_dir, "mock_speech_registry.json")
    try:
        # Load existing registry or initialize new
        registry = {}
        if os.path.exists(registry_path):
            with open(registry_path, "r", encoding="utf-8") as f:
                registry = json.load(f)
        
        # Add or overwrite timeline for this session
        registry[args.session_id] = MOCK_TRANSCRIPT_TIMELINE
        with open(registry_path, "w", encoding="utf-8") as f:
            json.dump(registry, f, indent=2, ensure_ascii=False)
        print(f"Populated mock speech registry for session {args.session_id} at {registry_path}.")
    except Exception as e:
        print(f"Failed to update mock speech registry: {e}")

    # 2. Generate and optionally stream each audio chunk
    for idx, segment in enumerate(MOCK_TRANSCRIPT_TIMELINE):
        chunk_name = f"chunk_{idx}_{segment['language']}.wav"
        chunk_path = os.path.join(data_dir, chunk_name)
        duration = segment["end_time"] - segment["start_time"]
        
        # Determine unique tone frequency per speaker for variety
        freq = 320 if segment["speaker_id"] == "Officer" else 220
        
        # Generate the file
        generate_synthetic_tone(chunk_path, duration_sec=duration, freq=freq)
        print(f"Generated {chunk_name} ({duration}s, {freq}Hz).")

        if args.stream_api:
            # POST the WAV file to backend
            with open(chunk_path, "rb") as f:
                wav_bytes = f.read()
                
            files = {"audio": (chunk_name, wav_bytes, "audio/wav")}
            data = {
                "session_id": args.session_id,
                "elapsed_seconds": segment["start_time"]
            }
            try:
                r = requests.post(args.url, files=files, data=data, timeout=5.0)
                if r.status_code == 200:
                    res_json = r.json()
                    status_val = res_json.get("status")
                    print(f"Posted {chunk_name} at t={segment['start_time']}s. Status: {status_val}")
                    if status_val == "success":
                        print(f"  Transcript: [{res_json.get('speaker_id')}] - {res_json.get('utterance')}")
                        acoustics = res_json.get('acoustic_cues') or {}
                        pitch = acoustics.get('pitch')
                        jitter = acoustics.get('jitter')
                        pitch_str = f"{pitch:.1f} Hz" if pitch is not None else "N/A"
                        jitter_str = f"{jitter:.4f}" if jitter is not None else "N/A"
                        print(f"  Acoustics: Pitch={pitch_str}, Jitter={jitter_str}")
                        nlp = res_json.get("nlp_analysis") or {}
                        if nlp.get("contradiction_flag"):
                            print(f"  [CONTRADICTION FLAG] {nlp.get('contradiction_details', {}).get('reasoning')}")
                    else:
                        print(f"  Message: {res_json.get('message')}")
                else:
                    print(f"Failed to post chunk {chunk_name}: {r.status_code}")
            except Exception as e:
                print(f"Connection error at chunk {idx}: {e}")
                
            # Simulate real time pauses between statements if streaming
            time.sleep(1.0)

    print("Mock audio processing completed.")

if __name__ == "__main__":
    main()
