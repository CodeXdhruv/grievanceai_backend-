// Landing Page - Professional Minimal Design
// File: src/components/LandingPage/LandingPage.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function LandingPage() {
    const { user } = useAuth();

    const features = [
        {
            title: 'Duplicate Detection',
            desc: 'AI identifies similar grievances even when worded differently using semantic analysis.',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            )
        },
        {
            title: 'Auto Classification',
            desc: 'Automatically categorize into Water, Road, Electricity, Garbage and more.',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
            )
        },
        {
            title: 'Batch Processing',
            desc: 'Upload multiple PDFs at once with parallel OCR and cross-document matching.',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            )
        },
        {
            title: 'Area Filtering',
            desc: 'Filter by geographic location to find duplicates within same locality.',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            )
        },
        {
            title: 'Cluster Analysis',
            desc: 'Group related issues together to identify widespread problems quickly.',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            )
        },
        {
            title: 'Analytics Dashboard',
            desc: 'Comprehensive reporting and insights for administrators.',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            )
        }
    ];

    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className="border-b border-gray-100">
                <div className="max-w-5xl mx-auto px-6 py-5">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="text-lg tracking-tight text-gray-900">
                            <span className="font-semibold">Grievance</span>
                            <span className="text-blue-700 font-semibold">AI</span>
                        </Link>
                        <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
                            <a href="#features" className="hover:text-gray-900">Features</a>
                            <a href="#how-it-works" className="hover:text-gray-900">How it works</a>
                            <a href="#about" className="hover:text-gray-900">About</a>
                        </div>
                        {user ? (
                            <Link to="/dashboard" className="text-sm font-medium text-blue-700 hover:text-blue-700">
                                Dashboard →
                            </Link>
                        ) : (
                            <div className="flex items-center gap-4">
                                <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">
                                    Sign in
                                </Link>
                                <Link to="/register" className="text-sm font-medium px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                    Get started
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm mb-6">
                            <span className="w-1.5 h-1.5 bg-blue-700 rounded-full"></span>
                            AI-Powered Solution
                        </div>

                        <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 leading-tight tracking-tight mb-6">
                            Intelligent grievance management for government
                        </h1>

                        <p className="text-lg text-gray-600 leading-relaxed mb-8">
                            Streamline public complaint processing with AI-powered duplicate detection.
                            Reduce manual work, improve response times, and serve citizens better.
                        </p>

                        <div className="flex flex-wrap gap-4">
                            <Link
                                to={user ? "/dashboard" : "/register"}
                                className="px-6 py-3 bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                {user ? 'Go to Dashboard' : 'Start for free'}
                            </Link>
                            <a
                                href="#how-it-works"
                                className="px-6 py-3 border border-gray-200 text-gray-700 font-medium rounded-lg hover:border-gray-300 transition-colors"
                            >
                                Learn more
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 px-6 bg-gray-50">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-4">
                            Everything you need to manage grievances
                        </h2>
                        <p className="text-gray-600 max-w-xl mx-auto">
                            A comprehensive solution built specifically for government agencies handling citizen complaints.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feature, i) => (
                            <div key={i} className="bg-white p-6 rounded-xl border border-gray-100">
                                <div className="w-10 h-10 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center mb-4">
                                    {feature.icon}
                                </div>
                                <h3 className="font-medium text-gray-900 mb-2">{feature.title}</h3>
                                <p className="text-sm text-gray-600 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-4">
                            How it works
                        </h2>
                        <p className="text-gray-600">
                            Simple three-step process to modernize your grievance workflow.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { step: '01', title: 'Submit', desc: 'Enter text directly or upload PDFs with area and category metadata.' },
                            { step: '02', title: 'Process', desc: 'AI classifies, embeds, and compares against existing grievances.' },
                            { step: '03', title: 'Analyze', desc: 'View status, similarity scores, clusters, and actionable insights.' }
                        ].map((item, i) => (
                            <div key={i} className="text-center">
                                <div className="w-12 h-12 mx-auto bg-blue-700 text-white rounded-full flex items-center justify-center text-sm font-semibold mb-4">
                                    {item.step}
                                </div>
                                <h3 className="font-medium text-gray-900 mb-2">{item.title}</h3>
                                <p className="text-sm text-gray-600">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* About Section */}
            <section id="about" className="py-20 px-6 bg-gray-50">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-4">
                        Built for government excellence
                    </h2>
                    <p className="text-gray-600 leading-relaxed mb-6">
                        GrievanceAI uses advanced natural language processing to understand
                        the semantic meaning of complaints. Unlike keyword-based systems,
                        our AI detects duplicates even when citizens describe the same issue
                        using completely different words.
                    </p>
                    <p className="text-gray-600 leading-relaxed">
                        Deployed on enterprise-grade cloud infrastructure with JWT authentication,
                        role-based access control, and secure data handling to meet government
                        compliance requirements.
                    </p>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-6">
                <div className="max-w-5xl mx-auto text-center">
                    <h2 className="text-2xl font-semibold text-gray-900 tracking-tight mb-4">
                        Ready to modernize your grievance system?
                    </h2>
                    <p className="text-gray-600 mb-8">
                        Join government agencies using AI to improve citizen services.
                    </p>
                    <Link
                        to={user ? "/dashboard" : "/register"}
                        className="inline-flex px-8 py-3 bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        {user ? 'Go to Dashboard' : 'Get started free'}
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 border-t border-gray-100">
                <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-gray-500">
                    <span>© 2025 GrievanceAI</span>
                </div>
            </footer>
        </div>
    );
}

export default LandingPage;
