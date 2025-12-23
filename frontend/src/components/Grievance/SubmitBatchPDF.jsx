// Submit Multiple PDFs Component with Parallel OCR
// File: src/components/Grievance/SubmitBatchPDF.jsx

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import api from '../../utils/api';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

function SubmitBatchPDF() {
    const navigate = useNavigate();
    const [area, setArea] = useState('');  // Area for all PDFs in batch
    const [files, setFiles] = useState([]);
    const [fileProgress, setFileProgress] = useState({});
    const [processing, setProcessing] = useState(false);
    const [overallProgress, setOverallProgress] = useState(0);
    const [stage, setStage] = useState('');
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [batchId, setBatchId] = useState(null);
    const [areaWarning, setAreaWarning] = useState({ show: false, count: 0 });
    
    // Check if area already has grievances
    const checkAreaExists = async () => {
        if (!area.trim()) return false;
        
        try {
            const response = await api.get(`/areas/${encodeURIComponent(area.trim())}/exists`);
            if (response.exists) {
                setAreaWarning({ show: true, count: response.count });
                return true;
            }
            return false;
        } catch (err) {
            console.error('Error checking area:', err);
            return false;
        }
    };
    
    const handleFilesChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        
        if (selectedFiles.length === 0) return;
        
        // Validate new files
        const validNewFiles = [];
        const errors = [];
        
        // Get existing file names to avoid duplicates
        const existingNames = new Set(files.map(f => f.name));
        
        for (const file of selectedFiles) {
            if (existingNames.has(file.name)) {
                errors.push(`${file.name}: Already added`);
                continue;
            }
            if (file.type !== 'application/pdf') {
                errors.push(`${file.name}: Not a PDF file`);
                continue;
            }
            if (file.size > 10 * 1024 * 1024) {
                errors.push(`${file.name}: Exceeds 10MB limit`);
                continue;
            }
            validNewFiles.push(file);
        }
        
        // Combine existing + new files
        const allFiles = [...files, ...validNewFiles];
        
        if (allFiles.length > 10) {
            setError('Maximum 10 PDFs allowed per batch');
            return;
        }
        
        if (errors.length > 0) {
            setError(errors.join(', '));
        } else {
            setError(null);
        }
        
        setFiles(allFiles);
        
        // Update progress for new files only (keep existing progress)
        setFileProgress(prev => {
            const newProgress = { ...prev };
            validNewFiles.forEach(f => {
                newProgress[f.name] = { status: 'pending', percent: 0, grievances: [] };
            });
            return newProgress;
        });
        
        // Reset file input to allow selecting same file again
        e.target.value = '';
    };
    
    const extractTextFromPDF = async (pdfFile, onProgress) => {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const worker = await createWorker('eng');
        
        let fullText = '';
        const numPages = pdf.numPages;
        const pageGrievances = [];
        
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            onProgress(Math.round((pageNum / numPages) * 80), `Page ${pageNum}/${numPages}`);
            
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            const imageData = canvas.toDataURL('image/png');
            const { data: { text } } = await worker.recognize(imageData);
            
            fullText += text + '\n\n';
            
            // Track page content for grievance mapping
            if (text.trim().length > 20) {
                pageGrievances.push({
                    pageNumber: pageNum,
                    text: text.trim()
                });
            }
        }
        
        await worker.terminate();
        
        return { fullText: fullText.trim(), pageGrievances };
    };
    
    const splitIntoGrievances = (text, pageGrievances) => {
        // Try numbered patterns first
        let parts = text.split(/(?:\r?\n|^)\s*(?:\d+[.\)]|\[\d+\])\s+/);
        
        if (parts.length > 1) {
            return parts.filter(p => p.trim().length > 20).map((text, i) => ({
                text: text.trim(),
                pageNumber: findPageForText(text, pageGrievances)
            }));
        }
        
        // Split by double newlines
        parts = text.split(/\n\s*\n/);
        
        if (parts.length > 1) {
            return parts.filter(p => p.trim().length > 20).map((text, i) => ({
                text: text.trim(),
                pageNumber: findPageForText(text, pageGrievances)
            }));
        }
        
        // Return based on pages
        return pageGrievances.filter(pg => pg.text.length > 20);
    };
    
    const findPageForText = (text, pageGrievances) => {
        const snippet = text.substring(0, 50);
        for (const pg of pageGrievances) {
            if (pg.text.includes(snippet)) {
                return pg.pageNumber;
            }
        }
        return 1;
    };
    
    const handleSubmit = async () => {
        if (files.length === 0) {
            setError('Please select at least one PDF file');
            return;
        }
        
        // Check if area already has grievances
        if (area.trim()) {
            const exists = await checkAreaExists();
            if (exists) {
                return; // Modal will be shown
            }
        }
        
        // Proceed with processing
        await processFiles();
    };
    
    const processFiles = async () => {
        setProcessing(true);
        setError(null);
        setOverallProgress(0);
        setAreaWarning({ show: false, count: 0 });
        setStage('Starting parallel processing...');
        
        try {
            // PARALLEL OCR PROCESSING
            const extractionPromises = files.map(async (file, index) => {
                const updateProgress = (percent, stage) => {
                    setFileProgress(prev => ({
                        ...prev,
                        [file.name]: { ...prev[file.name], status: 'processing', percent, stage }
                    }));
                };
                
                updateProgress(5, 'Loading PDF');
                
                const { fullText, pageGrievances } = await extractTextFromPDF(file, updateProgress);
                
                updateProgress(85, 'Splitting grievances');
                
                const grievances = splitIntoGrievances(fullText, pageGrievances);
                
                updateProgress(100, 'Complete');
                
                setFileProgress(prev => ({
                    ...prev,
                    [file.name]: { 
                        ...prev[file.name], 
                        status: 'extracted', 
                        percent: 100,
                        grievances,
                        extractedText: fullText
                    }
                }));
                
                return { file, grievances, extractedText: fullText };
            });
            
            setStage('Extracting text from all PDFs in parallel...');
            
            // Wait for all extractions to complete
            const extractedData = await Promise.all(extractionPromises);
            
            setOverallProgress(50);
            setStage('Uploading to server for batch processing...');
            
            // Create FormData with all PDFs and extracted grievances
            const formData = new FormData();
            
            // Add area for entire batch
            formData.append('area', area);
            
            for (const { file, grievances } of extractedData) {
                formData.append('pdfs', file);
                formData.append(`grievances_${file.name}`, JSON.stringify(grievances));
            }
            
            // Submit batch
            const response = await api.post('/grievances/submit-batch', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            setOverallProgress(75);
            setBatchId(response.batchId);
            setStage('Batch submitted! Processing duplicates...');
            
            // Poll for completion
            await pollBatchStatus(response.batchId);
            
        } catch (err) {
            console.error('Batch processing error:', err);
            setError(err.message || 'Failed to process PDFs');
        } finally {
            setProcessing(false);
        }
    };
    
    const pollBatchStatus = async (id) => {
        const maxAttempts = 60; // 5 minutes max
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            try {
                const status = await api.get(`/batches/${id}/status`);
                
                if (status.status === 'completed') {
                    setOverallProgress(100);
                    setStage('Batch processing complete!');
                    
                    // Fetch full results
                    const results = await api.get(`/batches/${id}/results`);
                    setResults(results);
                    return;
                } else if (status.status === 'failed') {
                    throw new Error(status.errorMessage || 'Batch processing failed');
                }
                
                setOverallProgress(75 + (status.progress.percentComplete * 0.25));
                setStage(`Processing: ${status.progress.processedPdfs}/${status.progress.totalPdfs} PDFs`);
                
            } catch (err) {
                console.error('Status poll error:', err);
            }
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
        }
        
        throw new Error('Batch processing timed out');
    };
    
    const removeFile = (fileName) => {
        setFiles(files.filter(f => f.name !== fileName));
        setFileProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileName];
            return newProgress;
        });
    };
    
    const totalGrievances = Object.values(fileProgress)
        .reduce((sum, fp) => sum + (fp.grievances?.length || 0), 0);
    
    return (
        <div className="min-h-screen bg-white">
            {/* Area Already Exists Warning Modal */}
            {areaWarning.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Area Already Exists</h3>
                        </div>
                        <p className="text-gray-600 mb-4">
                            The area <strong>"{area}"</strong> already has <strong>{areaWarning.count}</strong> grievance(s). 
                        </p>
                        <p className="text-gray-600 mb-6">
                            Would you like to <strong>append</strong> new grievances or <strong>go to grievances page</strong> to delete existing ones first?
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    setAreaWarning({ show: false, count: 0 });
                                    processFiles();
                                }}
                                className="w-full px-4 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium"
                            >
                                Append to Existing ({areaWarning.count} + new)
                            </button>
                            <button
                                onClick={() => {
                                    setAreaWarning({ show: false, count: 0 });
                                    navigate('/grievances');
                                }}
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                Go to Grievances Page to Delete
                            </button>
                            <button
                                onClick={() => setAreaWarning({ show: false, count: 0 })}
                                className="w-full px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Header */}
            <div className="border-b border-gray-100">
                <div className="max-w-5xl mx-auto px-6 py-8">
                    <h1 className="text-3xl font-semibold text-gray-900 mb-2">Upload PDF Documents</h1>
                    <p className="text-gray-500 text-lg">
                        Upload multiple PDFs with AI-powered duplicate detection
                    </p>
                </div>
            </div>

            <div className="content-section py-8">
                <div className="max-w-4xl mx-auto">
                    <div className="card">
                        
                        {error && (
                            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        )}
                        
                        {/* Area Input - Required for all PDFs in batch */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Area / Location *
                            </label>
                            <input
                                type="text"
                                value={area}
                                onChange={(e) => setArea(e.target.value)}
                                placeholder="e.g., Sector 15, Ward 5, Old City Zone"
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-50 focus:border-blue-300 transition-all text-gray-900 placeholder-gray-400"
                                disabled={processing}
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                This area will apply to all grievances in the uploaded PDFs. Category is auto-detected.
                            </p>
                        </div>
                        
                        {/* Multi-file Upload */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Select PDF Files (up to 10)
                            </label>
                            <div className="relative border-2 border-dashed border-gray-200 rounded-lg p-8 text-center bg-white hover:border-blue-300 transition-colors">
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    multiple
                                    onChange={handleFilesChange}
                                    disabled={processing}
                                    className="hidden"
                                    id="pdf-batch-upload"
                                />
                                <label htmlFor="pdf-batch-upload" className="cursor-pointer block">
                                    <div className="w-12 h-12 mx-auto mb-4 bg-gray-900 rounded-lg flex items-center justify-center">
                                        <svg className="h-6 w-6 text-white" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    </div>
                                    <p className="text-base font-medium text-gray-900">
                                        {files.length > 0 ? `${files.length} file(s) selected` : 'Click to upload PDFs'}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">
                                        Maximum 10MB per file, 10 files per batch
                                    </p>
                                </label>
                            </div>
                        </div>
                        
                        {/* File List with Progress */}
                        {files.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                                    Selected Files ({files.length})
                                </h3>
                                <div className="space-y-2">
                                    {files.map(file => (
                                        <div key={file.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
                                                    </svg>
                                                    <span className="text-sm font-medium text-gray-900">{file.name}</span>
                                                    <span className="text-xs text-gray-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                                </div>
                                                
                                                {fileProgress[file.name]?.status === 'processing' && (
                                                    <div className="mt-2">
                                                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                                                            <span>{fileProgress[file.name].stage}</span>
                                                            <span>{fileProgress[file.name].percent}%</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                            <div 
                                                                className="bg-blue-600 h-1.5 rounded-full transition-all"
                                                                style={{ width: `${fileProgress[file.name].percent}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {fileProgress[file.name]?.status === 'extracted' && (
                                                    <div className="mt-1 text-xs text-green-600">
                                                        ✓ {fileProgress[file.name].grievances?.length || 0} grievances extracted
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {!processing && (
                                                <button
                                                    onClick={() => removeFile(file.name)}
                                                    className="ml-3 text-gray-400 hover:text-red-600"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* Overall Progress */}
                        {processing && (
                            <div className="mb-6 bg-blue-50 rounded-lg p-5 border border-blue-200">
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium text-blue-900 flex items-center gap-2">
                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                        </svg>
                                        {stage}
                                    </span>
                                    <span className="text-sm font-semibold text-blue-900">{overallProgress.toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-blue-200 rounded-full h-2">
                                    <div 
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                        style={{ width: `${overallProgress}%` }}
                                    />
                                </div>
                                {totalGrievances > 0 && (
                                    <p className="text-xs text-blue-700 mt-2">
                                        Total grievances extracted: {totalGrievances}
                                    </p>
                                )}
                            </div>
                        )}
                        
                        {/* Results Summary */}
                        {results && (
                            <div className="mb-6 bg-green-50 rounded-lg p-5 border border-green-200">
                                <h3 className="text-lg font-semibold text-green-900 mb-3">
                                    ✓ Batch Processing Complete
                                </h3>
                                <div className="grid grid-cols-4 gap-4 text-center">
                                    <div className="bg-white p-3 rounded-lg">
                                        <div className="text-2xl font-bold text-gray-900">{results.stats.total}</div>
                                        <div className="text-xs text-gray-600">Total</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg">
                                        <div className="text-2xl font-bold text-green-600">{results.stats.unique}</div>
                                        <div className="text-xs text-gray-600">Unique</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg">
                                        <div className="text-2xl font-bold text-red-600">{results.stats.duplicate}</div>
                                        <div className="text-xs text-gray-600">Duplicate</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg">
                                        <div className="text-2xl font-bold text-yellow-600">{results.stats.nearDuplicate}</div>
                                        <div className="text-xs text-gray-600">Near-Dup</div>
                                    </div>
                                </div>
                                <div className="mt-4 flex gap-3">
                                    <button
                                        onClick={() => navigate(`/batches/${batchId}`)}
                                        className="btn-primary flex-1"
                                    >
                                        View Detailed Results
                                    </button>
                                    <button
                                        onClick={() => navigate('/grievances')}
                                        className="btn-secondary flex-1"
                                    >
                                        View All Grievances
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* Submit Button */}
                        {!results && (
                            <div className="flex gap-3">
                                <button
                                    onClick={handleSubmit}
                                    disabled={processing || files.length === 0}
                                    className="flex-1 btn-primary py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {processing ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Processing...
                                        </span>
                                    ) : (
                                        `Process ${files.length} PDF${files.length !== 1 ? 's' : ''}`
                                    )}
                                </button>
                                
                                <button
                                    onClick={() => navigate('/grievances')}
                                    disabled={processing}
                                    className="btn-secondary px-6 py-3 font-medium disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                        
                        {/* Info Section */}
                        <div className="mt-8 pt-6 border-t border-gray-200">
                            <h3 className="text-base font-semibold text-gray-900 mb-4">
                                Batch Processing Features
                            </h3>
                            <div className="grid md:grid-cols-2 gap-3">
                                <div className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                                    <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">Parallel Processing</p>
                                        <p className="text-xs text-gray-600 mt-0.5">All PDFs processed simultaneously</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                                    <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center flex-shrink-0">
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">Cross-PDF Detection</p>
                                        <p className="text-xs text-gray-600 mt-0.5">Find duplicates across all documents</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                                    <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center flex-shrink-0">
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">AI-Powered Similarity</p>
                                        <p className="text-xs text-gray-600 mt-0.5">Semantic + contextual analysis</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                                    <div className="w-6 h-6 bg-orange-600 rounded flex items-center justify-center flex-shrink-0">
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">Cluster Visualization</p>
                                        <p className="text-xs text-gray-600 mt-0.5">Group related grievances together</p>
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

export default SubmitBatchPDF;
