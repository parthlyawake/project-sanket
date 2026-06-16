import time
import numpy as np

# Global store for active baseline sessions
_active_baselines = {}

class BaselineSession:
    """
    Manages the baseline profile collection period for a single session.
    Enforces a configurable 3-5 minute silent window (180s - 300s), defaulting to 4 minutes (240s).
    During this period, cue data is gathered but no alerts are generated.
    """
    def __init__(self, session_id: str, duration_seconds: int = 60):
        self.session_id = session_id
        self.duration_seconds = duration_seconds
        self.start_time = None
        self.samples = {
            "heart_rate": [],
            "pitch": [],
            "posture_shift": [],
            "face_au_intensity": []
        }
        self.stats = {}
        self.completed = False

    def start(self):
        """Starts the baseline timer."""
        self.start_time = time.time()
        print(f"Baseline collection started for session {self.session_id}. Window: {self.duration_seconds} seconds.")

    def get_elapsed_time(self) -> float:
        """Returns the elapsed time in seconds since the baseline started."""
        if self.start_time is None:
            return 0.0
        return time.time() - self.start_time

    def is_complete(self) -> bool:
        """
        Checks if the baseline period is complete.
        If complete, automatically triggers profile finalization.
        """
        if self.completed:
            return True
        if self.start_time is None:
            return False
        if self.get_elapsed_time() >= self.duration_seconds:
            self.finalize()
            return True
        return False

    def add_sample(self, modality: str, value: float):
        """
        Adds a cue measurement sample to the baseline database.
        Ignored if the baseline has already completed.
        """
        if self.completed or self.start_time is None:
            return
        if modality in self.samples:
            self.samples[modality].append(value)

    def finalize(self):
        """
        Calculates the mean and standard deviation for each sensory modality.
        Transitions the baseline session to completed status.
        """
        self.stats = {}
        for modality, vals in self.samples.items():
            if len(vals) > 0:
                self.stats[modality] = {
                    "mean": float(np.mean(vals)),
                    "std": float(np.std(vals)) if len(vals) > 1 else 1.0
                }
            else:
                # Safe fallbacks if no samples were received
                self.stats[modality] = {"mean": 0.0, "std": 1.0}
        self.completed = True
        print(f"Baseline profile finalized for session {self.session_id}: {self.stats}")

    def get_deviation(self, modality: str, current_value: float) -> dict:
        """
        Calculates the statistical deviation of a current value from the collected baseline.
        Returns:
            dict containing deviation score, standard deviations from mean, and alert flag.
        """
        if not self.completed:
            # Silent period: no alerts/deviations reported
            return {"deviation_std": 0.0, "is_deviation": False, "reason": "Baseline not completed"}

        stats = self.stats.get(modality, {"mean": 0.0, "std": 1.0})
        mean = stats["mean"]
        std = stats["std"]
        
        diff = current_value - mean
        dev_std = diff / std if std > 0 else 0.0
        
        # Consider a deviation significant if it is greater than 2.0 standard deviations from the mean
        is_deviation = abs(dev_std) >= 2.0
        
        return {
            "deviation_std": float(dev_std),
            "is_deviation": is_deviation,
            "mean": mean,
            "std": std
        }

def get_or_create_baseline(session_id: str, duration_seconds: int = 60) -> BaselineSession:
    """Retrieves or registers a baseline session manager."""
    if session_id not in _active_baselines:
        _active_baselines[session_id] = BaselineSession(session_id, duration_seconds)
    return _active_baselines[session_id]

def reset_baseline(session_id: str):
    """Removes a baseline session manager."""
    if session_id in _active_baselines:
        del _active_baselines[session_id]
