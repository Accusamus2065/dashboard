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
    InputNumber,
    Card,
    Divider,
    Tooltip,
    Modal,
    Tag,
} from 'antd';
import {
    UploadOutlined,
    InboxOutlined,
    ArrowLeftOutlined,
    QuestionCircleOutlined,
    FileTextOutlined,
    DeleteOutlined,
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

    // files
    const [artifactFiles, setArtifactFiles] = useState([]);
    const [readmeFile, setReadmeFile] = useState([]);
    const [complianceFiles, setComplianceFiles] = useState([]);
    const [complianceTypes, setComplianceTypes] = useState({});
    const [guideOpen, setGuideOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // LICENSE options
    const licenseOptions = useMemo(
        () => (LICENSES || []).map(x => (typeof x === 'string' ? {label: x, value: x} : x)),
        []
    );

    const onFinish = async (values) => {
        // require a type for every uploaded compliance file
        const needTypeButMissing =
            complianceFiles.length > 0 && complianceFiles.some(f => !complianceTypes[f.uid]);
        if (needTypeButMissing) {
            message.error('Please select a type for each compliance document.');
            return;
        }

        const data = new FormData();
        const simpleFields = [
            'name', 'version', 'description', 'input_schema', 'risk_level',
            'owner_contact', 'license',
            'baseline_latency_ms', 'baseline_accuracy', 'baseline_f1', 'baseline_auc',
        ];
        simpleFields.forEach(k => {
            if (values[k] !== undefined && values[k] !== null && values[k] !== '') {
                data.append(k, values[k]);
            }
        });

        if (Array.isArray(values.business_tags)) {
            data.append('business_tags', JSON.stringify(values.business_tags));
        }

        artifactFiles.forEach(f => data.append('files', f.originFileObj)); // single zip (maxCount=1)
        if (readmeFile[0]?.originFileObj) data.append('readme', readmeFile[0].originFileObj);

        // compliance docs
        setSubmitting(true);
        try {
            const createRes = await api.post('/models', data, {headers: {'Content-Type': 'multipart/form-data'}});
            const created = createRes.data;
            const modelId = created?.id;

            if (modelId && complianceFiles.length > 0) {
                for (const f of complianceFiles) {
                    const fd = new FormData();
                    fd.append('type', complianceTypes[f.uid]);
                    fd.append('doc', f.originFileObj);
                    await api.post(`/models/${modelId}/compliance-docs`, fd, {
                        headers: {'Content-Type': 'multipart/form-data'}
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

    // ---- helpers for tooltip labels ----
    const Info = ({children, placement = 'right'}) => (
        <Tooltip title={<div className={styles.tip}>{children}</div>}
                 overlayClassName={styles.tipOverlay}
                 placement={placement}>
            <QuestionCircleOutlined className={styles.helpIcon}/>
        </Tooltip>
    );
    const labelWithInfo = (text, tip, after = null) => (
        <span className={styles.labelWithIcon}>
      {text} <Info>{tip}</Info>{after}
    </span>
    );
    const metricLabel = (text, tip) => labelWithInfo(text, tip);

    // ---- tips ----
    const tipInputSchema = (
        <>
            <b>What it is:</b> Input schema describes the request shape for inference.<br/><br/>
            <b>Common modes:</b><br/>
            • <b>generic</b>: JSON key/values (e.g. {"{"}"age":27,"income":50000{"}"}).<br/>
            • <b>feature-map</b>: numeric vector/tensor.<br/>
            • <b>image</b>: image bytes/URLs with same preprocessing.<br/>
            • <b>text</b>: plain text; note tokenization/limits.<br/>
            • <b>sequence</b>: time/discrete sequences.<br/><br/>
            <b>Tip:</b> Put field types, ranges, shapes and examples in README.
        </>
    );
    const tipRisk = (
        <>
            <b>What it is:</b> Risk drives required compliance docs.<br/><br/>
            <b>Levels:</b> low (none) · medium (PRIVACY) · high (FRIA + DPIA + PRIVACY).<br/><br/>
            <b>Counting rules:</b> Missing = required <i>types</i> not uploaded; Pending = uploaded but awaiting review.
        </>
    );
    const tipCompliance = (
        <>
            <b>Types:</b> FRIA (fundamental rights), DPIA (data protection), PRIVACY (policy), TERMS (usage), OTHER
            (e.g. model card).<br/><br/>
            Docs start as <i>pending</i> and require auditor/admin review. Only <b>approved</b> docs show on the detail
            page.<br/><br/>
            <b>Required by risk:</b> Low: none · Medium: PRIVACY · High: FRIA + DPIA + PRIVACY.
        </>
    );
    const tipAcc = <>Fraction of predictions that are correct (0–1).</>;
    const tipF1 = <>Harmonic mean of precision &amp; recall (0–1).</>;
    const tipAUC = <>Area under ROC (0–1); robust to class imbalance.</>;
    const tipLatency = <>Average time per inference (ms) under expected load.</>;

    // model file label with Learn more modal trigger
    const modelFileLabel = labelWithInfo(
        'Model File (.zip only)',
        'Upload a single .zip containing your runnable model and manifest.json.',
        <Button
            type="link"
            size="small"
            className={styles.inlineLink}
            onClick={() => setGuideOpen(true)}
        >
            Learn more
        </Button>
    );

    // compliance: remove single file from list
    const removeCompliance = (uid) => {
        const next = complianceFiles.filter(f => f.uid !== uid);
        const nextTypes = {...complianceTypes};
        delete nextTypes[uid];
        setComplianceFiles(next);
        setComplianceTypes(nextTypes);
    };

    // size helper
    const humanSize = (bytes = 0) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className={styles.wrapper}>
            <Card className={styles.card} bordered={false}>
                {/* Top bar */}
                <div className={styles.topbar}>
                    <Button icon={<ArrowLeftOutlined/>} onClick={() => navigate(-1)} aria-label="Back">
                        Back
                    </Button>

                    <div className={styles.header}>
                        <Title level={2} style={{margin: 0, marginTop: 6}}>Upload Model</Title>
                        <Text className={styles.subtitle}>
                            Upload a new model to the platform. Compliance Documents can be added later; all other
                            fields must be completed.
                        </Text>
                    </div>
                </div>

                <Divider style={{margin: '8px 0 14px'}}/>

                <Form
                    className={styles.form}
                    layout="vertical"
                    form={form}
                    requiredMark={false}
                    validateTrigger="onSubmit"
                    onFinish={onFinish}
                    onFinishFailed={() => message.error('Please complete all required fields before submitting.')}
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

                        <Form.Item
                            name="input_schema"
                            label={labelWithInfo('Input Schema', tipInputSchema)}
                            rules={[{required: true}]}
                        >
                            <Select id="input_schema">
                                {SCHEMA_MODES.map(m => (<Option key={m} value={m}>{m}</Option>))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="risk_level"
                            label={labelWithInfo('Risk', tipRisk)}
                            rules={[{required: true}]}
                        >
                            <Select id="risk_level">
                                {RISK_LEVELS.map(r => (<Option key={r} value={r}>{r}</Option>))}
                            </Select>
                        </Form.Item>

                        <Form.Item name="license" label="License">
                            <Select id="license" placeholder="Select license" allowClear options={licenseOptions}/>
                        </Form.Item>

                        <Form.Item name="owner_contact" label="Owner Contact">
                            <Input id="owner_contact" placeholder="Name and email, separated by comma"
                                   autoComplete="name email"/>
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

                    {/* Baseline Metrics */}
                    <div className={styles.sectionTitle}>Baseline Metrics</div>
                    <div className={`${styles.group} ${styles.metricsGrid}`}>
                        <Form.Item
                            name="baseline_accuracy"
                            label={metricLabel('Accuracy', tipAcc)}
                            rules={[{required: true}]}
                            className={styles.metricItem}
                        >
                            <InputNumber id="baseline_accuracy" min={0} max={1} step={0.0001} placeholder="0–1"
                                         className={styles.metricInput}/>
                        </Form.Item>

                        <Form.Item
                            name="baseline_f1"
                            label={metricLabel('F1 Score', tipF1)}
                            rules={[{required: true}]}
                            className={styles.metricItem}
                        >
                            <InputNumber id="baseline_f1" min={0} max={1} step={0.0001} placeholder="0–1"
                                         className={styles.metricInput}/>
                        </Form.Item>

                        <Form.Item
                            name="baseline_auc"
                            label={metricLabel('Area Under the Curve', tipAUC)}
                            rules={[{required: true}]}
                            className={styles.metricItem}
                        >
                            <InputNumber id="baseline_auc" min={0} max={1} step={0.0001} placeholder="0–1"
                                         className={styles.metricInput}/>
                        </Form.Item>

                        <Form.Item
                            name="baseline_latency_ms"
                            label={metricLabel('Latency (ms)', tipLatency)}
                            rules={[{required: true}]}
                            className={styles.metricItem}
                        >
                            <InputNumber id="baseline_latency_ms" min={0} step={1} placeholder="e.g. 12"
                                         className={styles.metricInput}/>
                        </Form.Item>
                    </div>

                    {/* Files */}
                    <div className={styles.sectionTitle}>Files</div>
                    <div className={`${styles.group} ${styles.twoCol}`}>
                        {/* Model zip (single) */}
                        <Form.Item
                            name="files"
                            label={modelFileLabel}
                            rules={[{required: true, message: 'Please select a model .zip file'}]}
                        >
                            <Dragger
                                id="files"
                                multiple={false}
                                maxCount={1}
                                accept=".zip"
                                beforeUpload={() => false}
                                onChange={info => setArtifactFiles(info.fileList.slice(-1))}
                                fileList={artifactFiles}
                            >
                                <p className="ant-upload-drag-icon"><InboxOutlined/></p>
                                <p className="ant-upload-text">Click or drag a single .zip here</p>
                            </Dragger>
                        </Form.Item>

                        {/* README */}
                        <Form.Item name="readme" label="README (.md or .pdf)">
                            <Dragger
                                id="readme"
                                accept=".md,.pdf"
                                maxCount={1}
                                beforeUpload={() => false}
                                onChange={info => setReadmeFile(info.fileList.slice(-1))}
                                fileList={readmeFile}
                            >
                                <p className="ant-upload-drag-icon"><UploadOutlined/></p>
                                <p className="ant-upload-text">Click or drag README.md / README.pdf here</p>
                            </Dragger>
                        </Form.Item>
                    </div>

                    {/* Compliance — redesigned */}
                    <div className={styles.sectionTitle}>
                        {labelWithInfo('Compliance Documents', tipCompliance)}
                    </div>
                    <div className={styles.group}>
                        <div className={styles.compHeader}>
                            <div className={styles.compLegend}>
                                <Tag color="blue">Medium</Tag> requires <b>PRIVACY</b>
                                <span className={styles.dot}>|</span>
                                <Tag color="red">High</Tag> requires <b>FRIA + DPIA + PRIVACY</b>
                            </div>
                            <Text type="secondary" className={styles.compHint}>
                                Uploaded files start as <i>pending</i>; only approved docs are visible on the model
                                page.
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
                                            options={COMPLIANCE_TYPES.map(t => ({label: t, value: t}))}
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

                    {/* Submit */}
                    <div className={styles.actions}>
                        <Button type="primary" htmlType="submit" loading={submitting}>
                            Submit
                        </Button>
                    </div>
                </Form>
            </Card>

            {/* Learn more modal */}
            <Modal
                title="Model File (.zip) — Full guide"
                open={guideOpen}
                onCancel={() => setGuideOpen(false)}
                footer={null}
                width={720}
                styles={{body: {padding: 16}}}
            >
                <div className={`${styles.guideBody} ${styles.customScroll}`}>
                    <p><b>Only one file (.zip)</b>. The ZIP packages your runnable model and metadata.</p>

                    <p><b>Recommended layout:</b></p>
                    <pre className={styles.preBlock}>
{`<name>-<version>/
manifest.json   # REQUIRED: tells how to load/infer
model/          # model files
  model.onnx|pt|h5|...
assets/         # optional preprocess files
  labels.json, tokenizer.json, ...`}
          </pre>

                    <p><b>manifest.json (required) minimal example:</b></p>
                    <pre className={styles.preBlock}>
{`{
  "framework": "onnx|pytorch|tensorflow|keras|sklearn",
  "entry": "model/model.onnx",
  "task": "classification|regression|embedding|segmentation",
  "signature": {"inputs":[...], "outputs":[...]}
}`}
          </pre>

                    <p>
                        <b>ZIP naming rules:</b> must end with <code>.zip</code>; ASCII <code>[A-Za-z0-9._-]</code>, no
                        spaces.
                        Suggest: <code>fraud-detector-v1.2.0.zip</code>
                    </p>
                </div>
            </Modal>
        </div>
    );
}