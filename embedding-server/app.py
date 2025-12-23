from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests

# Load model at startup (this takes ~30 seconds on first load)
print("Loading embedding model...")
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
print("Model loaded successfully!")

@app.route('/', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "model": "all-MiniLM-L6-v2",
        "dimensions": 384
    })

@app.route('/embeddings', methods=['POST'])
def get_embeddings():
    """Generate embeddings for input texts"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        texts = data.get('inputs', [])
        
        if not texts:
            return jsonify({"error": "No texts provided"}), 400
        
        # Handle single text or list of texts
        if isinstance(texts, str):
            texts = [texts]
        
        print(f"Processing {len(texts)} texts...")
        
        # Generate embeddings
        embeddings = model.encode(texts, show_progress_bar=False).tolist()
        
        print(f"Generated {len(embeddings)} embeddings")
        
        return jsonify(embeddings)
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)
