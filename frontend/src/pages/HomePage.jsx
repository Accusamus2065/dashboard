// frontend/src/pages/HomePage.jsx
import React, {useEffect, useMemo, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {
    Typography, Button, Input, Space, Select, Popconfirm, message, Tag, Divider, Alert,
    Row, Col, Card, Drawer, Checkbox, Slider, DatePicker, Pagination, Badge, Tooltip, Segmented
} from 'antd';
import {
    PlusOutlined, EyeOutlined, DeleteOutlined, PlayCircleOutlined, EditOutlined, TeamOutlined,
    FilterOutlined, ReloadOutlined, SortAscendingOutlined, SearchOutlined, LogoutOutlined,
    AppstoreOutlined, BarsOutlined
} from '@ant-design/icons';
import api from '../services/api';
import {SCHEMA_MODES, RISK_LEVELS, LICENSES} from '../constants/constant';
import {useAuth} from '../contexts/AuthContext';
import {useNavigate} from 'react-router-dom';
import styles from './HomePage.module.css';

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
    // license now in Advanced drawer only
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
    const [complianceFilter, setComplianceFilter] = useState('any'); // any|compliant|pending|missing

    // pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(12);

    const [tagOptions, setTagOptions] = useState([]);
    const [bannerOpen, setBannerOpen] = useState(true);
    const [viewMode, setViewMode] = useState('grid'); // grid | list

    // License array -> options
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
                (allRes.data || []).forEach(m => (m.business_tags || []).forEach(t => setTags.add(t)));
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
        setComplianceFilter('any');
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

    const filteredItems = useMemo(() => {
        if (complianceFilter === 'any') return items;
        return items.filter(m => {
            const st = statusMap.get(m.id);
            if (!st) return false;
            const compliant = st.missing.length === 0 && st.pending === 0;
            if (complianceFilter === 'compliant') return compliant;
            if (complianceFilter === 'pending') return st.pending > 0;
            if (complianceFilter === 'missing') return st.missing.length > 0 && st.pending === 0;
            return true;
        });
    }, [items, complianceFilter, statusMap]);

    return (
        <div className={styles.page}>
            <div className={styles.main}>
                {/* Header */}
                <div className={styles.header}>
                    <Title level={2} style={{margin: 0}}>Model Registry</Title>
                    <div className={styles.headerRight}>
                        {canUpload && (
                            <Button type="primary" icon={<PlusOutlined/>} onClick={() => navigate('/upload')}>
                                Upload Model
                            </Button>
                        )}
                        {user?.role === 'admin' && (
                            <Button icon={<TeamOutlined/>} onClick={() => navigate('/admin/users')}>Users</Button>
                        )}
                        <Text type="secondary">{user?.email} · <b>{user?.role}</b></Text>
                        <Button icon={<LogoutOutlined/>} onClick={logout}>Logout</Button>
                    </div>
                </div>

                <Divider style={{margin: '8px 0 10px'}}/>

                {/* Compliance banner (closable) */}
                {bannerOpen && filteredItems.length > 0 && missingCountTotal > 0 && (
                    <Alert
                        type="warning"
                        showIcon
                        closable
                        onClose={() => setBannerOpen(false)}
                        style={{marginBottom: 10}}
                        message={`${missingCountTotal} model(s) are missing required compliance docs`}
                        action={<Button size="small" onClick={() => setAdvOpen(true)}>Review</Button>}
                    />
                )}

                {/* Toolbar */}
                <div className={styles.toolbar}>
                    <Search
                        placeholder="Search name, description, owner, tags"
                        allowClear
                        enterButton={<SearchOutlined/>}
                        value={q}
                        onChange={(e) => {
                            setQ(e.target.value);
                            setPage(1);
                        }}
                    />

                    <Select
                        mode="multiple"
                        allowClear
                        placeholder="Schema"
                        value={schemaFilter}
                        maxTagCount="responsive"
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
                        value={riskFilter}
                        maxTagCount="responsive"
                        onChange={(v) => {
                            setRiskFilter(v);
                            setPage(1);
                        }}
                    >
                        {RISK_LEVELS.map(r => <Option key={r} value={r}>{r}</Option>)}
                    </Select>

                    {/* sort */}
                    <Select
                        value={sortBy}
                        onChange={(v) => {
                            setSortBy(v);
                            setPage(1);
                        }}
                        suffixIcon={<SortAscendingOutlined/>}
                    >
                        {SORT_OPTIONS.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                    </Select>

                    {/* view toggle */}
                    <Space.Compact className={styles.viewToggle}>
                        <Button
                            type={viewMode === 'grid' ? 'primary' : 'default'}
                            icon={<AppstoreOutlined/>}
                            onClick={() => setViewMode('grid')}
                        />
                        <Button
                            type={viewMode === 'list' ? 'primary' : 'default'}
                            icon={<BarsOutlined/>}
                            onClick={() => setViewMode('list')}
                        />
                    </Space.Compact>

                    {/* advanced & reset */}
                    <Space.Compact className={styles.ghostBtn}>
                        <Button icon={<FilterOutlined/>} onClick={() => setAdvOpen(true)}>Advanced</Button>
                        <Button icon={<ReloadOutlined/>} onClick={resetAll}>Reset</Button>
                    </Space.Compact>
                </div>

                {/* Results strip */}
                <div className={styles.resultsBar}>
                    <Text className={styles.count}>{filteredItems.length} result(s)</Text>
                </div>

                {/* Cards */}
                {viewMode === 'grid' ? (
                    <Row gutter={[14, 14]} className={styles.grid}>
                        {filteredItems.map(m => {
                            const st = statusMap.get(m.id);
                            const compliant = st ? (st.missing.length === 0 && st.pending === 0) : null;
                            const missing = st ? st.missing.length : 0;
                            const pending = st ? st.pending : 0;

                            return (
                                <Col key={m.id} xs={24} sm={12} md={8} lg={6}>
                                    <Card
                                        className={styles.card}
                                        hoverable
                                        loading={loading}
                                        onClick={() => navigate(`/view/${m.id}`)}
                                        title={
                                            <>
                                                <Space>
                                                    <Text strong>{m.name}</Text>
                                                    {m.version && <Tag>{m.version}</Tag>}
                                                </Space>
                                                <div className={styles.subMeta}>
                                                    <Tooltip
                                                        title={m.updated_at ? new Date(m.updated_at).toLocaleString() : ''}>
                            <span className={styles.updated}>
                              {m.updated_at && relativeFrom(m.updated_at)}
                            </span>
                                                    </Tooltip>
                                                </div>
                                            </>
                                        }
                                        extra={
                                            compliant != null ? (
                                                compliant ? <Badge status="success" text="Compliant"/>
                                                    : pending > 0 ?
                                                        <Badge status="warning" text={`Pending ${pending}`}/>
                                                        : <Badge status="error" text={`Missing ${missing}`}/>
                                            ) : null
                                        }
                                    >
                                        <div className={styles.metaRow}>
                                            <Tag color={riskColor(m.risk_level)}>{m.risk_level}</Tag>
                                            <Tag>{m.input_schema}</Tag>
                                            {m.license && <Tag>{m.license}</Tag>}
                                        </div>

                                        {m.business_tags?.length > 0 && (
                                            <div style={{marginTop: 6}}>
                                                <Space wrap size={[4, 4]}>
                                                    {m.business_tags.slice(0, 3).map((t, i) => (
                                                        <Tag key={i}>{t}</Tag>))}
                                                    {m.business_tags.length > 3 &&
                                                        <Tag>+{m.business_tags.length - 3}</Tag>}
                                                </Space>
                                            </div>
                                        )}

                                        <div style={{marginTop: 8}}>
                                            <Text type="secondary">{metricLine(m)}</Text>
                                        </div>

                                        <div className={styles.cardFooter}>
                                            <div/>
                                            <Space className={styles.cardActions} onClick={e => e.stopPropagation()}>
                                                <Button size="small" icon={<EyeOutlined/>}
                                                        onClick={() => navigate(`/view/${m.id}`)}>View</Button>
                                                <Button size="small" icon={<PlayCircleOutlined/>}
                                                        onClick={() => navigate(`/predict/${m.id}`)}>Predict</Button>
                                                {canEdit && (
                                                    <Button size="small" icon={<EditOutlined/>}
                                                            onClick={() => navigate(`/edit/${m.id}`)}>Edit</Button>
                                                )}
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
                                        </div>
                                    </Card>
                                </Col>
                            );
                        })}
                    </Row>
                ) : (
                    /* List view */
                    <Space direction="vertical" size="middle" style={{width: '100%'}}>
                        {filteredItems.map(m => {
                            const st = statusMap.get(m.id);
                            const compliant = st ? (st.missing.length === 0 && st.pending === 0) : null;
                            const missing = st ? st.missing.length : 0;
                            const pending = st ? st.pending : 0;

                            return (
                                <Card key={m.id} className={`${styles.card} ${styles.listCard}`} loading={loading}>
                                    <div className={styles.listLeft}>
                                        <Space size={8} wrap>
                                            <Text strong style={{fontSize: 16}}>{m.name}</Text>
                                            {m.version && <Tag>{m.version}</Tag>}
                                            {compliant != null && (
                                                compliant ? <Badge status="success" text="Compliant"/>
                                                    : pending > 0 ?
                                                        <Badge status="warning" text={`Pending ${pending}`}/>
                                                        : <Badge status="error" text={`Missing ${missing}`}/>
                                            )}
                                        </Space>
                                        <div className={styles.subMeta} style={{marginTop: 6}}>
                                            <Tooltip
                                                title={m.updated_at ? new Date(m.updated_at).toLocaleString() : ''}>
                        <span className={styles.updated}>
                          {m.updated_at && relativeFrom(m.updated_at)}
                        </span>
                                            </Tooltip>
                                        </div>
                                        <div className={styles.metaRow}>
                                            <Tag color={riskColor(m.risk_level)}>{m.risk_level}</Tag>
                                            <Tag>{m.input_schema}</Tag>
                                            {m.license && <Tag>{m.license}</Tag>}
                                            {m.business_tags?.slice(0, 3).map((t, i) => (<Tag key={i}>{t}</Tag>))}
                                            {m.business_tags?.length > 3 && <Tag>+{m.business_tags.length - 3}</Tag>}
                                        </div>
                                        {metricLine(m) && (
                                            <Text type="secondary" style={{display: 'block', marginTop: 6}}>
                                                {metricLine(m)}
                                            </Text>
                                        )}
                                    </div>

                                    <div className={styles.listRight}>
                                        <Button icon={<EyeOutlined/>}
                                                onClick={() => navigate(`/view/${m.id}`)}>View</Button>
                                        <Button icon={<PlayCircleOutlined/>}
                                                onClick={() => navigate(`/predict/${m.id}`)}>Predict</Button>
                                        {canEdit && <Button icon={<EditOutlined/>}
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
                                                <Button danger icon={<DeleteOutlined/>}/>
                                            </Popconfirm>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </Space>
                )}
            </div>

            {/* Sticky footer */}
            <div className={styles.footer}>
                <Pagination
                    current={page}
                    pageSize={pageSize}
                    total={filteredItems.length} /* total shown after local compliance filter */
                    showSizeChanger
                    pageSizeOptions={['8', '12', '24', '48', '96']}
                    onChange={(p, ps) => {
                        setPage(p);
                        setPageSize(ps);
                    }}
                />
            </div>

            {/* Advanced Drawer */}
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
                            <Select
                                value={complianceFilter}
                                onChange={setComplianceFilter}
                                style={{width: '100%'}}
                                options={[
                                    {value: 'any', label: 'Any'},
                                    {value: 'compliant', label: 'Compliant only'},
                                    {value: 'pending', label: 'Pending only'},
                                    {value: 'missing', label: 'Missing only'},
                                ]}
                            />
                        </div>
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
                            maxTagCount="responsive"
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
                            maxTagCount="responsive"
                        >
                            {tagOptions.map(t => <Option key={t} value={t}>{t}</Option>)}
                        </Select>
                    </div>

                    <div>
                        <Text strong>License</Text>
                        <Select
                            mode="multiple"
                            allowClear
                            style={{width: '100%', marginTop: 8}}
                            value={licenseFilter}
                            onChange={setLicenseFilter}
                            showSearch
                            optionFilterProp="label"
                            options={licenseOptions}
                            maxTagCount="responsive"
                        />
                    </div>

                    <div>
                        <Text strong>Metrics</Text>
                        <div style={{marginTop: 8}}>
                            <Text>Min Accuracy</Text>
                            <Slider min={0} max={1} step={0.01}
                                    value={minAcc ?? 0}
                                    onChange={v => setMinAcc(v === 0 ? undefined : v)}
                            />
                        </div>
                        <div>
                            <Text>Min F1</Text>
                            <Slider min={0} max={1} step={0.01}
                                    value={minF1 ?? 0}
                                    onChange={v => setMinF1(v === 0 ? undefined : v)}
                            />
                        </div>
                        <div>
                            <Text>Min AUC</Text>
                            <Slider min={0} max={1} step={0.01}
                                    value={minAUC ?? 0}
                                    onChange={v => setMinAUC(v === 0 ? undefined : v)}
                            />
                        </div>
                        <div>
                            <Text>Max Latency (ms)</Text>
                            <Slider min={0} max={10000} step={10}
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
