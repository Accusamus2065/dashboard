// frontend/src/pages/UploadPage.jsx
import React, {useState} from 'react';
import '@ant-design/v5-patch-for-react-19'
import {
    Form, Input, Button, Select, Upload, message, Typography, Space
} from 'antd';
import {UploadOutlined} from '@ant-design/icons';
import {useNavigate} from 'react-router-dom';
import api from '../services/api';

import {SCHEMA_MODES, RISK_LEVELS, LICENSES} from '../constants/constant';

const {Title} = Typography;
const {Option} = Select;

export default function UploadPage() {
    const [fileList, setFileList] = useState([]);
    const [form] = Form.useForm();
    const navigate = useNavigate();

    const onFinish = async (values) => {
        const data = new FormData();
        Object.entries(values).forEach(([k, v]) => {
            if (v != null) {
                if (['baseline_metrics', 'compliance_docs', 'business_tags'].includes(k)) {
                    data.append(k, JSON.stringify(v));
                } else {
                    data.append(k, v);
                }
            }
        });
        fileList.forEach(f => data.append('files', f.originFileObj));

        try {
            await api.post('/models', data, {headers: {'Content-Type': 'multipart/form-data'}});
            message.success('Model uploaded');
            navigate('/');
        } catch (err) {
            message.error(err.response?.data?.error || 'Upload failed');
        }
    };

    return (<div style={{padding: 24, maxWidth: 600}}>
        <Title level={2}>Upload Model</Title>
        <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{input_schema: SCHEMA_MODES[0], risk_level: RISK_LEVELS[1]}}
        >
            <Form.Item name="name" label="Name *" rules={[{required: true}]}>
                <Input/>
            </Form.Item>
            <Form.Item name="version" label="Version *" rules={[{required: true}]}>
                <Input placeholder="e.g. v1.0.0"/>
            </Form.Item>
            <Form.Item name="description" label="Brief Description *" rules={[{required: true}]}>
                <Input.TextArea rows={3}/>
            </Form.Item>
            <Form.Item name="input_schema" label="Input Schema *" rules={[{required: true}]}>
                <Select>
                    {SCHEMA_MODES.map(m => <Option key={m} value={m}>{m}</Option>)}
                </Select>
            </Form.Item>
            <Form.Item name="risk_level" label="Risk *" rules={[{required: true}]}>
                <Select>
                    {RISK_LEVELS.map(r => <Option key={r} value={r}>{r}</Option>)}
                </Select>
            </Form.Item>

            {/* 可选字段组 */}
            <Form.Item name="environment_spec" label="Environment Spec">
                <Input.TextArea rows={2} placeholder="e.g. Python packages or requirements.txt"/>
            </Form.Item>
            <Form.Item name="baseline_metrics" label="Baseline Metrics (JSON)">
                <Input.TextArea rows={2} placeholder='e.g. {"latency": 10, "accuracy": 0.95}'/>
            </Form.Item>
            <Form.Item name="example_io" label="Example I/O">
                <Input.TextArea rows={2} placeholder="示例输入输出"/>
            </Form.Item>
            <Form.Item name="compliance_docs" label="Compliance Docs (JSON array)">
                <Input.TextArea rows={2} placeholder='e.g. ["url1","url2"]'/>
            </Form.Item>
            <Form.Item name="business_tags" label="Business Tags (JSON array)">
                <Input.TextArea rows={2} placeholder='e.g. ["finance","health"]'/>
            </Form.Item>
            <Form.Item name="owner_contact" label="Owner Contact">
                <Input placeholder="Name and email"/>
            </Form.Item>
            <Form.Item name="license" label="License">
                <Select allowClear placeholder="Select license">
                    {LICENSES.map(l => <Option key={l} value={l}>{l}</Option>)}
                </Select>
            </Form.Item>
            <Form.Item name="dataset_dependencies" label="Dataset Dependencies">
                <Input.TextArea rows={2} placeholder="Training/validation data info or links"/>
            </Form.Item>
            <Form.Item name="additional_notes" label="Additional Notes">
                <Input.TextArea rows={2}/>
            </Form.Item>

            <Form.Item label="Model File(s) *" rules={[{required: true}]}>
                <Upload
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
                    <Button type="primary" htmlType="submit">Submit</Button>
                    <Button onClick={() => navigate(-1)}>Cancel</Button>
                </Space>
            </Form.Item>
        </Form>
    </div>);
}
