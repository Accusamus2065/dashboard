// frontend/src/App.jsx
import React from 'react';
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import ModelDetailPage from "./pages/ModelDetailPage";
import EditPage from "./pages/EditPage";

export default function App() {
    return (<BrowserRouter>
        <Routes>
            <Route path="/" element={<HomePage/>}/>
            <Route path="/upload" element={<UploadPage/>}/>
            <Route path="/view/:id" element={<ModelDetailPage/>}/>
            <Route path="/edit/:id" element={<EditPage/>}/>
        </Routes>
    </BrowserRouter>);
}
