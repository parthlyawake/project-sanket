import os
import cv2
import numpy as np
import time
import math
import argparse
import requests

def generate_mock_face_frame(frame_num: int, t: float) -> np.ndarray:
    """
    Renders a synthetic frame containing a 2D face outline.
    Features:
      - Head movements (gaze shifts/nods): Ellipse center oscillates.
      - Eye blinks: Eye circles close every 30 frames.
      - Simulated rPPG pulse: Skin area red color channel oscillates at 1.2 Hz (72 BPM).
    """
    # Create dark gray background
    img = np.zeros((480, 640, 3), dtype=np.uint8) + 40
    
    # 1. Calculate head center coordinates (simulate slow movement)
    head_x = int(320 + 40 * np.sin(t * 0.5))
    head_y = int(240 + 20 * np.cos(t * 0.8))
    
    # 2. Simulate skin color blood volume pulse (rPPG)
    # 1.2 Hz frequency = 72 BPM. We oscillate the red channel intensity of the face skin.
    pulse_val = int(10 * np.sin(2 * math.pi * 1.2 * t))
    skin_color = (130 + pulse_val, 180, 230) # BGR (Light peach with pulsing red)
    
    # Draw head (face skin)
    cv2.ellipse(img, (head_x, head_y), (80, 110), 0, 0, 360, skin_color, -1)
    # Face outline border
    cv2.ellipse(img, (head_x, head_y), (80, 110), 0, 0, 360, (100, 120, 150), 3)
    
    # 3. Draw eyes (blink check every 30 frames for 3 frames)
    eye_offset_x = 30
    eye_y = head_y - 25
    is_blinking = (frame_num % 30) in [0, 1, 2]
    
    left_eye_center = (head_x - eye_offset_x, eye_y)
    right_eye_center = (head_x + eye_offset_x, eye_y)
    
    if is_blinking:
        # Draw closed eyes (flat lines)
        cv2.line(img, (left_eye_center[0] - 15, eye_y), (left_eye_center[0] + 15, eye_y), (30, 30, 30), 3)
        cv2.line(img, (right_eye_center[0] - 15, eye_y), (right_eye_center[0] + 15, eye_y), (30, 30, 30), 3)
    else:
        # Draw open eyes (circles with pupils)
        cv2.circle(img, left_eye_center, 12, (255, 255, 255), -1)
        cv2.circle(img, right_eye_center, 12, (255, 255, 255), -1)
        
        # Pupils (slight gaze look-around)
        gaze_look_x = int(4 * np.sin(t * 0.3))
        gaze_look_y = int(2 * np.cos(t * 0.4))
        cv2.circle(img, (left_eye_center[0] + gaze_look_x, left_eye_center[1] + gaze_look_y), 5, (0, 0, 0), -1)
        cv2.circle(img, (right_eye_center[0] + gaze_look_x, right_eye_center[1] + gaze_look_y), 5, (0, 0, 0), -1)

    # 4. Draw mouth (simple lip line)
    mouth_y = head_y + 40
    # mouth changes shape slightly representing speech
    mouth_open_factor = int(8 * abs(np.sin(t * 4.0)))
    cv2.ellipse(img, (head_x, mouth_y), (25, mouth_open_factor), 0, 0, 360, (50, 50, 180), -1)
    cv2.ellipse(img, (head_x, mouth_y), (25, mouth_open_factor), 0, 0, 360, (0, 0, 0), 2)
    
    # 5. Draw overlay text (disclaimer watermark)
    cv2.putText(img, "ASSISTIVE - NOT EVIDENCE", (20, 450), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
    cv2.putText(img, "MOCK CAMERA SOURCE", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 1)

    return img

def main():
    parser = argparse.ArgumentParser(description="SANKET Mock Video Streamer and File Generator")
    parser.add_argument("--save-file", action="store_true", help="Saves output to an MP4 video file")
    parser.add_argument("--stream-api", action="store_true", help="Streams frames via POST to backend endpoint")
    parser.add_argument("--session-id", default="mock_session_123", help="Session ID for API streaming")
    parser.add_argument("--url", default="http://localhost:8000/frame", help="API frame endpoint")
    args = parser.parse_args()

    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.makedirs(os.path.join(BASE_DIR, "data"), exist_ok=True)
    video_path = os.path.join(BASE_DIR, "data", "mock_face.mp4")

    fps = 30
    duration_sec = 10
    total_frames = fps * duration_sec
    
    # Create video writer if file save selected
    writer = None
    if args.save_file:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(video_path, fourcc, fps, (640, 480))
        print(f"Generating mock video file at {video_path}...")

    print("Generating frames...")
    for f in range(total_frames):
        t = f / float(fps)
        img = generate_mock_face_frame(f, t)
        
        if writer is not None:
            writer.write(img)
            
        if args.stream_api:
            # Encode frame to JPEG bytes and POST to endpoint
            _, enc_img = cv2.imencode(".jpg", img)
            files = {"frame": ("frame.jpg", enc_img.tobytes(), "image/jpeg")}
            data = {"session_id": args.session_id, "elapsed_seconds": t}
            try:
                r = requests.post(args.url, files=files, data=data, timeout=1.0)
                if r.status_code == 200:
                    print(f"Posted frame {f}/{total_frames} (t={t:.2f}s). Response: {r.json()}")
                else:
                    print(f"Failed to post frame {f}: {r.status_code}")
            except Exception as e:
                print(f"Connection error at frame {f}: {e}")
                
        # Small delay to mimic normal frame rate if streaming
        if args.stream_api:
            time.sleep(1.0 / fps)

    if writer is not None:
        writer.release()
        print("Mock video file saved successfully.")

if __name__ == "__main__":
    main()
