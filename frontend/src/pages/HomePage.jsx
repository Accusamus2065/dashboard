// frontend/src/pages/HomePage.jsx
import React, {useEffect, useState, useMemo} from 'react';
import {Table, Typography, Button, Input, Space, Select, Popconfirm, message} from 'antd';
import {PlusOutlined, EyeOutlined, DeleteOutlined, PlayCircleOutlined} from '@ant-design/icons';
import {useNavigate} from 'react-router-dom';
import api from '../services/api';

const {Title} = Typography;
const {Option} = Select;
const {Search} = Input;

export default function HomePage() {
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(false);

    const [searchText, setSearchText] = useState('');
    const [descSearch, setDescSearch] = useState('');
    const [riskFilter, setRiskFilter] = useState(null);
    const [schemaFilter, setSchemaFilter] = useState(null);

    const [pageSize, setPageSize] = useState(10);

    const navigate = useNavigate();

    const loadModels = async () => {
        setLoading(true);
        try {
            const res = await api.get('/models');
            setModels(res.data);
        } catch (err) {
            message.error('Failed to load models');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadModels();
    }, []);

    const filteredData = useMemo(() => {
        return models
            .filter(m => {
                if (searchText && !m.name.toLowerCase().includes(searchText.toLowerCase())) {
                    return false;
                }
                if (descSearch && !m.description.toLowerCase().includes(descSearch.toLowerCase())) {
                    return false;
                }
                if (riskFilter && m.risk_level !== riskFilter) {
                    return false;
                }
                if (schemaFilter && m.input_schema !== schemaFilter) {
                    return false;
                }
                return true;
            })
            .map((m, idx) => ({...m, _number: idx + 1}));
    }, [models, searchText, descSearch, riskFilter, schemaFilter]);

    const columns = [
        {
            title: '#',
            dataIndex: '_number',
            key: 'number',
            width: 60,
        },
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            filterDropdown: () => (
                <Search
                    placeholder="Search name"
                    onSearch={val => setSearchText(val)}
                    allowClear
                    style={{width: 200, marginBottom: 8}}
                />
            ),
            filterIcon: () => <></>,
        },
        {
            title: 'Version',
            dataIndex: 'version',
            key: 'version',
            width: 100,
        },
        {
            title: 'Brief Description',
            dataIndex: 'description',
            key: 'description',
            filterDropdown: () => (
                <Search
                    placeholder="Search desc"
                    onSearch={val => setDescSearch(val)}
                    allowClear
                    style={{width: 200, marginBottom: 8}}
                />
            ),
            filterIcon: () => <></>,
        },
        {
            title: 'Input Schema',
            dataIndex: 'input_schema',
            key: 'input_schema',
            filters: Array.from(new Set(models.map(m => m.input_schema)))
                .filter(Boolean)
                .map(val => ({text: val, value: val})),
            onFilter: (value, record) => record.input_schema === value,
        },
        {
            title: 'Risk',
            dataIndex: 'risk_level',
            key: 'risk_level',
            filters: [
                {text: 'low', value: 'low'},
                {text: 'medium', value: 'medium'},
                {text: 'high', value: 'high'},
            ],
            onFilter: (value, record) => record.risk_level === value,
            width: 100,
        },
        {
            title: 'Artifact',
            dataIndex: 'artifact_uri',
            key: 'artifact_uri',
            render: uri => (
                <a href={`http://localhost:3000${uri}`} download>
                    Download
                </a>
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 180,
            render: (_text, record) => (
                <Space>
                    <Button
                        icon={<EyeOutlined/>}
                        onClick={() => navigate(`/view/${record.id}`)}
                    >
                        View
                    </Button>
                    <Button
                        icon={<PlayCircleOutlined/>}
                        onClick={() => navigate(`/predict/${record.id}`)}
                    >
                        Predict
                    </Button>
                    <Popconfirm
                        title="Confirm delete?"
                        onConfirm={async () => {
                            try {
                                await api.delete(`/models/${record.id}`);
                                message.success('Deleted');
                                loadModels();
                            } catch {
                                message.error('Delete failed');
                            }
                        }}
                    >
                        <Button icon={<DeleteOutlined/>} danger>
                            Delete
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div style={{padding: 24}}>
            <Title level={2}>Model Registry</Title>
            <Space style={{marginBottom: 16}}>
                <Button
                    type="primary"
                    icon={<PlusOutlined/>}
                    onClick={() => navigate('/upload')}
                >
                    Upload Model
                </Button>
                <Select
                    placeholder="Page Size"
                    value={pageSize}
                    onChange={val => setPageSize(val)}
                    options={[5, 10, 20, 50].map(n => ({label: `${n}`, value: n}))}
                />
            </Space>
            <Table
                dataSource={filteredData}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{pageSize}}
            />
        </div>
    );
}