# Embedding Server for Grievance Detection System

A Flask-based embedding server using sentence-transformers for generating text embeddings.

## Deployment to Render.com (Free)

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up with GitHub

### Step 2: Create New Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `grievance-embedding-server`
   - **Region**: Choose nearest
   - **Branch**: `main`
   - **Root Directory**: `embedding-server`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Instance Type**: Free

### Step 3: Deploy
Click "Create Web Service" - deployment takes 5-10 minutes.

### Step 4: Use the URL
Your server URL will be: `https://grievance-embedding-server.onrender.com`

Add to your backend `.dev.vars`:
```
EMBEDDING_SERVER_URL=https://grievance-embedding-server.onrender.com/embeddings
```

## API Endpoints

### Health Check
```
GET /
```

### Generate Embeddings
```
POST /embeddings
Content-Type: application/json

{
    "inputs": ["text1", "text2", "text3"]
}
```

**Response**: Array of 768-dimensional embedding vectors

## Local Development
```bash
pip install -r requirements.txt
python app.py
```

Server runs at http://localhost:5001

## Note
The free tier has a cold start delay (~30 seconds) if the service hasn't been used for 15 minutes. First request may be slow, but subsequent requests are fast.
