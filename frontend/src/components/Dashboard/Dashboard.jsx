import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

function Dashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        total: 0,
        unique: 0,
        nearDuplicate: 0,
        duplicate: 0
    });
    const [areas, setAreas] = useState([]);
    const [recentGrievances, setRecentGrievances] = useState([]);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const data = await api.get('/grievances');
            const grievances = data.grievances || [];
            
            setStats({
                total: grievances.length,
                unique: grievances.filter(g => g.duplicate_status === 'UNIQUE').length,
                nearDuplicate: grievances.filter(g => g.duplicate_status === 'NEAR_DUPLICATE').length,
                duplicate: grievances.filter(g => g.duplicate_status === 'DUPLICATE').length
            });
            
            // Get unique areas with counts
            const areaMap = {};
            grievances.forEach(g => {
                const area = g.area || 'Unspecified';
                if (!areaMap[area]) areaMap[area] = { count: 0, duplicates: 0 };
                areaMap[area].count++;
                if (g.duplicate_status !== 'UNIQUE') areaMap[area].duplicates++;
            });
            
            const areaList = Object.entries(areaMap)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
            setAreas(areaList);
            
            // Get recent grievances
            setRecentGrievances(grievances.slice(0, 3));
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const cards = [
        {
            title: 'Submit Text Grievance',
            description: 'Enter grievance text directly',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            ),
            link: '/submit-text'
        },
        {
            title: 'Upload PDF Documents',
            description: 'Batch upload PDFs for processing',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
            ),
            link: '/submit-batch'
        },
        {
            title: 'View All Grievances',
            description: 'Browse and manage submissions',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
            link: '/grievances'
        }
    ];

    if (user?.role === 'admin') {
        cards.push({
            title: 'Admin Dashboard',
            description: 'System administration',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
            link: '/admin'
        });
    }

    const totalDuplicates = (stats.duplicate || 0) + (stats.nearDuplicate || 0);
    const efficiencyRate = stats.total > 0 ? Math.round((totalDuplicates / stats.total) * 100) : 0;

    const statCards = [
        { label: 'Total Grievances', value: stats.total, color: 'blue' },
        { label: 'Unique', value: stats.unique, color: 'green' },
        { label: 'Duplicates Found', value: totalDuplicates, color: 'orange' }
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header Section */}
            <div className="bg-white border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-6 py-8">
                    <h1 className="text-3xl font-semibold text-gray-900 mb-2">
                        Welcome back, {user?.name}
                    </h1>
                    <p className="text-gray-500 text-lg">
                        AI-powered grievance duplicate detection system
                    </p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    {statCards.map((stat, index) => (
                        <div key={index} className="bg-white rounded-xl border border-gray-100 p-5 text-center shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">{stat.label}</div>
                            <div className={`text-3xl font-bold ${
                                stat.color === 'green' ? 'text-green-600' :
                                stat.color === 'orange' ? 'text-orange-600' : 'text-blue-600'
                            }`}>{stat.value}</div>
                        </div>
                    ))}
                    {/* Detection Efficiency */}
                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-center shadow-sm">
                        <div className="text-sm text-blue-100 mb-1">Detection Rate</div>
                        <div className="text-3xl font-bold text-white">{efficiencyRate}%</div>
                        <div className="text-xs text-blue-200 mt-1">duplicates identified</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Action Cards */}
                    <div className="lg:col-span-2">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {cards.map((card, index) => (
                                <Link
                                    key={index}
                                    to={card.link}
                                    className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all group"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-700 flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                                            {card.icon}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-medium text-gray-900 mb-1">{card.title}</h3>
                                            <p className="text-sm text-gray-500">{card.description}</p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Areas Overview */}
                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-gray-900">Top Areas</h2>
                            <Link to="/grievances" className="text-sm text-blue-600 hover:text-blue-700">View All</Link>
                        </div>
                        {areas.length > 0 ? (
                            <div className="space-y-3">
                                {areas.map((area, idx) => (
                                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            <span className="text-sm text-gray-700 truncate max-w-[120px]">{area.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-900">{area.count}</span>
                                            {area.duplicates > 0 && (
                                                <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                                                    {area.duplicates} dup
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-4">No areas yet</p>
                        )}
                    </div>
                </div>

                {/* How It Works + Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* How It Works */}
                    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                        <h2 className="font-semibold text-gray-900 mb-4">How It Works</h2>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">1</div>
                                <div>
                                    <h4 className="font-medium text-gray-900 text-sm">Upload Grievances</h4>
                                    <p className="text-sm text-gray-500">Submit text or PDF documents containing grievances</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">2</div>
                                <div>
                                    <h4 className="font-medium text-gray-900 text-sm">AI Processing</h4>
                                    <p className="text-sm text-gray-500">NLP extracts text and generates semantic embeddings</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">3</div>
                                <div>
                                    <h4 className="font-medium text-gray-900 text-sm">Duplicate Detection</h4>
                                    <p className="text-sm text-gray-500">DBSCAN clustering identifies similar grievances</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-900 text-sm">Results</h4>
                                    <p className="text-sm text-gray-500">View unique vs duplicate grievances organized by area</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-gray-900">Recent Activity</h2>
                            <Link to="/grievances" className="text-sm text-blue-600 hover:text-blue-700">View All</Link>
                        </div>
                        {recentGrievances.length > 0 ? (
                            <div className="space-y-3">
                                {recentGrievances.map((g, idx) => (
                                    <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                                g.duplicate_status === 'UNIQUE' 
                                                    ? 'bg-green-100 text-green-700' 
                                                    : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                {g.duplicate_status === 'UNIQUE' ? 'UNIQUE' : 'DUPLICATE'}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {new Date(g.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-700 line-clamp-2">
                                            {g.original_text?.substring(0, 100)}...
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <p className="text-sm text-gray-500">No grievances yet</p>
                                <Link to="/submit-batch" className="text-sm text-blue-600 hover:text-blue-700 mt-1 inline-block">
                                    Upload your first PDF →
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
