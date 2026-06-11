# Use Python 3.10 for ML library compatibility
FROM python:3.10-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/models/hf_cache

WORKDIR /app

# Install system dependencies (compilers, audio tools, ffmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    curl \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements list
COPY requirements.txt .

# Install dependencies (will use CUDA if GPU is mapped, otherwise CPU)
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy source code
COPY . .

# Build argument to choose Whisper model size (large for production, tiny for fast dev)
ARG WHISPER_MODEL=openai/whisper-large-v3
ENV WHISPER_MODEL=$WHISPER_MODEL

# Pre-download and cache model weights at build time (no runtime network calls)
RUN python download_models.py

EXPOSE 8000

# Run FastAPI app
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
