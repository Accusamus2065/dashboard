// frontend/src/pages/LoginPage.jsx
import React from 'react';
import '@ant-design/v5-patch-for-react-19';
import {Button, Card, Form, Input, Typography, message} from 'antd';
import {useNavigate, Link} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';

const {Title} = Typography;

export default function RegisterPage() {
    const {register} = useAuth();
    const navigate = useNavigate();

    const onFinish = async (v) => {
        try {
            await register(v.email, v.password);
            navigate('/login');
        } catch (e) {
            message.error(e.response?.data?.error || 'Register failed');
        }
    };

    return (
        <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24}}>
            <Card style={{width: 360}}>
                <Title level={3} style={{textAlign: 'center'}}>Create account</Title>
                <Form layout="vertical" onFinish={onFinish}>
                    <Form.Item name="email" label="Email" rules={[{required: true}, {type: 'email'}]}>
                        <Input autoComplete="email"/>
                    </Form.Item>
                    <Form.Item name="password" label="Password" rules={[{required: true, min: 6}]}>
                        <Input.Password autoComplete="new-password"/>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block>Register</Button>
                    </Form.Item>
                    <div style={{textAlign: 'center'}}>
                        <Link to="/login">Back to login</Link>
                    </div>
                </Form>
            </Card>
        </div>
    );
}
