// frontend/src/pages/ForgotPasswordPage.jsx
import React, {useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {Form, Input, Button, Typography, Space, message, Alert} from 'antd';
import api from '../services/api';
import {useNavigate} from 'react-router-dom';

const {Title} = Typography;

export default function ForgotPasswordPage() {
    const [form] = Form.useForm();
    const [email, setEmail] = useState('');
    const [questions, setQuestions] = useState([]);
    const [stage, setStage] = useState(1); // 1=enter email, 2=answer & reset
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const fetchQuestions = async () => {
        if (!email) return message.error('Please enter email');
        setLoading(true);
        try {
            const res = await api.get('/auth/security-questions', {params: {email}});
            setQuestions(res.data?.questions || []);
            setStage(2);
            message.success('Security questions loaded');
        } catch (e) {
            const msg = e.response?.data?.error || 'This account does not support password recovery.';
            message.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const onReset = async (values) => {
        const answers = questions.map((q, i) => ({
            question: q.question,
            answer: values[`ans_${i}`]
        }));
        try {
            await api.post('/auth/reset-with-qa', {email, answers, new_password: values.new_password});
            message.success('Password reset, please login');
            navigate('/login');
        } catch (e) {
            message.error(e.response?.data?.error || 'Reset failed');
        }
    };

    return (
        <div style={{padding: 24, maxWidth: 560, margin: '0 auto'}}>
            <Title level={3}>Forgot Password</Title>

            {stage === 1 && (
                <Space direction="vertical" size="middle" style={{width: '100%'}}>
                    <Alert type="info" showIcon message="Enter your email to load your security questions."/>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="Email"
                        autoComplete="email"
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <Button type="primary" onClick={fetchQuestions} loading={loading}>Get Questions</Button>
                </Space>
            )}

            {stage === 2 && (
                <Form layout="vertical" form={form} onFinish={onReset}>
                    <Alert
                        type="success"
                        showIcon
                        message={`Loaded ${questions.length} question(s) for ${email}`}
                        style={{marginBottom: 12}}
                    />
                    {questions.map((q, i) => (
                        <Form.Item
                            key={i}
                            name={`ans_${i}`}
                            label={q.question}
                            rules={[{required: true, message: 'Please answer this question'}]}
                        >
                            <Input autoComplete="off"/>
                        </Form.Item>
                    ))}
                    <Form.Item name="new_password" label="New Password" rules={[{required: true, min: 6}]}>
                        <Input.Password autoComplete="new-password"/>
                    </Form.Item>
                    <Space>
                        <Button onClick={() => {
                            setStage(1);
                            setQuestions([]);
                        }}>Back</Button>
                        <Button type="primary" htmlType="submit">Reset Password</Button>
                    </Space>
                </Form>
            )}
        </div>
    );
}
