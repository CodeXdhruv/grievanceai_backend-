-- Grievance Detection System - Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active INTEGER DEFAULT 1
);

-- Grievances table
CREATE TABLE IF NOT EXISTS grievances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    grievance_text TEXT NOT NULL,
    original_text TEXT NOT NULL,
    submission_type TEXT NOT NULL,
    pdf_upload_id INTEGER,
    -- Structured input fields for better duplicate detection
    category TEXT NOT NULL DEFAULT 'OTHER',
    area TEXT DEFAULT '',
    location_details TEXT DEFAULT '',
    -- Duplicate detection results
    duplicate_status TEXT NOT NULL DEFAULT 'UNIQUE',
    similarity_score REAL DEFAULT 0.0,
    matched_grievance_id INTEGER,
    processed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Embeddings table (for vector storage)
CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grievance_id INTEGER NOT NULL UNIQUE,
    embedding_vector TEXT NOT NULL,
    vector_dimension INTEGER NOT NULL DEFAULT 384,
    model_name TEXT NOT NULL DEFAULT 'paraphrase-MiniLM-L6-v2',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (grievance_id) REFERENCES grievances(id) ON DELETE CASCADE
);

-- PDF uploads table
CREATE TABLE IF NOT EXISTS pdf_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    processing_status TEXT DEFAULT 'pending',
    total_grievances_extracted INTEGER DEFAULT 0,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Similarity logs table
CREATE TABLE IF NOT EXISTS similarity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grievance_id INTEGER NOT NULL,
    compared_with_id INTEGER NOT NULL,
    similarity_score REAL NOT NULL,
    computation_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (grievance_id) REFERENCES grievances(id),
    FOREIGN KEY (compared_with_id) REFERENCES grievances(id)
);

-- System metrics table
CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value TEXT NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_grievances_user_id ON grievances(user_id);
CREATE INDEX IF NOT EXISTS idx_grievances_duplicate_status ON grievances(duplicate_status);
CREATE INDEX IF NOT EXISTS idx_grievances_created ON grievances(created_at);
CREATE INDEX IF NOT EXISTS idx_grievances_pdf ON grievances(pdf_upload_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_grievance_id ON embeddings(grievance_id);
CREATE INDEX IF NOT EXISTS idx_pdf_uploads_user_id ON pdf_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_uploads_status ON pdf_uploads(processing_status);
CREATE INDEX IF NOT EXISTS idx_pdf_uploads_created ON pdf_uploads(created_at);
CREATE INDEX IF NOT EXISTS idx_similarity_grievance ON similarity_logs(grievance_id);
CREATE INDEX IF NOT EXISTS idx_similarity_score ON similarity_logs(similarity_score);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON system_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);
