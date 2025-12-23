// Cloudflare Worker - Main Entry Point
// File: src/index.js

import { Router } from 'itty-router';
import { 
    preprocessText, 
    validateGrievanceText, 
    splitIntoGrievances,
    extractNGrams,
    calculateTFIDF,
    jaccardSimilarity 
} from './nlp/textPreprocessing.js';
import { 
    generateEmbedding, 
    findMostSimilar,
    findMostSimilarEnhanced,
    classifyDuplicate,
    cosineSimilarity,
    calculateContextualSimilarity 
} from './nlp/embedding.js';
import { verifyJWT, generateJWT } from './auth/jwt.js';
import { hashPassword, verifyPassword } from './auth/password.js';
import { processBatch } from './batch/batchProcessor.js';
import { 
    getAdaptiveThresholds, 
    updateThresholdsFromFeedback, 
    logFeedback,
    getThresholdConfidence 
} from './nlp/adaptiveThreshold.js';

const router = Router();

// CORS middleware
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function corsify(response) {
    const newResponse = new Response(response.body, response);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        newResponse.headers.set(key, value);
    });
    return newResponse;
}

// OPTIONS handler for CORS preflight
router.options('*', () => new Response(null, { headers: corsHeaders }));

// ===== ROOT ENDPOINT - API DOCUMENTATION =====

/**
 * GET /
 * API Documentation - Shows all available endpoints
 */
router.get('/', async (request, env) => {
    const endpoints = [
        "POST   /api/auth/register          - Register new user",
        "POST   /api/auth/login             - User login",
        "",
        "POST   /api/grievances/submit-text - Submit text grievance",
        "POST   /api/grievances/submit-pdf  - Upload PDF grievance",
        "POST   /api/grievances/submit-batch- Batch process PDFs",
        "GET    /api/grievances             - List grievances",
        "GET    /api/grievances/:id         - Get grievance by ID",
        "",
        "GET    /api/areas                  - List areas",
        "GET    /api/areas/:name/exists     - Check area exists",
        "DELETE /api/areas/:name            - Delete area",
        "",
        "GET    /api/batches                - List batches",
        "GET    /api/batches/:id/status     - Batch status",
        "GET    /api/batches/:id/results    - Batch results",
        "",
        "GET    /api/thresholds             - Get thresholds",
        "GET    /api/clusters               - Get clusters (admin)",
        "POST   /api/feedback               - Submit feedback (admin)",
        "GET    /api/stats/dashboard        - Dashboard stats (admin)"
    ];

    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Grievance Detection API</title>
    <style>
        body { background: #000; color: #fff; font-family: monospace; padding: 40px; }
        h1 { margin-bottom: 30px; }
        pre { font-size: 14px; line-height: 1.8; }
    </style>
</head>
<body>
    <h1>Grievance Detection System API</h1>
    <p>17 Endpoints | Cloudflare Workers | AI-Powered</p>
    <hr style="border-color: #333; margin: 20px 0;">
    <pre>${endpoints.join('\n')}</pre>
</body>
</html>`;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html', ...corsHeaders }
    });
});

// ===== AUTHENTICATION ENDPOINTS =====

/**
 * POST /api/auth/register
 * Register new user
 */
router.post('/api/auth/register', async (request, env) => {
    try {
        const { email, password, fullName, phone } = await request.json();
        
        // Validate input
        if (!email || !password || !fullName) {
            return jsonResponse({ error: 'Missing required fields' }, 400);
        }
        
        // Check if user exists
        const existing = await env.DB.prepare(
            'SELECT id FROM users WHERE email = ?'
        ).bind(email).first();
        
        if (existing) {
            return jsonResponse({ error: 'User already exists' }, 409);
        }
        
        // Hash password
        const passwordHash = await hashPassword(password);
        
        // Insert user
        const result = await env.DB.prepare(
            `INSERT INTO users (email, password_hash, full_name, phone, role) 
             VALUES (?, ?, ?, ?, 'user')`
        ).bind(email, passwordHash, fullName, phone || null).run();
        
        // Generate JWT
        const token = await generateJWT({ 
            userId: result.meta.last_row_id, 
            email, 
            role: 'user' 
        }, env.JWT_SECRET);
        
        return jsonResponse({
            success: true,
            token,
            user: {
                id: result.meta.last_row_id,
                email,
                fullName,
                role: 'user'
            }
        }, 201);
        
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
});

/**
 * POST /api/auth/login
 * User login
 */
router.post('/api/auth/login', async (request, env) => {
    try {
        const { email, password } = await request.json();
        
        if (!email || !password) {
            return jsonResponse({ error: 'Email and password required' }, 400);
        }
        
        // Get user
        const user = await env.DB.prepare(
            'SELECT * FROM users WHERE email = ? AND is_active = 1'
        ).bind(email).first();
        
        if (!user) {
            return jsonResponse({ error: 'Invalid credentials' }, 401);
        }
        
        // Verify password
        const isValid = await verifyPassword(password, user.password_hash);
        
        if (!isValid) {
            return jsonResponse({ error: 'Invalid credentials' }, 401);
        }
        
        // Update last login
        await env.DB.prepare(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(user.id).run();
        
        // Generate JWT
        const token = await generateJWT({
            userId: user.id,
            email: user.email,
            role: user.role
        }, env.JWT_SECRET);
        
        return jsonResponse({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role
            }
        });
        
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
});

// ===== GRIEVANCE SUBMISSION ENDPOINTS =====

/**
 * POST /api/grievances/submit-text
 * Submit text grievance with structured metadata
 */
router.post('/api/grievances/submit-text', async (request, env) => {
    try {
        // Verify authentication
        const auth = await authenticateRequest(request, env);
        if (!auth.valid) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        const { grievanceText, category, area, locationDetails } = await request.json();
        
        // Validate required fields
        if (!category) {
            return jsonResponse({ error: 'Category is required' }, 400);
        }
        
        if (!area) {
            return jsonResponse({ error: 'Area is required' }, 400);
        }
        
        // Validate text
        const validation = validateGrievanceText(grievanceText);
        if (!validation.isValid) {
            return jsonResponse({ 
                error: 'Invalid grievance text', 
                details: validation.errors 
            }, 400);
        }
        
        // Process grievance with structured metadata
        const result = await processGrievance(
            auth.user.userId,
            grievanceText,
            'text',
            null,
            env,
            { category, area, locationDetails: locationDetails || '' }
        );
        
        return jsonResponse({
            success: true,
            grievance: result
        }, 201);
        
    } catch (error) {
        console.error('Submit text error:', error);
        return jsonResponse({ error: error.message }, 500);
    }
});

/**
 * POST /api/grievances/submit-pdf
 * Upload PDF and extract grievances (receives pre-extracted text from frontend)
 */
router.post('/api/grievances/submit-pdf', async (request, env) => {
    try {
        // Verify authentication
        const auth = await authenticateRequest(request, env);
        if (!auth.valid) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        const formData = await request.formData();
        const file = formData.get('pdf');
        const extractedText = formData.get('extractedText');
        const grievanceTexts = formData.get('grievances');
        
        if (!file) {
            return jsonResponse({ error: 'No PDF file provided' }, 400);
        }
        
        // Validate file type
        if (!file.type.includes('pdf')) {
            return jsonResponse({ error: 'File must be PDF' }, 400);
        }
        
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            return jsonResponse({ error: 'File too large (max 10MB)' }, 400);
        }
        
        // Upload PDF to R2
        const fileKey = `pdfs/${auth.user.userId}/${Date.now()}-${file.name}`;
        await env.PDF_BUCKET.put(fileKey, file.stream());
        
        console.log(`PDF uploaded to R2: ${fileKey}`);
        
        // Parse grievances if provided
        let grievanceList = [];
        if (grievanceTexts) {
            try {
                grievanceList = JSON.parse(grievanceTexts);
            } catch (e) {
                grievanceList = [extractedText || ''];
            }
        } else if (extractedText) {
            grievanceList = [extractedText];
        }
        
        // Create PDF upload record
        const pdfResult = await env.DB.prepare(
            `INSERT INTO pdf_uploads 
             (user_id, filename, file_size, r2_key, r2_url, processing_status, total_grievances_extracted) 
             VALUES (?, ?, ?, ?, ?, 'processing', ?)`
        ).bind(
            auth.user.userId,
            file.name,
            file.size,
            fileKey,
            fileKey,
            grievanceList.length
        ).run();
        
        const pdfId = pdfResult.meta.last_row_id;
        
        // Process each grievance synchronously
        const results = [];
        for (const grievanceText of grievanceList) {
            if (grievanceText && grievanceText.trim().length > 20) {
                const result = await processGrievance(
                    auth.user.userId,
                    grievanceText,
                    'pdf',
                    pdfId,
                    env
                );
                results.push(result);
            }
        }
        
        // Update PDF record as completed
        await env.DB.prepare(
            `UPDATE pdf_uploads 
             SET processing_status = 'completed', 
                 total_grievances_extracted = ?,
                 completed_at = CURRENT_TIMESTAMP 
             WHERE id = ?`
        ).bind(results.length, pdfId).run();
        
        return jsonResponse({
            success: true,
            message: 'PDF uploaded and processed successfully',
            pdfId,
            r2_key: fileKey,
            grievancesProcessed: results.length,
            results
        }, 201);
        
    } catch (error) {
        console.error('PDF upload error:', error);
        return jsonResponse({ error: error.message }, 500);
    }
});

/**
 * GET /api/grievances
 * Get all grievances (with filters)
 */
router.get('/api/grievances', async (request, env) => {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.valid) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        const url = new URL(request.url);
        const status = url.searchParams.get('status');
        const limit = parseInt(url.searchParams.get('limit')) || 50;
        const offset = parseInt(url.searchParams.get('offset')) || 0;
        
        let query = `
            SELECT g.*, u.email as user_email, u.full_name as user_name
            FROM grievances g
            JOIN users u ON g.user_id = u.id
        `;
        
        const params = [];
        
        // Filter by user if not admin
        if (auth.user.role !== 'admin') {
            query += ' WHERE g.user_id = ?';
            params.push(auth.user.userId);
        } else if (status) {
            query += ' WHERE g.duplicate_status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY g.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        const { results } = await env.DB.prepare(query)
            .bind(...params)
            .all();
        
        return jsonResponse({
            success: true,
            grievances: results,
            pagination: {
                limit,
                offset,
                count: results.length
            }
        });
        
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
});

/**
 * GET /api/grievances/:id
 * Get specific grievance
 */
router.get('/api/grievances/:id', async (request, env) => {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.valid) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        const { id } = request.params;
        
        const grievance = await env.DB.prepare(`
            SELECT g.*, u.email as user_email, u.full_name as user_name,
                   e.embedding_vector, e.model_name
            FROM grievances g
            JOIN users u ON g.user_id = u.id
            LEFT JOIN embeddings e ON g.id = e.grievance_id
            WHERE g.id = ?
        `).bind(id).first();
        
        if (!grievance) {
            return jsonResponse({ error: 'Grievance not found' }, 404);
        }
        
        // Check authorization
        if (auth.user.role !== 'admin' && grievance.user_id !== auth.user.userId) {
            return jsonResponse({ error: 'Forbidden' }, 403);
        }
        
        // Get matched grievance if exists
        if (grievance.matched_grievance_id) {
            const matched = await env.DB.prepare(
                'SELECT id, grievance_text, created_at FROM grievances WHERE id = ?'
            ).bind(grievance.matched_grievance_id).first();
            
            grievance.matched_grievance = matched;
        }
        
        return jsonResponse({
            success: true,
            grievance
        });
        
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
});

/**
 * GET /api/areas
 * Get list of unique areas with grievance counts
 */
router.get('/api/areas', async (request, env) => {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.valid) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        const result = await env.DB.prepare(`
            SELECT area, COUNT(*) as count,
                   SUM(CASE WHEN duplicate_status = 'UNIQUE' THEN 1 ELSE 0 END) as unique_count,
                   SUM(CASE WHEN duplicate_status != 'UNIQUE' THEN 1 ELSE 0 END) as duplicate_count
            FROM grievances
            WHERE user_id = ? AND area IS NOT NULL AND area != ''
            GROUP BY area
            ORDER BY area
        `).bind(auth.user.userId).all();
        
        return jsonResponse({
            success: true,
            areas: result.results || []
        });
        
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
});

/**
 * GET /api/areas/:name/exists
 * Check if an area already has grievances
 */
router.get('/api/areas/:name/exists', async (request, env) => {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.valid) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        const areaName = decodeURIComponent(request.params.name);
        
        const result = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM grievances
            WHERE user_id = ? AND LOWER(area) = LOWER(?)
        `).bind(auth.user.userId, areaName).first();
        
        return jsonResponse({
            success: true,
            exists: result.count > 0,
            count: result.count
        });
        
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
});

/**
 * DELETE /api/areas/:name
 * Delete all grievances for a specific area
 */
router.delete('/api/areas/:name', async (request, env) => {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.valid) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        const areaName = decodeURIComponent(request.params.name);
        console.log(`🗑️ Starting delete for area: ${areaName}`);
        
        // Get grievance IDs to delete
        const grievances = await env.DB.prepare(`
            SELECT id FROM grievances
            WHERE user_id = ? AND LOWER(area) = LOWER(?)
        `).bind(auth.user.userId, areaName).all();
        
        const ids = grievances.results?.map(g => g.id) || [];
        console.log(`  Found ${ids.length} grievances to delete`);
        
        if (ids.length === 0) {
            return jsonResponse({ success: true, deleted: 0 });
        }
        
        // Build ID list for IN clause
        const idPlaceholders = ids.map(() => '?').join(',');
        
        // Step 1: Clear matched_grievance_id references (self-referencing FK)
        // Clear references TO these grievances from OTHER grievances
        console.log('  Step 1a: Clearing references TO these grievances...');
        await env.DB.prepare(`
            UPDATE grievances SET matched_grievance_id = NULL 
            WHERE matched_grievance_id IN (${idPlaceholders})
        `).bind(...ids).run();
        
        // Also clear matched_grievance_id FOR the grievances being deleted (they may reference each other)
        console.log('  Step 1b: Clearing references FROM these grievances...');
        await env.DB.prepare(`
            UPDATE grievances SET matched_grievance_id = NULL 
            WHERE id IN (${idPlaceholders})
        `).bind(...ids).run();
        
        // Step 2: Delete from similarity_logs (both columns reference grievances)
        console.log('  Step 2: Deleting similarity_logs...');
        try {
            await env.DB.prepare(`
                DELETE FROM similarity_logs 
                WHERE grievance_id IN (${idPlaceholders}) OR compared_with_id IN (${idPlaceholders})
            `).bind(...ids, ...ids).run();
        } catch (e) {
            console.log('    similarity_logs table may not exist, skipping');
        }
        
        // Step 3: Delete from cluster_members
        console.log('  Step 3: Deleting cluster_members...');
        try {
            await env.DB.prepare(`
                DELETE FROM cluster_members WHERE grievance_id IN (${idPlaceholders})
            `).bind(...ids).run();
        } catch (e) {
            console.log('    cluster_members table may not exist, skipping');
        }
        
        // Step 4: Delete from embeddings
        console.log('  Step 4: Deleting embeddings...');
        await env.DB.prepare(`
            DELETE FROM embeddings WHERE grievance_id IN (${idPlaceholders})
        `).bind(...ids).run();
        
        // Step 5: Finally delete grievances
        console.log('  Step 5: Deleting grievances...');
        await env.DB.prepare(`
            DELETE FROM grievances
            WHERE user_id = ? AND LOWER(area) = LOWER(?)
        `).bind(auth.user.userId, areaName).run();
        
        console.log(`✅ Successfully deleted ${ids.length} grievances for area: ${areaName}`);
        
        return jsonResponse({
            success: true,
            deleted: ids.length,
            area: areaName
        });
        
    } catch (error) {
        console.error('❌ Delete area error:', error);
        return jsonResponse({ error: error.message }, 500);
    }
});

/**
 * GET /api/stats/dashboard
 * Admin dashboard statistics
 */
router.get('/api/stats/dashboard', async (request, env) => {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.valid || auth.user.role !== 'admin') {
            return jsonResponse({ error: 'Forbidden' }, 403);
        }
        
        // Get various statistics
        const [totalGrievances, statusStats, dailyStats, recentGrievances] = await Promise.all([
            env.DB.prepare('SELECT COUNT(*) as count FROM grievances').first(),
            env.DB.prepare('SELECT * FROM v_duplicate_stats').all(),
            env.DB.prepare('SELECT * FROM v_daily_submissions LIMIT 30').all(),
            env.DB.prepare(`
                SELECT g.*, u.full_name 
                FROM grievances g 
                JOIN users u ON g.user_id = u.id 
                ORDER BY g.created_at DESC 
                LIMIT 10
            `).all()
        ]);
        
        return jsonResponse({
            success: true,
            stats: {
                total: totalGrievances.count,
                byStatus: statusStats.results,
                daily: dailyStats.results,
                recent: recentGrievances.results
            }
        });
        
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
});

// ===== BATCH PROCESSING ENDPOINTS =====

/**
 * POST /api/grievances/submit-batch
 * Upload multiple PDFs for batch processing
 */
router.post('/api/grievances/submit-batch', async (request, env, ctx) => {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.valid) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        const formData = await request.formData();
        const pdfs = formData.getAll('pdfs');
        const metadataJson = formData.get('metadata');
        
        if (!pdfs || pdfs.length === 0) {
            return jsonResponse({ error: 'No PDF files provided' }, 400);
        }
        
        if (pdfs.length > 10) {
            return jsonResponse({ error: 'Maximum 10 PDFs per batch' }, 400);
        }
        
        // Validate all files
        for (const pdf of pdfs) {
            if (!pdf.type.includes('pdf')) {
                return jsonResponse({ error: `File ${pdf.name} is not a PDF` }, 400);
            }
            if (pdf.size > 10 * 1024 * 1024) {
                return jsonResponse({ error: `File ${pdf.name} exceeds 10MB limit` }, 400);
            }
        }
        
        // Create batch record
        const batchResult = await env.DB.prepare(`
            INSERT INTO processing_batches (user_id, batch_status, total_pdfs)
            VALUES (?, 'pending', ?)
        `).bind(auth.user.userId, pdfs.length).run();
        
        const batchId = batchResult.meta.last_row_id;
        
        // Parse metadata if provided
        let metadata = {};
        if (metadataJson) {
            try {
                metadata = JSON.parse(metadataJson);
            } catch (e) {
                console.warn('Failed to parse metadata:', e);
            }
        }
        
        // Upload all PDFs to R2 and create records
        const pdfEntries = [];
        
        for (const pdf of pdfs) {
            const fileKey = `pdfs/${auth.user.userId}/batch-${batchId}/${Date.now()}-${pdf.name}`;
            await env.PDF_BUCKET.put(fileKey, pdf.stream());
            
            // Create PDF upload record
            const pdfResult = await env.DB.prepare(`
                INSERT INTO pdf_uploads 
                (user_id, filename, file_size, r2_key, r2_url, batch_id, processing_status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')
            `).bind(
                auth.user.userId,
                pdf.name,
                pdf.size,
                fileKey,
                fileKey,
                batchId
            ).run();
            
            // Parse grievances from form data (frontend extracts text)
            const grievancesKey = `grievances_${pdf.name}`;
            const grievancesJson = formData.get(grievancesKey);
            
            let grievances = [];
            if (grievancesJson) {
                try {
                    grievances = JSON.parse(grievancesJson);
                } catch (e) {
                    console.warn(`Failed to parse grievances for ${pdf.name}:`, e);
                }
            }
            
            // Get area from FormData (user-provided for entire batch)
            const batchArea = formData.get('area') || '';
            
            pdfEntries.push({
                pdfId: pdfResult.meta.last_row_id,
                filename: pdf.name,
                r2Key: fileKey,
                area: batchArea,  // Area for all grievances in this PDF
                grievances: grievances.map((g, i) => ({
                    text: typeof g === 'string' ? g : g.text,
                    pageNumber: typeof g === 'object' ? g.pageNumber : i + 1
                })),
                userId: auth.user.userId
            });
        }
        
        // Process batch asynchronously using ctx.waitUntil
        ctx.waitUntil(
            processBatch(batchId, pdfEntries, env).catch(error => {
                console.error('Batch processing error:', error);
            })
        );
        
        return jsonResponse({
            success: true,
            batchId,
            pdfsReceived: pdfs.length,
            message: 'Batch processing started',
            statusUrl: `/api/batches/${batchId}/status`
        }, 202);
        
    } catch (error) {
        console.error('Batch upload error:', error);
        return jsonResponse({ error: error.message }, 500);
    }
});

/**
 * GET /api/batches/:id/status
 * Get batch processing status
 */
router.get('/api/batches/:id/status', async (request, env) => {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.valid) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        const { id } = request.params;
        
        const batch = await env.DB.prepare(`
            SELECT * FROM processing_batches WHERE id = ?
        `).bind(id).first();
        
        if (!batch) {
            return jsonResponse({ error: 'Batch not found' }, 404);
        }
        
        // Check authorization
        if (auth.user.role !== 'admin' && batch.user_id !== auth.user.userId) {
            return jsonResponse({ error: 'Forbidden' }, 403);
        }
        
        // Calculate progress percentage
        const percentComplete = batch.total_grievances > 0 
            ? Math.round((batch.processed_pdfs / batch.total_pdfs) * 100)
            : 0;
        
        return jsonResponse({
            batchId: batch.id,
            status: batch.batch_status,
            progress: {
                totalPdfs: batch.total_pdfs,
                processedPdfs: batch.processed_pdfs,
                totalGrievances: batch.total_grievances,
                uniqueCount: batch.unique_count,
                duplicateCount: batch.duplicate_count,
                nearDuplicateCount: batch.near_duplicate_count,
                percentComplete
            },
            startedAt: batch.processing_started_at,
            completedAt: batch.processing_completed_at,
            errorMessage: batch.error_message
        });
        
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
});

/**
 * GET /api/batches/:id/results
 * Get batch processing results with grievances and clusters
 */
router.get('/api/batches/:id/results', async (request, env) => {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.valid) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        const { id } = request.params;
        
        // Get batch info
        const batch = await env.DB.prepare(`
            SELECT * FROM processing_batches WHERE id = ?
        `).bind(id).first();
        
        if (!batch) {
            return jsonResponse({ error: 'Batch not found' }, 404);
        }
        
        if (auth.user.role !== 'admin' && batch.user_id !== auth.user.userId) {
            return jsonResponse({ error: 'Forbidden' }, 403);
        }
        
        // Get grievances for this batch
        const { results: grievances } = await env.DB.prepare(`
            SELECT g.*, p.filename as source_filename
            FROM grievances g
            LEFT JOIN pdf_uploads p ON g.pdf_upload_id = p.id
            WHERE g.batch_id = ?
            ORDER BY g.source_pdf_name, g.page_number
        `).bind(id).all();
        
        // Get clusters for this batch
        const { results: clusters } = await env.DB.prepare(`
            SELECT dc.*, g.grievance_text as primary_text
            FROM duplicate_clusters dc
            JOIN grievances g ON dc.primary_grievance_id = g.id
            WHERE dc.batch_id = ?
        `).bind(id).all();
        
        // Get cluster members
        for (const cluster of clusters) {
            const { results: members } = await env.DB.prepare(`
                SELECT cm.*, g.grievance_text, g.source_pdf_name, g.page_number
                FROM cluster_members cm
                JOIN grievances g ON cm.grievance_id = g.id
                WHERE cm.cluster_id = ?
            `).bind(cluster.id).all();
            cluster.members = members;
        }
        
        return jsonResponse({
            batchId: batch.id,
            status: batch.batch_status,
            stats: {
                total: batch.total_grievances,
                unique: batch.unique_count,
                duplicate: batch.duplicate_count,
                nearDuplicate: batch.near_duplicate_count
            },
            grievances,
            clusters
        });
        
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
});

/**
 * GET /api/batches
 * List all batches for user (or all for admin)
 */
router.get('/api/batches', async (request, env) => {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.valid) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const offset = parseInt(url.searchParams.get('offset')) || 0;
        
        let query = `
            SELECT pb.*, u.full_name as submitted_by
            FROM processing_batches pb
            JOIN users u ON pb.user_id = u.id
        `;
        
        const params = [];
        
        if (auth.user.role !== 'admin') {
            query += ' WHERE pb.user_id = ?';
            params.push(auth.user.userId);
        }
        
        query += ' ORDER BY pb.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        const { results } = await env.DB.prepare(query).bind(...params).all();
        
        return jsonResponse({
            success: true,
            batches: results,
            pagination: { limit, offset, count: results.length }
        });
        
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
});

/**
 * POST /api/feedback
 * Submit admin feedback on similarity classification
 */
router.post('/api/feedback', async (request, env) => {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.valid) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        if (auth.user.role !== 'admin') {
            return jsonResponse({ error: 'Admin access required' }, 403);
        }
        
        const feedback = await request.json();
        
        if (!feedback.grievanceId || !feedback.originalStatus || !feedback.correctedStatus) {
            return jsonResponse({ error: 'Missing required fields' }, 400);
        }
        
        // Log the feedback
        await logFeedback(feedback, auth.user.userId, env);
        
        // Update thresholds based on feedback
        const updatedThresholds = await updateThresholdsFromFeedback(feedback, env);
        
        // Update the grievance status
        await env.DB.prepare(`
            UPDATE grievances 
            SET duplicate_status = ?
            WHERE id = ?
        `).bind(feedback.correctedStatus, feedback.grievanceId).run();
        
        return jsonResponse({
            success: true,
            message: 'Feedback recorded and thresholds updated',
            thresholds: updatedThresholds
        });
        
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
});

/**
 * GET /api/thresholds
 * Get current adaptive thresholds
 */
router.get('/api/thresholds', async (request, env) => {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.valid) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        const thresholds = await getAdaptiveThresholds(env);
        const confidence = await getThresholdConfidence(env);
        
        return jsonResponse({
            success: true,
            thresholds,
            confidence
        });
        
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
});

/**
 * GET /api/clusters
 * Get all duplicate clusters (for admin dashboard)
 */
router.get('/api/clusters', async (request, env) => {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.valid) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        if (auth.user.role !== 'admin') {
            return jsonResponse({ error: 'Admin access required' }, 403);
        }
        
        const url = new URL(request.url);
        const batchId = url.searchParams.get('batchId');
        const limit = parseInt(url.searchParams.get('limit')) || 50;
        
        let query = `
            SELECT dc.*, g.grievance_text as primary_text, g.source_pdf_name,
                   pb.created_at as batch_date
            FROM duplicate_clusters dc
            JOIN grievances g ON dc.primary_grievance_id = g.id
            LEFT JOIN processing_batches pb ON dc.batch_id = pb.id
        `;
        
        const params = [];
        
        if (batchId) {
            query += ' WHERE dc.batch_id = ?';
            params.push(batchId);
        }
        
        query += ' ORDER BY dc.created_at DESC LIMIT ?';
        params.push(limit);
        
        const { results: clusters } = await env.DB.prepare(query).bind(...params).all();
        
        // Get member counts
        for (const cluster of clusters) {
            const { results: members } = await env.DB.prepare(`
                SELECT cm.*, g.grievance_text, g.source_pdf_name
                FROM cluster_members cm
                JOIN grievances g ON cm.grievance_id = g.id
                WHERE cm.cluster_id = ?
            `).bind(cluster.id).all();
            cluster.members = members;
        }
        
        return jsonResponse({
            success: true,
            clusters
        });
        
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
});

// ===== HELPER FUNCTIONS =====

/**
 * Process a single grievance with structured metadata
 */
async function processGrievance(userId, grievanceText, type, pdfId, env, metadata = {}) {
    const startTime = Date.now();
    
    // Extract metadata with defaults
    const category = metadata.category || 'OTHER';
    const area = metadata.area || '';
    const locationDetails = metadata.locationDetails || '';
    
    // Store original text
    const originalText = grievanceText;
    
    // Preprocess
    const processedText = preprocessText(grievanceText);
    
    // Generate embedding
    const embedding = await generateEmbedding(processedText);
    
    // Get existing grievances - FILTER BY CATEGORY AND AREA for better matching
    let query = `
        SELECT g.id, g.grievance_text as text, g.category, g.area, e.embedding_vector as embedding 
        FROM grievances g
        JOIN embeddings e ON g.id = e.grievance_id
        WHERE g.processed = 1
    `;
    const params = [];
    
    // If we have category, prioritize same category matches
    if (category && category !== 'OTHER') {
        query += ' AND g.category = ?';
        params.push(category);
    }
    
    // If we have area, prioritize same area matches
    if (area) {
        query += ' AND g.area = ?';
        params.push(area);
    }
    
    const stmt = params.length > 0 
        ? env.DB.prepare(query).bind(...params)
        : env.DB.prepare(query);
    
    const { results: existingGrievances } = await stmt.all();
    
    // Parse embeddings and prepare data for enhanced similarity
    const parsed = existingGrievances.map(g => ({
        id: g.id,
        text: g.text,
        category: g.category,
        area: g.area,
        embedding: JSON.parse(g.embedding)
    }));
    
    let matchedId = null;
    let score = 0;
    let status = 'UNIQUE';
    let cosineSim = 0;
    let jaccardSim = 0;
    let ngramSim = 0;
    let topMatches = [];
    
    // Use enhanced similarity detection if there are existing grievances with same category/area
    if (parsed.length > 0) {
        const result = findMostSimilarEnhanced(embedding, processedText, parsed);
        matchedId = result.matchedId;
        score = result.score;
        status = result.status;
        cosineSim = result.cosineSim;
        jaccardSim = result.jaccardSim;
        ngramSim = result.ngramSim;
        topMatches = result.topMatches;
        
        console.log(`📍 Metadata filter: category=${category}, area=${area} -> Found ${parsed.length} matching grievances`);
        console.log(`📊 Best match: score=${score.toFixed(3)}, status=${status}`);
    } else {
        console.log(`📍 No existing grievances match category=${category}, area=${area} -> Marked as UNIQUE`);
    }
    
    // Save grievance with structured metadata
    const grievanceResult = await env.DB.prepare(`
        INSERT INTO grievances 
        (user_id, grievance_text, original_text, submission_type, pdf_upload_id,
         category, area, location_details,
         duplicate_status, similarity_score, matched_grievance_id, processed) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
        userId,
        processedText,
        originalText,
        type,
        pdfId,
        category,
        area,
        locationDetails,
        status,
        score,
        matchedId
    ).run();
    
    const grievanceId = grievanceResult.meta.last_row_id;
    
    // Save embedding
    await env.DB.prepare(`
        INSERT INTO embeddings (grievance_id, embedding_vector, vector_dimension, model_name) 
        VALUES (?, ?, 384, 'paraphrase-MiniLM-L6-v2')
    `).bind(grievanceId, JSON.stringify(embedding)).run();
    
    // Log similarity with detailed metrics if matched
    if (matchedId && score > 0) {
        await env.DB.prepare(`
            INSERT INTO similarity_logs 
            (grievance_id, compared_with_id, similarity_score, computation_time_ms) 
            VALUES (?, ?, ?, ?)
        `).bind(grievanceId, matchedId, score, Date.now() - startTime).run();
        
        // Log top matches for analysis (optional, store in JSON format)
        console.log('Top similar grievances:', JSON.stringify(topMatches.slice(0, 3)));
    }
    
    return {
        id: grievanceId,
        status,
        similarityScore: score,
        cosineSimilarity: cosineSim,
        jaccardSimilarity: jaccardSim,
        ngramSimilarity: ngramSim,
        matchedGrievanceId: matchedId,
        topMatches: topMatches.slice(0, 3).map(m => ({
            id: m.id,
            score: m.combinedScore,
            status: m.status
        })),
        processingTimeMs: Date.now() - startTime
    };
}

/**
 * Authenticate request using JWT
 */
async function authenticateRequest(request, env) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { valid: false };
    }
    
    const token = authHeader.substring(7);
    
    try {
        const payload = await verifyJWT(token, env.JWT_SECRET);
        return { valid: true, user: payload };
    } catch (error) {
        return { valid: false };
    }
}

/**
 * JSON response helper
 */
function jsonResponse(data, status = 200) {
    return corsify(new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    }));
}

// ===== ROUTES =====

// Catch-all 404 handler
router.all('*', () => {
    return jsonResponse({ error: 'Not found' }, 404);
});

// ===== WORKER EXPORT =====

export default {
    async fetch(request, env, ctx) {
        return router.handle(request, env, ctx).catch(error => {
            console.error('Worker error:', error);
            return jsonResponse({ 
                error: 'Internal server error',
                message: error.message 
            }, 500);
        });
    }
};