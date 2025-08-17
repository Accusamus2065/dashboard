import React, {useEffect, useState, useMemo} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {
    Descriptions,
    Spin,
    Button,
    message,
    Typography,
    Divider,
    Tag,
    Table,
    Card,
    Space,
} from 'antd';
import {ArrowLeftOutlined, FilePdfOutlined, MailOutlined, DownloadOutlined} from '@ant-design/icons';
import {useParams, useNavigate} from 'react-router-dom';
import api from '../services/api';
import {useAuth} from '../contexts/AuthContext';
import {LICENSES} from '../constants/constant';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, {defaultSchema} from 'rehype-sanitize';
import 'github-markdown-css/github-markdown-light.css';

import styles from './ModelDetailPage.module.css';

const {Title, Text} = Typography;

const sanitizeSchema = {
    ...defaultSchema,
    attributes: {
        ...defaultSchema.attributes,
        img: [...(defaultSchema.attributes?.img || []), 'src', 'alt', 'title', 'width', 'height', 'loading'],
        a: [...(defaultSchema.attributes?.a || []), 'href', 'title', 'target', 'rel'],
        p: [...(defaultSchema.attributes?.p || []), 'align'],
        h1: [...(defaultSchema.attributes?.h1 || []), 'align'],
        h2: [...(defaultSchema.attributes?.h2 || []), 'align'],
        h3: [...(defaultSchema.attributes?.h3 || []), 'align'],
        h4: [...(defaultSchema.attributes?.h4 || []), 'align'],
        h5: [...(defaultSchema.attributes?.h5 || []), 'align'],
        h6: [...(defaultSchema.attributes?.h6 || []), 'align'],
    }
};

const BASE = 'http://localhost:3000';

export default function ModelDetailPage() {
    const {id} = useParams();
    const navigate = useNavigate();
    const {hasRole} = useAuth();
    const canEdit = hasRole(['uploader', 'admin']);

    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(false);
    const [readmeText, setReadmeText] = useState('');
    const [docs, setDocs] = useState([]);
    const [updates, setUpdates] = useState([]);

    useEffect(() => {
        setLoading(true);
        api.get(`/models/${id}`)
            .then(res => setModel(res.data))
            .catch(() => message.error('Failed to load'))
            .finally(() => setLoading(false));
    }, [id]);

    // Detect README filetype
    const isReadmePdf = useMemo(() => !!model?.readme_uri && /\.pdf(\?|$)/i.test(model.readme_uri), [model?.readme_uri]);

    // Load README text only for non-PDF
    useEffect(() => {
        const loadReadme = async () => {
            if (!model?.readme_uri || isReadmePdf) {
                setReadmeText('');
                return;
            }
            try {
                const url = `${BASE}${model.readme_uri}`;
                const resp = await fetch(url);
                const txt = await resp.text();
                setReadmeText(txt);
            } catch {
                setReadmeText('Failed to load README.');
            }
        };
        loadReadme();
    }, [model?.readme_uri, isReadmePdf]);

    // Compliance docs
    useEffect(() => {
        const loadCompliance = async () => {
            try {
                const res = await api.get(`/models/${id}/compliance-docs`);
                setDocs(res.data || []);
            } catch {
                message.error('Failed to load compliance docs');
            }
        };
        loadCompliance();
    }, [id]);

    // Update history
    useEffect(() => {
        const loadUpdates = async () => {
            try {
                const res = await api.get(`/models/${id}/updates`);
                setUpdates(res.data || []);
            } catch {
                message.error('Failed to load update history');
            }
        };
        loadUpdates();
    }, [id]);

    const approvedDocs = useMemo(() => (docs || []).filter(d => d.status === 'approved'), [docs]);
    const approvedPdfDocs = useMemo(
        () => approvedDocs.filter(d => /\.pdf(\?|$)/i.test(d.uri || '')),
        [approvedDocs]
    );

    const licenseFull = useMemo(() => {
        const raw = model?.license;
        if (!raw) return null;
        const entry = (LICENSES || []).find(x => (typeof x === 'string' ? x === raw : x?.value === raw));
        if (!entry) return raw;
        if (typeof entry === 'string') return entry;
        return entry.label || entry.value || raw;
    }, [model?.license]);

    const ownerParsed = useMemo(() => {
        const oc = model?.owner_contact;
        if (!oc || typeof oc !== 'string') return {raw: oc};
        const parts = oc.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
            return {name: parts[0], email: parts[1]};
        }
        return {raw: oc};
    }, [model?.owner_contact]);

    const metricCells = useMemo(() => {
        if (!model) return [];
        const arr = [];
        if (model.baseline_accuracy != null) arr.push({label: 'Accuracy', value: model.baseline_accuracy});
        if (model.baseline_f1 != null) arr.push({label: 'F1 Score', value: model.baseline_f1});
        if (model.baseline_auc != null) arr.push({label: 'AUC', value: model.baseline_auc});
        if (model.baseline_latency_ms != null) arr.push({label: 'Latency', value: `${model.baseline_latency_ms} ms`});
        return arr;
    }, [model]);

    const docColumns = [
        {title: 'ID', dataIndex: 'id', key: 'id', width: 48, align: 'center'},
        {title: 'Type', dataIndex: 'type', key: 'type', render: t => <Tag>{t}</Tag>},
        {
            title: 'File',
            dataIndex: 'uri',
            key: 'uri',
            render: (u) => (
                <a href={`${BASE}${u}`} target="_blank" rel="noreferrer">
                    {u.split('/').pop()}
                </a>
            )
        },
        {title: 'Reviewer', key: 'reviewer', render: (_, r) => r.reviewer?.email || '—'},
        {
            title: 'Reviewed At', dataIndex: 'reviewed_at', key: 'reviewed_at',
            render: v => (v ? new Date(v).toLocaleString() : '—')
        }
    ];

    // Update type tags (English)
    const typeTag = (t) => {
        const map = {
            model: {color: 'geekblue', text: 'Replace model artifact / README'},
            basic: {color: 'green', text: 'Edit basic information'},
            compliance_upload: {color: 'purple', text: 'Upload compliance documents'},
            compliance_review: {color: 'orange', text: 'Review compliance documents'},
        };
        const it = map[t] || {color: 'default', text: t};
        return <Tag color={it.color}>{it.text}</Tag>;
    };

    const updateColumns = [
        {title: 'Time', dataIndex: 'created_at', render: v => new Date(v).toLocaleString()},
        {title: 'Actor', dataIndex: ['actor', 'email'], render: (v) => v || '—'},
        {title: 'Type', dataIndex: 'update_type', render: typeTag},
        {
            title: 'Model', render: (_, r) => (
                <Space size={6}>
                    <span>{r.name_snapshot || model?.name}</span>
                    {r.version_snapshot && <Tag>Ver. {r.version_snapshot}</Tag>}
                </Space>
            )
        },
        {
            title: 'Old artifact', render: (_, r) => (
                r.prev_artifact_uri
                    ? <a href={`${BASE}${r.prev_artifact_uri}`} download><DownloadOutlined/> Download</a>
                    : <Text type="secondary">—</Text>
            ),
        },
    ];

    if (loading || !model) {
        return (
            <div className={styles.wrapper}>
                <Spin/>
            </div>
        );
    }

    return (
        <div className={styles.wrapper}>
            <Card className={styles.card} bordered={false}>
                {/* Header */}
                <div className={styles.header}>
                    <Button
                        icon={<ArrowLeftOutlined/>}
                        onClick={() => navigate(`/`)}
                        aria-label="Back"
                    >
                        Back
                    </Button>

                    <div className={styles.titleBox}>
                        {model.artifact_uri ? (
                            <Title level={3} style={{margin: 0}}>
                                <a
                                    href={`${BASE}${model.artifact_uri}`}
                                    download
                                    className={styles.titleLink}
                                    title="Download model artifact"
                                >
                                    {model.name}
                                </a>
                            </Title>
                        ) : (
                            <Title level={3} style={{margin: 0}}>{model.name}</Title>
                        )}
                        {model.version && <Tag className={styles.versionTag}
                                               style={{position: 'relative', top: -2}}>Ver. {model.version}</Tag>}
                    </div>
                </div>

                <Divider style={{margin: '12px 0 16px'}}/>

                {/* Info */}
                <Descriptions bordered column={4} className={styles.desc} labelStyle={{width: 160}}>
                    {metricCells.map((m, idx) => (
                        <Descriptions.Item key={`metric-${idx}`} label={m.label}>
                            {m.value}
                        </Descriptions.Item>
                    ))}

                    <Descriptions.Item label="Input Schema" span={2}>
                        {model.input_schema || <Text type="secondary">—</Text>}
                    </Descriptions.Item>

                    <Descriptions.Item label="Risk Level" span={2}>
                        {model.risk_level
                            ? <Tag
                                color={model.risk_level === 'high' ? 'red' : model.risk_level === 'medium' ? 'orange' : 'green'}>
                                {model.risk_level}
                            </Tag>
                            : <Text type="secondary">—</Text>}
                    </Descriptions.Item>

                    <Descriptions.Item label="Owner Contact" span={2}>
                        {ownerParsed?.email
                            ? (
                                <Space size={8}>
                                    <span>{ownerParsed.name}</span>
                                    <a href={`mailto:${ownerParsed.email}`} style={{marginLeft: 5}}>
                                        <MailOutlined/> {ownerParsed.email}
                                    </a>
                                </Space>
                            )
                            : (ownerParsed?.raw || <Text type="secondary">—</Text>)
                        }
                    </Descriptions.Item>

                    <Descriptions.Item label="License" span={2}>
                        {licenseFull ? licenseFull : <Text type="secondary">—</Text>}
                    </Descriptions.Item>

                    {Array.isArray(model.business_tags) && model.business_tags.length > 0 && (
                        <Descriptions.Item label="Business Tags" span={4}>
                            <Space wrap size={[6, 6]}>
                                {model.business_tags.map((t, i) => <Tag key={i}>{t}</Tag>)}
                            </Space>
                        </Descriptions.Item>
                    )}

                    <Descriptions.Item label="Brief Description" span={4}>
                        {model.description
                            ? <div style={{whiteSpace: 'pre-line'}}>{model.description}</div>
                            : <Text type="secondary">—</Text>}
                    </Descriptions.Item>
                </Descriptions>

                {/* Approved Compliance Docs */}
                {approvedDocs.length > 0 && (
                    <>
                        <Divider/>
                        <Title level={4} style={{marginBottom: 12}}>Approved Compliance Documents</Title>
                        <div className={styles.tableWrap}>
                            <Table
                                rowKey="id"
                                dataSource={approvedDocs}
                                columns={docColumns}
                                pagination={false}
                                size="middle"
                            />
                        </div>

                        {approvedPdfDocs.length > 0 && (
                            <>
                                <Divider/>
                                <div className={styles.pdfHeader}>
                                    <Title level={5} style={{margin: 0}}>
                                        <FilePdfOutlined/> PDF Preview
                                    </Title>
                                    <Text type="secondary">Approved PDFs are rendered inline below.</Text>
                                </div>
                                <div className={styles.pdfGrid}>
                                    {approvedPdfDocs.map((d) => (
                                        <div key={d.id} className={styles.pdfItem}>
                                            <iframe title={`pdf-${d.id}`} src={`${BASE}${d.uri}`}
                                                    className={styles.pdfFrame}/>
                                            <div className={styles.pdfCaption}>
                                                <span className={styles.pdfName}>{(d.uri || '').split('/').pop()}</span>
                                                <Tag size="small">{d.type}</Tag>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}

                {/* README */}
                <Divider/>
                <Title level={4} style={{marginBottom: 12}}>README</Title>
                {model.readme_uri ? (
                    isReadmePdf ? (
                        <div className={styles.pdfItem} style={{marginTop: 0}}>
                            <iframe
                                title="readme-pdf"
                                src={`${BASE}${model.readme_uri}`}
                                className={`${styles.pdfFrame} ${styles.readmePdf}`}
                            />
                            <div className={styles.pdfCaption}>
                                <span className={styles.pdfName}>{(model.readme_uri || '').split('/').pop()}</span>
                                <Tag size="small">PDF</Tag>
                            </div>
                        </div>
                    ) : (
                        <article className={`${styles.readme} markdown-body`}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
                                components={{
                                    a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer"/>,
                                    img: ({node, ...props}) => <img {...props} loading="lazy"
                                                                    style={{maxWidth: '100%', height: 'auto'}}
                                                                    alt="img"/>
                                }}
                            >
                                {readmeText}
                            </ReactMarkdown>
                        </article>
                    )
                ) : (
                    <div className={styles.readmePlaceholder}>No README uploaded.</div>
                )}

                {/* Update History */}
                {updates.length > 0 && (
                    <>
                        <Divider/>
                        <Title level={4} style={{marginBottom: 10}}>Update History</Title>
                        <div className={styles.tableWrap}>
                            <Table
                                rowKey="id"
                                dataSource={updates}
                                columns={updateColumns}
                                pagination={false}
                                expandable={{
                                    expandedRowRender: (r) => (
                                        <div className={styles.updateDetail}>
                                            {r.note && <div className={styles.updateNote}><b>Note:</b> {r.note}</div>}
                                            <div className={styles.updateMeta}>
                                                <b>Details:</b>{' '}
                                                {(() => {
                                                    const mc = r?.meta?.model_change || r?.meta; // 兼容旧数据路径
                                                    const pv = mc?.prev_values;
                                                    const nv = mc?.new_values;
                                                    const fields = pv ? Object.keys(pv) : (mc?.changed_fields || []);
                                                    if (pv && nv) {
                                                        const fmt = (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v));
                                                        return (
                                                            <div style={{marginTop: 6}}>
                                                                {fields.map((k) => (
                                                                    <div key={k} style={{marginBottom: 4}}>
                                                                        <code>{k}</code>: <span
                                                                        style={{opacity: .85}}>{fmt(pv[k])}</span> → <b>{fmt(nv[k])}</b>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    }
                                                    if (mc?.changed_fields?.length) {
                                                        return <>Changed
                                                            fields: <code>{mc.changed_fields.join(', ')}</code></>;
                                                    }
                                                    if (r?.meta) {
                                                        return <pre
                                                            className={styles.json}>{JSON.stringify(r.meta, null, 2)}</pre>;
                                                    }
                                                    return <span>No additional metadata.</span>;
                                                })()}
                                            </div>
                                            {r.prev_artifact_uri && (
                                                <div className={styles.updateOld}>
                                                    Previous artifact:&nbsp;
                                                    <a href={`${BASE}${r.prev_artifact_uri}`} download>
                                                        {(r.prev_artifact_uri || '').split('/').pop()}
                                                    </a>
                                                    <span className={styles.updateHint}>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                }}
                            />
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
}