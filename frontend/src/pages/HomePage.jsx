// frontend/src/pages/HomePage.jsx
import React, {useEffect, useState} from 'react';
import {Table, Typography, Button} from 'antd';
import {PlusOutlined} from '@ant-design/icons';
import {useNavigate} from 'react-router-dom';
import api from '../services/api';

const {Title} = Typography;

export default function HomePage() {
    const [models, setModels] = useState([]);
    const navigate = useNavigate();

    // 改名为 loadModels，避免与全局 fetch 冲突
    const loadModels = async () => {
        try {
            const res = await api.get('/models');
            setModels(res.data);
        } catch (err) {
            console.error('Failed to load models', err);
        }
    };

    // 这里 useEffect 不返回任何东西
    useEffect(() => {
        loadModels();
    }, []);

    const columns = [
        {title: 'ID', dataIndex: 'id', key: 'id'},
        {title: 'Name', dataIndex: 'name', key: 'name'},
        {title: 'Version', dataIndex: 'version', key: 'version'},
        {title: 'Risk', dataIndex: 'risk_level', key: 'risk_level'},
        {
            title: 'Artifact',
            key: 'artifact_uri',
            render: (_, record) => (
                <a
                    href={`http://localhost:3000${record.artifact_uri}`}
                    target="_blank"
                    rel="noreferrer"
                >
                    Download
                </a>
            ),
        },
    ];

    return (
        <div style={{padding: 24}}>
            <Title level={2}>Model Registry</Title>
            <Button
                type="primary"
                icon={<PlusOutlined/>}
                style={{marginBottom: 16}}
                onClick={() => navigate('/upload')}
            >
                Upload Model
            </Button>
            <Table dataSource={models} columns={columns} rowKey="id"/>
        </div>
    );
}
