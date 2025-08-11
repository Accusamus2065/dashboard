// frontend/src/main.jsx
import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {AuthProvider} from './contexts/AuthContext';
import {ConfigProvider, theme} from 'antd';
import 'antd/dist/reset.css';

function Root() {
    const getSystemDark = () =>
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches;

    const [isDarkMode, setIsDarkMode] = useState(getSystemDark);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const listener = (e) => setIsDarkMode(e.matches);
        mq.addEventListener('change', listener);
        return () => mq.removeEventListener('change', listener);
    }, []);

    return (
        <ConfigProvider
            theme={{
                algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
                token: {
                    colorPrimary: '#6366f1',
                    colorLink: '#6366f1',
                    colorInfo: '#6366f1',
                    borderRadius: 12,
                    fontFamily:
                        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'",
                    colorBgLayout: isDarkMode ? '#0b1220' : '#f6f8fc',
                },
                components: {
                    Button: {controlHeight: 44, borderRadius: 12, fontWeight: 600},
                    Card: {borderRadiusLG: 20},
                    Input: {borderRadius: 10},
                    Typography: {titleMarginBottom: 8},
                },
            }}
        >
            <AuthProvider>
                <App/>
            </AuthProvider>
        </ConfigProvider>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Root/>
    </React.StrictMode>
);
