// frontend/src/pages/LoginPage.jsx
import React from 'react';
import '@ant-design/v5-patch-for-react-19';
import {Button, Card, Form, Input, Typography, message} from 'antd';
import {useNavigate, Link} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext.jsx';
import styles from './LoginPage.module.css';

const {Title, Text} = Typography;

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
        <div className={styles.wrapper}>
            <Card className={`${styles.card} ${styles.fadeIn}`} bordered={false}>
                <header className={styles.header}>
                    <div className={styles.logoWrap} aria-hidden>
                        <span className={styles.logoGlow}/>
                        {/* Lock icon for clearer auth context */}
                        <svg className={styles.logoSvg} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path
                                d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Zm3 4a1.75 1.75 0 0 1 1 3.2V19a1 1 0 1 1-2 0v-1.8A1.75 1.75 0 0 1 12 14Z"/>
                        </svg>
                    </div>
                    <Title level={3} style={{margin: 0}}>Sign in</Title>
                    <Text className={styles.subtitle}>Welcome back — let’s get you in</Text>
                </header>

                <Form layout="vertical" onFinish={onFinish} className={styles.form} size="large">
                    <Form.Item
                        name="email"
                        label="Email"
                        rules={[{required: true, message: 'Please enter your email'}, {type: 'email'}]}
                    >
                        <Input autoComplete="email" placeholder="you@example.com"/>
                    </Form.Item>

                    <Form.Item
                        name="password"
                        label="Password"
                        rules={[{required: true, message: 'Please enter your password'}]}
                    >
                        <Input.Password autoComplete="current-password" placeholder="••••••••"/>
                    </Form.Item>

                    <Form.Item className={styles.submitBtn}>
                        <Button type="primary" htmlType="submit" block>
                            Login
                        </Button>
                    </Form.Item>

                    <div className={styles.metaRow}>
                        <span>No account?</span>
                        <Link to="/register">Register</Link>
                    </div>

                    <div className={styles.helper}>
                        <Button type="link" onClick={() => navigate('/forgot')}>
                            Forgot password?
                        </Button>
                    </div>
                </Form>
            </Card>
        </div>
    );
}
