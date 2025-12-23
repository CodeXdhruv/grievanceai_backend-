// Embedding Generation and Similarity Calculation Module

/**
 * Embedding Generation Module for Grievance Detection
 * Uses HuggingFace Inference API or custom Colab server for embeddings
 * 
 * Model: sentence-transformers/paraphrase-MiniLM-L6-v2
 * Dimensions: 384
 * 
 * @param {string} text - Preprocessed text
 * @returns {Promise<number[]>} - Embedding vector
 */
export async function generateEmbedding(text, hfToken) {
    const HF_API_URL = 'https://api-inference.huggingface.co/models/sentence-transformers/paraphrase-MiniLM-L6-v2';

    // Use provided token or fallback
    const HF_TOKEN = hfToken || 'hf_your_token_here';

    try {
        const response = await fetch(HF_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: text,
                options: {
                    wait_for_model: true
                }
            })
        });

        if (!response.ok) {
            // Fallback: Generate simple embedding locally
            console.warn('HF API failed, using fallback embedding');
            return generateFallbackEmbedding(text);
        }

        const embedding = await response.json();

        // HF returns array directly for this model
        if (Array.isArray(embedding)) {
            return embedding;
        }

        throw new Error('Invalid embedding format');

    } catch (error) {
        console.error('Embedding generation error:', error);
        // Use fallback embedding
        return generateFallbackEmbedding(text);
    }
}

/**
 * Generate embeddings for multiple texts
 * Supports: Custom server (Colab+ngrok) OR HuggingFace API
 * 
 * IMPORTANT: Uses all-MiniLM-L6-v2 for semantic similarity
 * DO NOT use fallback hash embeddings - they break semantic matching
 * 
 * @param {string[]} texts - Array of preprocessed texts
 * @param {string} hfToken - HuggingFace API token
 * @param {string} customUrl - Optional custom embedding server URL (e.g., ngrok URL)
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
export async function generateBatchEmbeddings(texts, hfToken, customUrl = null) {
    if (!texts || texts.length === 0) {
        return [];
    }

    console.log(`\n🔄 Generating embeddings for ${texts.length} texts...`);

    // Try custom embedding server first (Colab + ngrok = FAST)
    if (customUrl) {
        try {
            console.log(`   Using custom embedding server: ${customUrl}`);
            const response = await fetch(customUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs: texts })
            });

            if (response.ok) {
                const embeddings = await response.json();
                if (Array.isArray(embeddings) && embeddings.length === texts.length) {
                    // Validate embeddings
                    const firstEmb = embeddings[0];
                    if (Array.isArray(firstEmb) && firstEmb.length === 384) {
                        console.log(`   ✅ Custom server: Generated ${embeddings.length} valid embeddings`);
                        return embeddings;
                    }
                }
            }
            console.warn('   ⚠️ Custom server failed, falling back to HuggingFace...');
        } catch (error) {
            console.warn('   ⚠️ Custom server error:', error.message);
        }
    }

    // HuggingFace API with retry logic
    const HF_API_URL = 'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2';
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`   Attempt ${attempt}/${MAX_RETRIES}: HuggingFace API (all-MiniLM-L6-v2)...`);

            const response = await fetch(HF_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${hfToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: texts,
                    options: { wait_for_model: true }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`   ⚠️ HF API error (${response.status}):`, errorText.substring(0, 200));
                
                if (attempt < MAX_RETRIES) {
                    console.log(`   ⏳ Waiting ${RETRY_DELAY/1000}s before retry...`);
                    await new Promise(r => setTimeout(r, RETRY_DELAY));
                    continue;
                }
                throw new Error(`HuggingFace API failed after ${MAX_RETRIES} attempts`);
            }

            const embeddings = await response.json();

            // Validate response format
            if (Array.isArray(embeddings) && embeddings.length === texts.length) {
                const firstEmb = embeddings[0];
                if (Array.isArray(firstEmb) && firstEmb.length === 384) {
                    console.log(`   ✅ HuggingFace: Generated ${embeddings.length} valid embeddings (384 dims)`);
                    return embeddings;
                }
            }

            // Handle single text case
            if (Array.isArray(embeddings) && texts.length === 1 && typeof embeddings[0] === 'number') {
                console.log(`   ✅ HuggingFace: Generated 1 embedding (384 dims)`);
                return [embeddings];
            }

            throw new Error('Invalid embedding format from API');

        } catch (error) {
            console.error(`   ❌ Attempt ${attempt} failed:`, error.message);
            
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, RETRY_DELAY));
            }
        }
    }

    // CRITICAL: If all retries fail, throw error instead of using fallback
    // Fallback hash embeddings don't work for semantic similarity!
    console.error('   ❌ CRITICAL: All embedding attempts failed!');
    console.error('   📝 Check your HUGGINGFACE_API_TOKEN in .dev.vars');
    throw new Error('Failed to generate embeddings - check API token');
}

/**
 * Fallback embedding generation using TF-IDF-like approach
 * Creates 384-dimensional vector for consistency with paraphrase-MiniLM-L6-v2
 */
export function generateFallbackEmbedding(text) {
    const vector = new Array(384).fill(0);
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);

    // Simple hash-based embedding
    words.forEach((word, idx) => {
        for (let i = 0; i < word.length; i++) {
            const charCode = word.charCodeAt(i);
            const position = (charCode * (i + 1) + idx) % 384;
            vector[position] += 1 / (idx + 1); // Decay by position
        }
    });

    // Normalize
    return normalizeVector(vector);
}

/**
 * Normalize vector to unit length
 */
function normalizeVector(vector) {
    const magnitude = Math.sqrt(
        vector.reduce((sum, val) => sum + val * val, 0)
    );

    if (magnitude === 0) return vector;

    return vector.map(val => val / magnitude);
}

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (typically 0 to 1 for text)
 * 
 * @param {number[]} vec1 - First embedding vector
 * @param {number[]} vec2 - Second embedding vector
 * @returns {number} - Cosine similarity score
 */
export function cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
        throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        mag1 += vec1[i] * vec1[i];
        mag2 += vec2[i] * vec2[i];
    }

    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);

    if (mag1 === 0 || mag2 === 0) {
        return 0;
    }

    return dotProduct / (mag1 * mag2);
}

/**
 * Find most similar grievance from database
 * 
 * @param {number[]} newEmbedding - Embedding of new grievance
 * @param {Array} existingEmbeddings - Array of {id, embedding} objects
 * @returns {Object} - {matchedId, score, allScores}
 */
export function findMostSimilar(newEmbedding, existingEmbeddings) {
    if (existingEmbeddings.length === 0) {
        return {
            matchedId: null,
            score: 0,
            allScores: []
        };
    }

    const similarities = existingEmbeddings.map(item => {
        const embedding = typeof item.embedding === 'string'
            ? JSON.parse(item.embedding)
            : item.embedding;

        return {
            id: item.id,
            score: cosineSimilarity(newEmbedding, embedding)
        };
    });

    // Sort by score descending
    similarities.sort((a, b) => b.score - a.score);

    return {
        matchedId: similarities[0].id,
        score: similarities[0].score,
        allScores: similarities
    };
}

/**
 * Enhanced duplicate classification with multiple similarity metrics
 * Combines cosine similarity with contextual analysis
 * 
 * @param {number} cosineSim - Cosine similarity score
 * @param {number} jaccardSim - Jaccard similarity score
 * @param {number} ngramOverlap - N-gram overlap score
 * @returns {string} - 'DUPLICATE', 'NEAR_DUPLICATE', or 'UNIQUE'
 */
export function classifyDuplicate(cosineSim, jaccardSim = null, ngramOverlap = null) {
    // If only cosine similarity provided, use optimized thresholds
    if (jaccardSim === null && ngramOverlap === null) {
        if (cosineSim >= 0.75) {
            return 'DUPLICATE';
        } else if (cosineSim >= 0.50) {
            return 'NEAR_DUPLICATE';
        } else {
            return 'UNIQUE';
        }
    }

    // Weighted combination of multiple metrics (optimized weights)
    const weights = {
        cosine: 0.60,   // Increased - semantic similarity is most important
        jaccard: 0.20,
        ngram: 0.20
    };

    let combinedScore = cosineSim * weights.cosine;

    if (jaccardSim !== null) {
        combinedScore += jaccardSim * weights.jaccard;
    }

    if (ngramOverlap !== null) {
        combinedScore += ngramOverlap * weights.ngram;
    }

    // Optimized contextual thresholds
    if (combinedScore >= 0.75) {
        return 'DUPLICATE';
    } else if (combinedScore >= 0.50) {
        return 'NEAR_DUPLICATE';
    } else {
        return 'UNIQUE';
    }
}

/**
 * Calculate n-gram overlap between two texts
 * @param {string} text1 - First preprocessed text
 * @param {string} text2 - Second preprocessed text
 * @param {number} n - N-gram size
 * @returns {number} - Overlap score (0-1)
 */
export function calculateNGramOverlap(text1, text2, n = 2) {
    const ngrams1 = extractNGramsFromWords(text1.split(' '), n);
    const ngrams2 = extractNGramsFromWords(text2.split(' '), n);

    if (ngrams1.length === 0 || ngrams2.length === 0) {
        return 0;
    }

    const set1 = new Set(ngrams1);
    const set2 = new Set(ngrams2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Helper to extract n-grams from word array
 */
function extractNGramsFromWords(words, n) {
    const ngrams = [];
    for (let i = 0; i <= words.length - n; i++) {
        ngrams.push(words.slice(i, i + n).join(' '));
    }
    return ngrams;
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate embedding statistics
 */
export function getEmbeddingStats(embedding) {
    const sum = embedding.reduce((a, b) => a + b, 0);
    const mean = sum / embedding.length;

    const variance = embedding.reduce((sum, val) => {
        return sum + Math.pow(val - mean, 2);
    }, 0) / embedding.length;

    const stdDev = Math.sqrt(variance);

    return {
        dimensions: embedding.length,
        mean: mean.toFixed(4),
        stdDev: stdDev.toFixed(4),
        min: Math.min(...embedding).toFixed(4),
        max: Math.max(...embedding).toFixed(4)
    };
}

/**
 * Validate embedding vector
 */
export function validateEmbedding(embedding) {
    if (!Array.isArray(embedding)) {
        return { valid: false, error: 'Embedding must be an array' };
    }

    if (embedding.length !== 384) {
        return { valid: false, error: `Expected 384 dimensions, got ${embedding.length}` };
    }

    if (embedding.some(val => typeof val !== 'number' || isNaN(val))) {
        return { valid: false, error: 'All values must be valid numbers' };
    }

    return { valid: true };
}

/**
 * Enhanced similarity detection combining multiple NLP techniques
 * @param {number[]} newEmbedding - Embedding of new grievance
 * @param {string} newText - Preprocessed text of new grievance
 * @param {Object} existingGrievance - {id, embedding, text}
 * @returns {Object} - {cosineSim, jaccardSim, ngramSim, combinedScore, status}
 */
export function calculateContextualSimilarity(newEmbedding, newText, existingGrievance) {
    const existingEmbedding = typeof existingGrievance.embedding === 'string'
        ? JSON.parse(existingGrievance.embedding)
        : existingGrievance.embedding;

    // 1. Cosine similarity on embeddings
    const cosineSim = cosineSimilarity(newEmbedding, existingEmbedding);

    // 2. Jaccard similarity on word sets
    const words1 = new Set(newText.split(' ').filter(w => w.length > 0));
    const words2 = new Set(existingGrievance.text.split(' ').filter(w => w.length > 0));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    const jaccardSim = union.size === 0 ? 0 : intersection.size / union.size;

    // 3. Bigram overlap
    const bigramSim = calculateNGramOverlap(newText, existingGrievance.text, 2);

    // 4. Trigram overlap
    const trigramSim = calculateNGramOverlap(newText, existingGrievance.text, 3);

    // Combined n-gram score
    const ngramSim = (bigramSim * 0.6 + trigramSim * 0.4);

    // Weighted combination
    const combinedScore = (
        cosineSim * 0.5 +
        jaccardSim * 0.25 +
        ngramSim * 0.25
    );

    // Classify
    const status = classifyDuplicate(cosineSim, jaccardSim, ngramSim);

    return {
        id: existingGrievance.id,
        cosineSim: Math.round(cosineSim * 1000) / 1000,
        jaccardSim: Math.round(jaccardSim * 1000) / 1000,
        bigramSim: Math.round(bigramSim * 1000) / 1000,
        trigramSim: Math.round(trigramSim * 1000) / 1000,
        ngramSim: Math.round(ngramSim * 1000) / 1000,
        combinedScore: Math.round(combinedScore * 1000) / 1000,
        status
    };
}

/**
 * Find most similar grievances using enhanced contextual similarity
 * @param {number[]} newEmbedding - Embedding of new grievance
 * @param {string} newText - Preprocessed text of new grievance
 * @param {Array} existingGrievances - Array of {id, embedding, text} objects
 * @returns {Object} - {matchedId, score, status, topMatches}
 */
export function findMostSimilarEnhanced(newEmbedding, newText, existingGrievances) {
    if (existingGrievances.length === 0) {
        return {
            matchedId: null,
            score: 0,
            status: 'UNIQUE',
            topMatches: []
        };
    }

    // Calculate similarity for all existing grievances
    const similarities = existingGrievances.map(grievance =>
        calculateContextualSimilarity(newEmbedding, newText, grievance)
    );

    // Sort by combined score
    similarities.sort((a, b) => b.combinedScore - a.combinedScore);

    // Get top match
    const topMatch = similarities[0];

    return {
        matchedId: topMatch.id,
        score: topMatch.combinedScore,
        cosineSim: topMatch.cosineSim,
        jaccardSim: topMatch.jaccardSim,
        ngramSim: topMatch.ngramSim,
        status: topMatch.status,
        topMatches: similarities.slice(0, 5) // Return top 5 matches
    };
}

/**
 * Compare multiple grievances and find duplicates
 * Returns clusters of similar grievances
 */
export function findDuplicateClusters(embeddings, threshold = 0.85) {
    const clusters = [];
    const visited = new Set();

    for (let i = 0; i < embeddings.length; i++) {
        if (visited.has(i)) continue;

        const cluster = [i];
        visited.add(i);

        for (let j = i + 1; j < embeddings.length; j++) {
            if (visited.has(j)) continue;

            const similarity = cosineSimilarity(
                embeddings[i].embedding,
                embeddings[j].embedding
            );

            if (similarity >= threshold) {
                cluster.push(j);
                visited.add(j);
            }
        }

        if (cluster.length > 1) {
            clusters.push(cluster);
        }
    }

    return clusters;
}
