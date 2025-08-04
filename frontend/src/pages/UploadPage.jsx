// frontend/src/pages/UploadPage.jsx
import React from 'react';
import {Form, Input, Button, Select, Upload, message, Typography} from 'antd';
import {UploadOutlined} from '@ant-design/icons';
import {useNavigate} from 'react-router-dom';
import api from '../services/api';

const {Title} = Typography;
const {Option} = Select;

export default function UploadPage() {
    const [form] = Form.useForm();
    const navigate = useNavigate();

    const onFinish = async (values) => {
        const fileList = values.file;
        const file = fileList[0].originFileObj;

        const data = new FormData();
        data.append('name', values.name);
        data.append('version', values.version);
        data.append('risk_level', values.risk_level);
        data.append('file', file);

        try {
            await api.post('/models', data, {
                headers: {'Content-Type': 'multipart/form-data'},
            });
            message.success('Upload successful!');
            navigate('/');
        } catch (err) {
            message.error('Upload failed.');
            console.error(err);
        }
    };

    return (
        <div style={{padding: 24, maxWidth: 500}}>
            <Title level={2}>Upload Model</Title>
            <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
            >
                <Form.Item
                    name="name"
                    label="Model Name"
                    rules={[{required: true, message: 'Please input the model name'}]}
                >
                    <Input/>
                </Form.Item>

                <Form.Item
                    name="version"
                    label="Version"
                    rules={[{required: true, message: 'Please input the version'}]}
                >
                    <Input/>
                </Form.Item>

                <Form.Item
                    name="risk_level"
                    label="Risk Level"
                    initialValue="medium"
                >
                    <Select>
                        <Option value="low">Low</Option>
                        <Option value="medium">Medium</Option>
                        <Option value="high">High</Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    name="file"
                    label="Model File"
                    valuePropName="fileList"
                    getValueFromEvent={e => e.fileList}
                    rules={[
                        {required: true, message: 'Please upload a model file (.onnx or .pkl)'},
                        {
                            validator: (_, fileList) => {
                                if (fileList && fileList.length > 0) return Promise.resolve();
                                return Promise.reject(new Error());
                            }
                        }
                    ]}
                >
                    <Upload
                        beforeUpload={() => false}
                        maxCount={1}
                        accept=".onnx,.pkl"
                        listType="text"
                        onExceed={() => {
                            message.error('You can only upload one file');
                        }}
                    >
                        <Button icon={<UploadOutlined/>}>Select File</Button>
                    </Upload>
                </Form.Item>

                <Form.Item>
                    <Button type="primary" htmlType="submit">
                        Upload
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
}
