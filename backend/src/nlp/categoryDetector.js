// Category Detection Module for Grievance Classification
// Automatically detects grievance category from text using keyword matching

/**
 * Category definitions with keywords
 */
const CATEGORY_KEYWORDS = {
    WATER: [
        'water', 'supply', 'tap', 'pipeline', 'drinking', 'contaminated',
        'leakage', 'shortage', 'tanker', 'bore', 'well', 'purification',
        'waterlogging', 'overflow', 'pump', 'reservoir'
    ],
    GARBAGE: [
        'garbage', 'waste', 'trash', 'rubbish', 'litter', 'dump', 'dustbin',
        'collection', 'sweeper', 'sanitation', 'cleanliness', 'filth',
        'solid waste', 'disposal', 'recycling', 'compost'
    ],
    ROAD: [
        'road', 'pothole', 'street', 'highway', 'bridge', 'footpath',
        'pavement', 'asphalt', 'tar', 'construction', 'traffic', 'signal',
        'zebra crossing', 'divider', 'speed breaker', 'accident'
    ],
    ELECTRICITY: [
        'electricity', 'power', 'electric', 'voltage', 'transformer',
        'meter', 'billing', 'outage', 'blackout', 'wire', 'pole',
        'streetlight', 'light', 'current', 'load shedding', 'connection'
    ],
    SEWAGE: [
        'sewage', 'drain', 'drainage', 'sewer', 'gutter', 'manhole',
        'clogged', 'blocked', 'overflow', 'stink', 'smell', 'nala',
        'wastewater', 'septic', 'toilet', 'sanitation'
    ],
    NOISE: [
        'noise', 'sound', 'loud', 'pollution', 'horn', 'speaker',
        'construction noise', 'factory', 'industrial', 'nuisance',
        'disturbance', 'music', 'loudspeaker', 'dj'
    ],
    PARK: [
        'park', 'garden', 'playground', 'green', 'tree', 'plantation',
        'grass', 'bench', 'fountain', 'jogging', 'walking', 'recreation',
        'children', 'swing', 'maintenance'
    ]
};

/**
 * Detect category from grievance text
 * @param {string} text - Grievance text
 * @returns {Object} - { category: string, confidence: number, matchedKeywords: string[] }
 */
export function detectCategory(text) {
    if (!text || typeof text !== 'string') {
        return { category: 'OTHER', confidence: 0, matchedKeywords: [] };
    }
    
    const lowerText = text.toLowerCase();
    const results = {};
    
    // Count keyword matches for each category
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        const matches = keywords.filter(keyword => lowerText.includes(keyword));
        results[category] = {
            count: matches.length,
            keywords: matches
        };
    }
    
    // Find category with most matches
    let bestCategory = 'OTHER';
    let maxCount = 0;
    let matchedKeywords = [];
    
    for (const [category, result] of Object.entries(results)) {
        if (result.count > maxCount) {
            maxCount = result.count;
            bestCategory = category;
            matchedKeywords = result.keywords;
        }
    }
    
    // Calculate confidence (0-1 based on number of matches)
    const confidence = Math.min(maxCount / 3, 1); // 3+ matches = 100% confidence
    
    return {
        category: bestCategory,
        confidence: Math.round(confidence * 100) / 100,
        matchedKeywords
    };
}

/**
 * Detect categories for multiple grievances
 * @param {string[]} texts - Array of grievance texts
 * @returns {Object[]} - Array of category detection results
 */
export function detectCategoriesBatch(texts) {
    return texts.map(text => detectCategory(text));
}

/**
 * Extract area/location from text using common patterns
 * Note: This is a best-effort extraction, may not always work
 * @param {string} text - Grievance text
 * @returns {string} - Extracted area or empty string
 */
export function extractArea(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    // Common area patterns
    const patterns = [
        /sector[-\s]?(\d+)/i,                    // Sector 15, Sector-15
        /ward[-\s]?(\d+)/i,                      // Ward 5
        /block[-\s]?([a-z])/i,                   // Block C
        /zone[-\s]?([a-z0-9]+)/i,                // Zone A, Zone 2
        /colony\s+([a-z\s]+)/i,                  // Colony name
        /village\s+([a-z\s]+)/i,                 // Village name
        /mohalla\s+([a-z\s]+)/i,                 // Mohalla name
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return match[0].trim();
        }
    }
    
    return '';
}

/**
 * Get all available categories
 * @returns {Object[]} - Array of { value, label } for dropdowns
 */
export function getCategories() {
    return [
        { value: 'WATER', label: 'Water Supply' },
        { value: 'GARBAGE', label: 'Garbage Collection' },
        { value: 'ROAD', label: 'Road / Pothole' },
        { value: 'ELECTRICITY', label: 'Electricity' },
        { value: 'SEWAGE', label: 'Sewage / Drainage' },
        { value: 'NOISE', label: 'Noise Pollution' },
        { value: 'PARK', label: 'Parks / Playground' },
        { value: 'OTHER', label: 'Other' }
    ];
}

export default {
    detectCategory,
    detectCategoriesBatch,
    extractArea,
    getCategories,
    CATEGORY_KEYWORDS
};
