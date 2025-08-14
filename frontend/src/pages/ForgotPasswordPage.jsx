// frontend/src/pages/ForgotPasswordPage.jsx
import React, {useLayoutEffect, useRef, useState, useEffect} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {Form, Input, Button, Typography, Space, message, Alert, Card} from 'antd';
import api from '../services/api';
import {useNavigate} from 'react-router-dom';
import styles from './ForgotPasswordPage.module.css';

const {Title, Text} = Typography;

export default function ForgotPasswordPage() {
    const [stage, setStage] = useState(1); // 1 = enter email, 2 = answer & reset
    const [loading, setLoading] = useState(false);
    const [emailForm] = Form.useForm(); // stage 1 form (so Enter submits)
    const [resetForm] = Form.useForm(); // stage 2 form
    const navigate = useNavigate();

    const [emailVal, setEmailVal] = useState('');
    const [questions, setQuestions] = useState([]);

    // floating label state for stage 2 fields
    const aVals = {
        a0: Form.useWatch('ans_0', resetForm) || '',
        a1: Form.useWatch('ans_1', resetForm) || '',
        a2: Form.useWatch('ans_2', resetForm) || '',
        newPwd: Form.useWatch('new_password', resetForm) || '',
    };

    // Refs for notch width measurement (email + answers + new pwd)
    const refs = {
        email: {label: useRef(null), box: useRef(null)},
        ans_0: {label: useRef(null), box: useRef(null)},
        ans_1: {label: useRef(null), box: useRef(null)},
        ans_2: {label: useRef(null), box: useRef(null)},
        new_password: {label: useRef(null), box: useRef(null)},
    };

    const applyGap = () => {
        const pad = 16;
        Object.values(refs).forEach(({label, box}) => {
            if (label.current && box.current) {
                const w = Math.ceil(label.current.getBoundingClientRect().width) + pad * 2;
                box.current.style.setProperty('--gap', `${w}px`);
            }
        });
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
    }, [emailVal, aVals.a0, aVals.a1, aVals.a2, aVals.newPwd, questions.length]);

    const fetchQuestions = async (email) => {
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

    const onEmailFinish = ({email}) => {
        setEmailVal(email);
        fetchQuestions(email);
    };

    const onReset = async (values) => {
        const answers = questions.map((q, i) => ({
            question: q.question,
            answer: values[`ans_${i}`],
        }));
        try {
            await api.post('/auth/reset-with-qa', {
                email: emailVal,
                answers,
                new_password: values.new_password,
            });
            message.success('Password reset, please login');
            navigate('/login');
        } catch (e) {
            message.error(e.response?.data?.error || 'Reset failed');
        }
    };

    return (
        <div className={styles.wrapper}>
            <Card className={styles.card} bordered={false}>
                <header className={styles.header}>
                    <Title level={3} style={{margin: 0}}>Forgot Password</Title>
                    <Text className={styles.subtitle}>
                        We’ll verify you with your security questions and let you set a new password.
                    </Text>
                </header>

                {/* Panels cross-fade */}
                <div className={styles.panelContainer}>
                    {/* Stage 1: Email (form so Enter triggers Get Questions) */}
                    <div className={`${styles.panel} ${stage === 1 ? styles.panelActive : ''}`}
                         aria-hidden={stage !== 1}>
                        <Form
                            form={emailForm}
                            layout="vertical"
                            requiredMark={false}
                            onFinish={onEmailFinish}
                        >
                            <Space direction="vertical" size="middle" style={{width: '100%'}}>
                                <Alert
                                    type="info"
                                    showIcon
                                    message="Enter your email to load your security questions."
                                />

                                <Form.Item name="email"
                                           rules={[{required: true, type: 'email', message: 'Enter a valid email'}]}>
                                    <div className={`${styles.floatField} ${emailVal ? styles.hasValue : ''}`}>
                                        <div ref={refs.email.box}
                                             className={`${styles.notchBox} ${emailVal ? 'floated' : ''}`}>
                                            <Input
                                                className={styles.innerInput}
                                                autoComplete="email"
                                                aria-label="Email address"
                                                onChange={(e) => setEmailVal(e.target.value)}
                                            />
                                        </div>
                                        <span ref={refs.email.label} className={styles.floatLabel}>Email address</span>
                                    </div>
                                </Form.Item>

                                <div className={`${styles.actions} ${styles.primaryBtn}`}>
                                    <Button onClick={() => navigate('/login')}>Back</Button>
                                    <Button type="primary" htmlType="submit" loading={loading}>
                                        Get Questions
                                    </Button>
                                </div>
                            </Space>
                        </Form>
                    </div>

                    {/* Stage 2: Questions + New Password */}
                    <div className={`${styles.panel} ${stage === 2 ? styles.panelActive : ''}`}
                         aria-hidden={stage !== 2}>
                        <Form
                            layout="vertical"
                            form={resetForm}
                            onFinish={onReset}
                            requiredMark={false}
                            className={styles.form}
                        >
                            <Alert
                                type="success"
                                showIcon
                                message={`Loaded ${questions.length} question(s) for ${emailVal}`}
                                style={{marginBottom: 12}}
                            />

                            {questions.map((q, i) => (
                                <Form.Item
                                    key={i}
                                    name={`ans_${i}`}
                                    rules={[{required: true, message: 'Please answer this question'}]}
                                >
                                    <div
                                        className={`${styles.floatField} ${(resetForm.getFieldValue(`ans_${i}`) || '').length ? styles.hasValue : ''}`}>
                                        <div ref={refs[`ans_${i}`]?.box}
                                             className={`${styles.notchBox} ${(resetForm.getFieldValue(`ans_${i}`) || '').length ? 'floated' : ''}`}>
                                            <Input autoComplete="off" className={styles.innerInput}
                                                   aria-label={`Answer ${i + 1}`}/>
                                        </div>
                                        <span ref={refs[`ans_${i}`]?.label}
                                              className={styles.floatLabel}>{q.question}</span>
                                    </div>
                                </Form.Item>
                            ))}

                            <Form.Item
                                name="new_password"
                                rules={[{required: true, min: 6, message: 'Minimum 6 characters'}]}
                            >
                                <div className={`${styles.floatField} ${aVals.newPwd ? styles.hasValue : ''}`}>
                                    <div ref={refs.new_password.box}
                                         className={`${styles.notchBox} ${aVals.newPwd ? 'floated' : ''}`}>
                                        <Input.Password
                                            autoComplete="new-password"
                                            className={styles.pwdAffix}
                                            aria-label="New password"
                                        />
                                    </div>
                                    <span ref={refs.new_password.label}
                                          className={styles.floatLabel}>New password</span>
                                </div>
                            </Form.Item>

                            <div className={`${styles.actions} ${styles.primaryBtn}`}>
                                <Button
                                    onClick={() => {
                                        setStage(1);
                                        setQuestions([]);
                                        resetForm.resetFields();
                                        // Keep the typed email in stage 1 form input
                                        emailForm.setFieldsValue({email: emailVal});
                                    }}
                                >
                                    Back
                                </Button>
                                <Button type="primary" htmlType="submit">Reset Password</Button>
                            </div>
                        </Form>
                    </div>
                </div>
            </Card>
        </div>
    );
}
