// frontend/src/pages/HomePage.jsx
import React, {useEffect, useState, useMemo} from 'react';
import {
    Table, Typography, Button, Input, Space, Select, Popconfirm, message
} from 'antd';
import {
    PlusOutlined, EyeOutlined, DeleteOutlined, PlayCircleOutlined
} from '@ant-design/icons';
import {useNavigate} from 'react-router-dom';
import api from '../services/api';

const {Title} = Typography;
const {Search} = Input;
const {Option} = Select;

export default function HomePage() {
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(false);

    // 过滤／搜索状态
    const [nameSearch, setNameSearch] = useState('');
    const [descSearch, setDescSearch] = useState('');
    const [riskFilter, setRiskFilter] = useState('');
    const [schemaFilter, setSchemaFilter] = useState('');

    // 分页
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

    // 筛选、搜索后数据，并生成“序号”
    const filteredData = useMemo(() => {
        return models
            .filter(m => {
                if (nameSearch && !m.name.toLowerCase().includes(nameSearch.toLowerCase())) return false;
                if (descSearch && !m.description?.toLowerCase().includes(descSearch.toLowerCase())) return false;
                if (riskFilter && m.risk_level !== riskFilter) return false;
                if (schemaFilter && m.input_schema !== schemaFilter) return false;
                return true;
            })
            .map((m, idx) => ({...m, _number: idx + 1}));
    }, [models, nameSearch, descSearch, riskFilter, schemaFilter]);

    // 动态生成 input_schema 下拉项
    const schemaOptions = Array.from(new Set(models.map(m => m.input_schema).filter(Boolean)));

    const columns = [{title: '#', dataIndex: '_number', key: 'number', width: 60}, {
        title: 'Name',
        dataIndex: 'name',
        key: 'name'
    }, {title: 'Version', dataIndex: 'version', key: 'version', width: 100}, {
        title: 'Brief Description',
        dataIndex: 'description',
        key: 'description'
    }, {title: 'Input Schema', dataIndex: 'input_schema', key: 'input_schema'}, {
        title: 'Risk', dataIndex: 'risk_level', key: 'risk_level', width: 100
    }, {
        title: 'Artifact',
        dataIndex: 'artifact_uri',
        key: 'artifact_uri',
        render: uri => (<a href={`http://localhost:3000${uri}`} download>
                Download
            </a>)
    }, {
        title: 'Actions', key: 'actions', width: 180, render: (_text, record) => (<Space>
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
            </Space>)
    }];

    return (<div style={{padding: 24}}>
            <Title level={2}>Model Registry</Title>

            {/* 过滤栏 */}
            <Space wrap style={{marginBottom: 16}}>
                <Button
                    type="primary"
                    icon={<PlusOutlined/>}
                    onClick={() => navigate('/upload')}
                >
                    Upload Model
                </Button>

                <Search
                    placeholder="Search Name"
                    allowClear
                    onSearch={val => setNameSearch(val)}
                    style={{width: 200}}
                />

                <Search
                    placeholder="Search Description"
                    allowClear
                    onSearch={val => setDescSearch(val)}
                    style={{width: 200}}
                />

                <Select
                    placeholder="Filter Risk"
                    allowClear
                    style={{width: 140}}
                    value={riskFilter}
                    onChange={val => setRiskFilter(val)}
                >
                    <Option value="low">low</Option>
                    <Option value="medium">medium</Option>
                    <Option value="high">high</Option>
                </Select>

                <Select
                    placeholder="Filter Schema"
                    allowClear
                    style={{width: 160}}
                    value={schemaFilter}
                    onChange={val => setSchemaFilter(val)}
                >
                    {schemaOptions.map(s => (<Option key={s} value={s}>
                            {typeof s === 'string' ? s : JSON.stringify(s)}
                        </Option>))}
                </Select>

                <Select
                    placeholder="Page Size"
                    value={pageSize}
                    onChange={val => setPageSize(val)}
                    style={{width: 100}}
                >
                    {[5, 10, 20, 50].map(n => (<Option key={n} value={n}>
                            {n}
                        </Option>))}
                </Select>
            </Space>

            <Table
                dataSource={filteredData}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{pageSize}}
            />
        </div>);
}
