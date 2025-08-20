// frontend/src/pages/LoginPage.jsx
import React, {useEffect, useLayoutEffect, useRef} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {Button, Card, Form, Input, Typography, message} from 'antd';
import {useNavigate, Link} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext.jsx';
import styles from './LoginPage.module.css';

const {Title, Text} = Typography;

export default function LoginPage() {
    const {login} = useAuth();
    const navigate = useNavigate();

    // AntD form + watch
    const [form] = Form.useForm();
    const emailValue = Form.useWatch('email', form) || '';
    const passwordValue = Form.useWatch('password', form) || '';

    const emailLabelRef = useRef(null);
    const emailBoxRef = useRef(null);
    const pwdLabelRef = useRef(null);
    const pwdBoxRef = useRef(null);

    const applyGap = () => {
        const pad = 16;
        if (emailLabelRef.current && emailBoxRef.current) {
            const w = Math.ceil(emailLabelRef.current.getBoundingClientRect().width) + pad * 2;
            emailBoxRef.current.style.setProperty('--gap', `${w}px`);
        }
        if (pwdLabelRef.current && pwdBoxRef.current) {
            const w = Math.ceil(pwdLabelRef.current.getBoundingClientRect().width) + pad * 2;
            pwdBoxRef.current.style.setProperty('--gap', `${w}px`);
        }
    };

    useLayoutEffect(() => {
        applyGap();
    }, []);
    useEffect(() => {
        const onResize = () => applyGap();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    useEffect(() => {
        applyGap();
    }, [emailValue, passwordValue]);

    const onFinish = async (v) => {
        try {
            await login(v.email, v.password);
            navigate('/');
        } catch (e) {
            message.error(e.response?.data?.error || 'Login failed');
        }
    };

    return (<div className={styles.wrapper}>
            <Card className={`${styles.card} ${styles.fadeIn}`} variant="borderless">
                <header className={styles.header}>
                    <div className={styles.logoWrap} aria-hidden>
                        <span className={styles.logoGlow}/>
                        <svg className={styles.logoSvg} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path
                                d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Zm3 4a1.75 1.75 0 0 1 1 3.2V19a1 1 0 1 1-2 0v-1.8A1.75 1.75 0 0 1 12 14Z"/>
                        </svg>
                    </div>
                    <Title level={3} style={{margin: 0}}>Sign in</Title>
                    <Text className={styles.subtitle}>Welcome back — let’s get you in</Text>
                </header>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    onFinishFailed={({errorFields}) => {
                        const byName = new Map();
                        for (const f of errorFields) {
                            const key = Array.isArray(f.name) ? f.name.join('.') : String(f.name ?? '');
                            const errs = f.errors || [];
                            if (!byName.has(key)) byName.set(key, []);
                            byName.set(key, byName.get(key).concat(errs));
                        }

                        const emailErrs = [...new Set(byName.get('email') || [])];
                        const pwdErrs = [...new Set(byName.get('password') || [])];
                        const otherErrs = [...new Set([...byName.entries()]
                            .filter(([n]) => n !== 'email' && n !== 'password')
                            .flatMap(([, errs]) => errs))];

                        if (emailErrs.length) {
                            message.error({content: emailErrs.join('\n'), duration: 4});
                        }
                        if (pwdErrs.length) {
                            message.error({content: pwdErrs.join('\n'), duration: 4});
                        }
                        if (otherErrs.length) {
                            message.error({content: otherErrs.join('\n'), duration: 4});
                        }
                    }}
                    className={`${styles.form} ${styles.formNoExplain}`}
                    size="large"
                    requiredMark={false}
                    autoComplete="on"
                    validateTrigger="onSubmit"
                    noValidate
                >
                    <Form.Item
                        name="email"
                        rules={[{required: true, message: 'Please enter your email'}, {
                            type: 'email',
                            message: 'Please enter a valid email'
                        },]}
                        // ensure item itself doesn’t validate onChange/onBlur
                        validateTrigger="onSubmit"
                    >
                        <div className={`${styles.floatField} ${emailValue ? styles.hasValue : ''}`}>
                            <div
                                ref={emailBoxRef}
                                className={`${styles.notchBox} ${emailValue ? 'floated' : ''}`}
                            >
                                <Input
                                    className={styles.innerInput}
                                    autoComplete="email"
                                    aria-label="Email address"
                                />
                            </div>
                            <span ref={emailLabelRef} className={styles.floatLabel}>Email address</span>
                        </div>
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{required: true, message: 'Please enter your password'}]}
                        validateTrigger="onSubmit"
                    >
                        <div className={`${styles.floatField} ${passwordValue ? styles.hasValue : ''}`}>
                            <div
                                ref={pwdBoxRef}
                                className={`${styles.notchBox} ${passwordValue ? 'floated' : ''}`}
                            >
                                <Input.Password
                                    className={styles.pwdAffix}
                                    autoComplete="current-password"
                                    aria-label="Password"
                                />
                            </div>
                            <span ref={pwdLabelRef} className={styles.floatLabel}>Password</span>
                        </div>
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
        </div>);
}
