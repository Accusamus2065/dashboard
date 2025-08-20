// frontend/src/pages/RegisterPage.jsx
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {Form, Input, Button, Typography, Select, Card, message} from 'antd';
import {useNavigate} from 'react-router-dom';
import api from '../services/api';
import {SECURITY_QUESTION_BANK} from '../constants/constant';
import styles from './RegisterPage.module.css';

const {Title, Text} = Typography;
const {Option} = Select;

export default function RegisterPage() {
    const [form] = Form.useForm();
    const navigate = useNavigate();

    // Watch values (typing + autofill)
    const emailVal = Form.useWatch('email', form) || '';
    const passwordVal = Form.useWatch('password', form) || '';
    const q1Val = Form.useWatch('q1', form) || '';
    const q2Val = Form.useWatch('q2', form) || '';
    const q3Val = Form.useWatch('q3', form) || '';
    const a1Val = Form.useWatch('a1', form) || '';
    const a2Val = Form.useWatch('a2', form) || '';
    const a3Val = Form.useWatch('a3', form) || '';

    // Persist-float flags for Selects
    const [q1Fixed, setQ1Fixed] = useState(false);
    const [q2Fixed, setQ2Fixed] = useState(false);
    const [q3Fixed, setQ3Fixed] = useState(false);

    // Keep label floated while dropdown is open
    const [q1Open, setQ1Open] = useState(false);
    const [q2Open, setQ2Open] = useState(false);
    const [q3Open, setQ3Open] = useState(false);

    useEffect(() => {
        setQ1Fixed(Boolean(q1Val));
    }, [q1Val]);
    useEffect(() => {
        setQ2Fixed(Boolean(q2Val));
    }, [q2Val]);
    useEffect(() => {
        setQ3Fixed(Boolean(q3Val));
    }, [q3Val]);

    // Track which questions are selected to hide them from other dropdowns
    const [selectedQuestions, setSelectedQuestions] = useState({q1: '', q2: '', q3: ''});
    useEffect(() => {
        setSelectedQuestions({q1: q1Val, q2: q2Val, q3: q3Val});
    }, [q1Val, q2Val, q3Val]);

    const availableQuestions = (currentField) => {
        const used = Object.entries(selectedQuestions)
            .filter(([k]) => k !== currentField)
            .map(([, v]) => v)
            .filter(Boolean);
        return SECURITY_QUESTION_BANK.filter(q => !used.includes(q));
    };

    // Notch measurement
    const refs = {
        email: {label: useRef(null), box: useRef(null)},
        password: {label: useRef(null), box: useRef(null)},
        q1: {label: useRef(null), box: useRef(null)},
        a1: {label: useRef(null), box: useRef(null)},
        q2: {label: useRef(null), box: useRef(null)},
        a2: {label: useRef(null), box: useRef(null)},
        q3: {label: useRef(null), box: useRef(null)},
        a3: {label: useRef(null), box: useRef(null)},
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
    }, [emailVal, passwordVal, q1Val, q2Val, q3Val, a1Val, a2Val, a3Val]);

    const onFinish = async (values) => {
        const payload = {
            email: values.email,
            password: values.password,
            security_questions: [{question: values.q1, answer: values.a1}, {
                question: values.q2,
                answer: values.a2
            }, {question: values.q3, answer: values.a3},].filter(x => x.question && x.answer),
        };
        try {
            await api.post('/auth/register', payload);
            message.success('Registered, please login');
            navigate('/login');
        } catch (e) {
            message.error(e.response?.data?.error || 'Register failed');
        }
    };

    // Submit-only validation; combine Q/A errors to one toast, others separate
    const onFinishFailed = ({errorFields}) => {
        const byName = new Map();
        for (const f of errorFields) {
            const key = Array.isArray(f.name) ? f.name.join('.') : String(f.name ?? '');
            const errs = f.errors || [];
            if (!byName.has(key)) byName.set(key, []);
            byName.set(key, [...byName.get(key), ...errs]);
        }

        const qaFields = ['q1', 'a1', 'q2', 'a2', 'q3', 'a3'];
        const qaFailed = qaFields.some(name => byName.has(name));
        const otherKeys = [...byName.keys()].filter(name => !qaFields.includes(name));

        if (qaFailed) {
            message.error({content: 'Please select and answer questions accordingly', duration: 4});
        }
        // Show one toast per remaining field (email/password, etc.)
        const order = ['email', 'password', ...otherKeys];
        const seen = new Set();
        for (const name of order) {
            if (seen.has(name) || !byName.has(name)) continue;
            seen.add(name);
            const msgs = [...new Set(byName.get(name) || [])];
            if (msgs.length) {
                message.error({
                    content: <div style={{whiteSpace: 'pre-line'}}>{msgs.join('\n')}</div>, duration: 4,
                });
            }
        }
    };

    return (<div className={styles.wrapper}>
            <Card className={`${styles.card} ${styles.fadeIn}`} variant={"borderless"}>
                <header className={styles.header}>
                    <Title level={3} style={{margin: 0}}>Create account</Title>
                    <Text className={styles.subtitle}>Fill in your details to get started.</Text>
                </header>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    onFinishFailed={onFinishFailed}
                    className={`${styles.form} ${styles.formNoExplain}`}
                    requiredMark={false}
                    autoComplete="on"
                    size="large"
                    validateTrigger="onSubmit"
                    noValidate
                >
                    {/* Email */}
                    <Form.Item
                        name="email"
                        rules={[{required: true, type: 'email', message: 'Please enter a valid email'}]}
                        validateTrigger="onSubmit"
                    >
                        <div className={`${styles.floatField} ${emailVal ? styles.hasValue : ''}`}>
                            <div ref={refs.email.box} className={`${styles.notchBox} ${emailVal ? 'floated' : ''}`}>
                                <Input className={styles.innerInput} autoComplete="email" aria-label="Email address"/>
                            </div>
                            <span ref={refs.email.label} className={styles.floatLabel}>Email address</span>
                        </div>
                    </Form.Item>

                    {/* Password */}
                    <Form.Item
                        name="password"
                        rules={[{required: true, min: 6, message: 'Password must be at least 6 characters'}]}
                        validateTrigger="onSubmit"
                    >
                        <div className={`${styles.floatField} ${passwordVal ? styles.hasValue : ''}`}>
                            <div ref={refs.password.box}
                                 className={`${styles.notchBox} ${passwordVal ? 'floated' : ''}`}>
                                <Input.Password
                                    className={styles.pwdAffix}
                                    autoComplete="new-password"
                                    aria-label="Password"
                                />
                            </div>
                            <span ref={refs.password.label} className={styles.floatLabel}>Password</span>
                        </div>
                    </Form.Item>

                    {/* Security Questions */}
                    <Title level={5} className={styles.sectionTitle}>Security Questions</Title>

                    {/* Q1 + A1 */}
                    <div className={styles.grid2}>
                        <Form.Item name="q1" rules={[{required: true, message: 'Please choose a question'}]}
                                   validateTrigger="onSubmit">
                            <div
                                className={`${styles.floatField} ${(q1Val || q1Open || q1Fixed) ? styles.hasValue : ''}`}>
                                <div ref={refs.q1.box}
                                     className={`${styles.notchBox} ${(q1Val || q1Open || q1Fixed) ? 'floated' : ''}`}>
                                    <Select
                                        className={styles.select}
                                        placeholder=""
                                        showSearch={false}
                                        allowClear
                                        aria-label="Security question 1"
                                        onDropdownOpenChange={setQ1Open}
                                        onChange={(val) => form.setFieldValue('q1', val)}
                                    >
                                        {availableQuestions('q1').map(q => (
                                            <Option key={`q1-${q}`} value={q}>{q}</Option>))}
                                    </Select>
                                </div>
                                <span ref={refs.q1.label} className={styles.floatLabel}>Question 1</span>
                            </div>
                        </Form.Item>

                        <Form.Item name="a1" rules={[{required: true, message: 'Please provide an answer'}]}
                                   validateTrigger="onSubmit">
                            <div className={`${styles.floatField} ${a1Val ? styles.hasValue : ''}`}>
                                <div ref={refs.a1.box} className={`${styles.notchBox} ${a1Val ? 'floated' : ''}`}>
                                    <Input className={styles.innerInput} autoComplete="off" aria-label="Answer 1"/>
                                </div>
                                <span ref={refs.a1.label} className={styles.floatLabel}>Answer 1</span>
                            </div>
                        </Form.Item>
                    </div>

                    {/* Q2 + A2 */}
                    <div className={styles.grid2}>
                        <Form.Item name="q2" rules={[{required: true, message: 'Please choose a question'}]}
                                   validateTrigger="onSubmit">
                            <div
                                className={`${styles.floatField} ${(q2Val || q2Open || q2Fixed) ? styles.hasValue : ''}`}>
                                <div ref={refs.q2.box}
                                     className={`${styles.notchBox} ${(q2Val || q2Open || q2Fixed) ? 'floated' : ''}`}>
                                    <Select
                                        className={styles.select}
                                        placeholder=""
                                        showSearch={false}
                                        allowClear
                                        aria-label="Security question 2"
                                        onDropdownOpenChange={setQ2Open}
                                        onChange={(val) => form.setFieldValue('q2', val)}
                                    >
                                        {availableQuestions('q2').map(q => (
                                            <Option key={`q2-${q}`} value={q}>{q}</Option>))}
                                    </Select>
                                </div>
                                <span ref={refs.q2.label} className={styles.floatLabel}>Question 2</span>
                            </div>
                        </Form.Item>

                        <Form.Item name="a2" rules={[{required: true, message: 'Please provide an answer'}]}
                                   validateTrigger="onSubmit">
                            <div className={`${styles.floatField} ${a2Val ? styles.hasValue : ''}`}>
                                <div ref={refs.a2.box} className={`${styles.notchBox} ${a2Val ? 'floated' : ''}`}>
                                    <Input className={styles.innerInput} autoComplete="off" aria-label="Answer 2"/>
                                </div>
                                <span ref={refs.a2.label} className={styles.floatLabel}>Answer 2</span>
                            </div>
                        </Form.Item>
                    </div>

                    {/* Q3 + A3 */}
                    <div className={styles.grid2}>
                        <Form.Item name="q3" rules={[{required: true, message: 'Please choose a question'}]}
                                   validateTrigger="onSubmit">
                            <div
                                className={`${styles.floatField} ${(q3Val || q3Open || q3Fixed) ? styles.hasValue : ''}`}>
                                <div ref={refs.q3.box}
                                     className={`${styles.notchBox} ${(q3Val || q3Open || q3Fixed) ? 'floated' : ''}`}>
                                    <Select
                                        className={styles.select}
                                        placeholder=""
                                        showSearch={false}
                                        allowClear
                                        aria-label="Security question 3"
                                        onDropdownOpenChange={setQ3Open}
                                        onChange={(val) => form.setFieldValue('q3', val)}
                                    >
                                        {availableQuestions('q3').map(q => (
                                            <Option key={`q3-${q}`} value={q}>{q}</Option>))}
                                    </Select>
                                </div>
                                <span ref={refs.q3.label} className={styles.floatLabel}>Question 3</span>
                            </div>
                        </Form.Item>

                        <Form.Item name="a3" rules={[{required: true, message: 'Please provide an answer'}]}
                                   validateTrigger="onSubmit">
                            <div className={`${styles.floatField} ${a3Val ? styles.hasValue : ''}`}>
                                <div ref={refs.a3.box} className={`${styles.notchBox} ${a3Val ? 'floated' : ''}`}>
                                    <Input className={styles.innerInput} autoComplete="off" aria-label="Answer 3"/>
                                </div>
                                <span ref={refs.a3.label} className={styles.floatLabel}>Answer 3</span>
                            </div>
                        </Form.Item>
                    </div>

                    <div className={`${styles.actions} ${styles.submitBtn}`}>
                        <Button onClick={() => navigate('/login')}>Back to Login</Button>
                        <Button type="primary" htmlType="submit">Register</Button>
                    </div>
                </Form>
            </Card>
        </div>);
}
