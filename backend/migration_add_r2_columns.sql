-- Migration: Add R2 columns to pdf_uploads table
-- Run this migration after the initial schema

-- Add r2_key column (stores the R2 object key)
ALTER TABLE pdf_uploads ADD COLUMN r2_key TEXT;

-- Add r2_url column (stores the public R2 URL)
ALTER TABLE pdf_uploads ADD COLUMN r2_url TEXT;

-- Create index for r2_key lookups
CREATE INDEX IF NOT EXISTS idx_pdf_uploads_r2_key ON pdf_uploads(r2_key);
