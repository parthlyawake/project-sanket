import os
from transformers import AutoTokenizer, AutoModel

def main():
    # Retrieve the Whisper model name from environment variables
    model_name = os.getenv('WHISPER_MODEL', 'openai/whisper-large-v3')
    print(f"--- PRE-DOWNLOADING MODELS FOR OFFLINE USE ---")
    print(f"Selected Whisper Model: {model_name}")
    
    # 1. Download Whisper
    print("Downloading Whisper tokenizer and model...")
    AutoTokenizer.from_pretrained(model_name)
    AutoModel.from_pretrained(model_name)
    
    # 2. Download MuRIL
    print("Downloading MuRIL tokenizer and model...")
    AutoTokenizer.from_pretrained('google/muril-base-cased')
    AutoModel.from_pretrained('google/muril-base-cased')
    
    # 3. Download LaBSE
    print("Downloading LaBSE tokenizer and model...")
    AutoTokenizer.from_pretrained('sentence-transformers/LaBSE')
    AutoModel.from_pretrained('sentence-transformers/LaBSE')
    
    print("--- MODEL PRE-DOWNLOAD COMPLETED ---")

if __name__ == "__main__":
    main()
