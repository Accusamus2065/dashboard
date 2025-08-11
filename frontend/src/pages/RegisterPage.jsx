// frontend/src/pages/RegisterPage.jsx
import React from 'react';
import '@ant-design/v5-patch-for-react-19';
import {Form, Input, Button, Typography, Space, Select, message} from 'antd';
import {useNavigate} from 'react-router-dom';
import api from '../services/api';
import {SECURITY_QUESTION_BANK} from '../constants/constant';

const {Title} = Typography;
const {Option} = Select;

export default function RegisterPage() {
    const [form] = Form.useForm();
    const navigate = useNavigate();

    const onFinish = async (values) => {
        const payload = {
            email: values.email,
            password: values.password,
            security_questions: [
                {question: values.q1, answer: values.a1},
                {question: values.q2, answer: values.a2},
                {question: values.q3, answer: values.a3},
            ].filter(x => x.question && x.answer),
        };
        try {
            await api.post('/auth/register', payload);
            message.success('Registered, please login');
            navigate('/login');
        } catch (e) {
            message.error(e.response?.data?.error || 'Register failed');
        }
    };

    return (
        <div style={{padding: 24, maxWidth: 520, margin: '0 auto'}}>
            <Title level={3}>Register</Title>
            <Form form={form} layout="vertical" onFinish={onFinish}>
                <Form.Item name="email" label="Email" rules={[{required: true, type: 'email'}]}>
                    <Input id="email" name="email" autoComplete="email"/>
                </Form.Item>
                <Form.Item name="password" label="Password" rules={[{required: true, min: 6}]}>
                    <Input.Password id="password" name="password" autoComplete="new-password"/>
                </Form.Item>

                <Space direction="vertical" size="small" style={{width: '100%'}}>
                    <Title level={5} style={{marginTop: 8}}>Security Questions</Title>

                    {/* Q1 */}
                    <Form.Item label="Question 1" required>
                        <Input.Group compact>
                            <Form.Item name="q1" noStyle rules={[{required: true}]}>
                                <Select style={{width: '100%'}} placeholder="Select your question">
                                    {SECURITY_QUESTION_BANK.map(q => <Option key={q} value={q}>{q}</Option>)}
                                </Select>
                            </Form.Item>
                        </Input.Group>
                    </Form.Item>
                    <Form.Item name="a1" label="Answer 1" rules={[{required: true}]}>
                        <Input id="a1" name="a1" autoComplete="off"/>
                    </Form.Item>

                    {/* Q2 */}
                    <Form.Item label="Question 2" required>
                        <Input.Group compact>
                            <Form.Item name="q2" noStyle rules={[{required: true}]}>
                                <Select style={{width: '100%'}} placeholder="Select your question" showSearch
                                        allowClear>
                                    {SECURITY_QUESTION_BANK.map(q => <Option key={q} value={q}>{q}</Option>)}
                                </Select>
                            </Form.Item>
                        </Input.Group>
                    </Form.Item>
                    <Form.Item name="a2" label="Answer 2" rules={[{required: true}]}>
                        <Input id="a2" name="a2" autoComplete="off"/>
                    </Form.Item>

                    {/* Q3 */}
                    <Form.Item label="Question 3" required>
                        <Input.Group compact>
                            <Form.Item name="q3" noStyle rules={[{required: true}]}>
                                <Select style={{width: '100%'}} placeholder="Select your question" showSearch
                                        allowClear>
                                    {SECURITY_QUESTION_BANK.map(q => <Option key={q} value={q}>{q}</Option>)}
                                </Select>
                            </Form.Item>
                        </Input.Group>
                    </Form.Item>
                    <Form.Item name="a3" label="Answer 3" rules={[{required: true}]}>
                        <Input id="a3" name="a3" autoComplete="off"/>
                    </Form.Item>
                </Space>

                <Form.Item style={{marginTop: 12}}>
                    <Space>
                        <Button type="primary" htmlType="submit">Register</Button>
                        <Button onClick={() => navigate('/login')}>Back to Login</Button>
                    </Space>
                </Form.Item>
            </Form>
        </div>
    );
}
