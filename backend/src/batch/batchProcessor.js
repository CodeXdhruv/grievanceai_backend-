// Batch Processing Engine
// File: src/batch/batchProcessor.js

import { preprocessText, validateGrievanceText, extractNGrams } from '../nlp/textPreprocessing.js';
import { generateEmbedding, generateBatchEmbeddings, cosineSimilarity, calculateNGramOverlap } from '../nlp/embedding.js';
import { 
    getAdaptiveThresholds, 
    classifyWithAdaptiveThresholds, 
    calculateAdaptiveWeightedScore 
} from '../nlp/adaptiveThreshold.js';
import { detectCategory, extractArea } from '../nlp/categoryDetector.js';
import { applyDBSCANClustering } from '../nlp/dbscan.js';

/**
 * Main batch processing orchestrator
 * Processes multiple PDFs in parallel with hierarchical deduplication
 * 
 * @param {number} batchId - Batch identifier
 * @param {Array} pdfEntries - Array of {pdfId, filename, grievances: [{text, pageNumber}], area}
 * @param {Object} env - Cloudflare Worker environment
 * @returns {Promise<Object>} - Batch processing results
 */
export async function processBatch(batchId, pdfEntries, env) {
    const startTime = Date.now();
    
    try {
        // Update batch status to processing
        await env.DB.prepare(`
            UPDATE processing_batches 
            SET batch_status = 'processing', 
                processing_started_at = CURRENT_TIMESTAMP,
                total_pdfs = ?
            WHERE id = ?
        `).bind(pdfEntries.length, batchId).run();
        
        // STEP 1: Flatten all grievances with source tracking + auto-detect category
        // Filter out PDF headers and metadata
        const allGrievances = [];
        for (const pdf of pdfEntries) {
            // Get area from PDF entry (user-provided) or try to extract from text
            const pdfArea = pdf.area || '';
            
            for (const grievance of pdf.grievances) {
                const text = grievance.text?.trim() || '';
                
                // Skip empty or too short text
                if (text.length < 30) {
                    console.log(`⏭️ Skipping short text: "${text.substring(0, 50)}..."`);
                    continue;
                }
                
                // Skip PDF headers and metadata
                const lowerText = text.toLowerCase();
                if (
                    lowerText.startsWith('grievance collection') ||
                    lowerText.startsWith('batch ') ||
                    lowerText.startsWith('municipal corporation') ||
                    lowerText.startsWith('ward ') ||
                    lowerText.startsWith('date:') ||
                    lowerText.match(/^---+$/) ||
                    lowerText.match(/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}$/i)
                ) {
                    console.log(`⏭️ Skipping header: "${text.substring(0, 50)}..."`);
                    continue;
                }
                
                // Auto-detect category from text
                const categoryResult = detectCategory(text);
                // Try to extract area from text if not provided
                const extractedArea = extractArea(text);
                
                allGrievances.push({
                    userId: pdf.userId,
                    pdfId: pdf.pdfId,
                    pdfName: pdf.filename,
                    pageNumber: grievance.pageNumber || 1,
                    originalText: text,
                    processedText: preprocessText(text),
                    // Structured metadata
                    category: categoryResult.category,
                    categoryConfidence: categoryResult.confidence,
                    area: pdfArea || extractedArea,
                    locationDetails: ''
                });
                
                console.log(`📋 Grievance: "${text.substring(0, 50)}..." → Category: ${categoryResult.category} (${Math.round(categoryResult.confidence * 100)}%)`);
            }
        }
        
        console.log(`\n✅ Total valid grievances to process: ${allGrievances.length}`);
        
        if (allGrievances.length === 0) {
            console.warn('⚠️ No valid grievances found in batch!');
            throw new Error('No valid grievances found in the uploaded PDFs');
        }
        
        // STEP 2: Generate embeddings in batch
        const embeddings = await generateBatchEmbeddingsOptimized(
            allGrievances.map(g => g.processedText),
            env
        );
        
        // Attach embeddings to grievances
        allGrievances.forEach((g, i) => {
            g.embedding = embeddings[i];
        });
        
        // STEP 3: Fetch existing embeddings for global dedup
        const existingEmbeddings = await getExistingEmbeddings(env);
        
        // STEP 4: Get adaptive thresholds
        const thresholds = await getAdaptiveThresholds(env);
        
        // STEP 5: Hierarchical deduplication
        const results = await hierarchicalDeduplication(
            allGrievances,
            existingEmbeddings,
            thresholds,
            env
        );
        
        // STEP 6: DBSCAN Clustering for additional duplicate detection
        // This catches groups of similar grievances that pairwise comparison might miss
        console.log('\n🔬 Running DBSCAN clustering...');
        const clusteredResults = applyDBSCANClustering(results, thresholds);
        
        // STEP 7: Save all results to database
        const savedResults = await saveGrievancesToDB(clusteredResults, batchId, env);
        
        // STEP 8: Form duplicate clusters
        await formDuplicateClusters(savedResults, batchId, env);
        
        // STEP 8: Update batch status
        const stats = calculateBatchStats(savedResults);
        await env.DB.prepare(`
            UPDATE processing_batches 
            SET batch_status = 'completed',
                processed_pdfs = ?,
                total_grievances = ?,
                unique_count = ?,
                duplicate_count = ?,
                near_duplicate_count = ?,
                processing_completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(
            pdfEntries.length,
            savedResults.length,
            stats.unique,
            stats.duplicate,
            stats.nearDuplicate,
            batchId
        ).run();
        
        return {
            batchId,
            processingTimeMs: Date.now() - startTime,
            totalGrievances: savedResults.length,
            stats,
            results: savedResults
        };
        
    } catch (error) {
        // Mark batch as failed
        await env.DB.prepare(`
            UPDATE processing_batches 
            SET batch_status = 'failed',
                error_message = ?,
                processing_completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(error.message, batchId).run();
        
        throw error;
    }
}

/**
 * Generate embeddings using custom server (Colab+ngrok) OR HuggingFace API
 * Custom server is ~100x faster when configured
 * 
 * @param {string[]} texts - Array of preprocessed texts
 * @param {Object} env - Cloudflare Worker environment
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
export async function generateBatchEmbeddingsOptimized(texts, env) {
    // Try custom embedding server first (Colab + ngrok = FAST)
    // Set EMBEDDING_SERVER_URL in .dev.vars to use your Colab server
    const customUrl = env.EMBEDDING_SERVER_URL || null;
    
    const embeddings = await generateBatchEmbeddings(
        texts, 
        env.HUGGINGFACE_API_TOKEN,
        customUrl
    );
    return embeddings;
}

/**
 * Fetch existing grievance embeddings from database
 * @param {Object} env - Cloudflare Worker environment
 * @returns {Promise<Array>} - Array of {id, text, embedding}
 */
async function getExistingEmbeddings(env) {
    const { results } = await env.DB.prepare(`
        SELECT g.id, g.grievance_text as text, e.embedding_vector as embedding
        FROM grievances g
        JOIN embeddings e ON g.id = e.grievance_id
        WHERE g.processed = 1
        ORDER BY g.created_at DESC
        LIMIT 1000
    `).all();
    
    return results.map(r => ({
        id: r.id,
        text: r.text,
        embedding: JSON.parse(r.embedding)
    }));
}

/**
 * Hierarchical deduplication: local (within PDF) then global (across all)
 * 
 * @param {Array} grievances - All grievances with embeddings
 * @param {Array} existingEmbeddings - Historical embeddings from DB
 * @param {Object} thresholds - Adaptive thresholds
 * @param {Object} env - Cloudflare Worker environment
 * @returns {Promise<Array>} - Grievances with duplicate status
 */
async function hierarchicalDeduplication(grievances, existingEmbeddings, thresholds, env) {
    // LAYER 1: Local deduplication (within same PDF)
    const pdfGroups = groupByPDF(grievances);
    
    for (const [pdfId, pdfGrievances] of Object.entries(pdfGroups)) {
        console.log(`\n📁 Processing PDF: ${pdfId} (${pdfGrievances.length} grievances)`);
        
        // Compare within this PDF only
        for (let i = 0; i < pdfGrievances.length; i++) {
            const current = pdfGrievances[i];
            
            // Find best match within same PDF (excluding self)
            let bestLocalMatch = null;
            let bestLocalScore = 0;
            
            for (let j = 0; j < i; j++) {
                const other = pdfGrievances[j];
                const similarity = computeContextualSimilarity(current, other, thresholds);
                
                console.log(`   Within-PDF comparison ${i+1} vs ${j+1}: score=${similarity.combinedScore.toFixed(3)}`);
                
                if (similarity.combinedScore > bestLocalScore) {
                    bestLocalScore = similarity.combinedScore;
                    bestLocalMatch = {
                        index: j,
                        similarity,
                        grievance: other
                    };
                }
            }
            
            // Classify local status
            if (bestLocalMatch && bestLocalScore >= thresholds.duplicate) {
                current.localStatus = 'LOCAL_DUPLICATE';
                current.localDuplicateOf = pdfGrievances[bestLocalMatch.index];
                current.localScore = bestLocalScore;
                current.localMatchId = `pdf_${pdfId}_${bestLocalMatch.index}`;
                console.log(`   ✓ Grievance ${i+1} is LOCAL_DUPLICATE of ${bestLocalMatch.index+1} (score: ${bestLocalScore.toFixed(3)})`);
            } else if (bestLocalMatch && bestLocalScore >= thresholds.near_duplicate) {
                current.localStatus = 'LOCAL_NEAR_DUPLICATE';
                current.localDuplicateOf = pdfGrievances[bestLocalMatch.index];
                current.localScore = bestLocalScore;
                current.localMatchId = `pdf_${pdfId}_${bestLocalMatch.index}`;
                console.log(`   ✓ Grievance ${i+1} is LOCAL_NEAR_DUPLICATE of ${bestLocalMatch.index+1} (score: ${bestLocalScore.toFixed(3)})`);
            } else {
                current.localStatus = 'LOCAL_UNIQUE';
                current.localScore = bestLocalScore;
            }
        }
    }
    
    // LAYER 2: Global deduplication (across batch + historical)
    // Track already processed batch items for cross-comparison
    const processedInBatch = [];
    
    for (let i = 0; i < grievances.length; i++) {
        const grievance = grievances[i];
        
        // If already marked as local duplicate within same PDF, mark as duplicate
        if (grievance.localStatus === 'LOCAL_DUPLICATE') {
            grievance.globalStatus = 'DUPLICATE';
            grievance.finalStatus = 'DUPLICATE';
            grievance.globalScore = grievance.localScore;
            // Add to processed pool for subsequent comparisons
            processedInBatch.push({
                idx: i,
                id: `batch_${i}`,
                text: grievance.processedText,
                embedding: grievance.embedding,
                category: grievance.category,
                area: grievance.area,
                grievanceRef: grievance
            });
            continue;
        }
        
        // Build comparison pool: historical + already processed in this batch
        const comparisonPool = [
            // Existing embeddings from database
            ...existingEmbeddings.map(e => ({
                id: e.id,
                text: e.text,
                embedding: e.embedding,
                category: e.category || null,
                area: e.area || null
            })),
            // Already processed batch items (with full grievance data)
            ...processedInBatch.map(p => ({
                id: p.id,
                text: p.text,
                embedding: p.embedding,
                category: p.category,
                area: p.area,
                processedText: p.text,  // For lexical comparison
                batchIdx: p.idx
            }))
        ];
        
        console.log(`\n📊 Grievance ${i + 1}: "${grievance.processedText.substring(0, 50)}..."`);
        console.log(`   Category: ${grievance.category}, Area: ${grievance.area || 'N/A'}`);
        console.log(`   Historical embeddings: ${existingEmbeddings.length}, Batch items so far: ${processedInBatch.length}`);
        console.log(`   Total comparison pool: ${comparisonPool.length}`);
        
        // HIERARCHICAL FILTERING: Category → Area → Semantic
        // Level 1: Filter by same category (if category is not OTHER)
        let filteredPool = comparisonPool;
        if (grievance.category && grievance.category !== 'OTHER') {
            const categoryFiltered = comparisonPool.filter(item => 
                !item.category || item.category === grievance.category
            );
            if (categoryFiltered.length > 0) {
                filteredPool = categoryFiltered;
                console.log(`   🏷️ Category filter (${grievance.category}): ${comparisonPool.length} → ${filteredPool.length}`);
            }
        }
        
        // Level 2: Filter by same area (if area is provided)
        if (grievance.area) {
            const areaFiltered = filteredPool.filter(item => 
                !item.area || item.area.toLowerCase() === grievance.area.toLowerCase()
            );
            // Only apply if it leaves some results
            if (areaFiltered.length > 0) {
                filteredPool = areaFiltered;
                console.log(`   📍 Area filter (${grievance.area}): → ${filteredPool.length}`);
            }
        }
        
        // Level 3: Top-K semantic similarity search on filtered pool
        // If pool is empty, use full comparison pool
        const searchPool = filteredPool.length > 0 ? filteredPool : comparisonPool;
        
        const topMatches = topKSimilaritySearch(
            grievance,
            searchPool,
            10,
            thresholds
        );
        
        // Log results
        console.log(`   Thresholds: duplicate=${thresholds.duplicate}, near_duplicate=${thresholds.near_duplicate}`);
        if (topMatches.length > 0) {
            console.log(`   Top match score: ${topMatches[0].combinedScore.toFixed(3)} (id: ${topMatches[0].id})`);
            console.log(`   Score breakdown:`, topMatches[0].breakdown);
        } else {
            console.log(`   No matches found in pool`);
        }
        
        if (topMatches.length > 0 && topMatches[0].combinedScore >= thresholds.duplicate) {
            grievance.globalStatus = 'DUPLICATE';
            grievance.globalMatchId = topMatches[0].id;
            grievance.globalScore = topMatches[0].combinedScore;
            grievance.scoreBreakdown = topMatches[0].breakdown;
            console.log(`   ➡️ Classified as: DUPLICATE`);
        } else if (topMatches.length > 0 && topMatches[0].combinedScore >= thresholds.near_duplicate) {
            grievance.globalStatus = 'NEAR_DUPLICATE';
            grievance.globalMatchId = topMatches[0].id;
            grievance.globalScore = topMatches[0].combinedScore;
            grievance.scoreBreakdown = topMatches[0].breakdown;
            console.log(`   ➡️ Classified as: NEAR_DUPLICATE`);
        } else {
            grievance.globalStatus = 'UNIQUE';
            grievance.globalScore = topMatches[0]?.combinedScore || 0;
            console.log(`   ➡️ Classified as: UNIQUE`);
        }
        
        // Final status is global status
        grievance.finalStatus = grievance.globalStatus;
        grievance.topMatches = topMatches.slice(0, 3);
        
        // Add to processed pool for subsequent comparisons WITH full metadata
        processedInBatch.push({
            idx: i,
            id: `batch_${i}`,
            text: grievance.processedText,
            embedding: grievance.embedding,
            category: grievance.category,
            area: grievance.area,
            grievanceRef: grievance
        });
    }
    
    return grievances;
}

/**
 * Compute contextual similarity between two grievances
 * Combines semantic, lexical, n-gram, metadata, and ADVANCED features:
 * - Rare keyword boost
 * - Category match/mismatch penalty
 * - Location keyword boost
 */
function computeContextualSimilarity(grievance1, grievance2, thresholds) {
    // 1. Semantic similarity (cosine on embeddings)
    const cosineScore = cosineSimilarity(grievance1.embedding, grievance2.embedding);
    
    // 2. Lexical similarity (Jaccard on word sets)
    const words1 = new Set(grievance1.processedText.split(' ').filter(w => w.length > 0));
    const words2 = new Set((grievance2.processedText || grievance2.text).split(' ').filter(w => w.length > 0));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    const jaccardScore = union.size === 0 ? 0 : intersection.size / union.size;
    
    // 3. N-gram overlap (bigrams)
    const ngramScore = calculateNGramOverlap(
        grievance1.processedText, 
        grievance2.processedText || grievance2.text, 
        2
    );
    
    // 4. RARE KEYWORD BOOST
    // Common words that appear in many grievances (should not boost)
    const commonWords = new Set([
        'problem', 'issue', 'complaint', 'please', 'help', 'need', 'request',
        'government', 'department', 'office', 'area', 'road', 'water', 'service',
        'days', 'weeks', 'months', 'time', 'action', 'taken', 'urgent'
    ]);
    
    // Find rare matching words (words that appear in both but are not common)
    const rareMatches = [...intersection].filter(word => 
        word.length > 3 && !commonWords.has(word)
    );
    
    // Location-specific keywords get extra boost
    const locationKeywords = rareMatches.filter(word =>
        /^(sector|ward|block|colony|nagar|road|chowk|market|park|school|hospital|station)$/i.test(word) ||
        word.match(/^\d+$/) // Numbers like sector 15
    );
    
    // Calculate rare keyword boost (max 0.08 = 8%)
    const rareBoost = Math.min(0.08, rareMatches.length * 0.02);
    const locationBoost = Math.min(0.06, locationKeywords.length * 0.03);
    
    // 5. CATEGORY MATCH/MISMATCH PENALTY
    let categoryModifier = 0;
    const cat1 = grievance1.category || 'OTHER';
    const cat2 = grievance2.category || grievance2.metadata?.category || 'OTHER';
    
    if (cat1 !== 'OTHER' && cat2 !== 'OTHER') {
        if (cat1 === cat2) {
            categoryModifier = 0.10; // +10% for same category
        } else {
            categoryModifier = -0.25; // -25% for different category (stronger penalty)
        }
    }
    
    // 6. Calculate base weighted score
    const baseScore = calculateAdaptiveWeightedScore({
        cosine: cosineScore,
        jaccard: jaccardScore,
        ngram: ngramScore,
        metadata: 0
    }, thresholds);
    
    // 7. Apply boosts and penalties
    let finalScore = baseScore + rareBoost + locationBoost + categoryModifier;
    
    // Clamp between 0 and 1
    finalScore = Math.max(0, Math.min(1, finalScore));
    
    // DEBUG: Log detailed similarity
    console.log(`   🔍 Comparing texts:`);
    console.log(`      Text1: "${grievance1.processedText?.substring(0, 40) || 'N/A'}..."`);
    console.log(`      Text2: "${(grievance2.processedText || grievance2.text)?.substring(0, 40) || 'N/A'}..."`);
    console.log(`      Base scores -> Cosine: ${cosineScore.toFixed(3)}, Jaccard: ${jaccardScore.toFixed(3)}, N-gram: ${ngramScore.toFixed(3)}`);
    console.log(`      Base weighted: ${baseScore.toFixed(3)}`);
    console.log(`      Rare keywords: [${rareMatches.join(', ')}] → +${rareBoost.toFixed(2)}`);
    console.log(`      Location keywords: [${locationKeywords.join(', ')}] → +${locationBoost.toFixed(2)}`);
    console.log(`      Category: ${cat1} vs ${cat2} → ${categoryModifier > 0 ? '+' : ''}${categoryModifier.toFixed(2)}`);
    console.log(`      FINAL SCORE: ${finalScore.toFixed(3)}`);
    
    return {
        combinedScore: finalScore,
        breakdown: {
            cosine: Math.round(cosineScore * 1000) / 1000,
            jaccard: Math.round(jaccardScore * 1000) / 1000,
            ngram: Math.round(ngramScore * 1000) / 1000,
            rareBoost: Math.round(rareBoost * 1000) / 1000,
            locationBoost: Math.round(locationBoost * 1000) / 1000,
            categoryModifier: Math.round(categoryModifier * 1000) / 1000,
            base: Math.round(baseScore * 1000) / 1000,
            final: Math.round(finalScore * 1000) / 1000
        }
    };
}

/**
 * Compute similarity between metadata objects
 */
function computeMetadataSimilarity(meta1, meta2) {
    let matches = 0;
    let total = 0;
    
    const fields = ['department', 'location', 'issue_category'];
    
    for (const field of fields) {
        if (meta1[field] && meta2[field]) {
            total++;
            if (meta1[field].toLowerCase() === meta2[field].toLowerCase()) {
                matches++;
            }
        }
    }
    
    return total === 0 ? 0 : matches / total;
}

/**
 * Top-K similarity search with early termination
 * Avoids O(n²) by stopping after finding K confident matches
 */
function topKSimilaritySearch(grievance, pool, k, thresholds) {
    const matches = [];
    
    for (const existing of pool) {
        const similarity = computeContextualSimilarity(
            grievance,
            { 
                processedText: existing.text, 
                embedding: existing.embedding,
                metadata: existing.metadata
            },
            thresholds
        );
        
        matches.push({
            id: existing.id,
            ...similarity
        });
    }
    
    // Sort by combined score descending
    matches.sort((a, b) => b.combinedScore - a.combinedScore);
    
    // Return top K
    return matches.slice(0, k);
}

/**
 * Group grievances by PDF ID
 */
function groupByPDF(grievances) {
    const groups = {};
    
    for (const g of grievances) {
        const key = g.pdfId || 'unknown';
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(g);
    }
    
    return groups;
}

/**
 * Save grievances to database with embeddings
 */
async function saveGrievancesToDB(grievances, batchId, env) {
    const savedResults = [];
    
    for (const g of grievances) {
        // Insert grievance with category and area metadata
        const result = await env.DB.prepare(`
            INSERT INTO grievances 
            (user_id, grievance_text, original_text, submission_type, 
             pdf_upload_id, batch_id, source_pdf_name, page_number,
             category, area, location_details,
             duplicate_status, similarity_score, matched_grievance_id,
             local_duplicate_of, cosine_score, jaccard_score, ngram_score,
             contextual_score, processed)
            VALUES (?, ?, ?, 'pdf', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).bind(
            g.userId || 1,
            g.processedText,
            g.originalText,
            g.pdfId,
            batchId,
            g.pdfName,
            g.pageNumber,
            g.category || 'OTHER',
            g.area || '',
            g.locationDetails || '',
            g.finalStatus,
            g.globalScore || g.localScore || 0,
            g.globalMatchId || null,
            g.localDuplicateOf?.id || null,
            g.scoreBreakdown?.cosine || 0,
            g.scoreBreakdown?.jaccard || 0,
            g.scoreBreakdown?.ngram || 0,
            g.scoreBreakdown?.metadata || 0
        ).run();
        
        const grievanceId = result.meta.last_row_id;
        g.id = grievanceId;
        
        // Insert embedding
        await env.DB.prepare(`
            INSERT INTO embeddings (grievance_id, embedding_vector, vector_dimension, model_name)
            VALUES (?, ?, 384, 'paraphrase-MiniLM-L6-v2')
        `).bind(grievanceId, JSON.stringify(g.embedding)).run();
        
        savedResults.push({
            id: grievanceId,
            pdfName: g.pdfName,
            pageNumber: g.pageNumber,
            status: g.finalStatus,
            score: g.globalScore || g.localScore || 0,
            matchedId: g.globalMatchId,
            breakdown: g.scoreBreakdown
        });
    }
    
    return savedResults;
}

/**
 * Form duplicate clusters from results
 */
async function formDuplicateClusters(results, batchId, env) {
    const clusters = {};
    
    // Group by matched grievance ID
    for (const r of results) {
        if (r.status === 'DUPLICATE' || r.status === 'NEAR_DUPLICATE') {
            // Skip if matchedId is a batch reference (string like "batch_0") instead of a real ID
            const matchedId = r.matchedId;
            if (typeof matchedId === 'string' && matchedId.startsWith('batch_')) {
                // This is a within-batch duplicate, use the current grievance's ID as primary
                continue;
            }
            
            const key = matchedId || r.id;
            
            // Skip if key is not a valid number
            if (typeof key !== 'number' || isNaN(key)) {
                console.warn(`Skipping cluster formation for invalid key: ${key}`);
                continue;
            }
            
            if (!clusters[key]) {
                clusters[key] = {
                    type: r.status,
                    primaryId: key,
                    members: [],
                    scores: []
                };
            }
            clusters[key].members.push(r.id);
            clusters[key].scores.push(r.score);
        }
    }
    
    // Save clusters to database
    for (const [primaryId, cluster] of Object.entries(clusters)) {
        if (cluster.members.length > 0) {
            // Validate primaryId is a valid number
            const primaryIdNum = parseInt(primaryId);
            if (isNaN(primaryIdNum)) {
                console.warn(`Skipping cluster with invalid primaryId: ${primaryId}`);
                continue;
            }
            
            const avgScore = cluster.scores.reduce((a, b) => a + b, 0) / cluster.scores.length;
            
            try {
                const clusterResult = await env.DB.prepare(`
                    INSERT INTO duplicate_clusters 
                    (batch_id, cluster_type, primary_grievance_id, member_count, avg_similarity_score)
                    VALUES (?, ?, ?, ?, ?)
                `).bind(batchId, cluster.type, primaryIdNum, cluster.members.length, avgScore).run();
                
                const clusterId = clusterResult.meta.last_row_id;
                
                // Save cluster members
                for (let i = 0; i < cluster.members.length; i++) {
                    await env.DB.prepare(`
                        INSERT INTO cluster_members (cluster_id, grievance_id, similarity_to_primary)
                        VALUES (?, ?, ?)
                    `).bind(clusterId, cluster.members[i], cluster.scores[i]).run();
                }
            } catch (error) {
                console.error(`Failed to save cluster for primaryId ${primaryId}:`, error.message);
            }
        }
    }
}

/**
 * Calculate batch statistics
 */
function calculateBatchStats(results) {
    return {
        unique: results.filter(r => r.status === 'UNIQUE').length,
        duplicate: results.filter(r => r.status === 'DUPLICATE').length,
        nearDuplicate: results.filter(r => r.status === 'NEAR_DUPLICATE').length
    };
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

