import React from 'react';
import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';

import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import ModelDetailPage from './pages/ModelDetailPage';
import EditPage from './pages/EditPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';

import {useAuth} from './contexts/AuthContext';
import AdminUsersPage from "./pages/AdminUsersPage.jsx";

function RequireAuth({children, roles}) {
    const {user, hasRole} = useAuth();

    if (!user) return <Navigate to="/login" replace/>;

    if (roles && !hasRole(roles)) return <Navigate to="/403" replace/>;

    return children;
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Auth */}
                <Route path="/login" element={<LoginPage/>}/>
                <Route path="/register" element={<RegisterPage/>}/>
                <Route path="/forgot" element={<ForgotPasswordPage/>}/>

                {/* Main */}
                <Route path="/" element={
                    <RequireAuth>
                        <HomePage/>
                    </RequireAuth>
                }/>

                <Route path="/view/:id" element={
                    <RequireAuth>
                        <ModelDetailPage/>
                    </RequireAuth>
                }/>

                <Route path="/upload" element={
                    <RequireAuth roles={['uploader', 'admin']}>
                        <UploadPage/>
                    </RequireAuth>
                }/>

                <Route path="/edit/:id" element={
                    <RequireAuth roles={['uploader', 'admin', 'auditor']}>
                        <EditPage/>
                    </RequireAuth>
                }/>

                <Route path="/admin/users" element={
                    <RequireAuth roles={['admin']}>
                        <AdminUsersPage/>
                    </RequireAuth>
                }/>

                <Route path="*" element={<Navigate to="/login" replace/>}/>
            </Routes>
        </BrowserRouter>
    );
}