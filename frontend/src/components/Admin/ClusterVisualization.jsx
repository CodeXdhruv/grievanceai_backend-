// Duplicate Cluster Visualization Component
// File: src/components/Admin/ClusterVisualization.jsx

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

function ClusterVisualization() {
    const [clusters, setClusters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCluster, setSelectedCluster] = useState(null);
    const [batchFilter, setBatchFilter] = useState('');
    const [batches, setBatches] = useState([]);

    useEffect(() => {
        fetchClusters();
        fetchBatches();
    }, [batchFilter]);

    const fetchClusters = async () => {
        try {
            setLoading(true);
            const params = batchFilter ? `?batchId=${batchFilter}` : '';
            const response = await api.get(`/clusters${params}`);
            setClusters(response.clusters || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchBatches = async () => {
        try {
            const response = await api.get('/batches?limit=20');
            setBatches(response.batches || []);
        } catch (err) {
            console.error('Failed to fetch batches:', err);
        }
    };

    const getStatusColor = (type) => {
        switch (type) {
            case 'DUPLICATE': return 'bg-red-100 text-red-800 border-red-200';
            case 'NEAR_DUPLICATE': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'CONTEXTUAL': return 'bg-purple-100 text-purple-800 border-purple-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusIcon = (type) => {
        switch (type) {
            case 'DUPLICATE':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                );
            case 'NEAR_DUPLICATE':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                );
            default:
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                );
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Duplicate Clusters</h2>
                    <p className="text-gray-600 text-sm mt-1">
                        View and manage groups of similar grievances
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <select
                        value={batchFilter}
                        onChange={(e) => setBatchFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Batches</option>
                        {batches.map(batch => (
                            <option key={batch.id} value={batch.id}>
                                Batch #{batch.id} - {new Date(batch.created_at).toLocaleDateString()}
                            </option>
                        ))}
                    </select>
                    
                    <button
                        onClick={fetchClusters}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {clusters.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                    <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">No Clusters Found</h3>
                    <p className="text-gray-600 text-sm">
                        Duplicate clusters will appear here after batch processing
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {clusters.map(cluster => (
                        <div
                            key={cluster.id}
                            className={`bg-white rounded-lg border-2 transition-all cursor-pointer ${
                                selectedCluster?.id === cluster.id 
                                    ? 'border-blue-500 shadow-lg' 
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => setSelectedCluster(
                                selectedCluster?.id === cluster.id ? null : cluster
                            )}
                        >
                            <div className="p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${getStatusColor(cluster.cluster_type)}`}>
                                            {getStatusIcon(cluster.cluster_type)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(cluster.cluster_type)}`}>
                                                    {cluster.cluster_type}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {cluster.member_count} member{cluster.member_count !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-900 mt-1 line-clamp-2">
                                                {cluster.primary_text?.substring(0, 150)}...
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-gray-900">
                                            {(cluster.avg_similarity_score * 100).toFixed(1)}%
                                        </div>
                                        <div className="text-xs text-gray-500">avg similarity</div>
                                    </div>
                                </div>
                                
                                {cluster.source_pdf_name && (
                                    <div className="mt-2 text-xs text-gray-500">
                                        Source: {cluster.source_pdf_name}
                                    </div>
                                )}
                            </div>
                            
                            {/* Expanded Members View */}
                            {selectedCluster?.id === cluster.id && cluster.members && (
                                <div className="border-t border-gray-200 bg-gray-50 p-4">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">
                                        Cluster Members
                                    </h4>
                                    <div className="space-y-3">
                                        {cluster.members.map((member, idx) => (
                                            <div 
                                                key={member.id || idx}
                                                className="bg-white p-3 rounded-lg border border-gray-200"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                            #{member.grievance_id}
                                                        </span>
                                                        {member.source_pdf_name && (
                                                            <span className="text-xs text-gray-500">
                                                                {member.source_pdf_name}
                                                                {member.page_number && ` (p.${member.page_number})`}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                                                        member.similarity_to_primary >= 0.85 
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                        {(member.similarity_to_primary * 100).toFixed(1)}%
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-700 line-clamp-2">
                                                    {member.grievance_text?.substring(0, 200)}...
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            
            {/* Stats Summary */}
            {clusters.length > 0 && (
                <div className="mt-6 grid grid-cols-3 gap-4">
                    <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200">
                        <div className="text-2xl font-bold text-red-600">
                            {clusters.filter(c => c.cluster_type === 'DUPLICATE').length}
                        </div>
                        <div className="text-sm text-red-700">Duplicate Clusters</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 text-center border border-yellow-200">
                        <div className="text-2xl font-bold text-yellow-600">
                            {clusters.filter(c => c.cluster_type === 'NEAR_DUPLICATE').length}
                        </div>
                        <div className="text-sm text-yellow-700">Near-Duplicate Clusters</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
                        <div className="text-2xl font-bold text-blue-600">
                            {clusters.reduce((sum, c) => sum + c.member_count, 0)}
                        </div>
                        <div className="text-sm text-blue-700">Total Members</div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ClusterVisualization;
