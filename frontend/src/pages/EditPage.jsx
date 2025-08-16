// frontend/src/pages/EditPage.jsx
import React, {useEffect, useMemo, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {
    Form, Input, Button, Select, Upload, message, Typography, Space, InputNumber,
    Table, Tag, Modal, Popconfirm
} from 'antd';
import {UploadOutlined, CheckCircleOutlined, CloseCircleOutlined} from '@ant-design/icons';
import {useNavigate, useParams} from 'react-router-dom';
import api from '../services/api';
import {SCHEMA_MODES, RISK_LEVELS, LICENSES, COMPLIANCE_DOC_TYPES} from '../constants/constant';
import {useAuth} from '../contexts/AuthContext';

const {Title} = Typography;
const {Option} = Select;

export default function EditPage() {
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const {id} = useParams();
    const {hasRole, user} = useAuth();

    const canReview = hasRole(['auditor', 'admin']);
    const canDeleteAny = hasRole('admin');

    // 基础更新用
    const [artifactFiles, setArtifactFiles] = useState([]);
    const [readmeFile, setReadmeFile] = useState([]);
    const [trainingFiles, setTrainingFiles] = useState([]);
    const [validationFiles, setValidationFiles] = useState([]);

    // 合规文档上传（移动到 Edit）
    const [complianceFiles, setComplianceFiles] = useState([]);
    const [complianceTypes, setComplianceTypes] = useState({}); // uid -> type

    // 合规文档列表与审核
    const [docs, setDocs] = useState([]);
    const [reviewModal, setReviewModal] = useState({open: false, id: null, status: 'approved', note: ''});

    useEffect(() => {
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
    }, [id]);

    const loadCompliance = async () => {
        try {
            const res = await api.get(`/models/${id}/compliance-docs`);
            setDocs(res.data || []);
        } catch {
            message.error('Failed to load compliance docs');
        }
    };
    useEffect(() => {
        loadCompliance();
    }, [id]);

    // —— 基础信息保存（不再在这里附带合规模块的上传） ——
    const onFinish = async (values) => {
        const data = new FormData();

        const simpleFields = [
            'name', 'version', 'description', 'input_schema', 'risk_level',
            'owner_contact', 'license',
            'baseline_latency_ms', 'baseline_accuracy', 'baseline_f1', 'baseline_auc'
        ];
        simpleFields.forEach(k => {
            if (values[k] !== undefined && values[k] !== null && values[k] !== '') {
                data.append(k, values[k]);
            }
        });

        if (Array.isArray(values.business_tags)) {
            data.append('business_tags', JSON.stringify(values.business_tags));
        }

        // 仅在用户选择了新文件时替换
        artifactFiles.forEach(f => data.append('files', f.originFileObj));
        if (readmeFile[0]?.originFileObj) data.append('readme', readmeFile[0].originFileObj);
        trainingFiles.forEach(f => data.append('training_data', f.originFileObj));
        validationFiles.forEach(f => data.append('validation_data', f.originFileObj));

        try {
            await api.put(`/models/${id}`, data, {headers: {'Content-Type': 'multipart/form-data'}});
            message.success('Model updated');
            navigate(`/view/${id}`);
        } catch (e) {
            message.error(e.response?.data?.error || 'Update failed');
        }
    };

    // —— 合规文档：上传（每个文件必须选择 type） ——
    const uploadCompliance = async () => {
        if (complianceFiles.length === 0) {
            return message.error('Please select at least one document.');
        }
        const missingType = complianceFiles.some(f => !complianceTypes[f.uid]);
        if (missingType) {
            return message.error('Please select a type for each document.');
        }
        try {
            for (const f of complianceFiles) {
                const fd = new FormData();
                fd.append('type', complianceTypes[f.uid]);
                fd.append('doc', f.originFileObj);
                await api.post(`/models/${id}/compliance-docs`, fd, {
                    headers: {'Content-Type': 'multipart/form-data'}
                });
            }
            message.success('Uploaded');
            setComplianceFiles([]);
            setComplianceTypes({});
            loadCompliance();
        } catch (e) {
            message.error(e.response?.data?.error || 'Upload failed');
        }
    };

    // —— 审核（auditor/admin） ——
    const doReview = async () => {
        try {
            await api.put(`/compliance-docs/${reviewModal.id}/review`, {
                status: reviewModal.status,
                note: reviewModal.note
            });
            message.success('Reviewed');
            setReviewModal({open: false, id: null, status: 'approved', note: ''});
            loadCompliance();
        } catch (e) {
            message.error(e.response?.data?.error || 'Review failed');
        }
    };

    // 许可证下拉容错（支持字符串或{label,value}）
    const licenseOptions = useMemo(
        () => (LICENSES || []).map(x => (typeof x === 'string' ? {label: x, value: x} : x)),
        []
    );

    const columns = [
        {title: 'ID', dataIndex: 'id', key: 'id', width: 70},
        {title: 'Type', dataIndex: 'type', key: 'type', render: t => <Tag>{t}</Tag>, width: 110},
        {
            title: 'File',
            dataIndex: 'uri',
            key: 'uri',
            render: (u) => (
                <a href={`http://localhost:3000${u}`} target="_blank" rel="noreferrer">
                    {u.split('/').pop()}
                </a>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 130,
            render: s => {
                const color = s === 'approved' ? 'green' : s === 'rejected' ? 'red' : 'gold';
                return <Tag color={color}>{s}</Tag>;
            }
        },
        {title: 'Uploader', key: 'uploader', width: 180, render: (_, r) => r.uploader?.email || r.uploaded_by},
        {title: 'Reviewer', key: 'reviewer', width: 180, render: (_, r) => r.reviewer?.email || '—'},
        {
            title: 'Actions',
            key: 'actions',
            width: 300,
            render: (_t, r) => {
                const canDelete = canDeleteAny || r.uploaded_by === user?.id;
                return (
                    <Space>
                        {canReview && r.status === 'pending' && (
                            <>
                                <Button icon={<CheckCircleOutlined/>}
                                        onClick={() => setReviewModal({
                                            open: true,
                                            id: r.id,
                                            status: 'approved',
                                            note: ''
                                        })}>
                                    Approve
                                </Button>
                                <Button danger icon={<CloseCircleOutlined/>}
                                        onClick={() => setReviewModal({
                                            open: true,
                                            id: r.id,
                                            status: 'rejected',
                                            note: ''
                                        })}>
                                    Reject
                                </Button>
                            </>
                        )}
                        {canDelete && (
                            <Popconfirm
                                title="Delete this document?"
                                onConfirm={async () => {
                                    try {
                                        await api.delete(`/compliance-docs/${r.id}`);
                                        message.success('Deleted');
                                        loadCompliance();
                                    } catch (e) {
                                        message.error(e.response?.data?.error || 'Delete failed');
                                    }
                                }}
                            >
                                <Button danger>Delete</Button>
                            </Popconfirm>
                        )}
                    </Space>
                );
            }
        }
    ];

    return (
        <div style={{padding: 24, maxWidth: 820}}>
            <Title level={2}>Edit Model #{id}</Title>

            {/* —— 基础信息表单（原逻辑保留） —— */}
            <Form layout="vertical" form={form} onFinish={onFinish}>
                <Form.Item name="name" label="Name *" rules={[{required: true}]}>
                    <Input id="name" placeholder="Model Name"/>
                </Form.Item>

                <Form.Item name="version" label="Version *" rules={[{required: true}]}>
                    <Input id="version" placeholder="e.g. v1.0.0"/>
                </Form.Item>

                <Form.Item name="description" label="Brief Description *" rules={[{required: true}]}>
                    <Input.TextArea id="description" rows={3}/>
                </Form.Item>

                <Form.Item name="input_schema" label="Input Schema *" rules={[{required: true}]}>
                    <Select id="input_schema">
                        {SCHEMA_MODES.map(m => <Option key={m} value={m}>{m}</Option>)}
                    </Select>
                </Form.Item>

                <Form.Item name="risk_level" label="Risk *" rules={[{required: true}]}>
                    <Select id="risk_level">
                        {RISK_LEVELS.map(r => <Option key={r} value={r}>{r}</Option>)}
                    </Select>
                </Form.Item>

                {/* Replace artifact (optional) */}
                <Form.Item name="files" label="Replace Model File(s)">
                    <Upload
                        id="files"
                        name="files"
                        multiple
                        accept=".onnx,.pkl,.pt,.pth,.h5,.pb,.joblib"
                        beforeUpload={() => false}
                        onChange={info => setArtifactFiles(info.fileList)}
                        fileList={artifactFiles}
                    >
                        <Button icon={<UploadOutlined/>}>Select Model Files</Button>
                    </Upload>
                </Form.Item>

                {/* README replace */}
                <Form.Item name="readme" label="Replace README">
                    <Upload
                        id="readme"
                        name="readme"
                        accept=".md,.txt"
                        maxCount={1}
                        beforeUpload={() => false}
                        onChange={info => setReadmeFile(info.fileList.slice(-1))}
                        fileList={readmeFile}
                    >
                        <Button icon={<UploadOutlined/>}>Select README</Button>
                    </Upload>
                </Form.Item>

                {/* Baseline metrics */}
                <Form.Item label="Baseline Metrics">
                    <Space wrap>
                        <Form.Item name="baseline_latency_ms" label="Latency (ms)" style={{marginBottom: 0}}>
                            <InputNumber id="baseline_latency_ms" min={0} step={1} placeholder="e.g. 12"/>
                        </Form.Item>
                        <Form.Item name="baseline_accuracy" label="Accuracy" style={{marginBottom: 0}}>
                            <InputNumber id="baseline_accuracy" min={0} max={1} step={0.0001} placeholder="0~1"/>
                        </Form.Item>
                        <Form.Item name="baseline_f1" label="F1" style={{marginBottom: 0}}>
                            <InputNumber id="baseline_f1" min={0} max={1} step={0.0001} placeholder="0~1"/>
                        </Form.Item>
                        <Form.Item name="baseline_auc" label="AUC" style={{marginBottom: 0}}>
                            <InputNumber id="baseline_auc" min={0} max={1} step={0.0001} placeholder="0~1"/>
                        </Form.Item>
                    </Space>
                </Form.Item>

                {/* Business tags */}
                <Form.Item name="business_tags" label="Business Tags">
                    <Select
                        id="business_tags"
                        mode="tags"
                        tokenSeparators={[',']}
                        placeholder="Type tag and press Enter or comma"
                    />
                </Form.Item>

                {/* Owner contact */}
                <Form.Item name="owner_contact" label="Owner Contact">
                    <Input id="owner_contact" placeholder="Name and email" autoComplete="name email"/>
                </Form.Item>

                {/* License（容错 options） */}
                <Form.Item name="license" label="License">
                    <Select id="license" placeholder="Select license" allowClear options={licenseOptions}/>
                </Form.Item>

                {/* Dataset dependencies */}
                <Form.Item name="training_data" label="Training Data (upload multiple)">
                    <Upload
                        id="training_data"
                        name="training_data"
                        multiple
                        accept=".csv,.json,.parquet,.zip"
                        beforeUpload={() => false}
                        onChange={info => setTrainingFiles(info.fileList)}
                        fileList={trainingFiles}
                    >
                        <Button icon={<UploadOutlined/>}>Select Training Data</Button>
                    </Upload>
                </Form.Item>

                <Form.Item name="validation_data" label="Validation Data (upload multiple)">
                    <Upload
                        id="validation_data"
                        name="validation_data"
                        multiple
                        accept=".csv,.json,.parquet,.zip"
                        beforeUpload={() => false}
                        onChange={info => setValidationFiles(info.fileList)}
                        fileList={validationFiles}
                    >
                        <Button icon={<UploadOutlined/>}>Select Validation Data</Button>
                    </Upload>
                </Form.Item>

                <Form.Item>
                    <Space>
                        <Button type="primary" htmlType="submit">Save</Button>
                        <Button onClick={() => navigate(-1)}>Cancel</Button>
                    </Space>
                </Form.Item>
            </Form>

            {/* —— 合规模块（上传 + 审核） —— */}
            <Title level={4} style={{marginTop: 24}}>Compliance Documents</Title>

            {/* 上传（uploader/admin） */}
            <Space direction="vertical" size="small" style={{marginBottom: 12, width: '100%'}}>
                <Upload
                    id="compliance_docs"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.md"
                    beforeUpload={() => false}
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
                    fileList={complianceFiles}
                    itemRender={(originNode, file) => (
                        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                            {originNode}
                            <Select
                                size="small"
                                placeholder="Type"
                                style={{width: 160}}
                                value={complianceTypes[file.uid]}
                                onChange={(val) => setComplianceTypes(prev => ({...prev, [file.uid]: val}))}
                                options={(COMPLIANCE_DOC_TYPES || ['FRIA', 'DPIA', 'PRIVACY', 'TERMS', 'OTHER'])
                                    .map(t => ({label: t, value: t}))}
                            />
                        </div>
                    )}
                >
                    <Button icon={<UploadOutlined/>}>Select Docs</Button>
                </Upload>
                <Button type="primary" onClick={uploadCompliance}>Upload Selected</Button>
            </Space>

            {/* 列表 + 审核 */}
            <Table
                rowKey="id"
                dataSource={docs}
                columns={columns}
                pagination={{pageSize: 10}}
            />

            {/* 审核弹窗 */}
            <Modal
                open={reviewModal.open}
                title={reviewModal.status === 'approved' ? 'Approve Document' : 'Reject Document'}
                onCancel={() => setReviewModal({open: false, id: null, status: 'approved', note: ''})}
                onOk={doReview}
            >
                <p>Status: <b>{reviewModal.status}</b></p>
                <Input.TextArea
                    value={reviewModal.note}
                    onChange={e => setReviewModal(s => ({...s, note: e.target.value}))}
                    placeholder="Optional note"
                    rows={4}
                />
            </Modal>
        </div>
    );
}
