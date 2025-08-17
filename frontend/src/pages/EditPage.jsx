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

    useEffect(() => {
        if (isViewer) {
            message.warning('Viewers cannot access the edit page.');
            navigate('/');
        }
    }, [isViewer, navigate]);

    const canReview = isAuditor || isAdmin;
    const canDeleteAny = isAdmin;

    // files
    const [artifactFiles, setArtifactFiles] = useState([]);
    const [readmeFile, setReadmeFile] = useState([]);

    // compliance upload (staged)
    const [complianceFiles, setComplianceFiles] = useState([]);
    const [complianceTypes, setComplianceTypes] = useState({}); // uid -> type

    // compliance list
    const [docs, setDocs] = useState([]);

    // review decisions (staged)
    const [reviewDecisions, setReviewDecisions] = useState({});

    // Update modal
    const [updateDlg, setUpdateDlg] = useState({
        open: false,
        type: 'basic',      // 'model' | 'basic' | 'compliance_upload' | 'compliance_review'
        note: ''
    });

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
        if (isViewer) return;
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
        {title: 'ID', dataIndex: 'id', key: 'id', width: 48, align: 'center', fixed: 'left'},
        {title: 'Type', dataIndex: 'type', key: 'type', render: t => <Tag>{t}</Tag>},
        {
            title: 'File',
            dataIndex: 'uri',
            key: 'uri',
            ellipsis: true,
            render: (u) => (
                <a href={`http://localhost:3000${u}`} target="_blank" rel="noreferrer">
                    {u.split('/').pop()}
                </a>
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (s) => {
                const colorNow = s === 'approved' ? 'green' : s === 'rejected' ? 'red' : 'gold';
                return <Tag color={colorNow}>{s}</Tag>;
            },
        },
        {
            title: 'Uploader',
            key: 'uploader',
            ellipsis: true,
            render: (_, r) => r.uploader?.email || r.uploaded_by
        },
        {title: 'Reviewer', key: 'reviewer', ellipsis: true, render: (_, r) => r.reviewer?.email || '—'},
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            align: 'center',
            render: (_t, r) => {
                const canDelete = canDeleteAny || r.uploaded_by === user?.id;

                return (
                    <Space size={8} wrap>
                        {canReview && r.status === 'pending' && (
                            <>
                                <Tooltip title="Approve">
                                    <Button
                                        style={{
                                            color: reviewDecisions[r.id] === 'approved' ? '#13c2c2' : '#13c2c2',
                                            border: reviewDecisions[r.id] === 'approved' ? '1px solid #b5f5ec' : 'none',
                                        }}
                                        icon={<CheckCircleOutlined/>}
                                        onClick={() =>
                                            setReviewDecisions(d => {
                                                const current = d[r.id];
                                                const nd = {...d};
                                                if (current === 'approved') {
                                                    delete nd[r.id];
                                                } else {
                                                    nd[r.id] = 'approved';
                                                }
                                                return nd;
                                            })
                                        }
                                    />
                                </Tooltip>
                                <Tooltip title="Reject">
                                    <Button
                                        style={{
                                            color: reviewDecisions[r.id] === 'rejected' ? '#f5222d' : '#f5222d',
                                            border: reviewDecisions[r.id] === 'rejected' ? '1px solid #ffa39e' : 'none',
                                        }}
                                        icon={<CloseCircleOutlined/>}
                                        onClick={() =>
                                            setReviewDecisions(d => {
                                                const current = d[r.id];
                                                const nd = {...d};
                                                if (current === 'rejected') {
                                                    delete nd[r.id];
                                                } else {
                                                    nd[r.id] = 'rejected';
                                                }
                                                return nd;
                                            })
                                        }
                                    />
                                </Tooltip>
                            </>
                        )}

                        {canDelete && (
                            <Tooltip title="Delete">
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
                                    <Button type="text" danger icon={<DeleteOutlined/>}/>
                                </Popconfirm>
                            </Tooltip>
                        )}
                    </Space>
                );
            }
        },
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

    // 替换原来的 runUpdate
    const runUpdate = async () => {
        const type = updateDlg.type;
        const note = updateDlg.note?.trim() || '';
        if (!note) {
            message.error('Description is required.');
            return;
        }

        const meta = {};
        let prev_artifact_uri = null;
        let new_artifact_uri = null;

        try {
            // —— 1) 基本信息 / 模型文件（只有 uploader/admin 能做）——
            const canModelOps = isUploader || isAdmin;
            // 只有在确实有意图更改时才触发 PUT：改了表单或选择了 zip/readme
            const wantPutModel =
                canModelOps &&
                (artifactFiles.length > 0 ||
                    readmeFile.length > 0 ||
                    form.isFieldsTouched(true));

            if (wantPutModel) {
                await form.validateFields();
                const values = form.getFieldsValue(true);
                const data = new FormData();

                const simple = [
                    'name', 'version', 'description', 'input_schema', 'risk_level',
                    'owner_contact', 'license',
                    'baseline_latency_ms', 'baseline_accuracy', 'baseline_f1', 'baseline_auc'
                ];
                simple.forEach(k => {
                    if (values[k] !== undefined && values[k] !== null && values[k] !== '') {
                        data.append(k, values[k]);
                    }
                });
                if (Array.isArray(values.business_tags)) {
                    data.append('business_tags', JSON.stringify(values.business_tags));
                }

                // 可选替换 artifact / README（若用户选了就带上）
                artifactFiles.forEach(f => data.append('files', f.originFileObj));
                if (readmeFile[0]?.originFileObj) data.append('readme', readmeFile[0].originFileObj);

                const putRes = await api.put(`/models/${id}`, data, {
                    headers: {'Content-Type': 'multipart/form-data'}
                });

                const changeMeta = putRes?.data?.change_meta || {};
                if (Object.keys(changeMeta).length) {
                    meta.model_change = changeMeta;
                    if (changeMeta.prev_artifact_uri) prev_artifact_uri = changeMeta.prev_artifact_uri;
                    if (changeMeta.new_artifact_uri) new_artifact_uri = changeMeta.new_artifact_uri;
                }
            }

            // —— 2) 合规文件上传（uploader/admin）——
            if ((isUploader || isAdmin) && complianceFiles.length > 0) {
                const missingType = complianceFiles.some(f => !complianceTypes[f.uid]);
                if (missingType) {
                    message.error('Please select a type for each compliance document.');
                    return;
                }
                const uploadedTypes = [];
                for (const f of complianceFiles) {
                    const fd = new FormData();
                    fd.append('type', complianceTypes[f.uid]);
                    fd.append('doc', f.originFileObj);
                    await api.post(`/models/${id}/compliance-docs`, fd, {
                        headers: {'Content-Type': 'multipart/form-data'}
                    });
                    uploadedTypes.push(complianceTypes[f.uid]);
                }
                meta.compliance_upload = {count: uploadedTypes.length, types: uploadedTypes};
            }

            // —— 3) 合规审核（auditor/admin）——
            if ((isAuditor || isAdmin) && Object.keys(reviewDecisions).length > 0) {
                const ids = Object.keys(reviewDecisions);
                let approved = 0, rejected = 0;
                for (const docId of ids) {
                    const status = reviewDecisions[docId];
                    await api.put(`/compliance-docs/${docId}/review`, {status, note: ''});
                    if (status === 'approved') approved++;
                    if (status === 'rejected') rejected++;
                }
                meta.compliance_review = {approved, rejected, total: ids.length, ids};
            }

            if (!Object.keys(meta).length) {
                message.warning('No staged changes to submit.');
                return;
            }

            // —— 4) 统一记录一条更新（类型=你在弹窗里选的）——
            await api.post(`/models/${id}/updates`, {
                update_type: type,
                note,
                meta,
                prev_artifact_uri,
                new_artifact_uri
            });

            // 清理&跳转
            await loadCompliance();
            setComplianceFiles([]);
            setComplianceTypes({});
            setReviewDecisions({});
            setArtifactFiles([]);
            setReadmeFile([]);

            message.success('Updated successfully');
            setUpdateDlg(s => ({...s, open: false}));
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
    const showBasics = isAdmin || isUploader;
    const showFiles = isAdmin || isUploader;
    const showMetrics = isAdmin || isUploader;
    const showComplianceUpload = isAdmin || isUploader;
    const showComplianceTable = isAdmin || isAuditor;

    // 角色驱动的更新类型选项
    const allUpdateOpts = [
        {label: 'Replace model artifact / README', value: 'model'},
        {label: 'Edit basic information', value: 'basic'},
        {label: 'Upload compliance documents', value: 'compliance_upload'},
        {label: 'Review compliance documents', value: 'compliance_review'},
    ];
    let typeOptions = [];
    if (isAdmin) typeOptions = allUpdateOpts;
    else if (isUploader) typeOptions = allUpdateOpts.slice(0, 3);
    else if (isAuditor) typeOptions = allUpdateOpts.slice(3);

    const defaultTypeByRole = () => {
        if (isAdmin) return 'basic';
        if (isUploader) return 'basic';
        if (isAuditor) return 'compliance_review';
        return 'basic';
    };

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

                <Form
                    className={styles.form}
                    layout="vertical"
                    form={form}
                    requiredMark={false}
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

                {/* Compliance - 上传 + 审核 */}
                <Divider/>
                <Title level={4} style={{marginBottom: 10}}>Compliance Documents</Title>

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

                {showComplianceTable && (
                    <>
                        <Divider/>
                        <div className={styles.fullBleed}>
                            <div className={styles.tableScroll}>
                                <Table
                                    rowKey="id"
                                    dataSource={docs}
                                    columns={columns}
                                    pagination={false}
                                    size="small"
                                    className={styles.compTable}
                                    scroll={{x: 'max-content'}}
                                />
                            </div>
                        </div>
                    </>
                )}

                {/* Update 按钮 -> 弹窗 */}
                <div className={styles.updateBar}>
                    <Button
                        type="primary"
                        size="large"
                        onClick={() => setUpdateDlg({open: true, type: defaultTypeByRole(), note: ''})}
                    >
                        Update
                    </Button>
                </div>
            </Card>

            {/* Update modal */}
            <Modal
                open={updateDlg.open}
                onCancel={() => setUpdateDlg(s => ({...s, open: false}))}
                onOk={runUpdate}
                okText="Submit"
                cancelText="Cancel"
                className={styles.updateModal}
                title="Record an Update"
                destroyOnClose
                centered
                width={640}
            >
                <div className={styles.modalRow}>
                    <div className={styles.modalLabel}>Update type</div>
                    <Select
                        className={styles.typeSelect}
                        value={updateDlg.type}
                        onChange={(val) => setUpdateDlg(s => ({...s, type: val}))}
                        placeholder="Choose an update type"
                        options={typeOptions}
                    />
                </div>

                <div className={styles.modalRow}>
                    <div className={styles.modalLabel}>Description</div>
                    <Input.TextArea
                        required
                        placeholder="What changed and why?"
                        value={updateDlg.note}
                        onChange={(e) => setUpdateDlg(s => ({...s, note: e.target.value}))}
                        autoSize={{minRows: 3, maxRows: 10}}
                    />
                </div>

                <Divider style={{margin: '10px 0 10px 0'}}/>
                <div className={styles.modalHint}>
                    After submission you will be redirected to the details page. This action is logged in the model’s
                    update history. Older artifacts remain downloadable, but legacy metadata pages are not stored.
                </div>
            </Modal>
        </div>
    );
}