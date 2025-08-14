// frontend/src/pages/HomePage.jsx
import React, {useEffect, useMemo, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {
    Typography, Button, Input, Space, Select, Popconfirm, message, Tag, Divider, Alert,
    Row, Col, Card, Drawer, Checkbox, Slider, DatePicker, Pagination, Badge, Tooltip
} from 'antd';
import {
    PlusOutlined, EyeOutlined, DeleteOutlined, PlayCircleOutlined, EditOutlined, TeamOutlined,
    FilterOutlined, ReloadOutlined, SortAscendingOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../services/api';
import {SCHEMA_MODES, RISK_LEVELS, LICENSES} from '../constants/constant';
import {useAuth} from '../contexts/AuthContext';
import {useNavigate} from 'react-router-dom';

const {Title, Text} = Typography;
const {Search} = Input;
const {Option} = Select;
const {RangePicker} = DatePicker;

const SORT_OPTIONS = [
    {value: 'updated_at_desc', label: 'Updated (newest)'},
    {value: 'updated_at_asc', label: 'Updated (oldest)'},
    {value: 'name_asc', label: 'Name (A→Z)'},
    {value: 'acc_desc', label: 'Accuracy (high→low)'},
    {value: 'f1_desc', label: 'F1 (high→low)'},
    {value: 'auc_desc', label: 'AUC (high→low)'},
    {value: 'latency_asc', label: 'Latency (low→high)'},
];

function relativeFrom(dateStr) {
    try {
        const d = new Date(dateStr);
        const diff = Date.now() - d.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins} min ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs} h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 30) return `${days} d ago`;
        const months = Math.floor(days / 30);
        return `${months} mo ago`;
    } catch {
        return '';
    }
}

export default function HomePage() {
    const {user, hasRole, logout} = useAuth();
    const navigate = useNavigate();

    const canUpload = hasRole(['uploader', 'admin']);
    const canEdit = hasRole(['uploader', 'admin']);
    const canDelete = hasRole('admin');

    // data
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [cStatus, setCStatus] = useState([]);

    // quick filters
    const [q, setQ] = useState('');
    const [schemaFilter, setSchemaFilter] = useState([]);
    const [riskFilter, setRiskFilter] = useState([]);
    const [licenseFilter, setLicenseFilter] = useState([]);
    const [sortBy, setSortBy] = useState('updated_at_desc');

    // advanced
    const [advOpen, setAdvOpen] = useState(false);
    const [tagFilterAny, setTagFilterAny] = useState([]);
    const [tagFilterAll, setTagFilterAll] = useState([]);
    const [hasDocs, setHasDocs] = useState(false);
    const [hasTrain, setHasTrain] = useState(false);
    const [hasVal, setHasVal] = useState(false);
    const [minAcc, setMinAcc] = useState(undefined);
    const [minF1, setMinF1] = useState(undefined);
    const [minAUC, setMinAUC] = useState(undefined);
    const [maxLatency, setMaxLatency] = useState(undefined);
    const [dateRange, setDateRange] = useState(null);

    // pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(12);

    const [tagOptions, setTagOptions] = useState([]);

    // ✅ 兼容 LICENSES 既可能是字符串数组，也可能是 {label,value} 数组
    const licenseOptions = useMemo(() => {
        return (LICENSES || []).map(x =>
            typeof x === 'string' ? {label: x, value: x} : x
        );
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const [allRes, stRes] = await Promise.all([
                    api.get('/models'),
                    api.get('/compliance/status')
                ]);
                setCStatus(stRes.data || []);
                const setTags = new Set();
                (allRes.data || []).forEach(m => {
                    (m.business_tags || []).forEach(t => setTags.add(t));
                });
                setTagOptions(Array.from(setTags).sort());
            } catch {
                // ignore
            }
        })();
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const params = {
                q: q || undefined,
                schema: schemaFilter.join(',') || undefined,
                risk: riskFilter.join(',') || undefined,
                license: licenseFilter.join(',') || undefined,
                ...(tagFilterAll.length ? {tags: tagFilterAll.join(','), tagsMode: 'all'}
                    : tagFilterAny.length ? {tags: tagFilterAny.join(','), tagsMode: 'any'}
                        : {}),
                hasDocs: hasDocs || undefined,
                hasTrain: hasTrain || undefined,
                hasVal: hasVal || undefined,
                minAcc, minF1, minAUC, maxLatency,
                ...(dateRange && dateRange.length === 2 ? {
                    dateFrom: dateRange[0]?.format('YYYY-MM-DD'),
                    dateTo: dateRange[1]?.format('YYYY-MM-DD'),
                } : {}),
                sort: sortBy,
                page, pageSize
            };
            const res = await api.get('/models/search', {params});
            setItems(res.data?.items || []);
            setTotal(res.data?.total || 0);
        } catch (e) {
            message.error(e.response?.data?.error || 'Failed to load models');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        q, schemaFilter, riskFilter, licenseFilter, sortBy,
        tagFilterAny, tagFilterAll,
        hasDocs, hasTrain, hasVal,
        minAcc, minF1, minAUC, maxLatency,
        dateRange, page, pageSize
    ]);

    const missingCountTotal = (cStatus || []).filter(s => s.missing.length > 0).length;

    const resetAll = () => {
        setQ('');
        setSchemaFilter([]);
        setRiskFilter([]);
        setLicenseFilter([]);
        setTagFilterAll([]);
        setTagFilterAny([]);
        setHasDocs(false);
        setHasTrain(false);
        setHasVal(false);
        setMinAcc(undefined);
        setMinF1(undefined);
        setMinAUC(undefined);
        setMaxLatency(undefined);
        setDateRange(null);
        setSortBy('updated_at_desc');
        setPage(1);
        setPageSize(12);
    };

    const statusMap = useMemo(() => {
        const m = new Map();
        (cStatus || []).forEach(s => m.set(s.model_id, s));
        return m;
    }, [cStatus]);

    const riskColor = r => r === 'high' ? 'red' : r === 'medium' ? 'orange' : 'green';
    const metricLine = (m) => {
        const bits = [];
        if (m.baseline_accuracy != null) bits.push(`Acc ${m.baseline_accuracy}`);
        if (m.baseline_f1 != null) bits.push(`F1 ${m.baseline_f1}`);
        if (m.baseline_auc != null) bits.push(`AUC ${m.baseline_auc}`);
        if (m.baseline_latency_ms != null) bits.push(`Lat ${m.baseline_latency_ms} ms`);
        return bits.join(' • ');
    };
    const tagRow = (arr) => {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const head = arr.slice(0, 3);
        const more = arr.length - head.length;
        return (
            <Space wrap size={[4, 4]}>
                {head.map((t, i) => <Tag key={i}>{t}</Tag>)}
                {more > 0 && <Tag>+{more}</Tag>}
            </Space>
        );
    };

    return (
        <div style={{padding: 24}}>
            <Space style={{width: '100%', justifyContent: 'space-between', marginBottom: 8}}>
                <Title level={2} style={{margin: 0}}>Model Registry</Title>
                <Space>
                    {user?.role === 'admin' && (
                        <Button icon={<TeamOutlined/>} onClick={() => navigate('/admin/users')}>
                            User Management
                        </Button>
                    )}
                    <Text type="secondary">
                        {user?.email} · <b>{user?.role}</b>
                    </Text>
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
                    action={<Button size="small" onClick={() => {
                        setAdvOpen(true);
                    }}>Review</Button>}
                />
            )}

            {/* Top quick bar */}
            <Space wrap align="center" style={{marginBottom: 16}}>
                {hasRole(['uploader', 'admin']) && (
                    <Button type="primary" icon={<PlusOutlined/>} onClick={() => navigate('/upload')}>
                        Upload Model
                    </Button>
                )}

                <label htmlFor="search-all" style={{position: 'absolute', left: -9999}}>Search</label>
                <Search
                    id="search-all"
                    placeholder="Search name, description, owner, tags"
                    allowClear
                    autoComplete="off"
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value);
                        setPage(1);
                    }}
                    style={{width: 320}}
                />

                <Select
                    mode="multiple"
                    allowClear
                    placeholder="Schema"
                    style={{minWidth: 200}}
                    value={schemaFilter}
                    onChange={(v) => {
                        setSchemaFilter(v);
                        setPage(1);
                    }}
                >
                    {SCHEMA_MODES.map(s => <Option key={s} value={s}>{s}</Option>)}
                </Select>

                <Select
                    mode="multiple"
                    allowClear
                    placeholder="Risk"
                    style={{minWidth: 160}}
                    value={riskFilter}
                    onChange={(v) => {
                        setRiskFilter(v);
                        setPage(1);
                    }}
                >
                    {RISK_LEVELS.map(r => <Option key={r} value={r}>{r}</Option>)}
                </Select>

                {/* ✅ License 改为 options={...}，避免把 {label,value} 当 children 渲染 */}
                <Select
                    mode="multiple"
                    allowClear
                    placeholder="License"
                    style={{minWidth: 220}}
                    value={licenseFilter}
                    onChange={(v) => {
                        setLicenseFilter(v);
                        setPage(1);
                    }}
                    showSearch
                    optionFilterProp="label"
                    options={licenseOptions}
                />

                <Select
                    value={sortBy}
                    style={{minWidth: 200}}
                    onChange={(v) => {
                        setSortBy(v);
                        setPage(1);
                    }}
                    suffixIcon={<SortAscendingOutlined/>}
                >
                    {SORT_OPTIONS.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                </Select>

                <Button icon={<FilterOutlined/>} onClick={() => setAdvOpen(true)}>
                    Advanced Filters
                </Button>

                <Button icon={<ReloadOutlined/>} onClick={resetAll}>
                    Reset
                </Button>
            </Space>

            <div style={{marginBottom: 8}}>
                <Text type="secondary">
                    {total} result(s)
                </Text>
            </div>

            {/* Cards */}
            <Row gutter={[16, 16]}>
                {items.map(m => {
                    const st = statusMap.get(m.id);
                    const compliant = st ? (st.missing.length === 0 && st.pending === 0) : null;
                    const missing = st ? st.missing.length : 0;
                    const pending = st ? st.pending : 0;

                    return (
                        <Col key={m.id} xs={24} sm={12} md={8} lg={6}>
                            <Card
                                hoverable
                                loading={loading}
                                onClick={() => navigate(`/view/${m.id}`)}
                                title={
                                    <Space>
                                        <Text strong>{m.name}</Text>
                                        {m.version && <Tag>{m.version}</Tag>}
                                    </Space>
                                }
                                extra={
                                    compliant != null ? (
                                        compliant ? <Badge status="success" text="Compliant"/>
                                            : pending > 0 ? <Badge status="warning" text={`Pending ${pending}`}/>
                                                : <Badge status="error" text={`Missing ${missing}`}/>
                                    ) : null
                                }
                            >
                                <Space direction="vertical" size={8} style={{width: '100%'}}>
                                    <Space wrap>
                                        <Tag color={riskColor(m.risk_level)}>{m.risk_level}</Tag>
                                        <Tag>{m.input_schema}</Tag>
                                        {m.license && <Tag>{m.license}</Tag>}
                                    </Space>

                                    {metricLine(m) && (
                                        <Text type="secondary">{metricLine(m)}</Text>
                                    )}

                                    {tagRow(m.business_tags)}

                                    <Space align="center" style={{justifyContent: 'space-between', width: '100%'}}>
                                        <Tooltip title={m.updated_at ? new Date(m.updated_at).toLocaleString() : ''}>
                                            <Text type="secondary">{m.updated_at && relativeFrom(m.updated_at)}</Text>
                                        </Tooltip>
                                        <Space onClick={e => e.stopPropagation()}>
                                            <Button size="small" icon={<EyeOutlined/>}
                                                    onClick={() => navigate(`/view/${m.id}`)}>View</Button>
                                            <Button size="small" icon={<PlayCircleOutlined/>}
                                                    onClick={() => navigate(`/predict/${m.id}`)}>Predict</Button>
                                            {canEdit && <Button size="small" icon={<EditOutlined/>}
                                                                onClick={() => navigate(`/edit/${m.id}`)}>Edit</Button>}
                                            {canDelete && (
                                                <Popconfirm
                                                    title="Confirm delete?"
                                                    onConfirm={async () => {
                                                        try {
                                                            await api.delete(`/models/${m.id}`);
                                                            message.success('Deleted');
                                                            await Promise.all([
                                                                load(),
                                                                (async () => {
                                                                    try {
                                                                        const res = await api.get('/compliance/status');
                                                                        setCStatus(res.data || []);
                                                                    } catch {
                                                                    }
                                                                })()
                                                            ]);
                                                        } catch (e) {
                                                            message.error(e.response?.data?.error || 'Delete failed');
                                                        }
                                                    }}
                                                >
                                                    <Button size="small" danger icon={<DeleteOutlined/>}/>
                                                </Popconfirm>
                                            )}
                                        </Space>
                                    </Space>
                                </Space>
                            </Card>
                        </Col>
                    );
                })}
            </Row>

            <div style={{marginTop: 16, display: 'flex', justifyContent: 'flex-end'}}>
                <Pagination
                    current={page}
                    pageSize={pageSize}
                    total={total}
                    showSizeChanger
                    pageSizeOptions={['8', '12', '24', '48', '96']}
                    onChange={(p, ps) => {
                        setPage(p);
                        setPageSize(ps);
                    }}
                />
            </div>

            <Drawer
                title="Advanced Filters"
                placement="right"
                open={advOpen}
                onClose={() => setAdvOpen(false)}
                width={420}
            >
                <Space direction="vertical" size="large" style={{width: '100%'}}>
                    <div>
                        <Text strong>Compliance</Text>
                        <div style={{marginTop: 8}}>
                            <Checkbox checked={hasDocs} onChange={e => setHasDocs(e.target.checked)}>
                                Has compliance docs
                            </Checkbox>
                        </div>
                    </div>

                    <div>
                        <Text strong>Data Dependencies</Text>
                        <div style={{marginTop: 8}}>
                            <Checkbox checked={hasTrain} onChange={e => setHasTrain(e.target.checked)}>
                                Has training data
                            </Checkbox>
                        </div>
                        <div style={{marginTop: 4}}>
                            <Checkbox checked={hasVal} onChange={e => setHasVal(e.target.checked)}>
                                Has validation data
                            </Checkbox>
                        </div>
                    </div>

                    <div>
                        <Text strong>Business Tags (match ALL)</Text>
                        <Select
                            mode="multiple"
                            allowClear
                            style={{width: '100%', marginTop: 8}}
                            value={tagFilterAll}
                            onChange={setTagFilterAll}
                            placeholder="Select tags that must all present"
                        >
                            {tagOptions.map(t => <Option key={t} value={t}>{t}</Option>)}
                        </Select>
                    </div>

                    <div>
                        <Text strong>Business Tags (match ANY)</Text>
                        <Select
                            mode="multiple"
                            allowClear
                            style={{width: '100%', marginTop: 8}}
                            value={tagFilterAny}
                            onChange={setTagFilterAny}
                            placeholder="Select tags (any match)"
                        >
                            {tagOptions.map(t => <Option key={t} value={t}>{t}</Option>)}
                        </Select>
                    </div>

                    <div>
                        <Text strong>Metrics</Text>
                        <div style={{marginTop: 8}}>
                            <Text>Min Accuracy</Text>
                            <Slider
                                min={0} max={1} step={0.01}
                                value={minAcc ?? 0}
                                onChange={v => setMinAcc(v === 0 ? undefined : v)}
                            />
                        </div>
                        <div>
                            <Text>Min F1</Text>
                            <Slider
                                min={0} max={1} step={0.01}
                                value={minF1 ?? 0}
                                onChange={v => setMinF1(v === 0 ? undefined : v)}
                            />
                        </div>
                        <div>
                            <Text>Min AUC</Text>
                            <Slider
                                min={0} max={1} step={0.01}
                                value={minAUC ?? 0}
                                onChange={v => setMinAUC(v === 0 ? undefined : v)}
                            />
                        </div>
                        <div>
                            <Text>Max Latency (ms)</Text>
                            <Slider
                                min={0} max={10000} step={10}
                                value={maxLatency ?? 10000}
                                onChange={v => setMaxLatency(v === 10000 ? undefined : v)}
                            />
                        </div>
                    </div>

                    <div>
                        <Text strong>Updated at</Text>
                        <RangePicker
                            style={{marginTop: 8, width: '100%'}}
                            value={dateRange}
                            onChange={setDateRange}
                            allowEmpty={[true, true]}
                        />
                    </div>

                    <div>
                        <Button icon={<ReloadOutlined/>} onClick={resetAll}>Reset All</Button>
                    </div>
                </Space>
            </Drawer>
        </div>
    );
}
