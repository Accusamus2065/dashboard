// frontend/src/pages/HomePage.jsx
import React, {useEffect, useMemo, useRef, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {
    Typography, Button, Input, Space, Select, Popconfirm, message, Tag, Divider, Alert,
    Drawer, Checkbox, Slider, DatePicker, Pagination, Badge, Table, Popover
} from 'antd';
import {
    PlusOutlined, EyeOutlined, DeleteOutlined, PlayCircleOutlined, EditOutlined, TeamOutlined,
    FilterOutlined, ReloadOutlined, SortAscendingOutlined, SearchOutlined, LogoutOutlined
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

const REQUIRED_BY_RISK = {
    high: ['FRIA', 'DPIA', 'PRIVACY'],
    medium: ['PRIVACY'],
    low: []
};

export default function HomePage() {
    const {user, hasRole, logout} = useAuth();
    const navigate = useNavigate();

    const canUpload = hasRole(['uploader', 'admin']);
    const canEdit = hasRole(['uploader', 'admin', 'auditor']);
    const canDelete = hasRole('admin');

    // data
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);             // ✅ 用于“已加载多少模型”的提示条
    const [loading, setLoading] = useState(false);

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

    const tokenSuffix = (() => {
        try {
            const tk = localStorage.getItem('token') || '';
            return tk ? tk.slice(-16) : 'anon';
        } catch {
            return 'anon';
        }
    })();
    const BANNER_KEY = `home_loaded_banner_closed_${tokenSuffix}`;
    const [bannerOpen, setBannerOpen] = useState(() => !localStorage.getItem(BANNER_KEY));
    const [firstLoadDone, setFirstLoadDone] = useState(false);

    const licenseOptions = useMemo(() => {
        return (LICENSES || []).map(x =>
            typeof x === 'string' ? {label: x, value: x} : x
        );
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/business-tags');
                setTagOptions(res.data?.items || []);
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
            setTotal(res.data?.total || 0);           // ✅ 用于顶部提示
            setFirstLoadDone(true);                   // ✅ 首次载入完成
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

    const [docStats, setDocStats] = useState({});
    const inFlight = useRef(new Set());

    const fetchDocStat = async (m) => {
        const id = m.id;
        if (inFlight.current.has(id) || docStats[id]) return;
        inFlight.current.add(id);
        try {
            const res = await api.get(`/models/${id}/compliance-docs`);
            const docs = res.data || [];
            const required = REQUIRED_BY_RISK[m.risk_level] || [];

            const uploadedTypes = new Set(docs.map(d => d.type));
            const missing = required.filter(t => !uploadedTypes.has(t)).length;          // ✅ 未上传任何文件的类型数
            const pending = docs.filter(d => d.status === 'pending').length;             // ✅ 待审文件数（多少文件就是多少）
            const complete = missing === 0 && pending === 0;                             // ✅ 完成条件

            setDocStats(prev => ({...prev, [id]: {missing, pending, complete}}));
        } catch {
            // ignore
        } finally {
            inFlight.current.delete(id);
        }
    };

    // 对当前结果里的模型生成/补全 doc 统计（缓存一次即可）
    useEffect(() => {
        (items || []).forEach(m => fetchDocStat(m));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items]);

    /** ===== 依赖 docStats 的前端合规筛选 ===== */
    const filteredItems = useMemo(() => {
        if (complianceFilter === 'any') return items;
        return items.filter(m => {
            const st = docStats[m.id];
            if (!st) return false;
            if (complianceFilter === 'compliant') return st.complete;
            if (complianceFilter === 'pending') return st.pending > 0;
            if (complianceFilter === 'missing') return st.missing > 0 && st.pending === 0;
            return true;
        });
    }, [items, complianceFilter, docStats]);

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

    /* ===== Table columns ===== */
    const columns = [
        {
            title: '#',
            dataIndex: 'index',
            width: 30,
            align: 'center',
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
                const st = docStats[m.id];
                if (!st) return <Text type="secondary">Loading…</Text>;

                if (st.missing === 0 && st.pending === 0) {
                    return <Badge status="success" text="Complete"/>;
                }
                return (
                    <Space size={6} wrap>
                        {st.missing > 0 &&
                            <Badge status="error" text={`Missing ${st.missing}`} style={{marginRight: 5}}/>}
                        {st.pending > 0 && <Badge status="warning" text={`Pending ${st.pending}`}/>}
                    </Space>
                );
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
            title: 'Tags',
            dataIndex: 'business_tags',
            render: (_, m) => {
                const tags = Array.isArray(m?.business_tags) ? m.business_tags.filter(Boolean) : [];
                const head = tags.slice(0, 4);
                const rest = tags.slice(4);
                const hasMore = rest.length > 0;

                if (tags.length === 0) {
                    return <span style={{color: '#999'}}>No tags</span>;
                }

                return (
                    <div className={styles.tagsWrap}>
                        {head.map((t, i) => (
                            <Tag key={`head-${i}`}>{t}</Tag>
                        ))}

                        {hasMore && (
                            <Popover
                                trigger="click"
                                overlayStyle={{maxWidth: 420}}
                                content={
                                    <div className={styles.tagsWrap} style={{maxWidth: 360}}>
                                        {rest.map((t, i) => (
                                            <Tag key={`rest-${i}`}>{t}</Tag>
                                        ))}
                                    </div>
                                }
                            >
                                <Tag color="blue" style={{cursor: 'pointer'}}>
                                    +{rest.length} …
                                </Tag>
                            </Popover>
                        )}
                    </div>
                );
            },
        },
        {
            title: 'Metrics',
            width: 380,
            dataIndex: 'metrics',
            render: (_, m) => metricChips(m),
        },
        {
            title: 'Actions',
            dataIndex: 'actions',
            width: 190,
            render: (_, m) => (
                <div className={styles.actionsWrap} style={{width: '100%'}}>
                    <Button size="small" icon={<EyeOutlined/>} onClick={() => navigate(`/view/${m.id}`)}>View</Button>
                    {canEdit && <Button size="small" icon={<EditOutlined/>}
                                        onClick={() => navigate(`/edit/${m.id}`)}>Edit</Button>}
                    {canDelete && (
                        <Popconfirm
                            title="Confirm delete?"
                            onConfirm={async () => {
                                try {
                                    await api.delete(`/models/${m.id}`);
                                    message.success('Deleted');
                                    // 重新拉取列表（docStats 对应项让它自然失效即可）
                                    await load();
                                } catch (e) {
                                    message.error(e.response?.data?.error || 'Delete failed');
                                }
                            }}
                        >
                            <Button danger icon={<DeleteOutlined/>} size="small"/>
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

                {bannerOpen && firstLoadDone && total > 0 && (
                    <Alert
                        type="info"
                        showIcon
                        closable
                        onClose={() => {
                            setBannerOpen(false);
                            try {
                                localStorage.setItem(BANNER_KEY, '1');
                            } catch {
                            }
                        }}
                        style={{marginBottom: 10}}
                        message={`${total} model(s) loaded`}
                    />
                )}

                {/* Toolbar */}
                <div className={styles.toolbar}>
                    <Search
                        placeholder="Search name, description, owner, tags"
                        allowClear
                        enterButton={<Button icon={<SearchOutlined/>} style={{width: 50}}/>}
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

                {/* Table view */}
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
                open={advOpen}
                onClose={() => setAdvOpen(false)}
                width={420}
            >
                <Space direction="vertical" size="large" style={{width: '100%'}}>
                    {/* 1) Data Dependencies */}
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
