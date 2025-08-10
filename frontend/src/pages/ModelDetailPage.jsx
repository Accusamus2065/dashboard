// frontend/src/pages/ModelDetailPage.jsx
import React, {useEffect, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {Descriptions, Spin, Button, message, Typography, Divider, Tag} from 'antd';
import {useParams, useNavigate} from 'react-router-dom';
import api from '../services/api';
import {useAuth} from "../contexts/AuthContext.jsx";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, {defaultSchema} from 'rehype-sanitize';

import 'github-markdown-css/github-markdown-light.css';

const {Title} = Typography;

const sanitizeSchema = {
    ...defaultSchema,
    attributes: {
        ...defaultSchema.attributes,
        img: [
            ...(defaultSchema.attributes?.img || []),
            'src', 'alt', 'title', 'width', 'height', 'loading'
        ],
        a: [
            ...(defaultSchema.attributes?.a || []),
            'href', 'title', 'target', 'rel'
        ],
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
    const {hasRole} = useAuth();
    const canEdit = hasRole(['uploader', 'admin']);
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(false);
    const [readmeText, setReadmeText] = useState('');

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

                {(model.baseline_latency_ms != null ||
                    model.baseline_accuracy != null ||
                    model.baseline_f1 != null ||
                    model.baseline_auc != null) && (
                    <Descriptions.Item label="Baseline Metrics">
                        {model.baseline_latency_ms != null &&
                            <span>Latency: {model.baseline_latency_ms} ms&nbsp;&nbsp;</span>}
                        {model.baseline_accuracy != null &&
                            <span>Accuracy: {model.baseline_accuracy}&nbsp;&nbsp;</span>}
                        {model.baseline_f1 != null && <span>F1: {model.baseline_f1}&nbsp;&nbsp;</span>}
                        {model.baseline_auc != null && <span>AUC: {model.baseline_auc}</span>}
                    </Descriptions.Item>
                )}

                {Array.isArray(model.compliance_docs) && model.compliance_docs.length > 0 && (
                    <Descriptions.Item label="Compliance Docs">
                        {model.compliance_docs.map((u, i) => (
                            <div key={i}>
                                <a href={`http://localhost:3000${u}`} target="_blank" rel="noreferrer">
                                    {u.split('/').pop()}
                                </a>
                            </div>
                        ))}
                    </Descriptions.Item>
                )}

                {Array.isArray(model.business_tags) && model.business_tags.length > 0 && (
                    <Descriptions.Item label="Business Tags">
                        {model.business_tags.map((t, i) => <Tag key={i}>{t}</Tag>)}
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
                                <a href={`http://localhost:3000${u}`} target="_blank" rel="noreferrer">
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
                                <a href={`http://localhost:3000${u}`} target="_blank" rel="noreferrer">
                                    {u.split('/').pop()}
                                </a>
                            </div>
                        ))}
                    </Descriptions.Item>
                )}
            </Descriptions>

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
                            a: ({node, ...props}) => (
                                <a {...props} target="_blank" rel="noopener noreferrer"/>
                            ),
                            img: ({node, ...props}) => (
                                <img {...props} loading="lazy" style={{maxWidth: '100%', height: 'auto'}}/>
                            )
                        }}
                    >
                        {readmeText}
                    </ReactMarkdown>
                </article>
            ) : (
                <div>No README uploaded.</div>
            )}

            <div style={{marginTop: 16}}>
                {canEdit && (
                    <Button type="primary" onClick={() => navigate(`/edit/${id}`)}>Edit</Button>
                )}
            </div>
        </div>
    );
}
