// React Frontend - Main App Component
// File: src/App.jsx

import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Lazy load components for code splitting
const LandingPage = lazy(() => import('./components/LandingPage/LandingPage'));
const Login = lazy(() => import('./components/Auth/Login'));
const Register = lazy(() => import('./components/Auth/Register'));
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'));
const SubmitText = lazy(() => import('./components/Grievance/SubmitText'));
const SubmitPDF = lazy(() => import('./components/Grievance/SubmitPDF'));
const SubmitBatchPDF = lazy(() => import('./components/Grievance/SubmitBatchPDF'));
const GrievanceList = lazy(() => import('./components/Grievance/GrievanceList'));
const AdminDashboard = lazy(() => import('./components/Admin/AdminDashboard'));
const ClusterVisualization = lazy(() => import('./components/Admin/ClusterVisualization'));
const Navbar = lazy(() => import('./components/Layout/Navbar'));

// Loading component
const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-screen" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" aria-label="Loading"></div>
        <span className="sr-only">Loading application...</span>
    </div>
);

function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="min-h-screen bg-gray-50">
                    <AppContent />
                </div>
            </Router>
        </AuthProvider>
    );
}

function AppContent() {
    const { user, loading } = useAuth();
    
    if (loading) {
        return <LoadingSpinner />;
    }
    
    return (
        <>
            {user && (
                <Suspense fallback={<div className="h-16 bg-gray-800" />}>
                    <Navbar />
                </Suspense>
            )}
            
            <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                    <Route path="/login" element={
                        user ? <Navigate to="/dashboard" replace /> : <Login />
                    } />
                    
                    <Route path="/register" element={
                        user ? <Navigate to="/dashboard" replace /> : <Register />
                    } />
                
                <Route path="/dashboard" element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                } />
                
                <Route path="/submit-text" element={
                    <ProtectedRoute>
                        <SubmitText />
                    </ProtectedRoute>
                } />
                
                <Route path="/submit-pdf" element={
                    <ProtectedRoute>
                        <SubmitPDF />
                    </ProtectedRoute>
                } />
                
                <Route path="/submit-batch" element={
                    <ProtectedRoute>
                        <SubmitBatchPDF />
                    </ProtectedRoute>
                } />
                
                <Route path="/grievances" element={
                    <ProtectedRoute>
                        <GrievanceList />
                    </ProtectedRoute>
                } />
                
                <Route path="/admin" element={
                    <ProtectedRoute requireAdmin>
                        <AdminDashboard />
                    </ProtectedRoute>
                } />
                
                <Route path="/admin/clusters" element={
                    <ProtectedRoute requireAdmin>
                        <ClusterVisualization />
                    </ProtectedRoute>
                } />
                
                {/* Landing page at root - redirect to dashboard if logged in */}
                <Route path="/" element={
                    user ? <Navigate to="/dashboard" replace /> : <LandingPage />
                } />
            </Routes>
            </Suspense>
        </>
    );
}

function ProtectedRoute({ children, requireAdmin = false }) {
    const { user, loading } = useAuth();
    
    if (loading) {
        return <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>;
    }
    
    if (!user) {
        return <Navigate to="/login" />;
    }
    
    if (requireAdmin && user.role !== 'admin') {
        return <Navigate to="/dashboard" />;
    }
    
    return children;
}

export default App;
