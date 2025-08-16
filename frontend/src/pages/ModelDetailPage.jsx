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
    Space
} from 'antd';
import {ArrowLeftOutlined, EditOutlined, FilePdfOutlined} from '@ant-design/icons';
import {useParams, useNavigate} from 'react-router-dom';
import api from '../services/api';
import {useAuth} from '../contexts/AuthContext';

// Markdown renderer and plugins
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

    // Load model
    useEffect(() => {
        setLoading(true);
        api.get(`/models/${id}`)
            .then(res => setModel(res.data))
            .catch(() => message.error('Failed to load'))
            .finally(() => setLoading(false));
    }, [id]);

    // Load README content
    useEffect(() => {
        const loadReadme = async () => {
            if (!model?.readme_uri) {
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
    }, [model?.readme_uri]);

    // Load ALL compliance docs, but View 仅展示 approved
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

    const approvedDocs = useMemo(() => (docs || []).filter(d => d.status === 'approved'), [docs]);
    const approvedPdfDocs = useMemo(
        () => approvedDocs.filter(d => /\.pdf(\?|$)/i.test(d.uri || '')),
        [approvedDocs]
    );

    const docColumns = [
        {title: 'ID', dataIndex: 'id', key: 'id', width: 70},
        {title: 'Type', dataIndex: 'type', key: 'type', width: 110, render: t => <Tag>{t}</Tag>},
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
        {title: 'Reviewer', key: 'reviewer', width: 180, render: (_, r) => r.reviewer?.email || '—'},
        {
            title: 'Reviewed At', dataIndex: 'reviewed_at', key: 'reviewed_at', width: 200,
            render: v => (v ? new Date(v).toLocaleString() : '—')
        }
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
                        onClick={() => navigate(-1)}
                        aria-label="Back"
                    >
                        Back
                    </Button>

                    <div className={styles.titleBox}>
                        <Title level={3} style={{margin: 0}}>
                            Model #{model.id} — {model.name}
                        </Title>
                        {model.version && <Tag className={styles.versionTag}>{model.version}</Tag>}
                    </div>
                </div>

                <Divider style={{margin: '10px 0 16px'}}/>

                {/* Summary */}
                <Descriptions
                    bordered
                    column={1}
                    className={styles.desc}
                    labelStyle={{width: 220}}
                >
                    <Descriptions.Item label="Brief Description">{model.description}</Descriptions.Item>
                    <Descriptions.Item label="Input Schema">{model.input_schema}</Descriptions.Item>
                    <Descriptions.Item label="Risk Level">
                        <Tag
                            color={model.risk_level === 'high' ? 'red' : model.risk_level === 'medium' ? 'orange' : 'green'}>
                            {model.risk_level}
                        </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Artifact">
                        <a href={`${BASE}${model.artifact_uri}`} download>Download</a>
                    </Descriptions.Item>

                    {(model.baseline_latency_ms != null ||
                        model.baseline_accuracy != null ||
                        model.baseline_f1 != null ||
                        model.baseline_auc != null) && (
                        <Descriptions.Item label="Baseline Metrics">
                            <div className={styles.metrics}>
                                {model.baseline_accuracy != null && (
                                    <span className={styles.metricChip}>Acc: {model.baseline_accuracy}</span>
                                )}
                                {model.baseline_f1 != null && (
                                    <span className={styles.metricChip}>F1: {model.baseline_f1}</span>
                                )}
                                {model.baseline_auc != null && (
                                    <span className={styles.metricChip}>AUC: {model.baseline_auc}</span>
                                )}
                                {model.baseline_latency_ms != null && (
                                    <span className={styles.metricChip}>Lat: {model.baseline_latency_ms} ms</span>
                                )}
                            </div>
                        </Descriptions.Item>
                    )}

                    {Array.isArray(model.business_tags) && model.business_tags.length > 0 && (
                        <Descriptions.Item label="Business Tags">
                            <Space wrap size={[6, 6]}>
                                {model.business_tags.map((t, i) => <Tag key={i}>{t}</Tag>)}
                            </Space>
                        </Descriptions.Item>
                    )}

                    {model.owner_contact && (
                        <Descriptions.Item label="Owner Contact">{model.owner_contact}</Descriptions.Item>
                    )}

                    {model.license && (
                        <Descriptions.Item label="License">{model.license}</Descriptions.Item>
                    )}

                    {Array.isArray(model.training_data_uris) && model.training_data_uris.length > 0 && (
                        <Descriptions.Item label="Training Data">
                            {model.training_data_uris.map((u, i) => (
                                <div key={i}>
                                    <a href={`${BASE}${u}`} target="_blank" rel="noreferrer">
                                        {u.split('/').pop()}
                                    </a>
                                </div>
                            ))}
                        </Descriptions.Item>
                    )}

                    {Array.isArray(model.validation_data_uris) && model.validation_data_uris.length > 0 && (
                        <Descriptions.Item label="Validation Data">
                            {model.validation_data_uris.map((u, i) => (
                                <div key={i}>
                                    <a href={`${BASE}${u}`} target="_blank" rel="noreferrer">
                                        {u.split('/').pop()}
                                    </a>
                                </div>
                            ))}
                        </Descriptions.Item>
                    )}
                </Descriptions>

                <Divider/>

                {/* Approved Compliance Docs (table + PDF previews) */}
                <Title level={4} style={{marginBottom: 12}}>Approved Compliance Documents</Title>
                <div className={styles.tableWrap}>
                    <Table
                        rowKey="id"
                        dataSource={approvedDocs}
                        columns={docColumns}
                        pagination={{pageSize: 10}}
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
                                    <iframe
                                        title={`pdf-${d.id}`}
                                        src={`${BASE}${d.uri}`}
                                        className={styles.pdfFrame}
                                    />
                                    <div className={styles.pdfCaption}>
                                        <span className={styles.pdfName}>{(d.uri || '').split('/').pop()}</span>
                                        <Tag size="small">{d.type}</Tag>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <Divider/>

                {/* README */}
                <Title level={4} style={{marginBottom: 12}}>README</Title>
                {model.readme_uri ? (
                    <article className={`${styles.readme} markdown-body`}>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
                            components={{
                                a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer"/>,
                                img: ({node, ...props}) => <img {...props} loading="lazy"
                                                                style={{maxWidth: '100%', height: 'auto'}} alt="img"/>
                            }}
                        >
                            {readmeText}
                        </ReactMarkdown>
                    </article>
                ) : (
                    <div className={styles.readmePlaceholder}>No README uploaded.</div>
                )}

                <div className={styles.footerActions}>
                    {canEdit && (
                        <Button type="primary" icon={<EditOutlined/>} onClick={() => navigate(`/edit/${id}`)}>
                            Edit
                        </Button>
                    )}
                </div>
            </Card>
        </div>
    );
}
