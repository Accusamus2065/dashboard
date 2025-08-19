// scripts/seed.js
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const archiver = require('archiver');

const sequelize = require('../config/sequelize');
const {User} = require('../models/user');
const {Model, SCHEMA_MODES, RISK_LEVELS, LICENSES} = require('../models/model');
const {ComplianceDoc} = require('../models/complianceDoc');
const {DataTypes} = require('sequelize');

// 复用后端里同结构的更新表（只需最简字段）
const ModelUpdate = sequelize.define('ModelUpdate', {
    model_id: {type: DataTypes.INTEGER, allowNull: false},
    actor_id: {type: DataTypes.INTEGER, allowNull: false},
    update_type: {type: DataTypes.STRING(40), allowNull: false},
    note: {type: DataTypes.TEXT, allowNull: true},
    meta: {type: DataTypes.JSONB, allowNull: true},
    name_snapshot: {type: DataTypes.STRING, allowNull: true},
    version_snapshot: {type: DataTypes.STRING, allowNull: true},
}, {
    tableName: 'model_updates',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

const argv = process.argv.slice(2);
const WANT_RESET = argv.includes('--reset');

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, {recursive: true});

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const nowStamp = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** ------------ 时间分布：今年 6/1 ~ 8/19 ------------ **/
const THIS_YEAR = new Date().getFullYear();
const SEED_START = new Date(`${THIS_YEAR}-06-01T00:00:00Z`);
const SEED_END = new Date(`${THIS_YEAR}-08-19T23:59:59Z`);

function randomDateBetween(start, end) {
    const t = start.getTime() + Math.random() * (end.getTime() - start.getTime());
    return new Date(Math.round(t));
}

function randomTimestamps() {
    const created_at = randomDateBetween(SEED_START, new Date(SEED_END.getTime() - 1000 * 60 * 60 * 24 * 3)); // 至少留 3 天给 updated
    const updated_at = randomDateBetween(created_at, SEED_END);
    return {created_at, updated_at};
}

/** ------------ 真实 zip：写入 manifest.json、一个假的模型文件和可选 assets/labels.json ------------ **/
async function createArtifactZip({name, version, task, framework = 'onnx'}) {
    const fname = `${nowStamp()}_${name.replace(/[^A-Za-z0-9._-]/g, '-')}_${version}.zip`;
    const fpath = path.join(UPLOAD_DIR, fname);

    const output = fs.createWriteStream(fpath);
    const archive = archiver('zip', {zlib: {level: 9}});
    const zipDone = new Promise((resolve, reject) => {
        output.on('close', resolve);
        archive.on('error', reject);
    });

    archive.pipe(output);

    const manifest = {
        framework,
        entry: framework === 'onnx' ? 'model/model.onnx' : 'model/model.pt',
        task,
        signature: {
            inputs: [{name: 'input', dtype: 'float32', shape: ['N', 'D']}],
            outputs: [{name: 'output', dtype: 'float32', shape: ['N']}]
        }
    };
    archive.append(JSON.stringify(manifest, null, 2), {name: 'manifest.json'});

    if (framework === 'onnx') archive.append('ONNX_DUMMY_CONTENT', {name: 'model/model.onnx'});
    else archive.append('PYTORCH_DUMMY_CONTENT', {name: 'model/model.pt'});

    if (task === 'classification') {
        archive.append(JSON.stringify(['negative', 'positive'], null, 2), {name: 'assets/labels.json'});
    }

    archive.finalize();
    await zipDone;
    return `/uploads/${fname}`;
}

function writeFile(ext, content) {
    const fname = `${nowStamp()}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, fname), content);
    return `/uploads/${fname}`;
}

/** ------------ metrics：统一保证非空且合理（0.75~0.996 等） ------------ **/
function r(min, max, d = 4) {
    const v = min + Math.random() * (max - min);
    return Number(v.toFixed(d));
}

function fillMetrics(task, base) {
    // 已提供的用提供值；若为 0 或不存在，则补上合理区间
    const has = (x) => (typeof x === 'number') && x > 0;

    // 针对不同任务给出稍微不同的分布倾向
    let acc = has(base.acc) ? base.acc : r(0.82, 0.99);
    let f1 = has(base.f1) ? base.f1 : r(0.78, 0.98);
    let auc = has(base.auc) ? base.auc : r(0.85, 0.996);

    // 让数值彼此更“像真的”
    if (task === 'regression' || task === 'ranking' || task === 'embedding' || task === 'segmentation') {
        // 这些任务其实更适合别的指标，但表结构就这三项：填入可读的 0~1 值
        acc = r(0.83, 0.97);
        f1 = r(0.80, 0.96);
        auc = Math.max(acc, f1, r(0.86, 0.995)); // AUC 通常不会比二者更差
    }

    // 避免极端排序：确保 0<acc,f1,auc<=0.9996
    acc = Math.min(Math.max(acc, 0.5), 0.9996);
    f1 = Math.min(Math.max(f1, 0.5), 0.9996);
    auc = Math.min(Math.max(auc, 0.5), 0.9996);

    // latency 若缺失（不会），兜底
    const latency = base.latency ?? Math.round(r(5, 45, 0));

    return {acc, f1, auc, latency};
}

/** ------------ README 生成 ------------ **/
function buildReadme({name, task, schema, description, metrics}) {
    return `# ${name}

${description}

## Inference
- **Task**: ${task}
- **Input schema**: ${schema}
- **Batching**: Supported
- **Latency target (p95)**: ${metrics.latency} ms

## Metrics (offline)
- Accuracy: ${metrics.acc}
- F1: ${metrics.f1}
- AUC: ${metrics.auc}

## Example
\`\`\`json
{"input": [0.12, 0.03, 0.98, 0.44]}
\`\`\`

## Notes
- Monitored with simple health checks and traffic shadowing.
- This is a seeded example for development/demo.
`;
}

/** ------------ 合规文档模板 ------------ **/
function buildCompliance(type, modelName) {
    const base = `# ${type} for ${modelName}

This document summarizes the ${type} considerations for the model **${modelName}**.

- Purpose & scope: internal demo seed.
- Data categories: synthetic / anonymized examples.
- Risks & mitigations: human review, rate limiting, abuse monitoring.
- Contacts: Privacy & Security teams.
`;
    return base;
}

/** ------------ 固定用户 & 模型清单（与你给的一致） ------------ **/
const USERS = [
    {email: 'admin@acme.com', role: 'admin'},
    {email: 'auditor@acme.com', role: 'auditor'},
    {email: 'uploader@acme.com', role: 'uploader'},
    {email: 'viewer@acme.com', role: 'viewer'},
];

const MODELS = [
    {
        name: 'Card Fraud Detector', task: 'classification', schema: 'generic', risk: 'high',
        tags: ['payments', 'fraud', 'risk'],
        desc: 'Detects card-not-present fraud using aggregated transaction and device signals. Trained on historical approvals and chargebacks.',
        metrics: {acc: 0.9643, f1: 0.7812, auc: 0.9871, latency: 18}
    },
    {
        name: 'KYC ID OCR & Validation', task: 'classification', schema: 'image', risk: 'medium',
        tags: ['kyc', 'vision', 'compliance'],
        desc: 'OCR for ID documents and basic forgery heuristics. Used to pre-screen submissions before human review.',
        metrics: {acc: 0.9822, f1: 0.9735, auc: 0.9910, latency: 42}
    },
    {
        name: 'Transaction Embedding Service', task: 'embedding', schema: 'generic', risk: 'low',
        tags: ['payments', 'embedding', 'similarity'],
        desc: 'Generates 128-d embeddings for downstream anomaly detection and retrieval over transactions.',
        metrics: {acc: 0.0, f1: 0.0, auc: 0.0, latency: 7}
    },
    {
        name: 'Product Recommender v2', task: 'ranking', schema: 'sequence', risk: 'low',
        tags: ['recommendation', 'retention', 'marketing'],
        desc: 'Session-based ranking model recommending next best products. Incorporates recency and diversity constraints.',
        metrics: {acc: 0.0, f1: 0.0, auc: 0.0, latency: 24}
    },
    {
        name: 'Customer Churn Classifier', task: 'classification', schema: 'feature-map', risk: 'low',
        tags: ['churn', 'retention', 'crm'],
        desc: 'Binary churn prediction for subscription users. Uses usage frequency, support tickets and billing signals.',
        metrics: {acc: 0.8921, f1: 0.7448, auc: 0.9242, latency: 11}
    },
    {
        name: 'Pricing Elasticity Regressor', task: 'regression', schema: 'feature-map', risk: 'low',
        tags: ['pricing', 'forecast', 'finance'],
        desc: 'Estimates demand response to price changes per product segment. Aids price experimentation.',
        metrics: {acc: 0.0, f1: 0.0, auc: 0.0, latency: 13}
    },
    {
        name: 'Ad CTR Predictor', task: 'classification', schema: 'generic', risk: 'low',
        tags: ['ads', 'ctr', 'ranking'],
        desc: 'Predicts click-through rate for display ads using user/device context and creative features.',
        metrics: {acc: 0.8123, f1: 0.7019, auc: 0.8610, latency: 9}
    },
    {
        name: 'Conversation Toxicity Filter', task: 'classification', schema: 'text', risk: 'medium',
        tags: ['nlp', 'moderation', 'safety'],
        desc: 'Classifies harmful text (harassment, hate, self-harm cues) for chat moderation with appeal pipeline.',
        metrics: {acc: 0.9384, f1: 0.9012, auc: 0.9655, latency: 15}
    },
    {
        name: 'PII Redactor (Text)', task: 'classification', schema: 'text', risk: 'medium',
        tags: ['privacy', 'nlp', 'masking'],
        desc: 'Detects and redacts common PII (emails, phones, addresses) in support transcripts before indexing.',
        metrics: {acc: 0.9551, f1: 0.9279, auc: 0.9742, latency: 17}
    },
    {
        name: 'Support Topic Classifier', task: 'classification', schema: 'text', risk: 'low',
        tags: ['support', 'routing', 'nlp'],
        desc: 'Routes support tickets into topics (billing, login, refunds) to assist triage and SLA planning.',
        metrics: {acc: 0.9145, f1: 0.9020, auc: 0.9481, latency: 8}
    },
    {
        name: 'Ops Anomaly Detector', task: 'classification', schema: 'sequence', risk: 'low',
        tags: ['ops', 'anomaly', 'monitoring'],
        desc: 'Detects anomalies in service metrics streams using rolling baselines and seasonal patterns.',
        metrics: {acc: 0.9022, f1: 0.6888, auc: 0.9180, latency: 6}
    },
    {
        name: 'Demand Forecaster', task: 'regression', schema: 'sequence', risk: 'low',
        tags: ['forecast', 'inventory', 'planning'],
        desc: 'Predicts weekly demand per SKU for replenishment. Incorporates holidays and promotions.',
        metrics: {acc: 0.0, f1: 0.0, auc: 0.0, latency: 21}
    },
    {
        name: 'Image Quality Scorer', task: 'regression', schema: 'image', risk: 'low',
        tags: ['vision', 'quality', 'ranking'],
        desc: 'Scores product photos for sharpness, exposure and background clutter; used for catalog QA.',
        metrics: {acc: 0.0, f1: 0.0, auc: 0.0, latency: 19}
    },
    {
        name: 'Face Blur Utility', task: 'segmentation', schema: 'image', risk: 'medium',
        tags: ['privacy', 'vision', 'safety'],
        desc: 'Detects faces and applies Gaussian blur for privacy before storing user-uploaded media.',
        metrics: {acc: 0.0, f1: 0.0, auc: 0.0, latency: 33}
    },
    {
        name: 'Invoice Parser', task: 'classification', schema: 'image', risk: 'medium',
        tags: ['finance', 'ocr', 'automation'],
        desc: 'Parses invoices and extracts totals, dates, suppliers with key-value detection and heuristics.',
        metrics: {acc: 0.9721, f1: 0.9584, auc: 0.9844, latency: 38}
    },
    {
        name: 'ADR Extractor (Pharmacovigilance)', task: 'classification', schema: 'text', risk: 'high',
        tags: ['health', 'nlp', 'safety'],
        desc: 'Extracts adverse drug reaction mentions from clinical notes to assist signal detection.',
        metrics: {acc: 0.9210, f1: 0.8865, auc: 0.9482, latency: 27}
    },
    {
        name: 'Mail Spam Classifier', task: 'classification', schema: 'text', risk: 'low',
        tags: ['security', 'nlp', 'filtering'],
        desc: 'Filters spam and phishing emails combining lexical features and URL reputation.',
        metrics: {acc: 0.9655, f1: 0.9520, auc: 0.9815, latency: 10}
    },
    {
        name: 'Language Detector', task: 'classification', schema: 'text', risk: 'low',
        tags: ['nlp', 'i18n', 'routing'],
        desc: 'Detects language of short queries for proper routing and model selection.',
        metrics: {acc: 0.9820, f1: 0.9781, auc: 0.9902, latency: 5}
    },
    {
        name: 'Entity Linking (Catalog)', task: 'classification', schema: 'text', risk: 'low',
        tags: ['nlp', 'search', 'catalog'],
        desc: 'Links free-text product mentions to catalog entities for analytics and search.',
        metrics: {acc: 0.9012, f1: 0.8640, auc: 0.9344, latency: 22}
    },
    {
        name: 'Semantic Search Encoder', task: 'embedding', schema: 'text', risk: 'low',
        tags: ['nlp', 'embedding', 'search'],
        desc: 'Sentence embedding model (384-d) used for semantic search and FAQ retrieval.',
        metrics: {acc: 0.0, f1: 0.0, auc: 0.0, latency: 12}
    },
    {
        name: 'Lead Scoring Model', task: 'classification', schema: 'feature-map', risk: 'low',
        tags: ['sales', 'crm', 'ranking'],
        desc: 'Scores inbound leads based on fit and engagement signals to prioritize outreach.',
        metrics: {acc: 0.8421, f1: 0.7840, auc: 0.9022, latency: 16}
    },
    {
        name: 'Loan Default Risk', task: 'classification', schema: 'feature-map', risk: 'high',
        tags: ['finance', 'risk', 'credit'],
        desc: 'Predicts probability of loan default with fairness checks and challenger models in place.',
        metrics: {acc: 0.9111, f1: 0.8025, auc: 0.9432, latency: 20}
    },
    {
        name: 'Claims Fraud Detector', task: 'classification', schema: 'feature-map', risk: 'high',
        tags: ['insurance', 'fraud', 'risk'],
        desc: 'Flags suspicious insurance claims combining claim history, provider patterns and graph features.',
        metrics: {acc: 0.9360, f1: 0.8188, auc: 0.9621, latency: 23}
    },
    {
        name: 'Abuse IP Reputation', task: 'classification', schema: 'generic', risk: 'medium',
        tags: ['security', 'abuse', 'ip'],
        desc: 'Scores IP addresses for abuse likelihood using login failures, velocity and threat feeds.',
        metrics: {acc: 0.9410, f1: 0.8992, auc: 0.9680, latency: 14}
    },
];

// 风险 -> 必需合规类型
const REQUIRED = {
    high: ['FRIA', 'DPIA', 'PRIVACY'],
    medium: ['PRIVACY'],
    low: []
};

(async () => {
    try {
        await sequelize.authenticate();

        if (WANT_RESET) {
            console.log('[seed] dropping & recreating tables…');
            await sequelize.sync({force: true});
        } else {
            await sequelize.sync();
        }

        // ---- 用户 ----
        const hash = await bcrypt.hash('Password123!', 10);
        const existingEmails = new Set((await User.findAll({attributes: ['email']})).map(u => u.email));
        const toCreate = USERS.filter(u => !existingEmails.has(u.email))
            .map(u => ({...u, password_hash: hash}));
        if (toCreate.length) await User.bulkCreate(toCreate);

        const allUsers = await User.findAll({attributes: ['id', 'email', 'role']});
        const getByRole = (role) => allUsers.find(u => u.role === role);
        const admin = getByRole('admin');
        const auditor = getByRole('auditor');
        const uploader = getByRole('uploader') || admin;

        console.log(`[seed] users present: ${allUsers.length}`);

        // ---- 模型 + 文件 + 合规 ----
        let createdCount = 0;
        for (let i = 0; i < MODELS.length; i++) {
            const base = MODELS[i];

            const schema = SCHEMA_MODES.includes(base.schema) ? base.schema : pick(SCHEMA_MODES);
            const risk = RISK_LEVELS.includes(base.risk) ? base.risk : pick(RISK_LEVELS);
            const license = pick(LICENSES);

            // metrics：统一补全非空
            const m = fillMetrics(base.task, base.metrics || {});
            // 版本
            const version = `v${1 + (i % 3)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`;

            // 构造 zip + readme
            const artifact_uri = await createArtifactZip({
                name: base.name, version, task: base.task, framework: pick(['onnx', 'pytorch'])
            });

            const readme_uri = writeFile('md', buildReadme({
                name: base.name,
                task: base.task,
                schema,
                description: base.desc,
                metrics: m
            }));

            // 可选训练/验证数据
            const training_data_uris = (i % 2 === 0)
                ? [writeFile('csv', 'id,feature1,feature2,label\n1,0.1,0.2,0\n2,0.3,0.8,1\n')]
                : null;
            const validation_data_uris = (i % 3 === 0)
                ? [writeFile('csv', 'id,feature1,feature2,label\n101,0.2,0.4,0\n102,0.9,0.1,1\n')]
                : null;

            // 时间戳：今年 6/1 ~ 8/19
            const {created_at, updated_at} = randomTimestamps();

            const created = await Model.create({
                name: base.name,
                version,
                description: base.desc,
                input_schema: schema,
                risk_level: risk,
                artifact_uri,
                readme_uri,
                baseline_latency_ms: m.latency,
                baseline_accuracy: m.acc,
                baseline_f1: m.f1,
                baseline_auc: m.auc,
                business_tags: base.tags,         // 会重复
                owner_contact: `Owner, ${uploader.email}`,
                license,
                training_data_uris,
                validation_data_uris,
                created_at,
                updated_at
            });

            createdCount++;

            // 合规文档（满足必需，并混合一点 pending）
            const required = REQUIRED[risk] || [];
            for (const t of required) {
                const uri = writeFile('md', buildCompliance(t, base.name));
                await ComplianceDoc.create({
                    model_id: created.id,
                    type: t,
                    uri,
                    uploaded_by: uploader.id,
                    status: (t === 'PRIVACY' && i % 5 === 0) ? 'pending' : 'approved',
                    reviewer_id: (t === 'PRIVACY' && i % 5 === 0) ? null : auditor.id,
                    reviewed_at: (t === 'PRIVACY' && i % 5 === 0) ? null : new Date()
                });
            }

            // 也给少数 low/medium 加一个非必需 TERMS，显得更真
            if (risk !== 'high' && i % 7 === 0) {
                const uri = writeFile('md', buildCompliance('TERMS', base.name));
                await ComplianceDoc.create({
                    model_id: created.id,
                    type: 'TERMS',
                    uri,
                    uploaded_by: uploader.id,
                    status: 'approved',
                    reviewer_id: auditor.id,
                    reviewed_at: new Date()
                });
            }

            // 更新历史（时间也落在 created_at ~ updated_at 之间）
            const updateCount = (i % 2 === 0 ? 2 : 1);
            for (let u = 0; u < updateCount; u++) {
                const updTime = randomDateBetween(created_at, updated_at);
                const row = await ModelUpdate.create({
                    model_id: created.id,
                    actor_id: uploader.id,
                    update_type: u === 0 ? 'basic' : 'model',
                    note: u === 0 ? 'Initial metadata & registration' : 'Initial artifact upload',
                    meta: {seed: true},
                    name_snapshot: created.name,
                    version_snapshot: created.version,
                    created_at: updTime
                });
                // 没有 updatedAt 列，无需再改
            }
        }

        console.log(`✅ Seed done. Users: ${allUsers.length}, Models: ${createdCount}`);
        console.log('Logins:');
        console.log('- admin@acme.com / Password123!');
        console.log('- auditor@acme.com / Password123!');
        console.log('- uploader@acme.com / Password123!');
        console.log('- viewer@acme.com / Password123!');
        console.log(`Uploads dir: ${UPLOAD_DIR}`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Seed failed:', err);
        process.exit(1);
    }
})();