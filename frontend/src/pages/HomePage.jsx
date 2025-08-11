// frontend/src/pages/HomePage.jsx
import React, {useEffect, useMemo, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {
    Table, Typography, Button, Input, Space, Select, Popconfirm, message, Tag, Divider, Alert
} from 'antd';
import {
    PlusOutlined, EyeOutlined, DeleteOutlined, PlayCircleOutlined, EditOutlined
} from '@ant-design/icons';
import {useNavigate} from 'react-router-dom';
import api from '../services/api';
import {SCHEMA_MODES, RISK_LEVELS} from '../constants/constant';
import {useAuth} from '../contexts/AuthContext';

const {Title, Text} = Typography;
const {Search} = Input;
const {Option} = Select;

export default function HomePage() {
    const navigate = useNavigate();
    const {user, hasRole, logout} = useAuth();

    const canUpload = hasRole(['uploader', 'admin']);
    const canEdit = hasRole(['uploader', 'admin']);
    const canDelete = hasRole('admin');

    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(false);

    // compliance status
    const [cStatus, setCStatus] = useState([]); // [{model_id, missing:[..], pending:n, approved:n}]
    const [showOnlyMissing, setShowOnlyMissing] = useState(false);

    // filters
    const [nameSearch, setNameSearch] = useState('');
    const [descSearch, setDescSearch] = useState('');
    const [schemaFilter, setSchemaFilter] = useState(undefined);
    const [riskFilter, setRiskFilter] = useState(undefined);

    // pagination
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const loadModels = async () => {
        setLoading(true);
        try {
            const res = await api.get('/models');
            setModels(res.data || []);
        } catch (e) {
            message.error(e.response?.data?.error || 'Failed to load models');
        } finally {
            setLoading(false);
        }
    };

    const loadComplianceStatus = async () => {
        try {
            const res = await api.get('/compliance/status');
            setCStatus(res.data || []);
        } catch {
            setCStatus([]);
        }
    };

    useEffect(() => {
        loadModels();
        loadComplianceStatus();
    }, []);

    const statusMap = useMemo(() => {
        const m = new Map();
        cStatus.forEach(s => m.set(s.model_id, s));
        return m;
    }, [cStatus]);

    const filteredData = useMemo(() => {
        const n = (nameSearch || '').toLowerCase();
        const d = (descSearch || '').toLowerCase();
        return (models || [])
            .filter(m => {
                if (n && !m.name.toLowerCase().includes(n)) return false;
                if (d && !(m.description || '').toLowerCase().includes(d)) return false;
                if (schemaFilter && m.input_schema !== schemaFilter) return false;
                if (riskFilter && m.risk_level !== riskFilter) return false;
                const st = statusMap.get(m.id);
                if (showOnlyMissing && st && st.missing.length === 0) return false;
                return true;
            });
    }, [models, nameSearch, descSearch, schemaFilter, riskFilter, showOnlyMissing, statusMap]);

    const missingCountTotal = cStatus.filter(s => s.missing.length > 0).length;

    const columns = [
        {
            title: '#',
            key: 'number',
            width: 70,
            render: (_t, _r, index) => ((currentPage - 1) * pageSize) + index + 1,
        },
        {title: 'Name', dataIndex: 'name', key: 'name', render: v => <Text strong>{v}</Text>},
        {title: 'Version', dataIndex: 'version', key: 'version', width: 120},
        {title: 'Brief Description', dataIndex: 'description', key: 'description', ellipsis: true},
        {
            title: 'Input Schema',
            dataIndex: 'input_schema',
            key: 'input_schema',
            width: 140,
            render: s => <Tag>{s}</Tag>
        },
        {
            title: 'Risk', dataIndex: 'risk_level', key: 'risk_level', width: 110,
            render: r => <Tag color={r === 'high' ? 'red' : r === 'medium' ? 'orange' : 'green'}>{r}</Tag>
        },
        {
            title: 'Compliance',
            key: 'compliance',
            width: 220,
            render: (_t, r) => {
                const st = statusMap.get(r.id);
                if (!st) return '—';
                const tags = [];
                if (st.missing.length > 0) tags.push(<Tag key="missing" color="red">Missing {st.missing.length}</Tag>);
                if (st.pending > 0) tags.push(<Tag key="pending" color="gold">Pending {st.pending}</Tag>);
                if (st.missing.length === 0 && st.pending === 0) tags.push(<Tag key="ok" color="green">Compliant</Tag>);
                return <Space>{tags}</Space>;
            }
        },
        {
            title: 'Artifact',
            dataIndex: 'artifact_uri',
            key: 'artifact_uri',
            width: 140,
            render: uri => uri ? (
                <a href={`http://localhost:3000${uri}`} download aria-label="download artifact">
                    Download
                </a>
            ) : '—'
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 300,
            render: (_t, record) => (
                <Space wrap>
                    <Button icon={<EyeOutlined/>} onClick={() => navigate(`/view/${record.id}`)}>View</Button>
                    <Button icon={<PlayCircleOutlined/>}
                            onClick={() => navigate(`/predict/${record.id}`)}>Predict</Button>
                    {canEdit &&
                        <Button icon={<EditOutlined/>} onClick={() => navigate(`/edit/${record.id}`)}>Edit</Button>}
                    {canDelete && (
                        <Popconfirm
                            title="Confirm delete?"
                            onConfirm={async () => {
                                try {
                                    await api.delete(`/models/${record.id}`);
                                    message.success('Deleted');
                                    loadModels();
                                    loadComplianceStatus();
                                } catch (e) {
                                    message.error(e.response?.data?.error || 'Delete failed');
                                }
                            }}
                        >
                            <Button icon={<DeleteOutlined/>} danger>Delete</Button>
                        </Popconfirm>
                    )}
                </Space>
            )
        },
    ];

    return (
        <div style={{padding: 24}}>
            <Space style={{width: '100%', justifyContent: 'space-between', marginBottom: 8}}>
                <Title level={2} style={{margin: 0}}>Model Registry</Title>
                <Space>
                    <Text type="secondary">{user?.email} · <b>{user?.role}</b></Text>
                    <Button onClick={logout}>Logout</Button>
                </Space>
            </Space>

            <Divider style={{marginTop: 12}}/>

            {missingCountTotal > 0 && (
                <Alert
                    type="warning"
                    showIcon
                    style={{marginBottom: 12}}
                    message={`${missingCountTotal} model(s) are missing required compliance docs`}
                    action={<Button size="small" onClick={() => setShowOnlyMissing(true)}>Show Missing Only</Button>}
                />
            )}

            <Space wrap style={{marginBottom: 16}}>
                {canUpload && (
                    <Button type="primary" icon={<PlusOutlined/>} onClick={() => navigate('/upload')}>
                        Upload Model
                    </Button>
                )}

                <label htmlFor="search-name" style={{position: 'absolute', left: -9999}}>Search Name</label>
                <Search id="search-name" placeholder="Search Name" allowClear autoComplete="off"
                        value={nameSearch} onChange={(e) => setNameSearch(e.target.value)}
                        style={{width: 220}}/>

                <label htmlFor="search-desc" style={{position: 'absolute', left: -9999}}>Search Description</label>
                <Search id="search-desc" placeholder="Search Description" allowClear autoComplete="off"
                        value={descSearch} onChange={(e) => setDescSearch(e.target.value)}
                        style={{width: 260}}/>

                <Select id="filter-schema" placeholder="Filter: Input Schema" allowClear style={{width: 200}}
                        value={schemaFilter} onChange={setSchemaFilter}>
                    {SCHEMA_MODES.map(s => <Option key={s} value={s}>{s}</Option>)}
                </Select>

                <Select id="filter-risk" placeholder="Filter: Risk" allowClear style={{width: 160}}
                        value={riskFilter} onChange={setRiskFilter}>
                    {RISK_LEVELS.map(r => <Option key={r} value={r}>{r}</Option>)}
                </Select>

                <div>
                    <label htmlFor="page-size" style={{marginRight: 8}}>Rows per page:</label>
                    <Select id="page-size" value={pageSize} onChange={(val) => {
                        setPageSize(val);
                        setCurrentPage(1);
                    }}
                            style={{width: 100}}>
                        {[5, 10, 20, 50].map(n => <Option key={n} value={n}>{n}</Option>)}
                    </Select>
                </div>

                <Button onClick={() => setShowOnlyMissing(false)} disabled={!showOnlyMissing}>Clear Missing
                    Filter</Button>
            </Space>

            <Table
                dataSource={filteredData}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{
                    pageSize,
                    current: currentPage,
                    onChange: (page, size) => {
                        setCurrentPage(page);
                        setPageSize(size);
                    }
                }}
            />
        </div>
    );
}
