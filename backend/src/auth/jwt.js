// JWT Authentication Module for Cloudflare Workers
// File: src/auth/jwt.js

/**
 * Generate JWT token
 * Uses Web Crypto API available in Cloudflare Workers
 * 
 * @param {Object} payload - Token payload
 * @param {string} secret - JWT secret
 * @param {number} expiresIn - Expiration in seconds (default 24h)
 * @returns {Promise<string>} JWT token
 */
export async function generateJWT(payload, secret, expiresIn = 86400) {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };
    
    const now = Math.floor(Date.now() / 1000);
    
    const jwtPayload = {
        ...payload,
        iat: now,
        exp: now + expiresIn
    };
    
    // Encode header and payload
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
    
    // Create signature
    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = await createHmacSignature(data, secret);
    
    return `${data}.${signature}`;
}

/**
 * Verify JWT token
 * 
 * @param {string} token - JWT token to verify
 * @param {string} secret - JWT secret
 * @returns {Promise<Object>} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
export async function verifyJWT(token, secret) {
    const parts = token.split('.');
    
    if (parts.length !== 3) {
        throw new Error('Invalid token format');
    }
    
    const [encodedHeader, encodedPayload, signature] = parts;
    
    // Verify signature
    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = await createHmacSignature(data, secret);
    
    if (signature !== expectedSignature) {
        throw new Error('Invalid signature');
    }
    
    // Decode payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp && payload.exp < now) {
        throw new Error('Token expired');
    }
    
    return payload;
}

/**
 * Create HMAC-SHA256 signature
 * 
 * @param {string} data - Data to sign
 * @param {string} secret - Secret key
 * @returns {Promise<string>} Base64URL encoded signature
 */
async function createHmacSignature(data, secret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(data);
    
    // Import key
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    // Sign
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        messageData
    );
    
    return base64UrlEncode(signature);
}

/**
 * Base64URL encode
 */
function base64UrlEncode(data) {
    let base64;
    
    if (typeof data === 'string') {
        base64 = btoa(data);
    } else {
        // ArrayBuffer
        const bytes = new Uint8Array(data);
        const binary = String.fromCharCode(...bytes);
        base64 = btoa(binary);
    }
    
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str) {
    let base64 = str
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    
    // Add padding
    while (base64.length % 4) {
        base64 += '=';
    }
    
    return atob(base64);
}

/**
 * Extract token from Authorization header
 */
export function extractToken(request) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    return authHeader.substring(7);
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(request, env) {
    const token = extractToken(request);
    
    if (!token) {
        throw new Error('No token provided');
    }
    
    try {
        const payload = await verifyJWT(token, env.JWT_SECRET);
        return payload;
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

/**
 * Middleware to require admin role
 */
export async function requireAdmin(request, env) {
    const payload = await requireAuth(request, env);
    
    if (payload.role !== 'admin') {
        throw new Error('Admin access required');
    }
    
    return payload;
}

/**
 * Refresh token (generate new token from existing valid token)
 */
export async function refreshToken(token, secret) {
    try {
        const payload = await verifyJWT(token, secret);
        
        // Remove old timestamps
        delete payload.iat;
        delete payload.exp;
        
        // Generate new token
        return await generateJWT(payload, secret);
        
    } catch (error) {
        throw new Error('Cannot refresh invalid token');
    }
}