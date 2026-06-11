from sqlalchemy.orm import Session
from database import SessionLocal, SessionModel, TranscriptSegmentModel, BehavioralCueModel
import os
import shutil

def get_session_model(db: Session, session_id: str) -> SessionModel:
    """Helper to fetch session from DB."""
    return db.query(SessionModel).filter(SessionModel.id == session_id).first()

def set_consent(session_id: str, status: str, demographics_volunteered: dict = None, is_vulnerable: bool = False, demo_mode: bool = False) -> bool:
    """
    Sets or updates the consent status for an interview session.
    Fulfills DPDP Act 2023 requirements for informed and explicit consent.
    """
    db = SessionLocal()
    try:
        session = get_session_model(db, session_id)
        if not session:
            session = SessionModel(
                id=session_id,
                officer_id="default_officer",
                consent_status=status,
                demographics_volunteered=demographics_volunteered,
                is_vulnerable=is_vulnerable,
                demo_mode=demo_mode
            )
            db.add(session)
        else:
            session.consent_status = status
            if demographics_volunteered is not None:
                session.demographics_volunteered = demographics_volunteered
            session.is_vulnerable = is_vulnerable
            session.demo_mode = demo_mode
        db.commit()
        return True
    except Exception as e:
        print(f"Error setting consent: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def withdraw_consent(session_id: str) -> bool:
    """
    Immediately withdraws consent for the session.
    Fulfills DPDP Act 2023 requirement that consent withdrawal must be easy and immediate.
    """
    db = SessionLocal()
    try:
        session = get_session_model(db, session_id)
        if session:
            session.consent_status = "Withdrawn"
            db.commit()
            print(f"Consent withdrawn for session {session_id}. Inference must stop immediately.")
            return True
        return False
    except Exception as e:
        print(f"Error withdrawing consent: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def is_inference_allowed(session_id: str) -> bool:
    """
    Checks if active model inference is allowed on the subject.
    Inference is ONLY allowed if consent is explicitly Granted.
    Vulnerability-based halts are managed independently by safeguard.py.
    """
    db = SessionLocal()
    try:
        session = get_session_model(db, session_id)
        if session:
            # Must have explicit 'Granted' consent
            return session.consent_status == "Granted"
        return False
    except Exception as e:
        print(f"Error checking inference permissions: {e}")
        return False
    finally:
        db.close()

def delete_session_data(session_id: str) -> bool:
    """
    Permanently erases all session records from the database and deletes mock S3 storage files.
    Fulfills DPDP Act 2023 'Right to Erasure' (Data Principal's right to delete data).
    """
    db = SessionLocal()
    try:
        # 1. Delete DB Records
        session = get_session_model(db, session_id)
        if session:
            db.delete(session)
            db.commit()
        
        # 2. Delete Associated S3/Filesystem data
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        s3_mock_session_dir = os.path.join(BASE_DIR, "data", "s3_mock", "sessions", session_id)
        if os.path.exists(s3_mock_session_dir):
            shutil.rmtree(s3_mock_session_dir)
            
        print(f"Session data for {session_id} permanently erased (DPDP Right to Erasure).")
        return True
    except Exception as e:
        print(f"Error deleting session data: {e}")
        db.rollback()
        return False
    finally:
        db.close()
