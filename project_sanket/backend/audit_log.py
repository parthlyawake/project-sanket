import os
import json
import datetime
import hashlib
from nacl.signing import SigningKey, VerifyKey
from nacl.encoding import HexEncoder
from database import SessionLocal, AuditLogModel

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.path.join(BASE_DIR, "..", "logs")
KEY_DIR = os.path.join(BASE_DIR, "data", "keys")

os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(KEY_DIR, exist_ok=True)

KEY_FILE = os.path.join(KEY_DIR, "audit_signing_key.key")
LOG_FILE = os.path.join(LOG_DIR, "hashchain.log")

# Setup or load the persistent Ed25519 signing key
if os.path.exists(KEY_FILE):
    with open(KEY_FILE, "rb") as f:
        signing_key = SigningKey(f.read())
else:
    signing_key = SigningKey.generate()
    with open(KEY_FILE, "wb") as f:
        f.write(signing_key.encode())

verify_key = signing_key.verify_key
verify_key_hex = verify_key.encode(encoder=HexEncoder).decode()

def get_last_entry_hash() -> str:
    """Reads the last entry from the hashchain.log file to get the chaining hash."""
    if not os.path.exists(LOG_FILE) or os.path.getsize(LOG_FILE) == 0:
        return "0" * 64  # Genesis previous hash representation
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()
        if not lines:
            return "0" * 64
        try:
            last_entry = json.loads(lines[-1].strip())
            return last_entry.get("entry_hash", "0" * 64)
        except Exception:
            return "0" * 64

def log_audit_event(event_type: str, details: dict, input_data_bytes: bytes = None, model_version: str = "1.0.0") -> dict:
    """
    Logs an audit event by hash-chaining it and signing it with the Ed25519 key.
    Writes to both the append-only ledger on disk and the DB ORM model.
    """
    # 1. Compute input data hash
    if input_data_bytes is not None:
        input_hash = hashlib.sha256(input_data_bytes).hexdigest()
    else:
        # Default to hashing serialized details if no raw bytes are supplied
        input_hash = hashlib.sha256(json.dumps(details, sort_keys=True).encode()).hexdigest()

    previous_hash = get_last_entry_hash()
    timestamp = datetime.datetime.utcnow().isoformat()
    
    # 2. Determine entry index
    index = 0
    if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > 0:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            index = len(f.readlines())

    # 3. Formulate signable payload
    payload = {
        "index": index,
        "timestamp": timestamp,
        "event_type": event_type,
        "details": details,
        "model_version": model_version,
        "input_hash": input_hash,
        "previous_hash": previous_hash
    }
    
    # Serialize payload consistently (sorted keys)
    payload_bytes = json.dumps(payload, sort_keys=True).encode()
    entry_hash = hashlib.sha256(payload_bytes).hexdigest()
    
    # 4. Sign with Ed25519 key
    signature = signing_key.sign(entry_hash.encode()).signature.hex()
    
    # Complete entry object
    full_entry = {
        **payload,
        "entry_hash": entry_hash,
        "signature": signature,
        "public_key": verify_key_hex
    }
    
    # 5. Append to the JSONL log file
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(full_entry) + "\n")
        
    # 6. Mirror to the relational database
    db = SessionLocal()
    try:
        db_log = AuditLogModel(
            timestamp=datetime.datetime.fromisoformat(timestamp),
            event_type=event_type,
            details=details,
            input_hash=input_hash,
            output_hash=entry_hash,
            signature=signature
        )
        db.add(db_log)
        db.commit()
    except Exception as e:
        print(f"Error mirroring audit log to database: {e}")
        db.rollback()
    finally:
        db.close()
        
    return full_entry

def verify_hash_chain() -> bool:
    """
    Validates the entire hash chain from index 0.
    Checks signature cryptographically and validates hash linkages.
    Returns True if valid, False if tampered with.
    """
    if not os.path.exists(LOG_FILE) or os.path.getsize(LOG_FILE) == 0:
        return True
        
    expected_prev_hash = "0" * 64
    
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                
                # Check index integrity
                if entry.get("index") != line_num:
                    print(f"Audit log tampered: index mismatch on line {line_num} (expected {line_num}, got {entry.get('index')})")
                    return False
                    
                # Reconstruct signable payload
                payload = {
                    "index": entry["index"],
                    "timestamp": entry["timestamp"],
                    "event_type": entry["event_type"],
                    "details": entry["details"],
                    "model_version": entry["model_version"],
                    "input_hash": entry["input_hash"],
                    "previous_hash": entry["previous_hash"]
                }
                
                # Verify chaining hash
                if entry["previous_hash"] != expected_prev_hash:
                    print(f"Audit log tampered: chain break on line {line_num}. Expected previous hash '{expected_prev_hash}', got '{entry['previous_hash']}'")
                    return False
                    
                # Re-compute entry hash
                payload_bytes = json.dumps(payload, sort_keys=True).encode()
                recomputed_hash = hashlib.sha256(payload_bytes).hexdigest()
                if recomputed_hash != entry["entry_hash"]:
                    print(f"Audit log tampered: entry hash mismatch on line {line_num}")
                    return False
                    
                # Verify signature
                v_key = VerifyKey(entry["public_key"], encoder=HexEncoder)
                v_key.verify(entry["entry_hash"].encode(), bytes.fromhex(entry["signature"]))
                
                # Update expected hash for next loop iteration
                expected_prev_hash = entry["entry_hash"]
            except Exception as e:
                print(f"Audit log verification failed on line {line_num} with error: {e}")
                return False
                
    return True
