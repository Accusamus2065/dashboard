// frontend/src/App.jsx
import React from 'react';
import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import ModelDetailPage from './pages/ModelDetailPage';
import EditPage from './pages/EditPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminUsersPage from './pages/AdminUsersPage';
import ForgotPasswordPage from "./pages/ForgotPasswordPage";

import {useAuth} from './contexts/AuthContext';

function RequireAuth({children, roles}) {
    const {user, hasRole} = useAuth();
    if (!user) return <Navigate to="/login" replace/>;
    if (roles && !hasRole(roles)) return <div style={{padding: 24}}>403 Forbidden</div>;
    return children;
}

export default function App() {
    return (<BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage/>}/>
                <Route path="/register" element={<RegisterPage/>}/>
                <Route path="/forgot" element={<ForgotPasswordPage/>} />

                <Route path="/" element={<RequireAuth><HomePage/></RequireAuth>}/>
                <Route path="/upload" element={<RequireAuth roles={['uploader', 'admin']}><UploadPage/></RequireAuth>}/>
                <Route path="/view/:id" element={<RequireAuth><ModelDetailPage/></RequireAuth>}/>
                <Route path="/edit/:id" element={<RequireAuth roles={['uploader', 'admin']}><EditPage/></RequireAuth>}/>

                {/* Admin only */}
                <Route path="/admin/users" element={<RequireAuth roles={['admin']}><AdminUsersPage/></RequireAuth>}/>

                <Route path="*" element={<Navigate to="/login" replace/>}/>
            </Routes>
        </BrowserRouter>);
}
