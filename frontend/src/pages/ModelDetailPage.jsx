// frontend/src/pages/ModelDetailPage.jsx
import React, {useEffect, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {Descriptions, Spin, Button, message, Typography, Row, Col} from 'antd';
import {useParams, useNavigate} from 'react-router-dom';
import api from '../services/api';

const {Title} = Typography;

export default function ModelDetailPage() {
    const {id} = useParams();
    const navigate = useNavigate();
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        api.get(`/models/${id}`)
            .then(res => setModel(res.data))
            .catch(() => message.error('Failed to load model'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading || !model) {
        return (<Row justify="center" align="middle" style={{height: '100vh'}}>
                <Col>
                    <Spin/>
                </Col>
            </Row>);
    }

    // Helper to render either the value or a “Pending update” placeholder
    const renderField = (value) => value != null && value !== '' ? value : <i>Pending update</i>;

    return (<div style={{padding: 24}}>
        <Button onClick={() => navigate(-1)} style={{marginBottom: 16}}>
            Back
        </Button>

        <Title level={3}>Model Details — #{model.id}</Title>

        <Descriptions bordered column={1}>
            <Descriptions.Item label="Name">
                {renderField(model.name)}
            </Descriptions.Item>

            <Descriptions.Item label="Version">
                {renderField(model.version)}
            </Descriptions.Item>

            <Descriptions.Item label="Brief Description">
                {renderField(model.description)}
            </Descriptions.Item>

            <Descriptions.Item label="Input Schema">
                {renderField(model.input_schema)}
            </Descriptions.Item>

            <Descriptions.Item label="Risk Level">
                {renderField(model.risk_level)}
            </Descriptions.Item>

            <Descriptions.Item label="Artifact">
                {model.artifact_uri ? (<a href={`http://localhost:3000${model.artifact_uri}`} download>
                    Download
                </a>) : (<i>Pending update</i>)}
            </Descriptions.Item>

            <Descriptions.Item label="Environment Spec">
                {renderField(model.environment_spec)}
            </Descriptions.Item>

            <Descriptions.Item label="Baseline Metrics">
                {model.baseline_metrics ? JSON.stringify(model.baseline_metrics) : <i>Pending update</i>}
            </Descriptions.Item>

            <Descriptions.Item label="Example I/O">
                {renderField(model.example_io)}
            </Descriptions.Item>

            <Descriptions.Item label="Compliance Docs">
                {model.compliance_docs?.length > 0 ? model.compliance_docs.map((u, i) => (<div key={i}>
                    <a href={u} target="_blank" rel="noreferrer">
                        {u}
                    </a>
                </div>)) : <i>Pending update</i>}
            </Descriptions.Item>

            <Descriptions.Item label="Business Tags">
                {model.business_tags?.length > 0 ? model.business_tags.join(', ') : <i>Pending update</i>}
            </Descriptions.Item>

            <Descriptions.Item label="Owner Contact">
                {renderField(model.owner_contact)}
            </Descriptions.Item>

            <Descriptions.Item label="License">
                {renderField(model.license)}
            </Descriptions.Item>

            <Descriptions.Item label="Dataset Dependencies">
                {renderField(model.dataset_dependencies)}
            </Descriptions.Item>

            <Descriptions.Item label="Additional Notes">
                {renderField(model.additional_notes)}
            </Descriptions.Item>
        </Descriptions>

        <Button
            type="primary"
            onClick={() => navigate(`/edit/${id}`)}
            style={{marginTop: 16}}
        >
            Edit
        </Button>
    </div>);
}
