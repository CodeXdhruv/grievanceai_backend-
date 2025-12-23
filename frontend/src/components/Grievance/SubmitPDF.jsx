// Submit PDF Component with Tesseract.js OCR
// File: src/components/Grievance/SubmitPDF.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import api from '../../utils/api';

// Set PDF.js worker - using node_modules path instead of CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

function SubmitPDF() {
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [stage, setStage] = useState('');
    const [extractedText, setExtractedText] = useState('');
    const [grievances, setGrievances] = useState([]);
    const [error, setError] = useState(null);
    
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        
        if (!selectedFile) return;
        
        if (selectedFile.type !== 'application/pdf') {
            setError('Please select a PDF file');
            return;
        }
        
        if (selectedFile.size > 10 * 1024 * 1024) {
            setError('File size must be less than 10MB');
            return;
        }
        
        setFile(selectedFile);
        setError(null);
        setExtractedText('');
        setGrievances([]);
    };
    
    const extractTextFromPDF = async (pdfFile) => {
        setStage('Loading PDF...');
        setProgress(10);
        
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        setStage('Extracting text from pages...');
        
        const worker = await createWorker('eng');
        
        let fullText = '';
        const numPages = pdf.numPages;
        
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            setStage(`Processing page ${pageNum} of ${numPages}...`);
            setProgress(10 + (pageNum / numPages) * 60);
            
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });
            
            // Create canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            // Render PDF page to canvas
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            // Get image data for OCR
            const imageData = canvas.toDataURL('image/png');
            
            // Perform OCR
            const { data: { text } } = await worker.recognize(imageData);
            
            fullText += text + '\n\n';
        }
        
        await worker.terminate();
        
        return fullText.trim();
    };
    
    const splitIntoGrievances = (text) => {
        // Split by numbered patterns
        let parts = text.split(/(?:\r?\n|^)\s*(?:\d+[\.\)]|\[\d+\])\s+/);
        
        if (parts.length > 1) {
            return parts.filter(p => p.trim().length > 20);
        }
        
        // Split by double newlines
        parts = text.split(/\n\s*\n/);
        
        if (parts.length > 1) {
            return parts.filter(p => p.trim().length > 20);
        }
        
        // Return as single grievance
        return [text];
    };
    
    const handleSubmit = async () => {
        if (!file) {
            setError('Please select a PDF file');
            return;
        }
        
        setLoading(true);
        setError(null);
        setProgress(0);
        
        try {
            // Extract text using OCR
            const text = await extractTextFromPDF(file);
            setExtractedText(text);
            
            setStage('Splitting into grievances...');
            setProgress(75);
            
            // Split into individual grievances
            const grievanceList = splitIntoGrievances(text);
            setGrievances(grievanceList);
            
            setStage('Uploading PDF to cloud storage...');
            setProgress(80);
            
            // Create FormData with PDF and extracted data
            const formData = new FormData();
            formData.append('pdf', file);
            formData.append('extractedText', text);
            formData.append('grievances', JSON.stringify(grievanceList));
            
            // Submit PDF with grievances
            const response = await api.post('/grievances/submit-pdf', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            setProgress(100);
            setStage('Complete!');
            
            // Show results  
            const message = `✅ PDF Upload Successful!\n\n` +
                           `📄 File: ${file.name}\n` +
                           `📊 Grievances Processed: ${response.grievancesProcessed}\n` +
                           `☁️ Stored in Cloud: ${response.r2_key}`;
            alert(message);
            
            // Navigate to grievances list
            setTimeout(() => {
                navigate('/grievances');
            }, 2000);
            
        } catch (err) {
            console.error('PDF processing error:', err);
            setError(err.message || 'Failed to process PDF');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header Section */}
            <div className="header-section">
                <div className="content-section py-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Submit PDF Grievances</h1>
                    <p className="text-gray-600">
                        Upload a PDF and our AI-powered OCR will extract text and process each grievance automatically
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
                    
                    {/* File Upload */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Select PDF File *
                        </label>
                        <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-white hover:border-gray-900 transition-colors">
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={handleFileChange}
                                disabled={loading}
                                className="hidden"
                                id="pdf-upload"
                            />
                            <label htmlFor="pdf-upload" className="cursor-pointer block">
                                <div className="w-12 h-12 mx-auto mb-4 bg-gray-900 rounded-lg flex items-center justify-center">
                                    <svg className="h-6 w-6 text-white" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                {file ? (
                                    <div className="space-y-1">
                                        <p className="text-base font-semibold text-gray-900 flex items-center justify-center gap-2">
                                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-gray-600">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <p className="text-base font-medium text-gray-900">
                                            Click to upload PDF
                                        </p>
                                        <p className="text-xs text-gray-600">
                                            Maximum file size: 10MB
                                        </p>
                                    </div>
                                )}
                            </label>
                        </div>
                    </div>
                    
                    {/* Progress Bar */}
                    {loading && (
                        <div className="mb-6 bg-gray-50 rounded-lg p-5 border border-gray-200">
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                    <svg className="animate-spin w-4 h-4 text-gray-900" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {stage}
                                </span>
                                <span className="text-sm font-semibold text-gray-900">{progress.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div 
                                    className="bg-gray-900 h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}
                    
                    {/* Extracted Text Preview */}
                    {extractedText && !loading && (
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-3">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h3 className="text-base font-semibold text-gray-900">
                                    Extracted Text <span className="text-green-600">({grievances.length} found)</span>
                                </h3>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                                <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">
                                    {extractedText.substring(0, 1000)}
                                    {extractedText.length > 1000 && '...'}
                                </pre>
                            </div>
                        </div>
                    )}
                    
                    {/* Submit Button */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !file}
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
                                'Process and Submit PDF'
                            )}
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => navigate('/grievances')}
                            disabled={loading}
                            className="btn-secondary px-6 py-3 font-medium disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">
                            PDF Requirements
                        </h3>
                        <div className="grid md:grid-cols-2 gap-3">
                            <div className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                                <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-semibold">1</span>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">PDF Files Only</p>
                                    <p className="text-xs text-gray-600 mt-0.5">Maximum 10MB file size</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                                <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-semibold">2</span>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">Clear Text</p>
                                    <p className="text-xs text-gray-600 mt-0.5">Legible for best OCR results</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                                <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-semibold">3</span>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">Proper Formatting</p>
                                    <p className="text-xs text-gray-600 mt-0.5">Number or separate grievances</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                                <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-semibold">4</span>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">Good Quality</p>
                                    <p className="text-xs text-gray-600 mt-0.5">Avoid poor quality scans</p>
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

export default SubmitPDF;