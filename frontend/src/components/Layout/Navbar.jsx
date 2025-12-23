import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function Navbar() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
            <div className="max-w-5xl mx-auto px-6">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link to="/dashboard" className="text-xl tracking-tight">
                        <span className="font-semibold text-gray-900">Grievance</span>
                        <span className="font-semibold text-blue-700">AI</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-6">
                        <Link
                            to="/dashboard"
                            className={`transition-colors ${
                                isActive('/dashboard')
                                    ? 'text-blue-700 font-medium'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Dashboard
                        </Link>
                        <Link
                            to="/grievances"
                            className={`transition-colors ${
                                isActive('/grievances')
                                    ? 'text-blue-700 font-medium'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Grievances
                        </Link>

                        {user?.role === 'admin' && (
                            <Link
                                to="/admin"
                                className={`transition-colors ${
                                    isActive('/admin')
                                        ? 'text-blue-700 font-medium'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Admin
                            </Link>
                        )}
                    </div>

                    {/* User Menu */}
                    <div className="flex items-center gap-4">
                        <span className="hidden md:block text-gray-600">{user?.name}</span>
                        <button
                            onClick={logout}
                            className="hidden md:block px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                        >
                            Logout
                        </button>

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden p-2 rounded-lg hover:bg-gray-50"
                        >
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="md:hidden border-t border-gray-100 bg-white">
                    <div className="px-6 py-4 space-y-1">
                        <Link to="/dashboard" className="block py-2 text-gray-700 text-sm" onClick={() => setMobileMenuOpen(false)}>
                            Dashboard
                        </Link>
                        <Link to="/grievances" className="block py-2 text-gray-700 text-sm" onClick={() => setMobileMenuOpen(false)}>
                            Grievances
                        </Link>

                        {user?.role === 'admin' && (
                            <Link to="/admin" className="block py-2 text-gray-700 text-sm" onClick={() => setMobileMenuOpen(false)}>
                                Admin
                            </Link>
                        )}
                        <button
                            onClick={() => { logout(); setMobileMenuOpen(false); }}
                            className="block w-full text-left py-2 text-gray-700 text-sm"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            )}
        </nav>
    );
}

export default Navbar;
