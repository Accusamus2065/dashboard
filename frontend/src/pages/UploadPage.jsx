// frontend/src/pages/UploadPage.jsx
import React, {useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {
    Form, Input, Button, Select, Upload, message, Typography, Space, InputNumber
} from 'antd';
import {UploadOutlined} from '@ant-design/icons';
import {useNavigate} from 'react-router-dom';
import api from '../services/api';
import {SCHEMA_MODES, RISK_LEVELS, LICENSES} from '../constants/constant';

const {Title} = Typography;
const {Option} = Select;

export default function UploadPage() {
    const [form] = Form.useForm();
    const navigate = useNavigate();

    // Separate file lists for different fields
    const [artifactFiles, setArtifactFiles] = useState([]);
    const [readmeFile, setReadmeFile] = useState([]);
    const [complianceFiles, setComplianceFiles] = useState([]);
    const [trainingFiles, setTrainingFiles] = useState([]);
    const [validationFiles, setValidationFiles] = useState([]);

    const onFinish = async (values) => {
        const data = new FormData();

        // Basic fields
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

        // Business tags (array) -> JSON string
        if (Array.isArray(values.business_tags)) {
            data.append('business_tags', JSON.stringify(values.business_tags));
        }

        // Files
        artifactFiles.forEach(f => data.append('files', f.originFileObj));
        if (readmeFile[0]?.originFileObj) data.append('readme', readmeFile[0].originFileObj);
        complianceFiles.forEach(f => data.append('compliance_docs', f.originFileObj));
        trainingFiles.forEach(f => data.append('training_data', f.originFileObj));
        validationFiles.forEach(f => data.append('validation_data', f.originFileObj));

        try {
            await api.post('/models', data, {
                headers: {'Content-Type': 'multipart/form-data'}
            });
            message.success('Model created');
            navigate('/');
        } catch (e) {
            message.error(e.response?.data?.error || 'Create failed');
        }
    };

    return (
        <div style={{padding: 24, maxWidth: 720}}>
            <Title level={2}>Upload Model</Title>

            <Form
                layout="vertical"
                form={form}
                onFinish={onFinish}
                initialValues={{input_schema: SCHEMA_MODES[0], risk_level: RISK_LEVELS[1]}}
            >
                <Form.Item name="name" label="Name *" rules={[{required: true}]}>
                    <Input id="name" name="name" placeholder="Model Name" autoComplete="on"/>
                </Form.Item>

                <Form.Item name="version" label="Version *" rules={[{required: true}]}>
                    <Input id="version" name="version" placeholder="e.g. v1.0.0" autoComplete="off"/>
                </Form.Item>

                <Form.Item name="description" label="Brief Description *" rules={[{required: true}]}>
                    <Input.TextArea id="description" name="description" rows={3}/>
                </Form.Item>

                <Form.Item name="input_schema" label="Input Schema *" rules={[{required: true}]}>
                    <Select id="input_schema" name="input_schema">
                        {SCHEMA_MODES.map(m => <Option key={m} value={m}>{m}</Option>)}
                    </Select>
                </Form.Item>

                <Form.Item name="risk_level" label="Risk *" rules={[{required: true}]}>
                    <Select id="risk_level" name="risk_level">
                        {RISK_LEVELS.map(r => <Option key={r} value={r}>{r}</Option>)}
                    </Select>
                </Form.Item>

                {/* Artifact files (required) */}
                <Form.Item
                    name="files"
                    label="Model File(s) *"
                    rules={[{required: true, message: 'Please select at least one model file'}]}
                >
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

                {/* README single file */}
                <Form.Item name="readme" label="README (Markdown/Text)">
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

                {/* Baseline metrics (numbers) */}
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

                {/* Compliance docs multi files */}
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

                {/* Business tags as tags input */}
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

                {/* License single select */}
                <Form.Item name="license" label="License">
                    <Select id="license" placeholder="Select license" allowClear>
                        {LICENSES.map(l => (
                            <Option key={l.value} value={l.value}>
                                {l.label} ({l.value})
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                {/* Dataset dependencies: training & validation files */}
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
                        <Button type="primary" htmlType="submit">Submit</Button>
                        <Button onClick={() => navigate(-1)}>Cancel</Button>
                    </Space>
                </Form.Item>
            </Form>
        </div>
    );
}
