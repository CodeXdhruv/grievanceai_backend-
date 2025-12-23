-- ============================================================
-- Grievance Detection System - Database Migration V2
-- Multi-PDF Batch Processing & Contextual Duplicate Detection
-- ============================================================

-- ============================================================
-- 1. BATCH PROCESSING TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS processing_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    batch_status TEXT DEFAULT 'pending' CHECK(batch_status IN ('pending', 'processing', 'completed', 'failed')),
    total_pdfs INTEGER DEFAULT 0,
    processed_pdfs INTEGER DEFAULT 0,
    total_grievances INTEGER DEFAULT 0,
    unique_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    near_duplicate_count INTEGER DEFAULT 0,
    processing_started_at DATETIME,
    processing_completed_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================================
-- 2. UPDATE PDF_UPLOADS FOR BATCH SUPPORT
-- ============================================================
-- Note: D1 doesn't support ALTER TABLE ADD COLUMN with REFERENCES
-- So we create columns without FK constraint and handle in app logic

-- Add batch_id column to link PDFs to batches
-- Run this only if column doesn't exist (D1 will error if exists)
ALTER TABLE pdf_uploads ADD COLUMN batch_id INTEGER;

-- Add page count tracking
ALTER TABLE pdf_uploads ADD COLUMN page_count INTEGER DEFAULT 0;

-- ============================================================
-- 3. UPDATE GRIEVANCES FOR ENHANCED TRACKING
-- ============================================================

-- Link grievance to batch
ALTER TABLE grievances ADD COLUMN batch_id INTEGER;

-- Link grievance to source PDF (already has pdf_upload_id but adding explicit)
ALTER TABLE grievances ADD COLUMN source_pdf_name TEXT;

-- Page number where grievance was found
ALTER TABLE grievances ADD COLUMN page_number INTEGER;

-- Local duplicate reference (within same PDF)
ALTER TABLE grievances ADD COLUMN local_duplicate_of INTEGER;

-- Individual similarity score breakdowns
ALTER TABLE grievances ADD COLUMN cosine_score REAL DEFAULT 0;
ALTER TABLE grievances ADD COLUMN jaccard_score REAL DEFAULT 0;
ALTER TABLE grievances ADD COLUMN ngram_score REAL DEFAULT 0;
ALTER TABLE grievances ADD COLUMN contextual_score REAL DEFAULT 0;

-- ============================================================
-- 4. CONTEXTUAL METADATA TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS grievance_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grievance_id INTEGER NOT NULL UNIQUE,
    department TEXT,
    location TEXT,
    issue_category TEXT,
    extracted_entities TEXT,
    keywords TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (grievance_id) REFERENCES grievances(id) ON DELETE CASCADE
);

-- ============================================================
-- 5. ADAPTIVE THRESHOLDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS adaptive_thresholds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threshold_type TEXT NOT NULL UNIQUE CHECK(threshold_type IN ('duplicate', 'near_duplicate', 'cosine_weight', 'jaccard_weight', 'ngram_weight', 'metadata_weight')),
    current_value REAL NOT NULL,
    min_value REAL DEFAULT 0.3,
    max_value REAL DEFAULT 0.95,
    adjustment_count INTEGER DEFAULT 0,
    last_adjusted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default threshold values
INSERT OR IGNORE INTO adaptive_thresholds (threshold_type, current_value, min_value, max_value) VALUES 
    ('duplicate', 0.85, 0.75, 0.95),
    ('near_duplicate', 0.65, 0.50, 0.80),
    ('cosine_weight', 0.50, 0.30, 0.70),
    ('jaccard_weight', 0.25, 0.10, 0.40),
    ('ngram_weight', 0.15, 0.05, 0.30),
    ('metadata_weight', 0.10, 0.00, 0.25);

-- ============================================================
-- 6. FEEDBACK LOGS FOR ADAPTIVE LEARNING
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    grievance_id INTEGER NOT NULL,
    matched_grievance_id INTEGER,
    original_status TEXT NOT NULL,
    corrected_status TEXT NOT NULL CHECK(corrected_status IN ('UNIQUE', 'DUPLICATE', 'NEAR_DUPLICATE')),
    original_score REAL,
    feedback_notes TEXT,
    applied_to_threshold INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id),
    FOREIGN KEY (grievance_id) REFERENCES grievances(id)
);

-- ============================================================
-- 7. DUPLICATE CLUSTERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS duplicate_clusters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER,
    cluster_type TEXT NOT NULL CHECK(cluster_type IN ('DUPLICATE', 'NEAR_DUPLICATE', 'CONTEXTUAL')),
    primary_grievance_id INTEGER NOT NULL,
    member_count INTEGER DEFAULT 1,
    avg_similarity_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES processing_batches(id),
    FOREIGN KEY (primary_grievance_id) REFERENCES grievances(id)
);

-- ============================================================
-- 8. CLUSTER MEMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS cluster_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cluster_id INTEGER NOT NULL,
    grievance_id INTEGER NOT NULL,
    similarity_to_primary REAL,
    FOREIGN KEY (cluster_id) REFERENCES duplicate_clusters(id) ON DELETE CASCADE,
    FOREIGN KEY (grievance_id) REFERENCES grievances(id)
);

-- ============================================================
-- 9. PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_grievances_batch ON grievances(batch_id);
CREATE INDEX IF NOT EXISTS idx_grievances_page ON grievances(page_number);
CREATE INDEX IF NOT EXISTS idx_grievances_local_dup ON grievances(local_duplicate_of);
CREATE INDEX IF NOT EXISTS idx_pdf_uploads_batch ON pdf_uploads(batch_id);
CREATE INDEX IF NOT EXISTS idx_processing_batches_user ON processing_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_batches_status ON processing_batches(batch_status);
CREATE INDEX IF NOT EXISTS idx_feedback_admin ON feedback_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_feedback_grievance ON feedback_logs(grievance_id);
CREATE INDEX IF NOT EXISTS idx_feedback_applied ON feedback_logs(applied_to_threshold);
CREATE INDEX IF NOT EXISTS idx_clusters_batch ON duplicate_clusters(batch_id);
CREATE INDEX IF NOT EXISTS idx_clusters_primary ON duplicate_clusters(primary_grievance_id);
CREATE INDEX IF NOT EXISTS idx_cluster_members_cluster ON cluster_members(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_members_grievance ON cluster_members(grievance_id);
CREATE INDEX IF NOT EXISTS idx_metadata_grievance ON grievance_metadata(grievance_id);
CREATE INDEX IF NOT EXISTS idx_metadata_department ON grievance_metadata(department);
CREATE INDEX IF NOT EXISTS idx_metadata_category ON grievance_metadata(issue_category);

-- ============================================================
-- 10. USEFUL VIEWS FOR DASHBOARD
-- ============================================================

-- Batch summary view
CREATE VIEW IF NOT EXISTS v_batch_summary AS
SELECT 
    pb.id as batch_id,
    pb.batch_status,
    pb.total_pdfs,
    pb.processed_pdfs,
    pb.total_grievances,
    pb.unique_count,
    pb.duplicate_count,
    pb.near_duplicate_count,
    u.full_name as submitted_by,
    pb.created_at,
    pb.processing_completed_at,
    CASE 
        WHEN pb.processing_completed_at IS NOT NULL 
        THEN (julianday(pb.processing_completed_at) - julianday(pb.processing_started_at)) * 86400
        ELSE NULL 
    END as processing_seconds
FROM processing_batches pb
JOIN users u ON pb.user_id = u.id
ORDER BY pb.created_at DESC;

-- Cluster details view
CREATE VIEW IF NOT EXISTS v_cluster_details AS
SELECT 
    dc.id as cluster_id,
    dc.batch_id,
    dc.cluster_type,
    dc.member_count,
    dc.avg_similarity_score,
    g.grievance_text as primary_text,
    g.source_pdf_name as primary_source
FROM duplicate_clusters dc
JOIN grievances g ON dc.primary_grievance_id = g.id
ORDER BY dc.created_at DESC;

-- Feedback impact view
CREATE VIEW IF NOT EXISTS v_feedback_impact AS
SELECT 
    at.threshold_type,
    at.current_value,
    at.adjustment_count,
    at.last_adjusted_at,
    COUNT(fl.id) as total_feedback,
    SUM(CASE WHEN fl.applied_to_threshold = 1 THEN 1 ELSE 0 END) as applied_feedback
FROM adaptive_thresholds at
LEFT JOIN feedback_logs fl ON fl.applied_to_threshold = 1
GROUP BY at.threshold_type;
