// frontend/src/pages/LoginPage.jsx
import React from 'react';
import '@ant-design/v5-patch-for-react-19';
import {Button, Card, Form, Input, Typography, Space, message} from 'antd';
import {useNavigate, Link} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext.jsx';

const {Title} = Typography;

export default function LoginPage() {
    const {login} = useAuth();
    const navigate = useNavigate();

    const onFinish = async (v) => {
        try {
            await login(v.email, v.password);
            navigate('/');
        } catch (e) {
            message.error(e.response?.data?.error || 'Login failed');
        }
    };

    return (
        <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24}}>
            <Card style={{width: 360}}>
                <Title level={3} style={{textAlign: 'center'}}>Sign in</Title>
                <Form layout="vertical" onFinish={onFinish}>
                    <Form.Item name="email" label="Email" rules={[{required: true}, {type: 'email'}]}>
                        <Input autoComplete="email"/>
                    </Form.Item>
                    <Form.Item name="password" label="Password" rules={[{required: true}]}>
                        <Input.Password autoComplete="current-password"/>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block>Login</Button>
                    </Form.Item>
                    <Space style={{width: '100%', justifyContent: 'center'}}>
                        <span>No account?</span>
                        <Link to="/register">Register</Link>
                    </Space>
                </Form>
                <Button type="link" onClick={() => navigate('/forgot')}>Forgot password?</Button>
            </Card>
        </div>
    );
}
