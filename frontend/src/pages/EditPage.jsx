import React, {useEffect, useMemo, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {
    Form, Input, Button, Select, Upload, message, Typography, Space, InputNumber,
    Table, Tag, Modal, Divider, Tooltip, Card, Popconfirm
} from 'antd';
import {
    UploadOutlined, CheckCircleOutlined, CloseCircleOutlined,
    ArrowLeftOutlined, QuestionCircleOutlined, FileTextOutlined, DeleteOutlined
} from '@ant-design/icons';
import {useNavigate, useParams} from 'react-router-dom';
import api from '../services/api';
import {SCHEMA_MODES, RISK_LEVELS, LICENSES, COMPLIANCE_DOC_TYPES} from '../constants/constant';
import {useAuth} from '../contexts/AuthContext';
import styles from './EditPage.module.css';

const {Title, Text} = Typography;
const {Option} = Select;
const {Dragger} = Upload;

export default function EditPage() {
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const {id} = useParams();
    const {hasRole, user} = useAuth();

    // ---- role gates ----
    const isViewer = hasRole('viewer');
    const isAuditor = hasRole('auditor');
    const isUploader = hasRole('uploader');
    const isAdmin = hasRole('admin');

    // viewer 不能进入编辑页
    useEffect(() => {
        if (isViewer) {
            message.warning('Viewers cannot access the edit page.');
            navigate('/');
        }
    }, [isViewer, navigate]);

    // 表格行为依赖
    const canReview = isAuditor || isAdmin;  // 审核按钮只给 auditor/admin
    const canDeleteAny = isAdmin;

    // files
    const [artifactFiles, setArtifactFiles] = useState([]);
    const [readmeFile, setReadmeFile] = useState([]);

    // compliance upload (staged; real upload happens on Update)
    const [complianceFiles, setComplianceFiles] = useState([]);
    const [complianceTypes, setComplianceTypes] = useState({}); // uid -> type

    // compliance list
    const [docs, setDocs] = useState([]);

    // review decisions (staged; applied on Update)
    // map: docId -> 'approved' | 'rejected'
    const [reviewDecisions, setReviewDecisions] = useState({});

    // tooltip
    const Info = ({children, placement = 'right'}) => (
        <Tooltip
            title={<div className={styles.tip}>{children}</div>}
            overlayClassName={styles.tipOverlay}
            placement={placement}
        >
            <QuestionCircleOutlined className={styles.helpIcon}/>
        </Tooltip>
    );

    // load model
    useEffect(() => {
        if (isViewer) return; // 已重定向，无需加载
        api.get(`/models/${id}`)
            .then(res => {
                const m = res.data;
                form.setFieldsValue({
                    name: m.name,
                    version: m.version,
                    description: m.description,
                    input_schema: m.input_schema,
                    risk_level: m.risk_level,
                    baseline_latency_ms: m.baseline_latency_ms ?? null,
                    baseline_accuracy: m.baseline_accuracy ?? null,
                    baseline_f1: m.baseline_f1 ?? null,
                    baseline_auc: m.baseline_auc ?? null,
                    business_tags: m.business_tags || [],
                    owner_contact: m.owner_contact || '',
                    license: m.license || undefined,
                });
            })
            .catch(() => message.error('Failed to load model'));
    }, [id, form, isViewer]);

    const loadCompliance = async () => {
        try {
            const res = await api.get(`/models/${id}/compliance-docs`);
            setDocs(res.data || []);
        } catch {
            message.error('Failed to load compliance docs');
        }
    };
    useEffect(() => {
        if (!isViewer) loadCompliance();
    }, [id, isViewer]);

    const licenseOptions = useMemo(
        () => (LICENSES || []).map(x => (typeof x === 'string' ? {label: x, value: x} : x)),
        []
    );

    // 审核表格列
    const columns = [
        {title: 'ID', dataIndex: 'id', key: 'id', width: 70},
        {title: 'Type', dataIndex: 'type', key: 'type', render: t => <Tag>{t}</Tag>, width: 110},
        {
            title: 'File', dataIndex: 'uri', key: 'uri',
            render: (u) => (
                <a href={`http://localhost:3000${u}`} target="_blank" rel="noreferrer">
                    {u.split('/').pop()}
                </a>
            )
        },
        {
            title: 'Status', dataIndex: 'status', key: 'status', width: 170,
            render: (s, r) => {
                const queued = reviewDecisions[r.id];
                const colorNow = s === 'approved' ? 'green' : s === 'rejected' ? 'red' : 'gold';
                return (
                    <Space size={6} wrap>
                        <Tag color={colorNow}>{s}</Tag>
                        {queued && <Tag color={queued === 'approved' ? 'blue' : 'volcano'}>queued: {queued}</Tag>}
                    </Space>
                );
            }
        },
        {title: 'Uploader', key: 'uploader', width: 180, render: (_, r) => r.uploader?.email || r.uploaded_by},
        {title: 'Reviewer', key: 'reviewer', width: 180, render: (_, r) => r.reviewer?.email || '—'},
        {
            title: 'Actions', key: 'actions', width: 360,
            render: (_t, r) => {
                const canDelete = canDeleteAny || r.uploaded_by === user?.id;
                const queued = reviewDecisions[r.id];
                return (
                    <Space size={8} wrap>
                        {canReview && r.status === 'pending' && (
                            <>
                                <Button
                                    icon={<CheckCircleOutlined/>}
                                    onClick={() => setReviewDecisions(d => ({...d, [r.id]: 'approved'}))}
                                >
                                    Queue Approve
                                </Button>
                                <Button
                                    danger icon={<CloseCircleOutlined/>}
                                    onClick={() => setReviewDecisions(d => ({...d, [r.id]: 'rejected'}))}
                                >
                                    Queue Reject
                                </Button>
                            </>
                        )}
                        {queued && (
                            <Button
                                className={styles.inlineLink}
                                onClick={() => setReviewDecisions(d => {
                                    const nd = {...d};
                                    delete nd[r.id];
                                    return nd;
                                })}
                            >
                                Undo
                            </Button>
                        )}
                        {canDelete && (
                            <Popconfirm
                                title="Delete this document?"
                                onConfirm={async () => {
                                    try {
                                        await api.delete(`/compliance-docs/${r.id}`);
                                        message.success('Deleted');
                                        await loadCompliance();
                                        setReviewDecisions(d => {
                                            const nd = {...d};
                                            delete nd[r.id];
                                            return nd;
                                        });
                                    } catch (e) {
                                        message.error(e.response?.data?.error || 'Delete failed');
                                    }
                                }}
                            >
                                <Button danger icon={<DeleteOutlined/>}>Delete</Button>
                            </Popconfirm>
                        )}
                    </Space>
                );
            }
        }
    ];

    // helpers
    const humanSize = (bytes = 0) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    const removeCompliance = (uid) => {
        const next = complianceFiles.filter(f => f.uid !== uid);
        const nextTypes = {...complianceTypes};
        delete nextTypes[uid];
        setComplianceFiles(next);
        setComplianceTypes(nextTypes);
    };

    // ---- Single Update pipeline (按角色分支执行) ----
    const runSingleUpdate = async () => {
        try {
            // uploader/admin 才需要校验表单（auditor 无可编辑字段）
            if (isUploader || isAdmin) {
                await form.validateFields();
            }

            // 1) uploader/admin：更新模型基本信息 & 可选文件
            if (isUploader || isAdmin) {
                const values = form.getFieldsValue(true);
                const data = new FormData();
                const simple = [
                    'name', 'version', 'description', 'input_schema', 'risk_level',
                    'owner_contact', 'license',
                    'baseline_latency_ms', 'baseline_accuracy', 'baseline_f1', 'baseline_auc'
                ];
                simple.forEach(k => {
                    if (values[k] !== undefined && values[k] !== null && values[k] !== '') data.append(k, values[k]);
                });
                if (Array.isArray(values.business_tags)) {
                    data.append('business_tags', JSON.stringify(values.business_tags));
                }
                // 可选替换
                artifactFiles.forEach(f => data.append('files', f.originFileObj));
                if (readmeFile[0]?.originFileObj) data.append('readme', readmeFile[0].originFileObj);
                await api.put(`/models/${id}`, data, {headers: {'Content-Type': 'multipart/form-data'}});
            }

            // 2) uploader/admin：上传待提交的合规文件
            if ((isUploader || isAdmin) && complianceFiles.length > 0) {
                const missingType = complianceFiles.some(f => !complianceTypes[f.uid]);
                if (missingType) {
                    message.error('Please select a type for each compliance document.');
                    return;
                }
                for (const f of complianceFiles) {
                    const fd = new FormData();
                    fd.append('type', complianceTypes[f.uid]);
                    fd.append('doc', f.originFileObj);
                    await api.post(`/models/${id}/compliance-docs`, fd, {
                        headers: {'Content-Type': 'multipart/form-data'}
                    });
                }
            }

            // 3) auditor/admin：应用审核队列
            if ((isAuditor || isAdmin) && Object.keys(reviewDecisions).length > 0) {
                const ids = Object.keys(reviewDecisions);
                for (const docId of ids) {
                    const status = reviewDecisions[docId];
                    await api.put(`/compliance-docs/${docId}/review`, {status, note: ''});
                }
            }

            // 刷新与清理 staged
            await loadCompliance();
            setComplianceFiles([]);
            setComplianceTypes({});
            setReviewDecisions({});
            setArtifactFiles([]);
            setReadmeFile([]);

            message.success('Updated successfully');
            navigate(`/view/${id}`);
        } catch (e) {
            if (e?.errorFields) {
                message.error('Please complete all required fields.');
            } else {
                message.error(e.response?.data?.error || 'Update failed');
            }
        }
    };

    // 可见性开关
    const showBasics = isAdmin || isUploader;             // auditor 不显示
    const showFiles = isAdmin || isUploader;              // auditor 不显示
    const showMetrics = isAdmin || isUploader;            // auditor 不显示
    const showComplianceUpload = isAdmin || isUploader;   // auditor 不显示上传
    const showComplianceTable = isAdmin || isAuditor;     // uploader 不显示审核表格

    return (
        <div className={styles.wrapper}>
            <Card className={styles.card} bordered={false}>
                {/* Header */}
                <div className={styles.topbar}>
                    <Button icon={<ArrowLeftOutlined/>} onClick={() => navigate(-1)} aria-label="Back">Back</Button>

                    <div className={styles.header}>
                        <Title level={2} style={{margin: 0, marginTop: 6}}>Edit Model #{id}</Title>
                        <Text className={styles.subtitle}>
                            {isAuditor && !isAdmin
                                ? 'Review compliance documents and queue decisions, then click Update.'
                                : 'Update basic information, replace artifacts, and manage compliance documents.'}
                        </Text>
                    </div>
                </div>

                <Divider style={{margin: '8px 0 14px'}}/>

                {/* Form（auditor 仅用于底部 Update 触发，不显示字段） */}
                <Form
                    className={styles.form}
                    layout="vertical"
                    form={form}
                    requiredMark={false}
                    onFinish={runSingleUpdate}
                >
                    {/* Basics */}
                    {showBasics && (
                        <>
                            <div className={styles.sectionTitle}>Basics</div>
                            <div className={`${styles.group} ${styles.twoCol}`}>
                                <Form.Item name="name" label="Name" rules={[{required: true}]}>
                                    <Input id="name" placeholder="Model Name" autoComplete="off"/>
                                </Form.Item>

                                <Form.Item name="version" label="Version" rules={[{required: true}]}>
                                    <Input id="version" placeholder="e.g. v1.0.0" autoComplete="off"/>
                                </Form.Item>

                                <Form.Item
                                    name="input_schema"
                                    label={<span className={styles.labelWithIcon}>Input Schema <Info>
                    Describe the expected request shape for inference.
                  </Info></span>}
                                    rules={[{required: true}]}
                                >
                                    <Select id="input_schema">
                                        {SCHEMA_MODES.map(m => <Option key={m} value={m}>{m}</Option>)}
                                    </Select>
                                </Form.Item>

                                <Form.Item
                                    name="risk_level"
                                    label={<span className={styles.labelWithIcon}>Risk <Info>
                    Risk level determines required compliance docs.
                  </Info></span>}
                                    rules={[{required: true}]}
                                >
                                    <Select id="risk_level">
                                        {RISK_LEVELS.map(r => <Option key={r} value={r}>{r}</Option>)}
                                    </Select>
                                </Form.Item>

                                <Form.Item name="license" label="License">
                                    <Select id="license" placeholder="Select license" allowClear
                                            options={licenseOptions}/>
                                </Form.Item>

                                <Form.Item name="owner_contact" label="Owner Contact">
                                    <Input id="owner_contact" placeholder="Name and email, separated by comma"
                                           autoComplete="name email"/>
                                </Form.Item>

                                <Form.Item name="business_tags" label="Business Tags" style={{gridColumn: '1 / -1'}}
                                           className={styles.tags}>
                                    <Select id="business_tags" mode="tags" tokenSeparators={[',']}
                                            placeholder="Type tag then Enter" maxTagCount="responsive"/>
                                </Form.Item>

                                <Form.Item name="description" label="Brief Description" rules={[{required: true}]}
                                           style={{gridColumn: '1 / -1'}}>
                                    <Input.TextArea id="description" autoSize={{minRows: 3, maxRows: 10}}/>
                                </Form.Item>
                            </div>
                        </>
                    )}

                    {/* Metrics */}
                    {showMetrics && (
                        <>
                            <div className={styles.sectionTitle}>Baseline Metrics</div>
                            <div className={`${styles.group} ${styles.metricsGrid}`}>
                                <Form.Item name="baseline_accuracy" label="Accuracy" className={styles.metricItem}>
                                    <InputNumber min={0} max={1} step={0.0001} placeholder="0–1"
                                                 className={styles.metricInput}/>
                                </Form.Item>
                                <Form.Item name="baseline_f1" label="F1 Score" className={styles.metricItem}>
                                    <InputNumber min={0} max={1} step={0.0001} placeholder="0–1"
                                                 className={styles.metricInput}/>
                                </Form.Item>
                                <Form.Item name="baseline_auc" label="AUC" className={styles.metricItem}>
                                    <InputNumber min={0} max={1} step={0.0001} placeholder="0–1"
                                                 className={styles.metricInput}/>
                                </Form.Item>
                                <Form.Item name="baseline_latency_ms" label="Latency (ms)"
                                           className={styles.metricItem}>
                                    <InputNumber min={0} step={1} placeholder="e.g. 12" className={styles.metricInput}/>
                                </Form.Item>
                            </div>
                        </>
                    )}

                    {/* Files */}
                    {showFiles && (
                        <>
                            <div className={styles.sectionTitle}>Files</div>
                            <div className={`${styles.group} ${styles.twoCol}`}>
                                <Form.Item name="files" label="Replace Model File (.zip)">
                                    <Dragger
                                        id="files" multiple={false} maxCount={1} accept=".zip"
                                        beforeUpload={() => false}
                                        onChange={info => setArtifactFiles(info.fileList.slice(-1))}
                                        fileList={artifactFiles}
                                    >
                                        <p className="ant-upload-drag-icon"><UploadOutlined/></p>
                                        <p className="ant-upload-text">Click or drag a single .zip here</p>
                                    </Dragger>
                                </Form.Item>

                                <Form.Item name="readme" label="Replace README (.md or .pdf)">
                                    <Dragger
                                        id="readme" accept=".md,.pdf" maxCount={1} beforeUpload={() => false}
                                        onChange={info => setReadmeFile(info.fileList.slice(-1))}
                                        fileList={readmeFile}
                                    >
                                        <p className="ant-upload-drag-icon"><UploadOutlined/></p>
                                        <p className="ant-upload-text">Click or drag README.md / README.pdf here</p>
                                    </Dragger>
                                </Form.Item>
                            </div>
                        </>
                    )}
                </Form>

                {/* Compliance - 上传（uploader/admin） + 审核（auditor/admin） */}
                <Divider/>
                <Title level={4} style={{marginBottom: 10}}>Compliance Documents</Title>

                {/* 上传区：仅 uploader/admin */}
                {showComplianceUpload && (
                    <div className={styles.group}>
                        <div className={styles.compHeader}>
                            <div className={styles.compLegend}>
                                <Tag color="blue">Medium</Tag> requires <b>PRIVACY</b>
                                <span className={styles.sep}>|</span>
                                <Tag color="red">High</Tag> requires <b>FRIA + DPIA + PRIVACY</b>
                            </div>
                            <Text type="secondary" className={styles.compHint}>
                                Files you add will be uploaded when you click <b>Update</b>.
                            </Text>
                        </div>

                        <Dragger
                            id="compliance_docs"
                            multiple
                            showUploadList={false}
                            accept=".pdf,.doc,.docx,.txt,.md"
                            beforeUpload={() => false}
                            className={styles.compDrop}
                            onChange={info => {
                                const next = info.fileList;
                                const nextTypes = {...complianceTypes};
                                const nextUids = new Set(next.map(f => f.uid));
                                Object.keys(nextTypes).forEach(uid => {
                                    if (!nextUids.has(uid)) delete nextTypes[uid];
                                });
                                setComplianceFiles(next);
                                setComplianceTypes(nextTypes);
                            }}
                        >
                            <p className="ant-upload-drag-icon"><UploadOutlined/></p>
                            <p className="ant-upload-text">Click or drag compliance docs here</p>
                            <p className="ant-upload-hint">PDF / DOC / DOCX / TXT / MD</p>
                        </Dragger>

                        {complianceFiles.length > 0 && (
                            <div className={styles.docList}>
                                {complianceFiles.map(f => (
                                    <div key={f.uid} className={styles.docItem}>
                                        <div className={styles.docMeta}>
                                            <FileTextOutlined className={styles.docIcon}/>
                                            <div>
                                                <div className={styles.docName} title={f.name}>{f.name}</div>
                                                <div className={styles.docSize}>{humanSize(f.size)}</div>
                                            </div>
                                        </div>

                                        <Select
                                            size="small"
                                            className={styles.docTypeSelect}
                                            placeholder="Type"
                                            value={complianceTypes[f.uid]}
                                            onChange={(val) => setComplianceTypes(prev => ({...prev, [f.uid]: val}))}
                                            options={(COMPLIANCE_DOC_TYPES || ['FRIA', 'DPIA', 'PRIVACY', 'TERMS', 'OTHER'])
                                                .map(t => ({label: t, value: t}))}
                                        />

                                        <Button
                                            type="text"
                                            icon={<DeleteOutlined/>}
                                            onClick={() => removeCompliance(f.uid)}
                                            className={styles.removeBtn}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 审核表格：仅 auditor/admin；一次性渲染全部，取消分页 */}
                {showComplianceTable && (
                    <>
                        <Divider/>
                        <div className={styles.wideSection}>
                            <div className={styles.tableWrapWide}>
                                <Table
                                    rowKey="id"
                                    dataSource={docs}
                                    columns={columns}
                                    pagination={false}
                                    size="middle"
                                />
                            </div>
                        </div>
                    </>
                )}

                {/* 统一 Update */}
                <div className={styles.updateBar}>
                    <Button type="primary" size="large" onClick={() => form.submit()}>
                        Update
                    </Button>
                </div>
            </Card>
        </div>
    );
}