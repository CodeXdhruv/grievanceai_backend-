// NLP Text Preprocessing Module
// Used in both Cloudflare Workers and Frontend

/**
 * Complete text preprocessing pipeline
 * @param {string} text - Raw input text
 * @returns {string} - Preprocessed text
 */
export function preprocessText(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    // Step 1: Unicode normalization
    let processed = normalizeUnicode(text);
    
    // Step 2: Convert to lowercase
    processed = processed.toLowerCase();
    
    // Step 3: Remove URLs
    processed = removeUrls(processed);
    
    // Step 4: Remove emails
    processed = removeEmails(processed);
    
    // Step 5: Remove phone numbers
    processed = removePhoneNumbers(processed);
    
    // Step 6: Remove special characters but keep spaces
    processed = removeSpecialChars(processed);
    
    // Step 7: Remove extra whitespaces
    processed = normalizeWhitespace(processed);
    
    // Step 8: Remove stopwords
    processed = removeStopwords(processed);
    
    // Step 9: Basic lemmatization (simplified)
    processed = simpleLemmatization(processed);
    
    return processed.trim();
}

/**
 * Unicode normalization (NFD - Canonical Decomposition)
 */
function normalizeUnicode(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Remove URLs from text
 */
function removeUrls(text) {
    const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    return text.replace(urlPattern, ' ');
}

/**
 * Remove email addresses
 */
function removeEmails(text) {
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    return text.replace(emailPattern, ' ');
}

/**
 * Remove phone numbers
 */
function removePhoneNumbers(text) {
    const phonePattern = /(\+\d{1,3}[- ]?)?\d{10}|\(\d{3}\)\s*\d{3}[-]?\d{4}/g;
    return text.replace(phonePattern, ' ');
}

/**
 * Remove special characters and punctuation
 */
function removeSpecialChars(text) {
    // Keep only alphanumeric and spaces
    return text.replace(/[^a-z0-9\s]/g, ' ');
}

/**
 * Normalize whitespace
 */
function normalizeWhitespace(text) {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * English stopwords list
 */
const STOPWORDS = new Set([
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 
    'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 
    'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 
    'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 
    'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 
    'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 
    'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 
    'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 
    'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 
    'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both', 
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 
    'just', 'don', 'should', 'now'
]);

/**
 * Remove stopwords
 */
function removeStopwords(text) {
    const words = text.split(' ');
    const filtered = words.filter(word => !STOPWORDS.has(word) && word.length > 1);
    return filtered.join(' ');
}

/**
 * Simple lemmatization using rule-based approach
 * (For production, consider using wink-lemmatizer or similar)
 */
function simpleLemmatization(text) {
    const words = text.split(' ');
    const lemmatized = words.map(word => lemmatizeWord(word));
    return lemmatized.join(' ');
}

/**
 * Enhanced word lemmatization with more comprehensive rules
 */
function lemmatizeWord(word) {
    // Skip very short words
    if (word.length <= 2) return word;
    
    // Irregular verbs and nouns mapping
    const irregulars = {
        'complained': 'complain', 'complaints': 'complain',
        'issues': 'issue', 'problems': 'problem',
        'services': 'service', 'products': 'product',
        'requests': 'request', 'responses': 'response',
        'delayed': 'delay', 'delays': 'delay',
        'refunds': 'refund', 'refunded': 'refund',
        'resolved': 'resolve', 'resolving': 'resolve',
        'received': 'receive', 'receiving': 'receive',
        'damaged': 'damage', 'damaging': 'damage',
        'charged': 'charge', 'charges': 'charge',
        'cancelled': 'cancel', 'cancelling': 'cancel'
    };
    
    if (irregulars[word]) {
        return irregulars[word];
    }
    
    // Extended suffix rules with priority ordering
    const rules = [
        { pattern: /ications?$/, replacement: 'icate', minLen: 7 },
        { pattern: /ational$/, replacement: 'ate', minLen: 7 },
        { pattern: /tional$/, replacement: 'tion', minLen: 6 },
        { pattern: /encies$/, replacement: 'ency', minLen: 6 },
        { pattern: /ancies$/, replacement: 'ancy', minLen: 6 },
        { pattern: /ement$/, replacement: '', minLen: 6 },
        { pattern: /ments$/, replacement: '', minLen: 6 },
        { pattern: /ness$/, replacement: '', minLen: 5 },
        { pattern: /ities$/, replacement: 'ity', minLen: 6 },
        { pattern: /ings?$/, replacement: '', minLen: 5 },
        { pattern: /edly$/, replacement: '', minLen: 5 },
        { pattern: /ied$/, replacement: 'y', minLen: 4 },
        { pattern: /ies$/, replacement: 'y', minLen: 4 },
        { pattern: /ed$/, replacement: '', minLen: 4 },
        { pattern: /es$/, replacement: '', minLen: 4 },
        { pattern: /s$/, replacement: '', minLen: 3 },
        { pattern: /tion$/, replacement: 'te', minLen: 5 },
        { pattern: /ment$/, replacement: '', minLen: 5 },
        { pattern: /ful$/, replacement: '', minLen: 5 },
        { pattern: /ous$/, replacement: '', minLen: 5 },
        { pattern: /ive$/, replacement: '', minLen: 5 },
        { pattern: /ize$/, replacement: '', minLen: 5 },
        { pattern: /ise$/, replacement: '', minLen: 5 },
        { pattern: /ly$/, replacement: '', minLen: 4 },
        { pattern: /er$/, replacement: '', minLen: 4 },
        { pattern: /or$/, replacement: '', minLen: 4 }
    ];
    
    let lemma = word;
    for (const rule of rules) {
        if (word.length >= rule.minLen && rule.pattern.test(word)) {
            lemma = word.replace(rule.pattern, rule.replacement);
            break;
        }
    }
    
    return lemma || word;
}

/**
 * Calculate text statistics
 */
export function getTextStats(text) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    return {
        length: text.length,
        wordCount: words.length,
        avgWordLength: words.reduce((sum, w) => sum + w.length, 0) / words.length || 0
    };
}

/**
 * Validate grievance text
 */
export function validateGrievanceText(text) {
    const errors = [];
    
    if (!text || text.trim().length === 0) {
        errors.push('Grievance text cannot be empty');
    }
    
    const stats = getTextStats(text);
    
    if (stats.wordCount < 5) {
        errors.push('Grievance must contain at least 5 words');
    }
    
    if (stats.wordCount > 5000) {
        errors.push('Grievance is too long (max 5000 words)');
    }
    
    if (stats.length < 20) {
        errors.push('Grievance must be at least 20 characters long');
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        stats
    };
}

/**
 * Extract sentences from text (for PDF splitting)
 */
export function extractSentences(text) {
    // Simple sentence tokenization
    const sentences = text
        .replace(/([.?!])\s+(?=[A-Z])/g, '$1|')
        .split('|')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    return sentences;
}

/**
 * Extract n-grams from text for better contextual matching
 * @param {string} text - Preprocessed text
 * @param {number} n - N-gram size (2 for bigrams, 3 for trigrams)
 * @returns {string[]} - Array of n-grams
 */
export function extractNGrams(text, n = 2) {
    const words = text.split(' ').filter(w => w.length > 0);
    const ngrams = [];
    
    for (let i = 0; i <= words.length - n; i++) {
        ngrams.push(words.slice(i, i + n).join(' '));
    }
    
    return ngrams;
}

/**
 * Calculate TF-IDF scores for words in text
 * @param {string} text - Preprocessed text
 * @param {Object} corpusStats - Corpus statistics {totalDocs, docFrequency}
 * @returns {Object} - Word to TF-IDF score mapping
 */
export function calculateTFIDF(text, corpusStats = null) {
    const words = text.split(' ').filter(w => w.length > 0);
    const termFrequency = {};
    
    // Calculate term frequency
    words.forEach(word => {
        termFrequency[word] = (termFrequency[word] || 0) + 1;
    });
    
    // Normalize by document length
    const maxFreq = Math.max(...Object.values(termFrequency));
    Object.keys(termFrequency).forEach(word => {
        termFrequency[word] = termFrequency[word] / maxFreq;
    });
    
    // If corpus stats provided, calculate IDF
    if (corpusStats) {
        const tfidf = {};
        Object.keys(termFrequency).forEach(word => {
            const df = corpusStats.docFrequency[word] || 1;
            const idf = Math.log(corpusStats.totalDocs / df);
            tfidf[word] = termFrequency[word] * idf;
        });
        return tfidf;
    }
    
    return termFrequency;
}

/**
 * Extract key phrases using word frequency and position
 * @param {string} text - Original text
 * @param {number} topN - Number of key phrases to extract
 * @returns {string[]} - Array of key phrases
 */
export function extractKeyPhrases(text, topN = 5) {
    const processed = preprocessText(text);
    const words = processed.split(' ').filter(w => w.length > 2);
    
    // Get bigrams and trigrams
    const bigrams = extractNGrams(processed, 2);
    const trigrams = extractNGrams(processed, 3);
    
    // Calculate frequencies
    const phraseFreq = {};
    [...bigrams, ...trigrams].forEach(phrase => {
        phraseFreq[phrase] = (phraseFreq[phrase] || 0) + 1;
    });
    
    // Sort by frequency and return top N
    const sorted = Object.entries(phraseFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([phrase]) => phrase);
    
    return sorted;
}

/**
 * Calculate Jaccard similarity between two texts
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {number} - Jaccard similarity score (0-1)
 */
export function jaccardSimilarity(text1, text2) {
    const words1 = new Set(text1.split(' ').filter(w => w.length > 0));
    const words2 = new Set(text2.split(' ').filter(w => w.length > 0));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Check if text is a valid grievance (not a header/metadata)
 * @param {string} text - Text to check
 * @returns {boolean} - True if valid grievance
 */
function isValidGrievance(text) {
    const lowerText = text.toLowerCase().trim();
    
    // Filter out empty or too short text
    if (lowerText.length < 30) return false;
    
    // Filter out PDF headers and metadata patterns
    const headerPatterns = [
        /^grievance collection/i,
        /^batch [a-z0-9]/i,
        /^municipal corporation/i,
        /^ward \d+/i,
        /^date:/i,
        /^---+$/,
        /^december \d{4}$/i,
        /^january \d{4}$/i,
        /^submitted by:/i,
        /^page \d+/i,
        /^total grievances/i
    ];
    
    for (const pattern of headerPatterns) {
        if (pattern.test(lowerText)) {
            return false;
        }
    }
    
    // Must contain complaint-related keywords
    const complaintKeywords = [
        'problem', 'issue', 'complaint', 'request', 'not working', 
        'broken', 'damaged', 'delay', 'failed', 'poor', 'need',
        'water', 'road', 'electricity', 'garbage', 'sewage', 'streetlight',
        'pothole', 'drainage', 'supply', 'service', 'unsafe', 'health',
        'sanitation', 'flooding', 'repair', 'maintenance', 'construction',
        'traffic', 'signal', 'stray', 'dogs', 'animals', 'park', 'school'
    ];
    
    // Check if text contains at least one complaint keyword
    const hasComplaintKeyword = complaintKeywords.some(keyword => 
        lowerText.includes(keyword)
    );
    
    // Must have minimum word count for meaningful content
    const wordCount = lowerText.split(/\s+/).length;
    
    return hasComplaintKeyword && wordCount >= 10;
}

/**
 * Extract core complaint from text (remove filler words and noise)
 * @param {string} text - Raw grievance text
 * @returns {string} - Core complaint text
 */
export function extractCoreComplaint(text) {
    // Remove grievance number prefixes
    let cleaned = text.replace(/^GRIEVANCE\s*[A-Za-z]?\d*:\s*/i, '');
    
    // Remove reference numbers
    cleaned = cleaned.replace(/\b(ref|reference|complaint|ticket)[\s#:]+[A-Z0-9-]+/gi, '');
    
    // Remove dates in various formats
    cleaned = cleaned.replace(/\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/g, '');
    cleaned = cleaned.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s*\d{4}/gi, '');
    
    // Remove filler phrases at start
    const fillerPrefixes = [
        /^(i am writing to|this is to inform|i would like to|i want to|please note that|kindly note that)/i,
        /^(dear sir|respected sir|to whom it may concern)/i,
        /^(regarding the|with reference to|in connection with)/i
    ];
    
    for (const pattern of fillerPrefixes) {
        cleaned = cleaned.replace(pattern, '');
    }
    
    return cleaned.trim();
}

/**
 * Split long text into grievances
 * Uses heuristics to identify individual grievances in a document
 * Filters out headers and metadata
 */
export function splitIntoGrievances(text) {
    const grievances = [];
    
    // First, try to split by "GRIEVANCE [X]:" pattern
    const grievancePattern = /GRIEVANCE\s*[A-Za-z]?\d*:\s*/gi;
    let parts = text.split(grievancePattern);
    
    if (parts.length > 1) {
        // Found grievances with GRIEVANCE X: format
        for (const part of parts) {
            const trimmed = part.trim();
            if (isValidGrievance(trimmed)) {
                const core = extractCoreComplaint(trimmed);
                if (core.length > 30) {
                    grievances.push(core);
                }
            }
        }
        
        if (grievances.length > 0) {
            console.log(`📄 Extracted ${grievances.length} grievances using GRIEVANCE pattern`);
            return grievances;
        }
    }
    
    // Method 2: Split by numbered patterns (1. 2. 3. or 1) 2) 3))
    parts = text.split(/(?:\r?\n|^)\s*(?:\d+[\.)]|\[\d+\])\s+/);
    
    if (parts.length > 1) {
        for (const part of parts) {
            const trimmed = part.trim();
            if (isValidGrievance(trimmed)) {
                const core = extractCoreComplaint(trimmed);
                if (core.length > 30) {
                    grievances.push(core);
                }
            }
        }
        
        if (grievances.length > 0) {
            console.log(`📄 Extracted ${grievances.length} grievances using numbered pattern`);
            return grievances;
        }
    }
    
    // Method 3: Split by double newlines
    parts = text.split(/\n\s*\n/);
    
    if (parts.length > 1) {
        for (const part of parts) {
            const trimmed = part.trim();
            if (isValidGrievance(trimmed)) {
                const core = extractCoreComplaint(trimmed);
                if (core.length > 30) {
                    grievances.push(core);
                }
            }
        }
        
        if (grievances.length > 0) {
            console.log(`📄 Extracted ${grievances.length} grievances using paragraph split`);
            return grievances;
        }
    }
    
    // Method 4: Treat entire text as single grievance if valid
    if (isValidGrievance(text)) {
        const core = extractCoreComplaint(text);
        if (core.length > 30) {
            grievances.push(core);
            console.log(`📄 Single grievance extracted`);
        }
    }
    
    return grievances;
}

