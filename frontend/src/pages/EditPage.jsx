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

    // Load existing model data
    useEffect(() => {
        api.get(`/models/${id}`)
            .then(res => {
                form.setFieldsValue({
                    name: res.data.name,
                    version: res.data.version,
                    description: res.data.description,
                    input_schema: res.data.input_schema,
                    risk_level: res.data.risk_level,
                    environment_spec: res.data.environment_spec,
                    baseline_metrics: res.data.baseline_metrics ? JSON.stringify(res.data.baseline_metrics) : '',
                    example_io: res.data.example_io,
                    compliance_docs: res.data.compliance_docs ? JSON.stringify(res.data.compliance_docs) : '',
                    business_tags: res.data.business_tags ? JSON.stringify(res.data.business_tags) : '',
                    owner_contact: res.data.owner_contact,
                    license: res.data.license,
                    dataset_dependencies: res.data.dataset_dependencies,
                    additional_notes: res.data.additional_notes
                });
            })
            .catch(() => message.error('Failed to load model'));
    }, [id]);

    const onFinish = async values => {
        const data = new FormData();
        Object.entries(values).forEach(([key, value]) => {
            if (value != null) {
                if (['baseline_metrics', 'compliance_docs', 'business_tags'].includes(key)) {
                    data.append(key, value);
                } else {
                    data.append(key, value);
                }
            }
        });
        fileList.forEach(f => data.append('files', f.originFileObj));

        try {
            await api.put(`/models/${id}`, data, {
                headers: {'Content-Type': 'multipart/form-data'}
            });
            message.success('Model updated');
            navigate(`/view/${id}`);
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
                <Form.Item
                    name="name"
                    label="Name *"
                    rules={[{required: true}]}
                >
                    <Input
                        id="name"
                        name="name"
                        autoComplete="on"
                        placeholder="Model Name"
                    />
                </Form.Item>

                <Form.Item
                    name="version"
                    label="Version *"
                    rules={[{required: true}]}
                >
                    <Input
                        id="version"
                        name="version"
                        autoComplete="off"
                        placeholder="e.g. v1.0.0"
                    />
                </Form.Item>

                <Form.Item
                    name="description"
                    label="Brief Description *"
                    rules={[{required: true}]}
                >
                    <Input.TextArea
                        id="description"
                        name="description"
                        autoComplete="off"
                        rows={3}
                    />
                </Form.Item>

                <Form.Item
                    name="input_schema"
                    label="Input Schema *"
                    rules={[{required: true}]}
                >
                    <Select
                        id="input_schema"
                        name="input_schema"
                        autoComplete="off"
                    >
                        {SCHEMA_MODES.map(m => (<Option key={m} value={m}>{m}</Option>))}
                    </Select>
                </Form.Item>

                <Form.Item
                    name="risk_level"
                    label="Risk *"
                    rules={[{required: true}]}
                >
                    <Select
                        id="risk_level"
                        name="risk_level"
                        autoComplete="off"
                    >
                        {RISK_LEVELS.map(r => (<Option key={r} value={r}>{r}</Option>))}
                    </Select>
                </Form.Item>

                <Form.Item
                    name="environment_spec"
                    label="Environment Spec"
                >
                    <Input.TextArea
                        id="environment_spec"
                        name="environment_spec"
                        autoComplete="off"
                        rows={2}
                        placeholder="e.g. contents of requirements.txt"
                    />
                </Form.Item>

                <Form.Item
                    name="baseline_metrics"
                    label="Baseline Metrics (JSON)"
                >
                    <Input.TextArea
                        id="baseline_metrics"
                        name="baseline_metrics"
                        autoComplete="off"
                        rows={2}
                        placeholder='e.g. {"latency":10,"accuracy":0.95}'
                    />
                </Form.Item>

                <Form.Item
                    name="example_io"
                    label="Example I/O"
                >
                    <Input.TextArea
                        id="example_io"
                        name="example_io"
                        autoComplete="off"
                        rows={2}
                        placeholder="Example inputs and outputs"
                    />
                </Form.Item>

                <Form.Item
                    name="compliance_docs"
                    label="Compliance Docs (JSON array)"
                >
                    <Input.TextArea
                        id="compliance_docs"
                        name="compliance_docs"
                        autoComplete="off"
                        rows={2}
                        placeholder='e.g. ["url1","url2"]'
                    />
                </Form.Item>

                <Form.Item
                    name="business_tags"
                    label="Business Tags (JSON array)"
                >
                    <Input.TextArea
                        id="business_tags"
                        name="business_tags"
                        autoComplete="off"
                        rows={2}
                        placeholder='e.g. ["finance","health"]'
                    />
                </Form.Item>

                <Form.Item
                    name="owner_contact"
                    label="Owner Contact"
                >
                    <Input
                        id="owner_contact"
                        name="owner_contact"
                        autoComplete="name email"
                        placeholder="Name and email"
                    />
                </Form.Item>

                <Form.Item
                    name="license"
                    label="License"
                >
                    <Select
                        id="license"
                        name="license"
                        autoComplete="off"
                        placeholder="Select license"
                        allowClear
                    >
                        {LICENSES.map(l => (<Option key={l} value={l}>{l}</Option>))}
                    </Select>
                </Form.Item>

                <Form.Item
                    name="dataset_dependencies"
                    label="Dataset Dependencies"
                >
                    <Input.TextArea
                        id="dataset_dependencies"
                        name="dataset_dependencies"
                        autoComplete="off"
                        rows={2}
                        placeholder="Training/validation data info or links"
                    />
                </Form.Item>

                <Form.Item
                    name="additional_notes"
                    label="Additional Notes"
                >
                    <Input.TextArea
                        id="additional_notes"
                        name="additional_notes"
                        autoComplete="off"
                        rows={2}
                    />
                </Form.Item>

                <Form.Item
                    name="files"
                    label="Replace Model File(s)"
                >
                    <Upload
                        id="files"
                        name="files"
                        beforeUpload={() => false}
                        onChange={info => setFileList(info.fileList)}
                        fileList={fileList}
                        multiple
                    >
                        <Button icon={<UploadOutlined/>}>Select Model Files</Button>
                    </Upload>
                </Form.Item>

                <Form.Item>
                    <Space>
                        <Button
                            id="submit"
                            name="submit"
                            type="primary"
                            htmlType="submit"
                        >
                            Save
                        </Button>
                        <Button
                            id="cancel"
                            name="cancel"
                            onClick={() => navigate(-1)}
                        >
                            Cancel
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </div>);
}
