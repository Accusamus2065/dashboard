// frontend/src/pages/EditPage.jsx
import React, {useEffect, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {
    Form, Input, Button, Select, Upload, message, Typography, Space
} from 'antd';
import {UploadOutlined} from '@ant-design/icons';
import {useNavigate, useParams} from 'react-router-dom';
import api from '../services/api';
import {SCHEMA_MODES, RISK_LEVELS, LICENSES} from '../constants/constant';

const {Title} = Typography;
const {Option} = Select;

export default function EditPage() {
    const [form] = Form.useForm();
    const [fileList, setFileList] = useState([]);
    const navigate = useNavigate();
    const {id} = useParams();

    // Load existing model data and prefill form + fileList
    useEffect(() => {
        api.get(`/models/${id}`)
            .then(res => {
                const m = res.data;
                // Prefill fields
                form.setFieldsValue({
                    name: m.name,
                    version: m.version,
                    description: m.description,
                    input_schema: m.input_schema,
                    risk_level: m.risk_level,
                    environment_spec: m.environment_spec,
                    baseline_metrics: m.baseline_metrics ? JSON.stringify(m.baseline_metrics) : '',
                    example_io: m.example_io,
                    compliance_docs: m.compliance_docs ? JSON.stringify(m.compliance_docs) : '',
                    business_tags: m.business_tags ? JSON.stringify(m.business_tags) : '',
                    owner_contact: m.owner_contact,
                    license: m.license,
                    dataset_dependencies: m.dataset_dependencies,
                    additional_notes: m.additional_notes
                });
                // Prefill fileList from artifact_uri
                if (m.artifact_uri) {
                    const filename = m.artifact_uri.split('/').pop();
                    setFileList([{
                        uid: '-1', name: filename, status: 'done', url: `http://localhost:3000${m.artifact_uri}`
                    }]);
                }
            })
            .catch(() => message.error('Failed to load model'));
    }, [id]);

    const onFinish = async values => {
        const data = new FormData();
        // Append all form values
        Object.entries(values).forEach(([key, value]) => {
            if (value != null && value !== '') {
                if (['baseline_metrics', 'compliance_docs', 'business_tags'].includes(key)) {
                    data.append(key, value);
                } else {
                    data.append(key, value);
                }
            }
        });
        // Append new file if selected
        fileList.forEach(f => {
            if (f.originFileObj) {
                data.append('files', f.originFileObj);
            }
        });

        try {
            await api.put(`/models/${id}`, data, {
                headers: {'Content-Type': 'multipart/form-data'}
            });
            message.success('Model updated');
            navigate(`/view/${id}`, {replace: true});
        } catch {
            message.error('Update failed');
        }
    };

    return (<div style={{padding: 24, maxWidth: 600}}>
            <Title level={2}>Edit Model #{id}</Title>
            <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
            >
                <Form.Item name="name" label="Name" rules={[{required: true}]}>
                    <Input id="name" name="name" autoComplete="on" placeholder="Model Name"/>
                </Form.Item>

                <Form.Item name="version" label="Version" rules={[{required: true}]}>
                    <Input id="version" name="version" autoComplete="off" placeholder="e.g. v1.0.0"/>
                </Form.Item>

                <Form.Item name="description" label="Brief Description" rules={[{required: true}]}>
                    <Input.TextArea id="description" name="description" rows={3} autoComplete="off"/>
                </Form.Item>

                <Form.Item name="input_schema" label="Input Schema" rules={[{required: true}]}>
                    <Select id="input_schema" name="input_schema" autoComplete="off">
                        {SCHEMA_MODES.map(m => <Option key={m} value={m}>{m}</Option>)}
                    </Select>
                </Form.Item>

                <Form.Item name="risk_level" label="Risk" rules={[{required: true}]}>
                    <Select id="risk_level" name="risk_level" autoComplete="off">
                        {RISK_LEVELS.map(r => <Option key={r} value={r}>{r}</Option>)}
                    </Select>
                </Form.Item>

                <Form.Item name="files" label="Replace Model File(s)">
                    <Upload
                        id="files"
                        name="files"
                        maxCount={1}
                        accept=".onnx,.pt,.pth,.h5,.pb,.pkl,.joblib"
                        action={null}
                        customRequest={({file, onSuccess}) => setTimeout(() => onSuccess(null, file), 0)}
                        beforeUpload={file => {
                            const valid = /\.(onnx|pt|pth|h5|pb|pkl|joblib)$/i.test(file.name);
                            if (!valid) message.error('Allowed: .onnx .pt .pth .h5 .pb .pkl .joblib');
                            return valid;
                        }}
                        onChange={info => setFileList(info.fileList)}
                        fileList={fileList}
                    >
                        <Button icon={<UploadOutlined/>}>Select Model File</Button>
                    </Upload>
                </Form.Item>

                {/* Optional Fields */}
                <Form.Item name="environment_spec" label="Environment Spec">
                    <Input.TextArea
                        id="environment_spec"
                        name="environment_spec"
                        rows={2}
                        autoComplete="off"
                        placeholder="e.g. contents of requirements.txt"
                    />
                </Form.Item>

                <Form.Item name="baseline_metrics" label="Baseline Metrics (JSON)">
                    <Input.TextArea
                        id="baseline_metrics"
                        name="baseline_metrics"
                        rows={2}
                        autoComplete="off"
                        placeholder='e.g. {"latency":10,"accuracy":0.95}'
                    />
                </Form.Item>

                <Form.Item name="example_io" label="Example I/O">
                    <Input.TextArea
                        id="example_io"
                        name="example_io"
                        rows={2}
                        autoComplete="off"
                        placeholder="Example inputs and outputs"
                    />
                </Form.Item>

                <Form.Item name="compliance_docs" label="Compliance Docs (JSON array)">
                    <Input.TextArea
                        id="compliance_docs"
                        name="compliance_docs"
                        rows={2}
                        autoComplete="off"
                        placeholder='e.g. ["url1","url2"]'
                    />
                </Form.Item>

                <Form.Item name="business_tags" label="Business Tags (JSON array)">
                    <Input.TextArea
                        id="business_tags"
                        name="business_tags"
                        rows={2}
                        autoComplete="off"
                        placeholder='e.g. ["finance","health"]'
                    />
                </Form.Item>

                <Form.Item name="owner_contact" label="Owner Contact">
                    <Input
                        id="owner_contact"
                        name="owner_contact"
                        autoComplete="name email"
                        placeholder="Name and email"
                    />
                </Form.Item>

                <Form.Item name="license" label="License">
                    <Select id="license" name="license" autoComplete="off" allowClear placeholder="Select license">
                        {LICENSES.map(l => <Option key={l} value={l}>{l}</Option>)}
                    </Select>
                </Form.Item>

                <Form.Item name="dataset_dependencies" label="Dataset Dependencies">
                    <Input.TextArea
                        id="dataset_dependencies"
                        name="dataset_dependencies"
                        rows={2}
                        autoComplete="off"
                        placeholder="Training/validation data info or links"
                    />
                </Form.Item>

                <Form.Item name="additional_notes" label="Additional Notes">
                    <Input.TextArea id="additional_notes" name="additional_notes" rows={2} autoComplete="off"/>
                </Form.Item>

                <Form.Item>
                    <Space>
                        <Button id="submit" name="submit" type="primary" htmlType="submit">Save</Button>
                        <Button id="cancel" name="cancel" onClick={() => navigate(-1)}>Cancel</Button>
                    </Space>
                </Form.Item>
            </Form>
        </div>);
}
