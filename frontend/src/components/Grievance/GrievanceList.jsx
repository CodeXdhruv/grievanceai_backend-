import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

function GrievanceList() {
    const navigate = useNavigate();
    const [grievances, setGrievances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all');
    const [expandedAreas, setExpandedAreas] = useState({});


    useEffect(() => {
        fetchGrievances();
    }, []);

    const fetchGrievances = async () => {
        try {
            setLoading(true);
            const data = await api.get('/grievances');
            setGrievances(data.grievances || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Filter grievances
    const filteredGrievances = filter === 'all'
        ? grievances
        : filter === 'DUPLICATE'
            ? grievances.filter(g => g.duplicate_status === 'DUPLICATE' || g.duplicate_status === 'NEAR_DUPLICATE')
            : grievances.filter(g => g.duplicate_status === filter);

    // Group grievances by area
    const groupedByArea = filteredGrievances.reduce((acc, grievance) => {
        const area = grievance.area || 'Unspecified Area';
        if (!acc[area]) {
            acc[area] = [];
        }
        acc[area].push(grievance);
        return acc;
    }, {});

    // Sort areas alphabetically
    const sortedAreas = Object.keys(groupedByArea).sort((a, b) => {
        if (a === 'Unspecified Area') return 1;
        if (b === 'Unspecified Area') return -1;
        return a.localeCompare(b);
    });

    const toggleArea = (area) => {
        setExpandedAreas(prev => ({
            ...prev,
            [area]: !prev[area]
        }));
    };

    const expandAllAreas = () => {
        const allExpanded = {};
        sortedAreas.forEach(area => allExpanded[area] = true);
        setExpandedAreas(allExpanded);
    };

    const collapseAllAreas = () => {
        setExpandedAreas({});
    };



    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-white">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-700 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">

            {/* Header Section */}
            <div className="border-b border-gray-100">
                <div className="max-w-5xl mx-auto px-6 py-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-semibold text-gray-900 mb-2">Your Grievances</h1>
                            <p className="text-gray-500 text-lg">
                                {grievances.length} grievance{grievances.length !== 1 ? 's' : ''} across {sortedAreas.length} area{sortedAreas.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/submit-text')}
                            className="btn-primary flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            Submit New
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-8">
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Filter Tabs */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-2">
                        {[
                            { key: 'all', label: 'All', count: grievances.length },
                            { key: 'UNIQUE', label: 'Unique', count: grievances.filter(g => g.duplicate_status === 'UNIQUE').length },
                            { key: 'DUPLICATE', label: 'Duplicate', count: grievances.filter(g => g.duplicate_status === 'DUPLICATE' || g.duplicate_status === 'NEAR_DUPLICATE').length }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setFilter(tab.key)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === tab.key
                                    ? 'bg-blue-700 text-white'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {tab.label}
                                <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${filter === tab.key ? 'bg-white/20' : 'bg-gray-200'}`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex gap-2">
                        <button onClick={expandAllAreas} className="text-sm text-blue-700 hover:text-blue-800">
                            Expand All
                        </button>
                        <span className="text-gray-300">|</span>
                        <button onClick={collapseAllAreas} className="text-sm text-blue-700 hover:text-blue-800">
                            Collapse All
                        </button>
                    </div>
                </div>

                {/* Grouped Grievances by Area */}
                {filteredGrievances.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-100 text-center py-12 px-6">
                        <div className="w-12 h-12 mx-auto bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="font-medium text-gray-900 mb-2">No Grievances Found</h3>
                        <p className="text-gray-500 text-sm mb-6">
                            {filter === 'all'
                                ? "You haven't submitted any grievances yet."
                                : `No ${filter.toLowerCase().replace('_', ' ')} grievances found.`
                            }
                        </p>
                        <button onClick={() => navigate('/submit-text')} className="btn-primary">
                            Submit Your First Grievance
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {sortedAreas.map((area) => {
                            const areaGrievances = groupedByArea[area];
                            const isExpanded = expandedAreas[area];
                            const uniqueCount = areaGrievances.filter(g => g.duplicate_status === 'UNIQUE').length;
                            const duplicateCount = areaGrievances.filter(g => g.duplicate_status === 'DUPLICATE' || g.duplicate_status === 'NEAR_DUPLICATE').length;

                            return (
                                <div key={area} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    {/* Area Header */}
                                    <div className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                        <button
                                            onClick={() => toggleArea(area)}
                                            className="flex-1 flex items-center gap-3 text-left"
                                        >
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{area}</h3>
                                                <p className="text-sm text-gray-500">
                                                    {areaGrievances.length} grievance{areaGrievances.length !== 1 ? 's' : ''}
                                                    <span className="mx-2">•</span>
                                                    <span className="text-green-600">{uniqueCount} unique</span>
                                                    {duplicateCount > 0 && (
                                                        <span className="text-orange-600 ml-2">{duplicateCount} duplicate</span>
                                                    )}
                                                </p>
                                            </div>
                                        </button>
                                        
                                        <div className="flex items-center gap-2">
                                            <svg
                                                className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Expandable Grievances List */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-100 divide-y divide-gray-50">
                                            {areaGrievances.map((grievance) => (
                                                <div key={grievance.id} className="px-5 py-4 hover:bg-gray-50">
                                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                                        <span className={`badge-${grievance.duplicate_status === 'UNIQUE' ? 'unique' : 'duplicate'}`}>
                                                            {grievance.duplicate_status === 'UNIQUE' ? 'UNIQUE' : 'DUPLICATE'}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(grievance.created_at).toLocaleDateString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric'
                                                            })}
                                                        </span>
                                                        {grievance.category && (
                                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                                                {grievance.category.replace('_', ' ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-gray-700 text-sm leading-relaxed">
                                                        {grievance.original_text.length > 250
                                                            ? `${grievance.original_text.substring(0, 250)}...`
                                                            : grievance.original_text
                                                        }
                                                    </p>
                                                    {grievance.similarity_score > 0 && (
                                                        <div className="mt-2 flex items-center gap-4 text-sm">
                                                            <span className="text-gray-500">
                                                                Similarity: <span className="font-medium text-gray-700">{(grievance.similarity_score * 100).toFixed(1)}%</span>
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default GrievanceList;
