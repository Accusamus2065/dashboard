// frontend/src/pages/HomePage.jsx
import React, {useEffect, useState, useMemo} from 'react';
import '@ant-design/v5-patch-for-react-19'
import {
    Table, Typography, Button, Input, Space, Select, Popconfirm, message
} from 'antd';
import {
    PlusOutlined, EyeOutlined, DeleteOutlined, PlayCircleOutlined
} from '@ant-design/icons';
import {useNavigate} from 'react-router-dom';
import api from '../services/api';

import {SCHEMA_MODES, RISK_LEVELS} from '../constants/constant';

const {Title} = Typography;
const {Search} = Input;
const {Option} = Select;

export default function HomePage() {
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(false);

    const [nameSearch, setNameSearch] = useState('');
    const [descSearch, setDescSearch] = useState('');
    const [riskFilter, setRiskFilter] = useState();
    const [schemaFilter, setSchemaFilter] = useState();

    const [pageSize, setPageSize] = useState(10);
    const navigate = useNavigate();

    const loadModels = async () => {
        setLoading(true);
        try {
            const res = await api.get('/models');
            setModels(res.data);
        } catch {
            message.error('Failed to load');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadModels();
    }, []);

    const filtered = useMemo(() => {
        return models
            .filter(m => {
                if (nameSearch && !m.name.includes(nameSearch)) return false;
                if (descSearch && !m.description?.includes(descSearch)) return false;
                if (riskFilter && m.risk_level !== riskFilter) return false;
                if (schemaFilter && m.input_schema !== schemaFilter) return false;
                return true;
            })
            .map((m, i) => ({...m, _number: i + 1}));
    }, [models, nameSearch, descSearch, riskFilter, schemaFilter]);

    const columns = [{title: '#', dataIndex: '_number', key: 'num', width: 60}, {
        title: 'Name', dataIndex: 'name', key: 'name'
    }, {title: 'Version', dataIndex: 'version', key: 'version', width: 100}, {
        title: 'Brief Description', dataIndex: 'description', key: 'desc'
    }, {title: 'Input Schema', dataIndex: 'input_schema', key: 'schema'}, {
        title: 'Risk', dataIndex: 'risk_level', key: 'risk', width: 100
    }, {
        title: 'Artifact',
        dataIndex: 'artifact_uri',
        key: 'uri',
        render: uri => <a href={`http://localhost:3000${uri}`} download>Download</a>
    }, {
        title: 'Actions', key: 'actions', width: 200, render: (_t, r) => (<Space>
            <Button icon={<EyeOutlined/>} onClick={() => navigate(`/view/${r.id}`)}>View</Button>
            <Button icon={<PlayCircleOutlined/>} onClick={() => navigate(`/predict/${r.id}`)}>Predict</Button>
            <Popconfirm title="Confirm delete?" onConfirm={async () => {
                await api.delete(`/models/${r.id}`);
                message.success('Deleted');
                loadModels();
            }}>
                <Button danger icon={<DeleteOutlined/>}>Delete</Button>
            </Popconfirm>
        </Space>)
    }];

    return (<div style={{padding: 24}}>
        <Title level={2}>Model Registry</Title>

        <Space wrap style={{marginBottom: 16}}>
            <Button type="primary" icon={<PlusOutlined/>} onClick={() => navigate('/upload')}>
                Upload Model
            </Button>

            <Search placeholder="Search Name" allowClear onSearch={setNameSearch} style={{width: 200}}/>

            <Search placeholder="Search Description" allowClear onSearch={setDescSearch} style={{width: 200}}/>

            <Select
                placeholder="Filter Schema"
                allowClear
                style={{width: 160}}
                onChange={setSchemaFilter}
                defaultValue={undefined}
            >
                {SCHEMA_MODES.map(s => <Option key={s} value={s}>{s}</Option>)}
            </Select>

            <Select
                placeholder="Filter Risk"
                allowClear
                style={{width: 140}}
                onChange={setRiskFilter}
                defaultValue={undefined}
            >
                {RISK_LEVELS.map(r => <Option key={r} value={r}>{r}</Option>)}
            </Select>

            <Select
                placeholder="Page Size"
                allowClear
                defaultValue={pageSize}
                style={{width: 120}}
                onChange={setPageSize}
            >
                {[5, 10, 20, 50].map(n => <Option key={n} value={n}>{n}</Option>)}
            </Select>
        </Space>

        <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{pageSize}}
        />
    </div>);
}
