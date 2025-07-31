// src/pages/HomePage.jsx
import React, {useEffect, useState} from 'react';
import {Table, Typography} from 'antd';
import api from '../services/api';

const {Title} = Typography;

export default function HomePage() {
    const [models, setModels] = useState([]);

    useEffect(() => {
        api.get('/models').then(res => setModels(res.data));
    }, []);

    const columns = [
        {title: 'ID', dataIndex: 'id', key: 'id'},
        {title: 'Name', dataIndex: 'name', key: 'name'},
        {title: 'Version', dataIndex: 'version', key: 'version'},
        {title: 'Risk', dataIndex: 'risk_level', key: 'risk_level'},
    ];

    return (
        <div style={{padding: 24}}>
            <Title level={2}>Model Registry</Title>
            <Table dataSource={models} columns={columns} rowKey="id"/>
        </div>
    );
}
