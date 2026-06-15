import os
import sys
import time
import requests
import cv2
import numpy as np

# Add scripts directory to path to import mock generator functions
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from mock_video import generate_mock_face_frame
from mock_audio import generate_synthetic_tone

def main():
    session_id = "live_test_session_abc"
    base_url = "http://localhost:8001"
    
    print("--- STARTING LIVE END-TO-END TEST ---")
    print(f"Target URL: {base_url}")
    print(f"Session ID: {session_id}")
    
    # Step 1: Submit explicit consent
    print("\n1. Submitting consent...")
    r = requests.post(f"{base_url}/consent", data={
        "session_id": session_id,
        "officer_id": "test_officer",
        "status": "Granted",
        "sex": "Male",
        "age": "30",
        "language": "English",
        "case_type": "Live Verification"
    })
    print("Consent response:", r.json())
    
    # Step 2: Stream 65 video frames to allow CHROM rPPG history compilation (needs >= 60 frames)
    print("\n2. Streaming 65 frames to backend...")
    last_frame_response = None
    for f in range(65):
        t = f / 30.0
        img = generate_mock_face_frame(f, t)
        
        # Encode frame to JPEG
        _, enc_img = cv2.imencode(".jpg", img)
        files = {"frame": ("frame.jpg", enc_img.tobytes(), "image/jpeg")}
        data = {"session_id": session_id, "elapsed_seconds": t}
        
        r = requests.post(f"{base_url}/frame", files=files, data=data)
        if f % 15 == 0 or f == 64:
            print(f"  Sent frame {f}/65 (t={t:.2f}s). Status code: {r.status_code}")
        if f == 64:
            last_frame_response = r.json()
            
    print("\n3. Raw JSON response from the 65th frame (/frame):")
    import json
    print(json.dumps(last_frame_response, indent=2))
    
    # Step 3: Generate and stream an audio chunk to trigger Whisper & openSMILE
    print("\n4. Generating and streaming a 3-second audio chunk...")
    audio_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "test_live_audio.wav")
    os.makedirs(os.path.dirname(audio_path), exist_ok=True)
    
    # Generate a synthetic tone at 440 Hz for 3 seconds
    generate_synthetic_tone(audio_path, duration_sec=3.0, freq=440)
    
    with open(audio_path, "rb") as f:
        audio_bytes = f.read()
        
    files = {"audio": ("test_live_audio.wav", audio_bytes, "audio/wav")}
    data = {
        "session_id": session_id,
        "elapsed_seconds": 0.0
    }
    
    r = requests.post(f"{base_url}/audio", files=files, data=data)
    print("\n5. Raw JSON response from /audio:")
    print(json.dumps(r.json(), indent=2))
    
    print("\n--- LIVE END-TO-END TEST COMPLETED ---")

if __name__ == "__main__":
    main()
