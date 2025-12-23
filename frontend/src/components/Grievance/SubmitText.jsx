// Submit Text Grievance Component with Structured Input
// File: src/components/Grievance/SubmitText.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

// Category options for grievances
const CATEGORIES = [
    { value: 'WATER', label: 'Water Supply' },
    { value: 'GARBAGE', label: 'Garbage Collection' },
    { value: 'ROAD', label: 'Road / Pothole' },
    { value: 'ELECTRICITY', label: 'Electricity' },
    { value: 'SEWAGE', label: 'Sewage / Drainage' },
    { value: 'NOISE', label: 'Noise Pollution' },
    { value: 'PARK', label: 'Parks / Playground' },
    { value: 'OTHER', label: 'Other' }
];

function SubmitText() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        category: '',
        area: '',
        locationDetails: '',
        grievanceText: ''
    });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.category) {
            setError('Please select a category');
            return;
        }
        
        if (!formData.area.trim()) {
            setError('Please enter the area/location');
            return;
        }
        
        if (!formData.grievanceText.trim()) {
            setError('Please enter grievance description');
            return;
        }
        
        if (formData.grievanceText.split(' ').length < 5) {
            setError('Grievance must contain at least 5 words');
            return;
        }
        
        setLoading(true);
        setError(null);
        setResult(null);
        
        try {
            const response = await api.post('/grievances/submit-text', formData);
            
            setResult(response.grievance);
            setFormData({ category: '', area: '', locationDetails: '', grievanceText: '' });
            
            // Auto-navigate after 3 seconds
            setTimeout(() => {
                navigate('/grievances');
            }, 3000);
            
        } catch (err) {
            setError(err.message || 'Submission failed');
        } finally {
            setLoading(false);
        }
    };
    
    const getStatusBadge = (status) => {
        switch (status) {
            case 'DUPLICATE':
                return 'badge-duplicate';
            case 'NEAR_DUPLICATE':
                return 'badge-near';
            case 'UNIQUE':
                return 'badge-unique';
            default:
                return 'badge-unique';
        }
    };
    
    const getStatusMessage = (status) => {
        switch (status) {
            case 'DUPLICATE':
                return 'This grievance appears to be a duplicate of an existing submission.';
            case 'NEAR_DUPLICATE':
                return 'This grievance is similar to an existing submission.';
            case 'UNIQUE':
                return 'This is a unique grievance. Thank you for your submission!';
            default:
                return '';
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header Section */}
            <div className="header-section">
                <div className="content-section py-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Submit Grievance</h1>
                    <p className="text-gray-600">
                        Our AI-powered system will automatically detect if similar grievances have been submitted
                    </p>
                </div>
            </div>

            <div className="content-section py-8">
                <div className="max-w-3xl mx-auto">
                    <div className="card">
                        {error && (
                            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3">
                                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        )}
                        
                        {result && (
                            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg px-5 py-4">
                                <div className="flex items-start gap-3 mb-3">
                                    <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                            Submission Successful
                                        </h3>
                                        <span className={`${getStatusBadge(result.status)}`}>{result.status.replace('_', ' ')}</span>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-700 mb-4">{getStatusMessage(result.status)}</p>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                                        <p className="text-xs text-gray-600 mb-1">Similarity Score</p>
                                        <p className="text-xl font-semibold text-gray-900">{(result.similarityScore * 100).toFixed(2)}%</p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                                        <p className="text-xs text-gray-600 mb-1">Processing Time</p>
                                        <p className="text-xl font-semibold text-gray-900">{result.processingTimeMs}ms</p>
                                    </div>
                                </div>
                                {result.matchedGrievanceId && (
                                    <div className="bg-white rounded-lg p-3 border border-gray-200 mb-3">
                                        <p className="text-xs text-gray-600">Matched with Grievance ID: <span className="font-mono font-semibold text-gray-900">{result.matchedGrievanceId}</span></p>
                                    </div>
                                )}
                                <p className="text-sm text-gray-600 flex items-center gap-2">
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Redirecting to grievances list...
                                </p>
                            </div>
                        )}
                    
                    <form onSubmit={handleSubmit}>
                        {/* Category Selection */}
                        <div className="mb-5">
                            <label 
                                htmlFor="category" 
                                className="block text-sm font-semibold text-gray-900 mb-2"
                            >
                                Category *
                            </label>
                            <select
                                id="category"
                                name="category"
                                value={formData.category}
                                onChange={handleInputChange}
                                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all text-gray-900"
                                disabled={loading}
                            >
                                <option value="">Select a category</option>
                                {CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                        
                        {/* Area/Location Fields */}
                        <div className="grid md:grid-cols-2 gap-4 mb-5">
                            <div>
                                <label 
                                    htmlFor="area" 
                                    className="block text-sm font-semibold text-gray-900 mb-2"
                                >
                                    Area / Sector *
                                </label>
                                <input
                                    type="text"
                                    id="area"
                                    name="area"
                                    value={formData.area}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all text-gray-900 placeholder-gray-400"
                                    placeholder="e.g., Sector 15"
                                    disabled={loading}
                                />
                            </div>
                            <div>
                                <label 
                                    htmlFor="locationDetails" 
                                    className="block text-sm font-semibold text-gray-900 mb-2"
                                >
                                    Block / Building (Optional)
                                </label>
                                <input
                                    type="text"
                                    id="locationDetails"
                                    name="locationDetails"
                                    value={formData.locationDetails}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all text-gray-900 placeholder-gray-400"
                                    placeholder="e.g., Block C, Near Building 42"
                                    disabled={loading}
                                />
                            </div>
                        </div>
                        
                        {/* Grievance Description */}
                        <div className="mb-6">
                            <label 
                                htmlFor="grievanceText" 
                                className="block text-sm font-semibold text-gray-900 mb-2"
                            >
                                Grievance Description *
                            </label>
                            <textarea
                                id="grievanceText"
                                name="grievanceText"
                                rows="8"
                                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all text-gray-900 placeholder-gray-400"
                                placeholder="Describe your grievance in detail..."
                                value={formData.grievanceText}
                                onChange={handleInputChange}
                                disabled={loading}
                            />
                            <div className="mt-2 flex justify-between items-center text-xs text-gray-600">
                                <div className="flex gap-3">
                                    <span>{formData.grievanceText.length} characters</span>
                                    <span>•</span>
                                    <span>{formData.grievanceText.split(/\s+/).filter(w => w).length} words</span>
                                </div>
                                <span className={`font-medium ${formData.grievanceText.split(/\s+/).filter(w => w).length >= 5 ? 'text-green-600' : 'text-gray-400'}`}>
                                    {formData.grievanceText.split(/\s+/).filter(w => w).length >= 5 ? '✓ Ready' : 'Minimum 5 words required'}
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={loading || !formData.category || !formData.area.trim() || !formData.grievanceText.trim()}
                                className="flex-1 btn-primary py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Processing...
                                    </span>
                                ) : (
                                    'Submit Grievance'
                                )}
                            </button>
                            
                            <button
                                type="button"
                                onClick={() => navigate('/grievances')}
                                className="btn-secondary px-6 py-3 font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                    
                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">
                            Submission Guidelines
                        </h3>
                        <div className="grid md:grid-cols-2 gap-3">
                            <div className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                                <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-semibold">1</span>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">Be Clear & Detailed</p>
                                    <p className="text-xs text-gray-600 mt-0.5">Provide comprehensive information</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                                <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-semibold">2</span>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">Minimum 5 Words</p>
                                    <p className="text-xs text-gray-600 mt-0.5">Required for AI processing</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                                <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-semibold">3</span>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">Include Specifics</p>
                                    <p className="text-xs text-gray-600 mt-0.5">Dates, locations, and relevant details</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                                <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-semibold">4</span>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">Professional Language</p>
                                    <p className="text-xs text-gray-600 mt-0.5">Avoid abusive or inappropriate content</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SubmitText;