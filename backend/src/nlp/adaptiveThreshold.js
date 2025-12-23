// Adaptive Threshold Management Module
// File: src/nlp/adaptiveThreshold.js

/**
 * Get current adaptive thresholds from database
 * @param {Object} env - Cloudflare Worker environment
 * @returns {Promise<Object>} - Current threshold values
 */
export async function getAdaptiveThresholds(env) {
    try {
        const { results } = await env.DB.prepare(`
            SELECT threshold_type, current_value 
            FROM adaptive_thresholds
        `).all();

        // Convert to object for easy access
        // SIMPLIFIED: Only DUPLICATE and UNIQUE (no NEAR_DUPLICATE)
        const thresholds = {
            duplicate: 0.60,        // 60% similarity = DUPLICATE, below = UNIQUE
            near_duplicate: 0.60,   // Same as duplicate (effectively disabled)
            cosine_weight: 0.55,    // Semantic similarity is key
            jaccard_weight: 0.25,   // Lexical overlap
            ngram_weight: 0.15,     // N-gram patterns
            metadata_weight: 0.05   // Metadata match
        };

        for (const row of results) {
            thresholds[row.threshold_type] = row.current_value;
        }

        return thresholds;
    } catch (error) {
        console.warn('Failed to fetch adaptive thresholds, using defaults:', error);
        return {
            duplicate: 0.50,
            near_duplicate: 0.50,
            cosine_weight: 0.55,
            jaccard_weight: 0.25,
            ngram_weight: 0.15,
            metadata_weight: 0.05
        };
    }
}

/**
 * Update thresholds based on admin feedback
 * Uses exponential moving average for gradual adjustment
 * 
 * @param {Object} feedback - Feedback data
 * @param {Object} env - Cloudflare Worker environment
 * @returns {Promise<Object>} - Updated thresholds
 */
export async function updateThresholdsFromFeedback(feedback, env) {
    const { originalStatus, correctedStatus, originalScore } = feedback;

    // Learning rate - how quickly to adjust (lower = more stable)
    const LEARNING_RATE = 0.05;

    // Get current thresholds
    const currentThresholds = await getAdaptiveThresholds(env);

    // Calculate adjustment based on feedback type
    let thresholdToAdjust = null;
    let adjustment = 0;

    if (originalStatus === 'UNIQUE' && correctedStatus === 'DUPLICATE') {
        // False negative - threshold was too high, need to lower it
        thresholdToAdjust = 'duplicate';
        adjustment = -LEARNING_RATE;
    } else if (originalStatus === 'DUPLICATE' && correctedStatus === 'UNIQUE') {
        // False positive - threshold was too low, need to raise it
        thresholdToAdjust = 'duplicate';
        adjustment = LEARNING_RATE;
    } else if (originalStatus === 'UNIQUE' && correctedStatus === 'NEAR_DUPLICATE') {
        thresholdToAdjust = 'near_duplicate';
        adjustment = -LEARNING_RATE;
    } else if (originalStatus === 'NEAR_DUPLICATE' && correctedStatus === 'UNIQUE') {
        thresholdToAdjust = 'near_duplicate';
        adjustment = LEARNING_RATE;
    } else if (originalStatus === 'NEAR_DUPLICATE' && correctedStatus === 'DUPLICATE') {
        // Near-dup should have been dup - raise near_dup threshold
        thresholdToAdjust = 'near_duplicate';
        adjustment = LEARNING_RATE;
    } else if (originalStatus === 'DUPLICATE' && correctedStatus === 'NEAR_DUPLICATE') {
        // Dup should have been near-dup - lower duplicate threshold
        thresholdToAdjust = 'duplicate';
        adjustment = LEARNING_RATE;
    }

    if (thresholdToAdjust) {
        // Calculate new value with bounds checking
        const currentValue = currentThresholds[thresholdToAdjust];

        // Get min/max bounds
        const bounds = await env.DB.prepare(`
            SELECT min_value, max_value 
            FROM adaptive_thresholds 
            WHERE threshold_type = ?
        `).bind(thresholdToAdjust).first();

        const minVal = bounds?.min_value || 0.3;
        const maxVal = bounds?.max_value || 0.95;

        // Apply adjustment within bounds
        const newValue = Math.max(minVal, Math.min(maxVal, currentValue + adjustment));

        // Update in database
        await env.DB.prepare(`
            UPDATE adaptive_thresholds 
            SET current_value = ?, 
                adjustment_count = adjustment_count + 1,
                last_adjusted_at = CURRENT_TIMESTAMP
            WHERE threshold_type = ?
        `).bind(newValue, thresholdToAdjust).run();

        // Return updated threshold
        currentThresholds[thresholdToAdjust] = newValue;

        console.log(`Threshold ${thresholdToAdjust} adjusted: ${currentValue} -> ${newValue}`);
    }

    return currentThresholds;
}

/**
 * Calculate confidence interval for threshold based on feedback history
 * @param {Object} env - Cloudflare Worker environment
 * @returns {Promise<Object>} - Confidence metrics
 */
export async function getThresholdConfidence(env) {
    const { results } = await env.DB.prepare(`
        SELECT 
            at.threshold_type,
            at.current_value,
            at.adjustment_count,
            COUNT(fl.id) as feedback_count,
            AVG(fl.original_score) as avg_score
        FROM adaptive_thresholds at
        LEFT JOIN feedback_logs fl ON fl.applied_to_threshold = 1
        GROUP BY at.threshold_type
    `).all();

    return results.map(row => ({
        type: row.threshold_type,
        value: row.current_value,
        adjustments: row.adjustment_count,
        feedbackCount: row.feedback_count || 0,
        confidence: Math.min(1.0, (row.feedback_count || 0) / 100) // More feedback = higher confidence
    }));
}

/**
 * Log feedback for future analysis
 * @param {Object} feedback - Feedback details
 * @param {number} adminId - Admin user ID
 * @param {Object} env - Cloudflare Worker environment
 */
export async function logFeedback(feedback, adminId, env) {
    await env.DB.prepare(`
        INSERT INTO feedback_logs 
        (admin_id, grievance_id, matched_grievance_id, original_status, 
         corrected_status, original_score, feedback_notes, applied_to_threshold)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
        adminId,
        feedback.grievanceId,
        feedback.matchedGrievanceId || null,
        feedback.originalStatus,
        feedback.correctedStatus,
        feedback.originalScore || null,
        feedback.notes || null
    ).run();
}

/**
 * Classify grievance status based on adaptive thresholds
 * @param {number} combinedScore - Weighted similarity score
 * @param {Object} thresholds - Current adaptive thresholds
 * @returns {string} - 'DUPLICATE', 'NEAR_DUPLICATE', or 'UNIQUE'
 */
export function classifyWithAdaptiveThresholds(combinedScore, thresholds) {
    if (combinedScore >= thresholds.duplicate) {
        return 'DUPLICATE';
    } else if (combinedScore >= thresholds.near_duplicate) {
        return 'NEAR_DUPLICATE';
    } else {
        return 'UNIQUE';
    }
}

/**
 * Calculate weighted similarity score using adaptive weights
 * @param {Object} scores - Individual similarity scores
 * @param {Object} thresholds - Current adaptive thresholds (includes weights)
 * @returns {number} - Combined weighted score
 */
export function calculateAdaptiveWeightedScore(scores, thresholds) {
    const { cosine, jaccard, ngram, metadata } = scores;

    // Use adaptive weights with fallback to defaults
    const cosineWeight = thresholds.cosine_weight || 0.50;
    const jaccardWeight = thresholds.jaccard_weight || 0.25;
    const ngramWeight = thresholds.ngram_weight || 0.15;
    const metadataWeight = thresholds.metadata_weight || 0.10;

    // Normalize weights to ensure they sum to 1
    const totalWeight = cosineWeight + jaccardWeight + ngramWeight + metadataWeight;

    const weightedScore = (
        (cosine * cosineWeight) +
        (jaccard * jaccardWeight) +
        (ngram * ngramWeight) +
        ((metadata || 0) * metadataWeight)
    ) / totalWeight;

    return Math.round(weightedScore * 1000) / 1000;
}
