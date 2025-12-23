// Admin Dashboard Component
// File: src/components/Admin/AdminDashboard.jsx

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('7days');
    
    useEffect(() => {
        fetchStats();
    }, [timeRange]);
    
    const fetchStats = async () => {
        setLoading(true);
        try {
            const response = await api.get('/stats/dashboard');
            setStats(response.stats);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    };
    
    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }
    
    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
                <p className="text-gray-600 mt-2">System overview and statistics</p>
            </div>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Total Grievances"
                    value={stats?.total || 0}
                    icon="📊"
                    color="bg-blue-500"
                />
                <StatCard
                    title="Unique"
                    value={stats?.byStatus?.find(s => s.duplicate_status === 'UNIQUE')?.count || 0}
                    icon="✨"
                    color="bg-green-500"
                    percentage={stats?.byStatus?.find(s => s.duplicate_status === 'UNIQUE')?.percentage}
                />
                <StatCard
                    title="Near Duplicates"
                    value={stats?.byStatus?.find(s => s.duplicate_status === 'NEAR_DUPLICATE')?.count || 0}
                    icon="⚠️"
                    color="bg-yellow-500"
                    percentage={stats?.byStatus?.find(s => s.duplicate_status === 'NEAR_DUPLICATE')?.percentage}
                />
                <StatCard
                    title="Duplicates"
                    value={stats?.byStatus?.find(s => s.duplicate_status === 'DUPLICATE')?.count || 0}
                    icon="🔄"
                    color="bg-red-500"
                    percentage={stats?.byStatus?.find(s => s.duplicate_status === 'DUPLICATE')?.percentage}
                />
            </div>
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Status Distribution */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">
                        Status Distribution
                    </h2>
                    <div className="space-y-4">
                        {stats?.byStatus?.map(item => (
                            <div key={item.duplicate_status}>
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-700">
                                        {item.duplicate_status.replace('_', ' ')}
                                    </span>
                                    <span className="text-sm font-medium text-gray-700">
                                        {item.percentage}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${getStatusColor(item.duplicate_status)}`}
                                        style={{ width: `${item.percentage}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Daily Submissions */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">
                        Daily Submissions (Last 7 Days)
                    </h2>
                    <div className="space-y-3">
                        {stats?.daily?.slice(0, 7).reverse().map(day => (
                            <div key={day.submission_date} className="flex items-center">
                                <span className="text-sm text-gray-600 w-32">
                                    {new Date(day.submission_date).toLocaleDateString()}
                                </span>
                                <div className="flex-1 bg-gray-200 rounded-full h-6 ml-4">
                                    <div
                                        className="bg-blue-500 h-6 rounded-full flex items-center justify-end pr-2"
                                        style={{ 
                                            width: `${Math.min((day.total_submissions / stats.total) * 100 * 10, 100)}%` 
                                        }}
                                    >
                                        <span className="text-xs text-white font-medium">
                                            {day.total_submissions}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Recent Grievances */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                    Recent Grievances
                </h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    User
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Grievance
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Date
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {stats?.recent?.map(grievance => (
                                <tr key={grievance.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        #{grievance.id}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {grievance.full_name}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                                        {grievance.grievance_text}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(grievance.duplicate_status)}`}>
                                            {grievance.duplicate_status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(grievance.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color, percentage }) {
    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600 mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-800">{value}</p>
                    {percentage && (
                        <p className="text-sm text-gray-500 mt-1">{percentage}%</p>
                    )}
                </div>
                <div className={`${color} text-white text-3xl p-4 rounded-full`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

function getStatusColor(status) {
    switch (status) {
        case 'DUPLICATE':
            return 'bg-red-500';
        case 'NEAR_DUPLICATE':
            return 'bg-yellow-500';
        case 'UNIQUE':
            return 'bg-green-500';
        default:
            return 'bg-gray-500';
    }
}

function getStatusBadgeColor(status) {
    switch (status) {
        case 'DUPLICATE':
            return 'bg-red-100 text-red-800';
        case 'NEAR_DUPLICATE':
            return 'bg-yellow-100 text-yellow-800';
        case 'UNIQUE':
            return 'bg-green-100 text-green-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

export default AdminDashboard;