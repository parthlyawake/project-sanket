import os
import shutil
from datetime import timedelta
from minio import Minio

# MinIO Connection Configuration
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_SECURE = os.getenv("MINIO_SECURE", "False").lower() in ("true", "1")

class MinioClientWrapper:
    """
    MinIO object storage wrapper with transparent filesystem backup if MinIO is not running.
    """
    def __init__(self):
        self.mock_mode = False
        # Fallback storage directory on local disk
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.local_dir = os.path.join(BASE_DIR, "data", "s3_mock")
        
        try:
            self.client = Minio(
                MINIO_ENDPOINT,
                access_key=MINIO_ACCESS_KEY,
                secret_key=MINIO_SECRET_KEY,
                secure=MINIO_SECURE
            )
            # Quick check to see if connection is healthy
            # We list buckets to check if the server is responsive
            self.client.list_buckets()
            print("Connected to MinIO successfully.")
        except Exception as e:
            print(f"MinIO client connection failed ({e}). Using local folder fallback for object storage.")
            self.mock_mode = True
            os.makedirs(self.local_dir, exist_ok=True)

    def _ensure_bucket(self, bucket_name: str):
        """Ensures that the bucket exists in either MinIO or local mock storage."""
        if self.mock_mode:
            os.makedirs(os.path.join(self.local_dir, bucket_name), exist_ok=True)
            return
        try:
            if not self.client.bucket_exists(bucket_name):
                self.client.make_bucket(bucket_name)
        except Exception as e:
            print(f"Failed to check/create bucket '{bucket_name}' in MinIO: {e}. Switching to mock local storage.")
            self.mock_mode = True
            os.makedirs(os.path.join(self.local_dir, bucket_name), exist_ok=True)

    def upload_file(self, bucket_name: str, object_name: str, file_path: str) -> str:
        """
        Uploads a local file to MinIO or local mock S3 storage.
        Returns a URI referencing the uploaded object.
        """
        self._ensure_bucket(bucket_name)
        if self.mock_mode:
            dest_path = os.path.join(self.local_dir, bucket_name, object_name)
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            shutil.copy2(file_path, dest_path)
            return f"local://{bucket_name}/{object_name}"
        
        try:
            self.client.fput_object(bucket_name, object_name, file_path)
            return f"s3://{bucket_name}/{object_name}"
        except Exception as e:
            print(f"MinIO upload failed ({e}). Falling back to local filesystem storage.")
            self.mock_mode = True
            return self.upload_file(bucket_name, object_name, file_path)

    def download_file(self, bucket_name: str, object_name: str, dest_file_path: str):
        """
        Downloads an object from MinIO or local mock storage to a destination path.
        """
        self._ensure_bucket(bucket_name)
        if self.mock_mode:
            src_path = os.path.join(self.local_dir, bucket_name, object_name)
            if not os.path.exists(src_path):
                raise FileNotFoundError(f"Mock S3 file not found: {src_path}")
            os.makedirs(os.path.dirname(dest_file_path), exist_ok=True)
            shutil.copy2(src_path, dest_file_path)
            return
        
        try:
            self.client.fget_object(bucket_name, object_name, dest_file_path)
        except Exception as e:
            print(f"MinIO download failed ({e}). Falling back to local filesystem storage.")
            self.mock_mode = True
            self.download_file(bucket_name, object_name, dest_file_path)

    def get_presigned_url(self, bucket_name: str, object_name: str) -> str:
        """
        Generates a URL link for accessing the uploaded object.
        For mock mode, returns a file:// URI path.
        """
        if self.mock_mode:
            src_path = os.path.join(self.local_dir, bucket_name, object_name)
            return f"file:///{src_path.replace(os.sep, '/')}"
        try:
            return self.client.presigned_get_object(bucket_name, object_name, expires=timedelta(hours=2))
        except Exception as e:
            print(f"Failed to generate presigned URL ({e}). Using local fallback path.")
            self.mock_mode = True
            return self.get_presigned_url(bucket_name, object_name)

# Singleton client instance
s3_client = MinioClientWrapper()
