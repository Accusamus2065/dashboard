// frontend/src/contexts/AuthContext.jsx
import React, {createContext, useContext, useEffect, useState} from 'react';
import api from '../services/api';
import {message} from 'antd';

const AuthCtx = createContext(null);

export function AuthProvider({children}) {
    const [user, setUser] = useState(() => {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token && !user) {
            api.get('/auth/me').then(res => {
                setUser(res.data);
                localStorage.setItem('user', JSON.stringify(res.data));
            }).catch(() => {
                logout();
            });
        }
    }, []);

    const login = async (email, password) => {
        const res = await api.post('/auth/login', {email, password});
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
    };

    const register = async (email, password) => {
        await api.post('/auth/register', {email, password});
        message.success('Registered. Please login.');
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    const hasRole = (roles) => {
        if (!user) return false;
        const arr = Array.isArray(roles) ? roles : [roles];
        return arr.includes(user.role);
    };

    return (
        <AuthCtx.Provider value={{user, login, register, logout, hasRole}}>
            {children}
        </AuthCtx.Provider>
    );
}

export function useAuth() {
    return useContext(AuthCtx);
}
