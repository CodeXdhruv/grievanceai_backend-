// API Utility
// File: src/utils/api.js

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class API {
    constructor() {
        this.baseURL = API_BASE_URL;
        this.token = null;
    }
    
    setAuthToken(token) {
        this.token = token;
    }
    
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        // Get token from localStorage if not already set
        const token = this.token || localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const config = {
            ...options,
            headers
        };
        
        try {
            const response = await fetch(url, config);
            
            // Handle OPTIONS preflight requests (no body expected)
            if (options.method === 'OPTIONS') {
                return null;
            }
            
            // Check content-type header
            const contentType = response.headers.get('content-type');
            
            // Get response text
            const responseText = await response.text();
            
            // Handle empty responses
            if (!responseText || responseText.trim() === '') {
                if (response.ok) {
                    return null;
                }
                throw new Error('Server returned empty response');
            }
            
            // Try to parse JSON
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError);
                console.error('Response Text:', responseText);
                throw new Error('Server returned invalid JSON response');
            }
            
            // Handle error responses
            if (!response.ok) {
                // Handle 401 Unauthorized - clear stale tokens and redirect to login
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    // Redirect to login if not already there
                    if (window.location.pathname !== '/login' && window.location.pathname !== '/register' && window.location.pathname !== '/') {
                        window.location.href = '/login';
                    }
                }
                throw new Error(data.error || `Request failed with status ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error.message);
            throw error;
        }
    }
    
    async get(endpoint, params = {}) {
        const query = new URLSearchParams(params).toString();
        const url = query ? `${endpoint}?${query}` : endpoint;
        
        return this.request(url, {
            method: 'GET'
        });
    }
    
    async post(endpoint, data, options = {}) {
        // Check if data is FormData (for file uploads)
        if (data instanceof FormData) {
            const url = `${this.baseURL}${endpoint}`;
            
            const headers = {};
            // Get token from localStorage if not already set
            const token = this.token || localStorage.getItem('token');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            // Don't set Content-Type for FormData - browser will set it with boundary
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: data
            });
            
            const responseText = await response.text();
            
            if (!responseText || responseText.trim() === '') {
                if (response.ok) return null;
                throw new Error('Server returned empty response');
            }
            
            const result = JSON.parse(responseText);
            
            if (!response.ok) {
                // Handle 401 Unauthorized
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    if (window.location.pathname !== '/login' && window.location.pathname !== '/register' && window.location.pathname !== '/') {
                        window.location.href = '/login';
                    }
                }
                throw new Error(result.error || `Request failed with status ${response.status}`);
            }
            
            return result;
        }
        
        // Regular JSON post
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
    
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
    
    async uploadFile(endpoint, file, onProgress) {
        const formData = new FormData();
        formData.append('pdf', file);
        
        const url = `${this.baseURL}${endpoint}`;
        
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            if (onProgress) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        onProgress(percentComplete);
                    }
                });
            }
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(new Error('Upload failed'));
                }
            });
            
            xhr.addEventListener('error', () => reject(new Error('Upload failed')));
            
            xhr.open('POST', url);
            
            // Get token from localStorage if not already set
            const token = this.token || localStorage.getItem('token');
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            
            xhr.send(formData);
        });
    }
}

const api = new API();

export default api;