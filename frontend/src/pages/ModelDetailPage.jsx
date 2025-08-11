// frontend/src/pages/ModelDetailPage.jsx
import React, {useEffect, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {
    Descriptions, Spin, Button, message, Typography, Divider, Tag,
    Upload, Select, Space, Table, Modal, Input, Popconfirm, Alert
} from 'antd';
import {UploadOutlined, CheckCircleOutlined, CloseCircleOutlined} from '@ant-design/icons';
import {useParams, useNavigate} from 'react-router-dom';
import api from '../services/api';
import {useAuth} from '../contexts/AuthContext';
import {COMPLIANCE_DOC_TYPES} from '../constants/constant';

// Markdown renderer and plugins
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, {defaultSchema} from 'rehype-sanitize';
import 'github-markdown-css/github-markdown-light.css';

const {Title} = Typography;
const {Option} = Select;
const {TextArea} = Input;

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

export default function ModelDetailPage() {
    const {id} = useParams();
    const navigate = useNavigate();
    const {hasRole, user} = useAuth();

    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(false);
    const [readmeText, setReadmeText] = useState('');

    // compliance
    const canUploadDoc = hasRole(['uploader', 'admin']);
    const canReview = hasRole(['auditor', 'admin']);
    const canDeleteAny = hasRole('admin');

    const [docType, setDocType] = useState('FRIA');
    const [docFile, setDocFile] = useState([]);
    const [docs, setDocs] = useState([]);
    const [reviewModal, setReviewModal] = useState({open: false, id: null, status: 'approved', note: ''});

    useEffect(() => {
        setLoading(true);
        api.get(`/models/${id}`)
            .then(res => setModel(res.data))
            .catch(() => message.error('Failed to load'))
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        const loadReadme = async () => {
            if (!model?.readme_uri) {
                setReadmeText('');
                return;
            }
            try {
                const url = `http://localhost:3000${model.readme_uri}`;
                const resp = await fetch(url);
                const txt = await resp.text();
                setReadmeText(txt);
            } catch {
                setReadmeText('Failed to load README.');
            }
        };
        loadReadme();
    }, [model?.readme_uri]);

    const loadCompliance = async () => {
        try {
            const res = await api.get(`/models/${id}/compliance-docs`);
            setDocs(res.data || []);
        } catch {
            message.error('Failed to load compliance docs');
        }
    };
    useEffect(() => {
        loadCompliance();
    }, [id]);

    const uploadDoc = async () => {
        if (!docFile[0]?.originFileObj) return message.error('Please select a file');
        const fd = new FormData();
        fd.append('type', docType);
        fd.append('doc', docFile[0].originFileObj);
        try {
            await api.post(`/models/${id}/compliance-docs`, fd, {headers: {'Content-Type': 'multipart/form-data'}});
            message.success('Uploaded');
            setDocFile([]);
            setDocType('FRIA');
            loadCompliance();
        } catch (e) {
            message.error(e.response?.data?.error || 'Upload failed');
        }
    };

    const doReview = async () => {
        try {
            await api.put(`/compliance-docs/${reviewModal.id}/review`, {
                status: reviewModal.status,
                note: reviewModal.note
            });
            message.success('Reviewed');
            setReviewModal({open: false, id: null, status: 'approved', note: ''});
            loadCompliance();
        } catch (e) {
            message.error(e.response?.data?.error || 'Review failed');
        }
    };

    const columns = [
        {title: 'ID', dataIndex: 'id', key: 'id', width: 70},
        {title: 'Type', dataIndex: 'type', key: 'type', render: t => <Tag>{t}</Tag>, width: 110},
        {
            title: 'File',
            dataIndex: 'uri',
            key: 'uri',
            render: (u) => <a href={`http://localhost:3000${u}`} target="_blank"
                              rel="noreferrer">{u.split('/').pop()}</a>
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 130,
            render: s => {
                const color = s === 'approved' ? 'green' : s === 'rejected' ? 'red' : 'gold';
                return <Tag color={color}>{s}</Tag>;
            }
        },
        {title: 'Uploader', key: 'uploader', width: 180, render: (_, r) => r.uploader?.email || r.uploaded_by},
        {title: 'Reviewer', key: 'reviewer', width: 180, render: (_, r) => r.reviewer?.email || '—'},
        {
            title: 'Actions',
            key: 'actions',
            width: 260,
            render: (_t, r) => {
                const canDelete = canDeleteAny || r.uploaded_by === user?.id;
                return (
                    <Space>
                        {canReview && r.status === 'pending' && (
                            <>
                                <Button icon={<CheckCircleOutlined/>} onClick={() => setReviewModal({
                                    open: true,
                                    id: r.id,
                                    status: 'approved',
                                    note: ''
                                })}>
                                    Approve
                                </Button>
                                <Button danger icon={<CloseCircleOutlined/>} onClick={() => setReviewModal({
                                    open: true,
                                    id: r.id,
                                    status: 'rejected',
                                    note: ''
                                })}>
                                    Reject
                                </Button>
                            </>
                        )}
                        {canDelete && (
                            <Popconfirm
                                title="Delete this document?"
                                onConfirm={async () => {
                                    try {
                                        await api.delete(`/compliance-docs/${r.id}`);
                                        message.success('Deleted');
                                        loadCompliance();
                                    } catch (e) {
                                        message.error(e.response?.data?.error || 'Delete failed');
                                    }
                                }}
                            >
                                <Button danger>Delete</Button>
                            </Popconfirm>
                        )}
                    </Space>
                );
            }
        }
    ];

    if (loading || !model) return <Spin/>;

    return (
        <div style={{padding: 24}}>
            <Button onClick={() => navigate(`/`)} style={{marginBottom: 16}}>Back</Button>
            <Title level={3}>Model #{model.id} — {model.name}</Title>

            <Descriptions bordered column={1}>
                <Descriptions.Item label="Version">{model.version}</Descriptions.Item>
                <Descriptions.Item label="Brief Description">{model.description}</Descriptions.Item>
                <Descriptions.Item label="Input Schema">{model.input_schema}</Descriptions.Item>
                <Descriptions.Item label="Risk Level">{model.risk_level}</Descriptions.Item>
                <Descriptions.Item label="Artifact">
                    <a href={`http://localhost:3000${model.artifact_uri}`} download>Download</a>
                </Descriptions.Item>
            </Descriptions>

            <Divider/>

            <Title level={4} style={{marginBottom: 8}}>Compliance Documents</Title>
            <Alert
                type="info"
                message="Required docs: High risk → FRIA, DPIA, PRIVACY; Medium → PRIVACY; Low → none"
                showIcon
                style={{marginBottom: 12}}
            />

            {canUploadDoc && (
                <Space direction="vertical" size="small" style={{marginBottom: 12, width: '100%'}}>
                    <Space wrap>
                        <Select value={docType} onChange={setDocType} style={{width: 180}}>
                            {COMPLIANCE_DOC_TYPES.map(t => <Option key={t} value={t}>{t}</Option>)}
                        </Select>
                        <Upload
                            id="doc"
                            name="doc"
                            accept=".pdf,.doc,.docx,.txt,.md"
                            beforeUpload={() => false}
                            fileList={docFile}
                            onChange={(info) => setDocFile(info.fileList.slice(-1))}
                            maxCount={1}
                        >
                            <Button icon={<UploadOutlined/>}>Choose File</Button>
                        </Upload>
                        <Button type="primary" onClick={uploadDoc}>Upload</Button>
                    </Space>
                </Space>
            )}

            <Table
                rowKey="id"
                dataSource={docs}
                columns={columns}
                pagination={{pageSize: 10}}
            />

            <Divider/>
            <Title level={4} style={{marginBottom: 12}}>README</Title>

            {model.readme_uri ? (
                <article
                    className="markdown-body"
                    style={{
                        background: '#fff',
                        padding: 16,
                        border: '1px solid #eee',
                        borderRadius: 8,
                        overflowX: 'auto'
                    }}
                >
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
                        components={{
                            a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer"/>,
                            img: ({node, ...props}) => <img {...props} loading="lazy"
                                                            style={{maxWidth: '100%', height: 'auto'}}/>
                        }}
                    >
                        {readmeText}
                    </ReactMarkdown>
                </article>
            ) : (
                <div>No README uploaded.</div>
            )}

            {/* Review modal */}
            <Modal
                open={reviewModal.open}
                title={reviewModal.status === 'approved' ? 'Approve Document' : 'Reject Document'}
                onCancel={() => setReviewModal({open: false, id: null, status: 'approved', note: ''})}
                onOk={doReview}
            >
                <p>Status: <b>{reviewModal.status}</b></p>
                <TextArea
                    value={reviewModal.note}
                    onChange={e => setReviewModal(s => ({...s, note: e.target.value}))}
                    placeholder="Optional note"
                    rows={4}
                />
            </Modal>
        </div>
    );
}
