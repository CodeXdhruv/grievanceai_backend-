// DBSCAN Clustering for Grievance Duplicate Detection
// File: src/nlp/dbscan.js

import { cosineSimilarity } from './embedding.js';

/**
 * DBSCAN (Density-Based Spatial Clustering of Applications with Noise)
 * Clusters grievances based on embedding similarity
 * 
 * @param {Array} grievances - Array of {id, embedding, processedText, ...}
 * @param {number} eps - Maximum distance (1 - similarity) for neighbors
 * @param {number} minPts - Minimum points to form a cluster
 * @returns {Object} - {clusters: [[idx, idx, ...], ...], noise: [idx, ...]}
 */
export function dbscanCluster(grievances, eps = 0.35, minPts = 2) {
    const n = grievances.length;
    const labels = new Array(n).fill(-1); // -1 = unvisited
    const NOISE = 0;
    let clusterId = 1;
    
    console.log(`\n🔬 DBSCAN Clustering: ${n} grievances, eps=${eps}, minPts=${minPts}`);
    
    // Precompute similarity matrix for efficiency
    const similarityMatrix = computeSimilarityMatrix(grievances);
    
    for (let i = 0; i < n; i++) {
        if (labels[i] !== -1) continue; // Already processed
        
        // Find neighbors within eps distance
        const neighbors = regionQuery(similarityMatrix, i, eps, n);
        
        if (neighbors.length < minPts) {
            labels[i] = NOISE;
        } else {
            // Start a new cluster
            expandCluster(similarityMatrix, labels, i, neighbors, clusterId, eps, minPts, n);
            clusterId++;
        }
    }
    
    // Group results
    const clusters = {};
    const noise = [];
    
    for (let i = 0; i < n; i++) {
        if (labels[i] === NOISE) {
            noise.push(i);
        } else {
            if (!clusters[labels[i]]) {
                clusters[labels[i]] = [];
            }
            clusters[labels[i]].push(i);
        }
    }
    
    const clusterArrays = Object.values(clusters).filter(c => c.length >= minPts);
    
    console.log(`   📊 Found ${clusterArrays.length} clusters, ${noise.length} noise points`);
    clusterArrays.forEach((cluster, idx) => {
        console.log(`   Cluster ${idx + 1}: ${cluster.length} grievances`);
    });
    
    return {
        clusters: clusterArrays,
        noise,
        labels
    };
}

/**
 * Compute similarity matrix between all grievances
 */
function computeSimilarityMatrix(grievances) {
    const n = grievances.length;
    const matrix = [];
    
    for (let i = 0; i < n; i++) {
        matrix[i] = [];
        for (let j = 0; j < n; j++) {
            if (i === j) {
                matrix[i][j] = 1.0; // Same item = perfect similarity
            } else if (j < i) {
                matrix[i][j] = matrix[j][i]; // Symmetric
            } else {
                matrix[i][j] = cosineSimilarity(
                    grievances[i].embedding,
                    grievances[j].embedding
                );
            }
        }
    }
    
    return matrix;
}

/**
 * Find all points within eps distance of point p
 */
function regionQuery(matrix, p, eps, n) {
    const neighbors = [];
    
    for (let q = 0; q < n; q++) {
        // Convert similarity to distance: distance = 1 - similarity
        const distance = 1 - matrix[p][q];
        if (distance <= eps) {
            neighbors.push(q);
        }
    }
    
    return neighbors;
}

/**
 * Expand cluster from seed point
 */
function expandCluster(matrix, labels, p, neighbors, clusterId, eps, minPts, n) {
    labels[p] = clusterId;
    
    const queue = [...neighbors];
    
    while (queue.length > 0) {
        const q = queue.shift();
        
        if (labels[q] === 0) {
            // Was noise, now border point
            labels[q] = clusterId;
        }
        
        if (labels[q] !== -1) continue; // Already processed
        
        labels[q] = clusterId;
        
        const qNeighbors = regionQuery(matrix, q, eps, n);
        
        if (qNeighbors.length >= minPts) {
            // Add new neighbors to queue
            for (const neighbor of qNeighbors) {
                if (!queue.includes(neighbor)) {
                    queue.push(neighbor);
                }
            }
        }
    }
}

/**
 * Apply DBSCAN clustering to batch results
 * Marks items in same cluster as potential duplicates
 * 
 * @param {Array} grievances - Processed grievances with embeddings
 * @param {Object} thresholds - Adaptive thresholds
 * @returns {Array} - Grievances with cluster info
 */
export function applyDBSCANClustering(grievances, thresholds) {
    if (grievances.length < 2) {
        return grievances;
    }
    
    // eps = 1 - similarity_threshold
    // Lower eps = tighter clusters
    const eps = 1 - (thresholds.near_duplicate || 0.30);
    const minPts = 2;
    
    const { clusters, labels } = dbscanCluster(grievances, eps, minPts);
    
    // Mark grievances with cluster info
    grievances.forEach((g, idx) => {
        g.clusterId = labels[idx];
        g.clusterSize = labels[idx] > 0 
            ? labels.filter(l => l === labels[idx]).length 
            : 0;
    });
    
    // For each cluster, mark all items as at least NEAR_DUPLICATE
    // (first item is "primary", rest are duplicates of it)
    for (const cluster of clusters) {
        if (cluster.length >= 2) {
            // Sort by page number to get "original"
            cluster.sort((a, b) => 
                (grievances[a].pageNumber || 0) - (grievances[b].pageNumber || 0)
            );
            
            const primaryIdx = cluster[0];
            
            for (let i = 1; i < cluster.length; i++) {
                const dupIdx = cluster[i];
                const g = grievances[dupIdx];
                
                // If not already marked as duplicate, mark based on cluster
                if (g.finalStatus === 'UNIQUE') {
                    g.finalStatus = 'NEAR_DUPLICATE';
                    g.clusteredWith = primaryIdx;
                    g.clusterBasedMatch = true;
                    console.log(`   🔗 Cluster match: Grievance ${dupIdx + 1} linked to ${primaryIdx + 1}`);
                }
            }
        }
    }
    
    return grievances;
}

/**
 * Get cluster statistics
 */
export function getClusterStats(clusters, noise) {
    return {
        totalClusters: clusters.length,
        avgClusterSize: clusters.length > 0 
            ? clusters.reduce((sum, c) => sum + c.length, 0) / clusters.length 
            : 0,
        maxClusterSize: clusters.length > 0 
            ? Math.max(...clusters.map(c => c.length)) 
            : 0,
        noisePoints: noise.length,
        clusterSizes: clusters.map(c => c.length)
    };
}
