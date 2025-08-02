// frontend/src/App.jsx
import React from 'react';
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HomePage/>}/>
                <Route path="/upload" element={<UploadPage/>}/>
            </Routes>
        </BrowserRouter>
    );
}
