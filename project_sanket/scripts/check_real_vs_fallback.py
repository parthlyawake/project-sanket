import os
import json
import time
import requests
import wave
import struct
import math

API_URL = "http://localhost:8001"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_FILE = os.path.join(os.path.dirname(BASE_DIR), "logs", "hashchain.log")

def generate_wav_bytes(duration=1.0, freq=440):
    sample_rate = 16000
    num_samples = int(duration * sample_rate)
    
    # Write to a memory buffer
    import io
    wav_io = io.BytesIO()
    with wave.open(wav_io, "wb") as wav_file:
        wav_file.setparams((1, 2, sample_rate, num_samples, "NONE", "not compressed"))
        for i in range(num_samples):
            val = int(16384.0 * math.sin(2.0 * math.pi * freq * i / sample_rate))
            wav_file.writeframes(struct.pack("<h", val))
    return wav_io.getvalue()

def generate_jpg_bytes():
    # 1x1 black pixel JPEG bytes
    return b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xc4\x00\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04\x04\x00\x00\x01\x7d\x01\x02\x03\x00\x04\x11\x05\x12!1A\x06\x13Qaq\x07"g\x14\x81\x91\xa1\x08#B\xb1\xc1\x15R\xd1\xf0$3br\x82\x92\xa2\x16\xe1\xf1\x09C\x17S\xc2\xa3\xb2\xd2\x0aDT\x83\x93\xb3\xd3\xf2\x18U\xe2\xf3%4c\x84\x94\xa4\xc3\xd4\xe3\xf4&5d\x85\x95\xa5\xc4\xd5\xe4\xf5'

def main():
    print("--- SANKET REAL VS FALLBACK INFERENCE TEST ---")
    session_id = f"test_inference_check_{int(time.time())}"
    
    # 1. Register consent
    consent_data = {
        "session_id": session_id,
        "officer_id": "officer_test",
        "status": "Granted",
        "sex": "Male",
        "age": "30",
        "language": "Hindi",
        "case_type": "Check",
        "is_vulnerable": "false"
    }
    
    print(f"Registering consent for {session_id}...")
    r_consent = requests.post(f"{API_URL}/consent", data=consent_data)
    if r_consent.status_code != 200:
        print(f"Failed to register consent: {r_consent.text}")
        return
        
    # 2. Upload mock frame (triggering face_cues & ppg)
    print("Uploading frame bytes...")
    jpg_data = generate_jpg_bytes()
    files = {"frame": ("frame.jpg", jpg_data, "image/jpeg")}
    data = {"session_id": session_id, "elapsed_seconds": 1.0}
    r_frame = requests.post(f"{API_URL}/frame", files=files, data=data)
    if r_frame.status_code != 200:
        print(f"Failed to post frame: {r_frame.text}")
        
    # 3. Upload mock audio (triggering ASR, openSMILE, and NLP)
    print("Uploading audio WAV bytes...")
    wav_data = generate_wav_bytes()
    files = {"audio": ("chunk.wav", wav_data, "audio/wav")}
    data = {"session_id": session_id, "elapsed_seconds": 1.0}
    r_audio = requests.post(f"{API_URL}/audio", files=files, data=data)
    if r_audio.status_code != 200:
        print(f"Failed to post audio: {r_audio.text}")
        
    # Give a tiny buffer for log write
    time.sleep(0.5)
    
    # Sync logs from container
    print("Syncing log file from docker container...")
    os.system("docker cp sanket_backend:/logs/hashchain.log logs/hashchain.log")
    
    # 4. Read last 10 entries of audit log
    if not os.path.exists(LOG_FILE):
        print(f"Log file not found at {LOG_FILE}")
        return
        
    print(f"\nReading audit logs from {LOG_FILE}...")
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    relevant_entries = []
    for line in lines:
        try:
            entry = json.loads(line.strip())
            details = entry.get("details", {})
            if details.get("session_id") == session_id:
                relevant_entries.append(entry)
        except Exception:
            pass
            
    print("\n" + "="*120)
    print(f"{'Processor/Modality':<25} | {'Audit Event Type':<30} | {'Model Version Used':<30} | {'Demo Flag':<10}")
    print("-"*120)
    
    for r in relevant_entries:
        event_type = r.get("event_type")
        details = r.get("details", {})
        model_version = r.get("model_version", "N/A")
        demo_mode = details.get("demo_mode", True)
        
        processor_name = "Unknown"
        if event_type == "CONSENT_RECORDED":
            processor_name = "Consent Gateway"
        elif event_type == "VISION_INFERENCE":
            processor_name = "Vision (face_cues)"
        elif event_type == "PPG_HR_INFERENCE":
            processor_name = "Physiology (rPPG)"
        elif event_type == "ASR_TRANSCRIPTION":
            processor_name = "Audio ASR"
        elif event_type == "AUDIO_ACOUSTIC_INFERENCE":
            processor_name = "Acoustic (openSMILE)"
        elif event_type == "NLP_LINGUISTIC_ANALYSIS":
            processor_name = "NLP Contradiction"
            
        print(f"{processor_name:<25} | {event_type:<30} | {model_version:<30} | {str(demo_mode):<10}")
        
    print("="*120)
    print("\nProcessor Implementation Summary:")
    print("1. ASR: Fallback. Uses corpus/registry lookup. (transformers pipeline is disabled in container).")
    print("2. Vision (face_cues): Hybrid. Runs REAL OpenCV Haar Cascade Face/Eye detection on frame pixels, with fallback temporal simulation for AUs.")
    print("3. Physiology (rPPG): Fallback. Simulates autonomic sinus arrhythmia (pyVHR is disabled on CPU-only container).")
    print("4. Acoustic (openSMILE): Real DSP. Performs REAL DSP autocorrelation pitch, jitter, and shimmer calculations on audio data.")
    print("5. NLP Contradiction: Real Logic. Performs REAL rule-based contradiction detection on transcripts.")

if __name__ == "__main__":
    main()
