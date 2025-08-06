// frontend/src/pages/ModelDetailPage.jsx
import React, {useEffect, useState} from 'react';
import {Descriptions, Spin, Button, message} from 'antd';
import {useParams, useNavigate} from 'react-router-dom';
import api from '../services/api';

export default function ModelDetailPage() {
    const {id} = useParams();
    const navigate = useNavigate();
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        api.get(`/models/${id}`)
            .then(res => setModel(res.data))
            .catch(() => message.error('Failed to load'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading || !model) return <Spin/>;

    return (<div style={{padding: 24}}>
            <Button onClick={() => navigate(-1)} style={{marginBottom: 16}}>
                Back
            </Button>
            <Descriptions title={`Model #${model.id}`} bordered column={1}>
                <Descriptions.Item label="Name">{model.name}</Descriptions.Item>
                <Descriptions.Item label="Version">{model.version}</Descriptions.Item>
                <Descriptions.Item label="Brief Description">
                    {model.description}
                </Descriptions.Item>
                <Descriptions.Item label="Input Schema">
                    {model.input_schema}
                </Descriptions.Item>
                <Descriptions.Item label="Risk Level">
                    {model.risk_level}
                </Descriptions.Item>
                <Descriptions.Item label="Artifact">
                    <a href={`http://localhost:3000${model.artifact_uri}`} download>
                        Download
                    </a>
                </Descriptions.Item>
                {/* 可选字段逐一展示 */}
                {model.environment_spec && (<Descriptions.Item label="Environment Spec">
                        {model.environment_spec}
                    </Descriptions.Item>)}
                {model.baseline_metrics && (<Descriptions.Item label="Baseline Metrics">
                        {JSON.stringify(model.baseline_metrics)}
                    </Descriptions.Item>)}
                {model.example_io && (<Descriptions.Item label="Example I/O">
                        {model.example_io}
                    </Descriptions.Item>)}
                {model.compliance_docs?.length > 0 && (<Descriptions.Item label="Compliance Docs">
                        {model.compliance_docs.map((u, i) => (
                            <div key={i}><a href={u} target="_blank" rel="noreferrer">{u}</a></div>))}
                    </Descriptions.Item>)}
                {model.business_tags?.length > 0 && (<Descriptions.Item label="Business Tags">
                        {model.business_tags.join(', ')}
                    </Descriptions.Item>)}
                {model.owner_contact && (<Descriptions.Item label="Owner Contact">
                        {model.owner_contact}
                    </Descriptions.Item>)}
                {model.license && (<Descriptions.Item label="License">
                        {model.license}
                    </Descriptions.Item>)}
                {model.dataset_dependencies && (<Descriptions.Item label="Dataset Dependencies">
                        {model.dataset_dependencies}
                    </Descriptions.Item>)}
                {model.additional_notes && (<Descriptions.Item label="Additional Notes">
                        {model.additional_notes}
                    </Descriptions.Item>)}
            </Descriptions>
            <Button type="primary" onClick={() => navigate(`/edit/${id}`)} style={{marginTop: 16}}>
                Edit
            </Button>
        </div>);
}
