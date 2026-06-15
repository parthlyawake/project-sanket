import os
import datetime
from sqlalchemy import create_engine, Column, String, Float, Boolean, DateTime, ForeignKey, Text, JSON, Integer
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

# Database URL configuration (defaults to local PostgreSQL)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/sanket")

# Transparent fallback logic
try:
    # Attempt to initialize PostgreSQL engine with a short timeout
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"connect_timeout": 3} if "postgresql" in DATABASE_URL else {}
    )
    # Test connection
    with engine.connect() as conn:
        print("Connected to PostgreSQL database successfully.")
except Exception as e:
    print(f"PostgreSQL connection failed ({e}). Falling back to SQLite local database.")
    # Fallback to local SQLite file database
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DB_DIR = os.path.join(BASE_DIR, "data")
    os.makedirs(DB_DIR, exist_ok=True)
    db_path = os.path.join(DB_DIR, "sanket.db")
    DATABASE_URL = f"sqlite:///{db_path}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class SessionModel(Base):
    """
    Session table representing a single interview recording and analysis session.
    """
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True)
    officer_id = Column(String, index=True, nullable=False)
    start_time = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    end_time = Column(DateTime, nullable=True)
    location = Column(String, nullable=True)
    consent_status = Column(String, default="Pending", nullable=False)  # Pending, Granted, Withdrawn, Denied
    demographics_volunteered = Column(JSON, nullable=True)  # e.g., {"sex": "Male", "age_group": "18-30", "language": "Hindi"}
    is_vulnerable = Column(Boolean, default=False, nullable=False)
    demo_mode = Column(Boolean, default=False, nullable=False)
    is_live_session = Column(Boolean, default=True, nullable=False)
    final_hash = Column(String, nullable=True)

    transcripts = relationship("TranscriptSegmentModel", back_populates="session", cascade="all, delete-orphan")
    cues = relationship("BehavioralCueModel", back_populates="session", cascade="all, delete-orphan")

class TranscriptSegmentModel(Base):
    """
    Table storing speaker-diarized text segments and transcript metadata.
    """
    __tablename__ = "transcript_segments"

    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    speaker_id = Column(String, nullable=False)  # Officer, Subject, Third Party
    utterance = Column(Text, nullable=False)
    language = Column(String, nullable=False)  # English, Hindi, Marathi, etc.
    language_confidence = Column(Float, default=1.0)
    start_time = Column(Float, nullable=False)  # relative start offset in seconds
    end_time = Column(Float, nullable=False)    # relative end offset in seconds
    contradiction_flag = Column(Boolean, default=False, nullable=False)
    contradiction_details = Column(JSON, nullable=True)

    session = relationship("SessionModel", back_populates="transcripts")

class BehavioralCueModel(Base):
    """
    Table storing Behavioral and Physiological cues derived from video/audio.
    """
    __tablename__ = "behavioral_cues"

    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    cue_type = Column(String, index=True, nullable=False)  # face_au, gaze, posture, heart_rate, voice_stress
    cue_data = Column(JSON, nullable=False)
    raw_data_ref = Column(String, nullable=True)  # MinIO object path for raw source (frame/audio segment)

    session = relationship("SessionModel", back_populates="cues")

class AuditLogModel(Base):
    """
    Database mirror of the append-only signed audit ledger for querying and auditing.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    event_type = Column(String, index=True, nullable=False)
    details = Column(JSON, nullable=False)
    input_hash = Column(String, nullable=False)
    output_hash = Column(String, nullable=False)
    signature = Column(String, nullable=False)

def init_db():
    """Initializes tables in the connected database."""
    Base.metadata.create_all(bind=engine)
