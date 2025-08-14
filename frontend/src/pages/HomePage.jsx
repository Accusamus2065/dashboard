// frontend/src/pages/HomePage.jsx
import React, {useEffect, useMemo, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {
    Typography, Button, Input, Space, Select, Popconfirm, message, Tag, Divider, Alert,
    Drawer, Checkbox, Slider, DatePicker, Pagination, Badge, Tooltip, Table, Popover
} from 'antd';
import {
    PlusOutlined, EyeOutlined, DeleteOutlined, PlayCircleOutlined, EditOutlined, TeamOutlined,
    FilterOutlined, ReloadOutlined, SortAscendingOutlined, SearchOutlined, LogoutOutlined, MoreOutlined
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

/* removed updated_* sort choices */
const SORT_OPTIONS = [
    {value: 'name_asc', label: 'Name (A→Z)'},
    {value: 'acc_desc', label: 'Accuracy (high→low)'},
    {value: 'f1_desc', label: 'F1 (high→low)'},
    {value: 'auc_desc', label: 'AUC (high→low)'},
    {value: 'latency_asc', label: 'Latency (low→high)'},
];

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
    const [sortBy, setSortBy] = useState('name_asc');

    // advanced
    const [advOpen, setAdvOpen] = useState(false);
    const [tagFilterAny, setTagFilterAny] = useState([]);
    const [tagFilterAll, setTagFilterAll] = useState([]);
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
        hasTrain, hasVal,
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
        setHasTrain(false);
        setHasVal(false);
        setMinAcc(undefined);
        setMinF1(undefined);
        setMinAUC(undefined);
        setMaxLatency(undefined);
        setDateRange(null);
        setComplianceFilter('any');
        setSortBy('name_asc');
        setPage(1);
        setPageSize(12);
    };

    const statusMap = useMemo(() => {
        const m = new Map();
        (cStatus || []).forEach(s => m.set(s.model_id, s));
        return m;
    }, [cStatus]);

    const riskColor = r => r === 'high' ? 'red' : r === 'medium' ? 'orange' : 'green';

    /* Present metrics as nice chips instead of a long sentence */
    const metricChips = (m) => {
        const chips = [];
        if (m.baseline_accuracy != null) chips.push({label: 'Acc', value: m.baseline_accuracy});
        if (m.baseline_f1 != null) chips.push({label: 'F1', value: m.baseline_f1});
        if (m.baseline_auc != null) chips.push({label: 'AUC', value: m.baseline_auc});
        if (m.baseline_latency_ms != null) chips.push({label: 'Lat', value: `${m.baseline_latency_ms}ms`});
        if (chips.length === 0) return <Text type="secondary">—</Text>;
        return (
            <div className={styles.metricGroup}>
                {chips.map((c, i) => (
                    <span key={i} className={styles.metricChip}>
            {c.label}: {c.value}
          </span>
                ))}
            </div>
        );
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

    /* ===== Table columns =====
       No column widths => table-layout: auto; cells can wrap and no horizontal scroll. */
    const columns = [
        {
            title: '#',
            dataIndex: 'index',
            align: 'right',
            render: (_, __, idx) => (page - 1) * pageSize + idx + 1,
        },
        {
            title: 'Name / Version',
            dataIndex: 'name',
            render: (_, m) => (
                <Space size={6} wrap>
                    <Text strong>{m?.name || '(unnamed)'}</Text>
                    {m?.version && <Tag>{m.version}</Tag>}
                </Space>
            ),
        },
        {
            title: 'Compliance',
            dataIndex: 'compliance',
            render: (_, m) => {
                const st = statusMap.get(m.id);
                if (!st) return null;
                const compliant = st.missing.length === 0 && st.pending === 0;
                const missing = st.missing.length;
                const pending = st.pending;
                return compliant
                    ? <Badge status="success" text="Compliant"/>
                    : pending > 0 ? <Badge status="warning" text={`Pending ${pending}`}/>
                        : <Badge status="error" text={`Missing ${missing}`}/>;
            },
        },
        {
            title: 'Risk',
            dataIndex: 'risk_level',
            render: (r) => <Tag color={riskColor(r)}>{r}</Tag>,
        },
        {
            title: 'Schema',
            dataIndex: 'input_schema',
            render: (s) => s ? <Tag>{s}</Tag> : <Text type="secondary">—</Text>,
        },
        {
            title: 'License',
            dataIndex: 'license',
            render: (l) => l ? <Tag>{l}</Tag> : <Text type="secondary">—</Text>,
        },
        {
            title: 'Business Tags',
            dataIndex: 'business_tags',
            render: (_, m) => {
                const tags = Array.isArray(m?.business_tags) ? m.business_tags : [];
                const head = tags.slice(0, 4);
                const more = Math.max(tags.length - 4, 0);
                return (
                    <div className={styles.tagsWrap}>
                        {head.map((t, i) => (<Tag key={i}>{t}</Tag>))}
                        {more > 0 && (
                            <Popover
                                trigger="click"
                                content={
                                    <div className={styles.tagsWrap} style={{maxWidth: 360}}>
                                        {tags.map((t, i) => <Tag key={`all-${i}`}>{t}</Tag>)}
                                    </div>
                                }
                                overlayStyle={{maxWidth: 420}}
                            >
                                <Tag color="blue"><MoreOutlined/> {more} more</Tag>
                            </Popover>
                        )}
                    </div>
                );
            },
        },
        {
            title: 'Metrics',
            dataIndex: 'metrics',
            render: (_, m) => metricChips(m),
        },
        {
            title: 'Actions',
            dataIndex: 'actions',
            render: (_, m) => (
                <div className={styles.actionsWrap}>
                    <Button size="small" icon={<EyeOutlined/>} onClick={() => navigate(`/view/${m.id}`)}>View</Button>
                    {canEdit && <Button size="small" icon={<EditOutlined/>}
                                        onClick={() => navigate(`/edit/${m.id}`)}>Edit</Button>}
                    <Button size="small" icon={<PlayCircleOutlined/>}
                            onClick={() => navigate(`/predict/${m.id}`)}>Predict</Button>
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
                            <div style={{marginLeft: 'auto'}}>
                                <Button danger icon={<DeleteOutlined/>} size="small"/>
                            </div>
                        </Popconfirm>
                    )}
                </div>
            ),
        },
    ];

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

                    <Space.Compact className={styles.ghostBtn}>
                        <Button icon={<FilterOutlined/>} onClick={() => setAdvOpen(true)}>Advanced</Button>
                        <Button icon={<ReloadOutlined/>} onClick={resetAll}>Reset</Button>
                    </Space.Compact>
                </div>

                {/* Results strip */}
                <div className={styles.resultsBar}>
                    <Text className={styles.count}>{filteredItems.length} result(s)</Text>
                </div>

                {/* Table view (no horizontal scroll; columns wrap) */}
                <div className={styles.tableWrap}>
                    <Table
                        rowKey="id"
                        size="middle"
                        loading={loading}
                        columns={columns}
                        dataSource={filteredItems}
                        pagination={false}
                    />
                </div>
            </div>

            {/* Sticky footer */}
            <div className={styles.footer}>
                <Pagination
                    current={page}
                    pageSize={pageSize}
                    total={filteredItems.length}
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
                className={styles.drawer}
                title="Advanced Filters"
                placement="right"
                open={advOpen}
                onClose={() => setAdvOpen(false)}
                width={420}
            >
                <Space direction="vertical" size="large" style={{width: '100%'}}>
                    {/* 1) Data Dependencies FIRST */}
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

                    {/* 2) Compliance Document SECOND (renamed) */}
                    <div>
                        <Text strong>Compliance Document</Text>
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
                            placeholder="Select license(s)"
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

                    <div className={styles.applyRow}>
                        <Button icon={<ReloadOutlined/>} onClick={resetAll}>Reset All</Button>
                        <Button type="primary" onClick={() => setAdvOpen(false)}>Apply</Button>
                    </div>
                </Space>
            </Drawer>
        </div>
    );
}
