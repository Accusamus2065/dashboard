// frontend/src/pages/EditPage.jsx
import React, {useEffect, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {
    Form, Input, Button, Select, Upload, message, Typography, Space, InputNumber
} from 'antd';
import {UploadOutlined} from '@ant-design/icons';
import {useNavigate, useParams} from 'react-router-dom';
import api from '../services/api';
import {SCHEMA_MODES, RISK_LEVELS, LICENSES} from '../constants/constant';

const {Title} = Typography;
const {Option} = Select;

export default function EditPage() {
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const {id} = useParams();

    const [artifactFiles, setArtifactFiles] = useState([]);
    const [readmeFile, setReadmeFile] = useState([]);
    const [complianceFiles, setComplianceFiles] = useState([]);
    const [trainingFiles, setTrainingFiles] = useState([]);
    const [validationFiles, setValidationFiles] = useState([]);

    useEffect(() => {
        api.get(`/models/${id}`)
            .then(res => {
                const m = res.data;
                form.setFieldsValue({
                    name: m.name,
                    version: m.version,
                    description: m.description,
                    input_schema: m.input_schema,
                    risk_level: m.risk_level,
                    baseline_latency_ms: m.baseline_latency_ms ?? null,
                    baseline_accuracy: m.baseline_accuracy ?? null,
                    baseline_f1: m.baseline_f1 ?? null,
                    baseline_auc: m.baseline_auc ?? null,
                    business_tags: m.business_tags || [],
                    owner_contact: m.owner_contact || '',
                    license: m.license || undefined,
                });
            })
            .catch(() => message.error('Failed to load model'));
    }, [id]);

    const onFinish = async (values) => {
        const data = new FormData();

        const simpleFields = [
            'name', 'version', 'description', 'input_schema', 'risk_level',
            'owner_contact', 'license',
            'baseline_latency_ms', 'baseline_accuracy', 'baseline_f1', 'baseline_auc'
        ];
        simpleFields.forEach(k => {
            if (values[k] !== undefined && values[k] !== null && values[k] !== '') {
                data.append(k, values[k]);
            }
        });

        if (Array.isArray(values.business_tags)) {
            data.append('business_tags', JSON.stringify(values.business_tags));
        }

        // Files (only send if user selected new ones)
        artifactFiles.forEach(f => data.append('files', f.originFileObj));
        if (readmeFile[0]?.originFileObj) data.append('readme', readmeFile[0].originFileObj);
        complianceFiles.forEach(f => data.append('compliance_docs', f.originFileObj));
        trainingFiles.forEach(f => data.append('training_data', f.originFileObj));
        validationFiles.forEach(f => data.append('validation_data', f.originFileObj));

        try {
            await api.put(`/models/${id}`, data, {headers: {'Content-Type': 'multipart/form-data'}});
            message.success('Model updated');
            navigate(`/view/${id}`);
        } catch (e) {
            message.error(e.response?.data?.error || 'Update failed');
        }
    };

    return (
        <div style={{padding: 24, maxWidth: 720}}>
            <Title level={2}>Edit Model #{id}</Title>
            <Form layout="vertical" form={form} onFinish={onFinish}>
                <Form.Item name="name" label="Name *" rules={[{required: true}]}>
                    <Input id="name" placeholder="Model Name"/>
                </Form.Item>

                <Form.Item name="version" label="Version *" rules={[{required: true}]}>
                    <Input id="version" placeholder="e.g. v1.0.0"/>
                </Form.Item>

                <Form.Item name="description" label="Brief Description *" rules={[{required: true}]}>
                    <Input.TextArea id="description" rows={3}/>
                </Form.Item>

                <Form.Item name="input_schema" label="Input Schema *" rules={[{required: true}]}>
                    <Select id="input_schema">
                        {SCHEMA_MODES.map(m => <Option key={m} value={m}>{m}</Option>)}
                    </Select>
                </Form.Item>

                <Form.Item name="risk_level" label="Risk *" rules={[{required: true}]}>
                    <Select id="risk_level">
                        {RISK_LEVELS.map(r => <Option key={r} value={r}>{r}</Option>)}
                    </Select>
                </Form.Item>

                {/* Replace artifact (optional) */}
                <Form.Item name="files" label="Replace Model File(s)">
                    <Upload
                        id="files"
                        name="files"
                        multiple
                        accept=".onnx,.pkl,.pt,.pth,.h5,.pb,.joblib"
                        beforeUpload={() => false}
                        onChange={info => setArtifactFiles(info.fileList)}
                        fileList={artifactFiles}
                    >
                        <Button icon={<UploadOutlined/>}>Select Model Files</Button>
                    </Upload>
                </Form.Item>

                {/* README replace */}
                <Form.Item name="readme" label="Replace README">
                    <Upload
                        id="readme"
                        name="readme"
                        accept=".md,.txt"
                        maxCount={1}
                        beforeUpload={() => false}
                        onChange={info => setReadmeFile(info.fileList.slice(-1))}
                        fileList={readmeFile}
                    >
                        <Button icon={<UploadOutlined/>}>Select README</Button>
                    </Upload>
                </Form.Item>

                {/* Baseline metrics */}
                <Form.Item label="Baseline Metrics">
                    <Space wrap>
                        <Form.Item name="baseline_latency_ms" label="Latency (ms)" style={{marginBottom: 0}}>
                            <InputNumber id="baseline_latency_ms" min={0} step={1} placeholder="e.g. 12"/>
                        </Form.Item>
                        <Form.Item name="baseline_accuracy" label="Accuracy" style={{marginBottom: 0}}>
                            <InputNumber id="baseline_accuracy" min={0} max={1} step={0.0001} placeholder="0~1"/>
                        </Form.Item>
                        <Form.Item name="baseline_f1" label="F1" style={{marginBottom: 0}}>
                            <InputNumber id="baseline_f1" min={0} max={1} step={0.0001} placeholder="0~1"/>
                        </Form.Item>
                        <Form.Item name="baseline_auc" label="AUC" style={{marginBottom: 0}}>
                            <InputNumber id="baseline_auc" min={0} max={1} step={0.0001} placeholder="0~1"/>
                        </Form.Item>
                    </Space>
                </Form.Item>

                {/* Compliance docs */}
                <Form.Item name="compliance_docs" label="Compliance Docs (upload multiple)">
                    <Upload
                        id="compliance_docs"
                        name="compliance_docs"
                        multiple
                        accept=".pdf,.doc,.docx,.txt,.md"
                        beforeUpload={() => false}
                        onChange={info => setComplianceFiles(info.fileList)}
                        fileList={complianceFiles}
                    >
                        <Button icon={<UploadOutlined/>}>Select Docs</Button>
                    </Upload>
                </Form.Item>

                {/* Business tags */}
                <Form.Item name="business_tags" label="Business Tags">
                    <Select
                        id="business_tags"
                        mode="tags"
                        tokenSeparators={[',']}
                        placeholder="Type tag and press Enter or comma"
                    />
                </Form.Item>

                {/* Owner contact */}
                <Form.Item name="owner_contact" label="Owner Contact">
                    <Input id="owner_contact" placeholder="Name and email" autoComplete="name email"/>
                </Form.Item>

                {/* License */}
                <Form.Item name="license" label="License">
                    <Select id="license" placeholder="Select license" allowClear>
                        {LICENSES.map(l => (
                            <Option key={l.value} value={l.value}>
                                {l.label} ({l.value})
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                {/* Dataset dependencies */}
                <Form.Item name="training_data" label="Training Data (upload multiple)">
                    <Upload
                        id="training_data"
                        name="training_data"
                        multiple
                        accept=".csv,.json,.parquet,.zip"
                        beforeUpload={() => false}
                        onChange={info => setTrainingFiles(info.fileList)}
                        fileList={trainingFiles}
                    >
                        <Button icon={<UploadOutlined/>}>Select Training Data</Button>
                    </Upload>
                </Form.Item>

                <Form.Item name="validation_data" label="Validation Data (upload multiple)">
                    <Upload
                        id="validation_data"
                        name="validation_data"
                        multiple
                        accept=".csv,.json,.parquet,.zip"
                        beforeUpload={() => false}
                        onChange={info => setValidationFiles(info.fileList)}
                        fileList={validationFiles}
                    >
                        <Button icon={<UploadOutlined/>}>Select Validation Data</Button>
                    </Upload>
                </Form.Item>

                <Form.Item>
                    <Space>
                        <Button type="primary" htmlType="submit">Save</Button>
                        <Button onClick={() => navigate(-1)}>Cancel</Button>
                    </Space>
                </Form.Item>
            </Form>
        </div>
    );
}
