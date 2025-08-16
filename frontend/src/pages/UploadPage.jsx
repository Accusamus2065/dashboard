import React, {useState, useMemo} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {
    Form,
    Input,
    Button,
    Select,
    Upload,
    message,
    Typography,
    Space,
    InputNumber,
    Card,
    Divider,
    Tooltip,
} from 'antd';
import {
    UploadOutlined,
    InboxOutlined,
    ArrowLeftOutlined,
    QuestionCircleOutlined,
} from '@ant-design/icons';
import {useNavigate} from 'react-router-dom';
import api from '../services/api';
import {SCHEMA_MODES, RISK_LEVELS, LICENSES} from '../constants/constant';
import styles from './UploadPage.module.css';

const {Title, Text} = Typography;
const {Option} = Select;
const {Dragger} = Upload;

const COMPLIANCE_TYPES = ['FRIA', 'DPIA', 'PRIVACY', 'TERMS', 'OTHER'];

export default function UploadPage() {
    const [form] = Form.useForm();
    const navigate = useNavigate();

    // Separate file lists for different fields
    const [artifactFiles, setArtifactFiles] = useState([]);
    const [readmeFile, setReadmeFile] = useState([]);
    const [complianceFiles, setComplianceFiles] = useState([]);
    const [trainingFiles, setTrainingFiles] = useState([]);
    const [validationFiles, setValidationFiles] = useState([]);

    const [complianceTypes, setComplianceTypes] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Normalize LICENSES into {label, value}
    const licenseOptions = useMemo(
        () => (LICENSES || []).map(x => (typeof x === 'string' ? {label: x, value: x} : x)),
        []
    );

    const onFinish = async (values) => {
        // If any compliance docs were uploaded, each must have a type selected
        const needTypeButMissing =
            complianceFiles.length > 0 && complianceFiles.some(f => !complianceTypes[f.uid]);
        if (needTypeButMissing) {
            message.error('Please select a type for each compliance document.');
            return;
        }

        const data = new FormData();

        // Basic fields
        const simpleFields = [
            'name',
            'version',
            'description',
            'input_schema',
            'risk_level',
            'owner_contact',
            'license',
            'baseline_latency_ms',
            'baseline_accuracy',
            'baseline_f1',
            'baseline_auc',
        ];
        simpleFields.forEach(k => {
            if (values[k] !== undefined && values[k] !== null && values[k] !== '') {
                data.append(k, values[k]);
            }
        });

        // Business tags (array) -> JSON string
        if (Array.isArray(values.business_tags)) {
            data.append('business_tags', JSON.stringify(values.business_tags));
        }

        // Files for model creation
        artifactFiles.forEach(f => data.append('files', f.originFileObj));
        if (readmeFile[0]?.originFileObj) data.append('readme', readmeFile[0].originFileObj);

        trainingFiles.forEach(f => data.append('training_data', f.originFileObj));
        validationFiles.forEach(f => data.append('validation_data', f.originFileObj));

        setSubmitting(true);
        try {
            const createRes = await api.post('/models', data, {
                headers: {'Content-Type': 'multipart/form-data'},
            });
            const created = createRes.data;
            const modelId = created?.id;

            // Upload compliance docs with selected types
            if (modelId && complianceFiles.length > 0) {
                for (const f of complianceFiles) {
                    const fd = new FormData();
                    fd.append('type', complianceTypes[f.uid]);
                    fd.append('doc', f.originFileObj); // server expects 'doc'
                    await api.post(`/models/${modelId}/compliance-docs`, fd, {
                        headers: {'Content-Type': 'multipart/form-data'},
                    });
                }
            }

            message.success('Model created');
            navigate('/');
        } catch (e) {
            message.error(e.response?.data?.error || 'Create failed');
        } finally {
            setSubmitting(false);
        }
    };

    const metricLabel = (text, tip) => (
        <span>
      {text}{' '}
            <Tooltip title={tip}>
        <QuestionCircleOutlined className={styles.helpIcon}/>
      </Tooltip>
    </span>
    );

    return (
        <div className={styles.wrapper}>
            <Card className={styles.card} bordered={false}>
                {/* Top bar with Back */}
                <div className={styles.topbar}>
                    <Button
                        icon={<ArrowLeftOutlined/>}
                        onClick={() => navigate(-1)}
                        aria-label="Back"
                    >
                        Back
                    </Button>

                    <div className={styles.header}>
                        <Title level={2} style={{margin: 0, marginTop: 6}}>Upload Model</Title>
                        <Text className={styles.subtitle}>
                            Compliance Documents and Datasets can be added later; all other fields must be completed.
                        </Text>
                    </div>
                </div>

                <Divider style={{margin: '8px 0 14px'}}/>

                <Form
                    className={styles.form}
                    layout="vertical"
                    form={form}
                    requiredMark={false}                 // no asterisks
                    validateTrigger="onSubmit"           // validate only on submit
                    onFinish={onFinish}
                    onFinishFailed={() => {
                        message.error('Please complete all required fields before submitting.');
                    }}
                    initialValues={{input_schema: SCHEMA_MODES[0], risk_level: RISK_LEVELS[1]}}
                >
                    {/* Basics */}
                    <div className={styles.sectionTitle}>Basics</div>
                    <div className={`${styles.group} ${styles.twoCol}`}>
                        <Form.Item name="name" label="Name" rules={[{required: true}]}>
                            <Input id="name" placeholder="Model Name" autoComplete="off"/>
                        </Form.Item>

                        <Form.Item name="version" label="Version" rules={[{required: true}]}>
                            <Input id="version" placeholder="e.g. v1.0.0" autoComplete="off"/>
                        </Form.Item>

                        <Form.Item name="input_schema" label="Input Schema" rules={[{required: true}]}>
                            <Select id="input_schema">
                                {SCHEMA_MODES.map(m => (
                                    <Option key={m} value={m}>{m}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item name="risk_level" label="Risk" rules={[{required: true}]}>
                            <Select id="risk_level">
                                {RISK_LEVELS.map(r => (
                                    <Option key={r} value={r}>{r}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item name="license" label="License">
                            <Select id="license" placeholder="Select license" allowClear options={licenseOptions}/>
                        </Form.Item>

                        <Form.Item name="owner_contact" label="Owner Contact">
                            <Input
                                id="owner_contact"
                                placeholder="Name and email, separated by comma"
                                autoComplete="name email"
                            />
                        </Form.Item>

                        <Form.Item
                            name="business_tags"
                            label="Business Tags"
                            className={styles.tags}
                            style={{gridColumn: '1 / -1'}}
                        >
                            <Select
                                id="business_tags"
                                mode="tags"
                                tokenSeparators={[',']}
                                placeholder="Type tag and press Enter or comma"
                                style={{width: '100%'}}
                                maxTagCount="responsive"
                            />
                        </Form.Item>

                        <Form.Item
                            name="description"
                            label="Brief Description"
                            rules={[{required: true}]}
                            style={{gridColumn: '1 / -1'}}
                        >
                            <Input.TextArea
                                id="description"
                                placeholder="Describe the model's purpose and functionality"
                                height={80}
                                autoSize={{minRows: 3, maxRows: 6}}
                            />
                        </Form.Item>
                    </div>

                    {/* Baseline Metrics (now above Files) */}
                    <div className={styles.sectionTitle}>Baseline Metrics</div>
                    <div className={`${styles.group} ${styles.metricsGrid}`}>
                        <Form.Item
                            name="baseline_accuracy"
                            label={metricLabel('Accuracy', 'Proportion of correct predictions (0–1).')}
                            rules={[{required: true}]}
                        >
                            <InputNumber id="baseline_accuracy" min={0} max={1} step={0.0001} placeholder="0–1"/>
                        </Form.Item>

                        <Form.Item
                            name="baseline_f1"
                            label={metricLabel('F1', 'Harmonic mean of precision and recall (0–1).')}
                            rules={[{required: true}]}
                        >
                            <InputNumber id="baseline_f1" min={0} max={1} step={0.0001} placeholder="0–1"/>
                        </Form.Item>

                        <Form.Item
                            name="baseline_auc"
                            label={metricLabel('AUC', 'Area under ROC curve (0–1).')}
                            rules={[{required: true}]}
                        >
                            <InputNumber id="baseline_auc" min={0} max={1} step={0.0001} placeholder="0–1"/>
                        </Form.Item>

                        <Form.Item
                            name="baseline_latency_ms"
                            label={metricLabel('Latency (ms)', 'Average runtime per inference in milliseconds.')}
                            rules={[{required: true}]}
                        >
                            <InputNumber id="baseline_latency_ms" min={0} step={1} placeholder="e.g. 12"/>
                        </Form.Item>
                    </div>

                    {/* Files (two-column draggers) */}
                    <div className={styles.sectionTitle}>Files</div>
                    <div className={`${styles.group} ${styles.twoCol}`}>
                        <Form.Item
                            name="files"
                            label="Model File(s)"
                            rules={[{required: true, message: 'Please select at least one model file'}]}
                        >
                            <Dragger
                                id="files"
                                multiple
                                accept=".onnx,.pkl,.pt,.pth,.h5,.pb,.joblib"
                                beforeUpload={() => false}
                                onChange={info => setArtifactFiles(info.fileList)}
                                fileList={artifactFiles}
                            >
                                <p className="ant-upload-drag-icon"><InboxOutlined/></p>
                                <p className="ant-upload-text">Click or drag model files here to upload</p>
                                <p className="ant-upload-hint">Supported: .onnx, .pkl, .pt, .pth, .h5, .pb, .joblib</p>
                            </Dragger>
                        </Form.Item>

                        <Form.Item name="readme" label="README (Markdown/Text)">
                            <Dragger
                                id="readme"
                                accept=".md,.txt"
                                maxCount={1}
                                beforeUpload={() => false}
                                onChange={info => setReadmeFile(info.fileList.slice(-1))}
                                fileList={readmeFile}
                            >
                                <p className="ant-upload-drag-icon"><UploadOutlined/></p>
                                <p className="ant-upload-text">Click or drag README.md / .txt here</p>
                            </Dragger>
                        </Form.Item>
                    </div>

                    {/* Compliance */}
                    <div className={styles.sectionTitle}>Compliance Documents</div>
                    <div className={styles.group}>
                        <Form.Item name="compliance_docs" label="Upload multiple docs and tag each with a type">
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
                                    <div className={styles.uploadRow}>
                                        {originNode}
                                        <Select
                                            size="small"
                                            placeholder="Type"
                                            style={{width: 150}}
                                            value={complianceTypes[file.uid]}
                                            onChange={(val) => setComplianceTypes(prev => ({...prev, [file.uid]: val}))}
                                            options={COMPLIANCE_TYPES.map(t => ({label: t, value: t}))}
                                        />
                                    </div>
                                )}
                            >
                                <Button icon={<UploadOutlined/>}>Select Docs</Button>
                            </Upload>
                        </Form.Item>
                    </div>

                    {/* Datasets (two-column draggers) */}
                    <div className={styles.sectionTitle}>Datasets</div>
                    <div className={`${styles.group} ${styles.twoCol}`}>
                        <Form.Item name="training_data" label="Training Data (upload multiple)">
                            <Dragger
                                id="training_data"
                                multiple
                                accept=".csv,.json,.parquet,.zip"
                                beforeUpload={() => false}
                                onChange={info => setTrainingFiles(info.fileList)}
                                fileList={trainingFiles}
                            >
                                <p className="ant-upload-drag-icon"><InboxOutlined/></p>
                                <p className="ant-upload-text">Click or drag training data files here</p>
                            </Dragger>
                        </Form.Item>

                        <Form.Item name="validation_data" label="Validation Data (upload multiple)">
                            <Dragger
                                id="validation_data"
                                multiple
                                accept=".csv,.json,.parquet,.zip"
                                beforeUpload={() => false}
                                onChange={info => setValidationFiles(info.fileList)}
                                fileList={validationFiles}
                            >
                                <p className="ant-upload-drag-icon"><InboxOutlined/></p>
                                <p className="ant-upload-text">Click or drag validation data files here</p>
                            </Dragger>
                        </Form.Item>
                    </div>

                    {/* Actions (Submit only) */}
                    <div className={styles.actions}>
                        <Button type="primary" htmlType="submit" loading={submitting}>
                            Submit
                        </Button>
                    </div>
                </Form>
            </Card>
        </div>
    );
}
