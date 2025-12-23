// Password Hashing Module using Web Crypto API
// File: src/auth/password.js

/**
 * Hash password using PBKDF2
 * Secure alternative to bcrypt for Cloudflare Workers
 * 
 * @param {string} password - Plain text password
 * @param {number} iterations - Number of iterations (default 100000)
 * @returns {Promise<string>} Hashed password with salt
 */
export async function hashPassword(password, iterations = 100000) {
    // Generate random salt
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    // Hash password
    const hash = await pbkdf2(password, salt, iterations);
    
    // Combine: iterations$salt$hash (all base64 encoded)
    const saltB64 = arrayBufferToBase64(salt);
    const hashB64 = arrayBufferToBase64(hash);
    
    return `${iterations}$${saltB64}$${hashB64}`;
}

/**
 * Verify password against hash
 * 
 * @param {string} password - Plain text password
 * @param {string} storedHash - Stored hash from database
 * @returns {Promise<boolean>} True if password matches
 */
export async function verifyPassword(password, storedHash) {
    try {
        // Parse stored hash
        const parts = storedHash.split('$');
        
        if (parts.length !== 3) {
            return false;
        }
        
        const iterations = parseInt(parts[0]);
        const salt = base64ToArrayBuffer(parts[1]);
        const storedHashBuffer = base64ToArrayBuffer(parts[2]);
        
        // Hash input password with same salt
        const computedHash = await pbkdf2(password, salt, iterations);
        
        // Compare hashes (timing-safe)
        return timingSafeEqual(
            new Uint8Array(computedHash),
            new Uint8Array(storedHashBuffer)
        );
        
    } catch (error) {
        console.error('Password verification error:', error);
        return false;
    }
}

/**
 * PBKDF2 key derivation
 * 
 * @param {string} password - Password
 * @param {Uint8Array} salt - Salt
 * @param {number} iterations - Iterations
 * @returns {Promise<ArrayBuffer>} Derived key
 */
async function pbkdf2(password, salt, iterations) {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    // Import password as key
    const key = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    
    // Derive bits
    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: iterations,
            hash: 'SHA-256'
        },
        key,
        256 // 256 bits = 32 bytes
    );
    
    return derivedBits;
}

/**
 * Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Timing-safe equality comparison
 * Prevents timing attacks
 */
function timingSafeEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a[i] ^ b[i];
    }
    
    return result === 0;
}

/**
 * Generate random password
 * Useful for temporary passwords
 */
export function generateRandomPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const randomValues = crypto.getRandomValues(new Uint8Array(length));
    
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset[randomValues[i] % charset.length];
    }
    
    return password;
}

/**
 * Check password strength
 */
export function checkPasswordStrength(password) {
    const checks = {
        length: password.length >= 8,
        hasLower: /[a-z]/.test(password),
        hasUpper: /[A-Z]/.test(password),
        hasNumber: /\d/.test(password),
        hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    
    const score = Object.values(checks).filter(Boolean).length;
    
    let strength = 'weak';
    if (score >= 4) strength = 'strong';
    else if (score >= 3) strength = 'medium';
    
    return {
        strength,
        score,
        checks,
        isValid: checks.length && score >= 3
    };
}