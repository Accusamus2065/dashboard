// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {Op, literal, fn, where} = require('sequelize');

const {Model, SCHEMA_MODES, RISK_LEVELS, LICENSES} = require('./models/model');
const {User, USER_ROLES} = require('./models/user');
const {ComplianceDoc, COMPLIANCE_TYPES, REVIEW_STATUSES} = require('./models/complianceDoc');
const {SecurityQA} = require('./models/securityQA');
const sequelize = require('./config/sequelize');
const {DataTypes} = require('sequelize');

const app = express();
app.use(cors({origin: 'http://localhost:5173', credentials: true}));
app.use(express.json());

// ---- JWT helpers ----
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function signToken(user) {
    return jwt.sign({uid: user.id, role: user.role}, JWT_SECRET, {expiresIn: '7d'});
}

// fetch latest role from DB on every request
async function authRequired(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({error: 'Unauthorized'});
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const dbUser = await User.findByPk(payload.uid, {attributes: ['id', 'role']});
        if (!dbUser) return res.status(401).json({error: 'Unauthorized'});
        req.user = {uid: dbUser.id, role: dbUser.role};
        next();
    } catch {
        return res.status(401).json({error: 'Invalid token'});
    }
}

function requireRole(roles) {
    const allow = Array.isArray(roles) ? roles : [roles];
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({error: 'Unauthorized'});
        if (!allow.includes(req.user.role)) return res.status(403).json({error: 'Forbidden'});
        next();
    };
}

// ---- uploads ----
const UPLOAD_DIR = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});

// 允许的类型较宽（合规/数据集等）；模型 ZIP 的强校验在路由里做
const upload = multer({
    storage,
    fileFilter: (_req, file, cb) => {
        const allowed = /\.(onnx|pt|pth|h5|pb|pkl|joblib|md|txt|pdf|doc|docx|csv|json|parquet|zip|png|jpg|jpeg|gif|svg)$/i;
        if (!allowed.test(file.originalname)) return cb(new Error('Unsupported file type'));
        cb(null, true);
    }
});
app.use('/uploads', express.static(UPLOAD_DIR));

// ---- Associations ----
ComplianceDoc.belongsTo(Model, {foreignKey: 'model_id'});
ComplianceDoc.belongsTo(User, {as: 'uploader', foreignKey: 'uploaded_by'});
ComplianceDoc.belongsTo(User, {as: 'reviewer', foreignKey: 'reviewer_id'});
SecurityQA.belongsTo(User, {foreignKey: 'user_id'});

Model.hasMany(ComplianceDoc, {foreignKey: 'model_id', as: 'docs'});

/** ---------------- 更新日志表 ModelUpdate ---------------- **/
const ModelUpdate = sequelize.define('ModelUpdate', {
    model_id: {type: DataTypes.INTEGER, allowNull: false},
    actor_id: {type: DataTypes.INTEGER, allowNull: false},
    update_type: {type: DataTypes.STRING(40), allowNull: false}, // 'model' | 'basic' | 'compliance_upload' | 'compliance_review'
    note: {type: DataTypes.TEXT, allowNull: true},
    meta: {type: DataTypes.JSONB, allowNull: true},
    prev_artifact_uri: {type: DataTypes.STRING, allowNull: true},
    new_artifact_uri: {type: DataTypes.STRING, allowNull: true},
    name_snapshot: {type: DataTypes.STRING, allowNull: true},
    version_snapshot: {type: DataTypes.STRING, allowNull: true},
}, {
    tableName: 'model_updates',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

ModelUpdate.belongsTo(Model, {foreignKey: 'model_id'});
ModelUpdate.belongsTo(User, {as: 'actor', foreignKey: 'actor_id'});
Model.hasMany(ModelUpdate, {foreignKey: 'model_id', as: 'updates'});
/** ---------------------------------------------------------------- **/

// ---- DB sync & seed admin ----
sequelize.sync({alter: true})
    .then(async () => {
        console.log('Database synced with alter');

        const {ADMIN_EMAIL, ADMIN_PASSWORD} = process.env;
        if (ADMIN_EMAIL && ADMIN_PASSWORD) {
            const existing = await User.findOne({where: {email: ADMIN_EMAIL}});
            if (!existing) {
                const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
                await User.create({email: ADMIN_EMAIL, password_hash: hash, role: 'admin'});
                console.log(`Seeded admin: ${ADMIN_EMAIL}`);
            }
        } else {
            console.log('Tip: set ADMIN_EMAIL & ADMIN_PASSWORD in .env to seed an admin');
        }
    })
    .catch(console.error);

// ---- helpers ----
const toNum = v => (v === undefined || v === null || v === '' ? null : Number(v));
const toArrayFromFiles = arr => (Array.isArray(arr) ? arr.map(f => `/uploads/${f.filename}`) : null);
const safeParseArray = v => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
        try {
            return JSON.parse(v);
        } catch {
            return null;
        }
    }
    return null;
};

// helper: safely remove a file referenced by a stored /uploads URI
function safeUnlinkByUri(uri) {
    if (!uri) return;
    const filename = path.basename(String(uri)); // strips leading /uploads/
    const fpath = path.join(UPLOAD_DIR, filename);
    fs.unlink(fpath, () => {
    }); // ignore ENOENT, etc.
}

// field-level redaction by role
function sanitizeModelForRole(modelRec, role) {
    const obj = modelRec.toJSON ? modelRec.toJSON() : {...modelRec};
    const r = role || 'viewer';

    if (r === 'admin' || r === 'uploader') return obj;
    if (r === 'auditor') {
        delete obj.training_data_uris;
        delete obj.validation_data_uris;
        return obj;
    }
    // viewer
    delete obj.owner_contact;
    delete obj.training_data_uris;
    delete obj.validation_data_uris;
    return obj;
}

// Compliance requirements by risk
const REQUIRED_DOCS = {
    high: ['FRIA', 'DPIA', 'PRIVACY'],
    medium: ['PRIVACY'],
    low: []
};

// ---- AUTH ROUTES ----
app.post('/auth/register', async (req, res) => {
    const {email, password, security_questions} = req.body || {};
    if (!email || !password) return res.status(400).json({error: 'Email & password required'});

    const existed = await User.findOne({where: {email}});
    if (existed) return res.status(409).json({error: 'Email already registered'});

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({email, password_hash: hash, role: 'viewer'});

    if (Array.isArray(security_questions) && security_questions.length >= 2 && security_questions.length <= 5) {
        for (const qa of security_questions) {
            if (!qa?.question || !qa?.answer) continue;
            const ah = await bcrypt.hash(String(qa.answer).trim(), 10);
            await SecurityQA.create({user_id: user.id, question: String(qa.question).trim(), answer_hash: ah});
        }
    }

    res.status(201).json({id: user.id, email: user.email, role: user.role});
});

app.get('/auth/security-questions', async (req, res) => {
    const email = String(req.query.email || '').trim();
    if (!email) return res.status(400).json({error: 'Email is required'});

    const user = await User.findOne({where: {email}, attributes: ['id', 'role']});
    if (!user) return res.status(409).json({error: 'This account does not support password recovery.'});

    const qas = await SecurityQA.findAll({where: {user_id: user.id}, order: [['id', 'ASC']]});
    if (!qas.length) return res.status(409).json({error: 'This account does not support password recovery.'});

    res.json({email, questions: qas.map(q => ({question: q.question}))});
});

app.post('/auth/reset-with-qa', async (req, res) => {
    const {email, answers, new_password} = req.body || {};
    if (!email || !Array.isArray(answers) || !new_password) {
        return res.status(400).json({error: 'email, answers and new_password are required'});
    }

    const user = await User.findOne({where: {email}});
    if (!user) return res.status(409).json({error: 'This account does not support password recovery.'});

    const qas = await SecurityQA.findAll({where: {user_id: user.id}});
    if (!qas.length) return res.status(409).json({error: 'This account does not support password recovery.'});

    for (const qa of qas) {
        const provided = answers.find(a => String(a.question).trim() === qa.question);
        if (!provided) return res.status(400).json({error: 'Missing answer for a question.'});
        const ok = await bcrypt.compare(String(provided.answer).trim(), qa.answer_hash);
        if (!ok) return res.status(401).json({error: 'Answer verification failed.'});
    }

    const hash = await bcrypt.hash(new_password, 10);
    await user.update({password_hash: hash});
    res.json({ok: true});
});

app.post('/auth/login', async (req, res) => {
    const {email, password} = req.body || {};
    const user = await User.findOne({where: {email}});
    if (!user) return res.status(401).json({error: 'User not found'});
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({error: 'Password does not match'});
    const token = signToken(user);
    res.json({token, user: {id: user.id, email: user.email, role: user.role}});
});

app.get('/auth/me', authRequired, async (req, res) => {
    const user = await User.findByPk(req.user.uid, {attributes: ['id', 'email', 'role']});
    res.json(user);
});

// ---- ADMIN: manage users ----
app.get('/admin/users', authRequired, requireRole('admin'), async (_req, res) => {
    const users = await User.findAll({attributes: ['id', 'email', 'role', 'created_at']});
    res.json(users);
});

// Delete user (admin only)
app.delete('/admin/users/:id', authRequired, requireRole('admin'), async (req, res, next) => {
    try {
        const targetId = Number(req.params.id);
        if (!Number.isInteger(targetId)) return res.status(400).json({error: 'Invalid user id'});

        if (targetId === req.user.uid) {
            return res.status(400).json({error: 'You cannot delete yourself'});
        }

        const user = await User.findByPk(targetId);
        if (!user) return res.status(404).json({error: 'User not found'});

        if (user.role === 'admin') {
            const adminCount = await User.count({where: {role: 'admin'}});
            if (adminCount <= 1) {
                return res.status(400).json({error: 'Cannot delete the last admin'});
            }
        }

        await SecurityQA.destroy({where: {user_id: targetId}});
        await user.destroy();
        res.sendStatus(204);
    } catch (err) {
        next(err);
    }
});

app.put('/admin/users/:id/role', authRequired, requireRole('admin'), async (req, res) => {
    const {role} = req.body || {};
    if (!USER_ROLES.includes(role)) return res.status(400).json({error: 'Invalid role'});
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({error: 'User not found'});
    user.role = role;
    await user.save();
    res.json({id: user.id, email: user.email, role: user.role});
});

// ---- MODEL ROUTES (protected) ----
app.get('/models/search', authRequired, async (req, res, next) => {
    try {
        const {
            q, risk, schema, license, tags, tagsMode,
            hasDocs, hasTrain, hasVal,
            minAcc, minF1, minAUC, maxLatency,
            dateFrom, dateTo,
            sort = 'updated_at_desc',
            page = 1, pageSize = 24
        } = req.query;

        const whereArr = [];
        const {Op, literal, fn, where: whereFn} = require('sequelize');
        const sequelize = require('./config/sequelize');

        if (q && String(q).trim()) {
            const terms = String(q).trim().split(/\s+/);
            for (const t of terms) {
                const like = `%${t}%`;
                whereArr.push({
                    [Op.or]: [
                        {name: {[Op.iLike]: like}},
                        {description: {[Op.iLike]: like}},
                        {owner_contact: {[Op.iLike]: like}},
                        whereFn(
                            fn('EXISTS',
                                literal(`SELECT 1
                                         FROM unnest("business_tags") AS tag
                                         WHERE tag ILIKE ${sequelize.escape(like)}`)
                            ),
                            true
                        )
                    ]
                });
            }
        }

        if (risk) whereArr.push({risk_level: {[Op.in]: String(risk).split(',')}});
        if (schema) whereArr.push({input_schema: {[Op.in]: String(schema).split(',')}});
        if (license) whereArr.push({license: {[Op.in]: String(license).split(',')}});

        if (tags) {
            const arr = String(tags).split(',').map(s => s.trim()).filter(Boolean);
            if (arr.length) {
                if (tagsMode === 'all') whereArr.push({business_tags: {[Op.contains]: arr}});
                else whereArr.push({business_tags: {[Op.overlap]: arr}});
            }
        }

        if (hasTrain === 'true') whereArr.push(literal(`training_data_uris IS NOT NULL AND array_length(training_data_uris, 1) > 0`));
        if (hasVal === 'true') whereArr.push(literal(`validation_data_uris IS NOT NULL AND array_length(validation_data_uris, 1) > 0`));

        if (minAcc !== undefined) whereArr.push({baseline_accuracy: {[Op.gte]: Number(minAcc)}});
        if (minF1 !== undefined) whereArr.push({baseline_f1: {[Op.gte]: Number(minF1)}});
        if (minAUC !== undefined) whereArr.push({baseline_auc: {[Op.gte]: Number(minAUC)}});
        if (maxLatency !== undefined) whereArr.push({baseline_latency_ms: {[Op.lte]: Number(maxLatency)}});

        if (dateFrom || dateTo) {
            whereArr.push({
                updated_at: {
                    ...(dateFrom ? {[Op.gte]: new Date(dateFrom)} : {}),
                    ...(dateTo ? {[Op.lte]: new Date(dateTo)} : {}),
                }
            });
        }

        const sortMap = {
            'updated_at_desc': ['updated_at', 'DESC'],
            'updated_at_asc': ['updated_at', 'ASC'],
            'name_asc': ['name', 'ASC'],
            'acc_desc': ['baseline_accuracy', 'DESC'],
            'f1_desc': ['baseline_f1', 'DESC'],
            'auc_desc': ['baseline_auc', 'DESC'],
            'latency_asc': ['baseline_latency_ms', 'ASC'],
        };
        const order = [sortMap[sort] || sortMap['updated_at_desc']];

        const limit = Math.min(Number(pageSize) || 24, 100);
        const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

        const include = [];
        if (hasDocs === 'true') {
            include.push({
                model: ComplianceDoc,
                as: 'docs',
                required: true,
                attributes: []
            });
        }

        const {rows, count} = await Model.findAndCountAll({
            where: whereArr.length ? {[Op.and]: whereArr} : undefined,
            include: include.length ? include : undefined,
            distinct: true,
            order: [order],
            limit,
            offset,
            attributes: [
                'id', 'name', 'version', 'risk_level', 'input_schema',
                'baseline_accuracy', 'baseline_f1', 'baseline_auc', 'baseline_latency_ms',
                'license', 'business_tags', 'updated_at'
            ]
        });

        const items = rows.map(r => sanitizeModelForRole(r, req.user.role));
        res.json({items, total: count, page: Number(page) || 1, pageSize: limit});
    } catch (err) {
        next(err);
    }
});

// Everyone logged-in can list
app.get('/models', authRequired, async (req, res, next) => {
    try {
        const list = await Model.findAll({order: [['id', 'ASC']]});
        const safe = list.map(m => sanitizeModelForRole(m, req.user.role));
        res.json(safe);
    } catch (err) {
        next(err);
    }
});

app.get('/models/:id', authRequired, async (req, res, next) => {
    try {
        const rec = await Model.findByPk(req.params.id);
        if (!rec) return res.status(404).json({error: 'Not found'});
        res.json(sanitizeModelForRole(rec, req.user.role));
    } catch (err) {
        next(err);
    }
});

// Create: uploader/admin
app.post(
    '/models',
    authRequired, requireRole(['uploader', 'admin']),
    upload.fields([
        {name: 'files', maxCount: 1},          // 仅 1 个 ZIP
        {name: 'readme', maxCount: 1},
        {name: 'compliance_docs', maxCount: 20},
        {name: 'training_data', maxCount: 50},
        {name: 'validation_data', maxCount: 50},
    ]),
    async (req, res, next) => {
        try {
            const {
                name, version, description, input_schema, risk_level,
                owner_contact, license
            } = req.body;

            if (!name || !version || !description || !input_schema || !risk_level) {
                return res.status(400).json({error: 'Missing required fields'});
            }
            if (!SCHEMA_MODES.includes(input_schema) || !RISK_LEVELS.includes(risk_level)) {
                return res.status(400).json({error: 'Invalid schema or risk'});
            }
            if (license && !LICENSES.includes(license)) {
                return res.status(400).json({error: 'Invalid license'});
            }

            // 模型文件仅支持 ZIP，并强校验命名
            const filesArr = req.files?.files || [];
            if (!filesArr.length) return res.status(400).json({error: 'Model artifact file is required (.zip)'});

            const mf = filesArr[0];
            const base = path.basename(mf.originalname);
            if (!/\.zip$/i.test(base)) {
                return res.status(400).json({error: 'Model file must be a .zip archive'});
            }
            if (!/^[A-Za-z0-9._-]+\.zip$/.test(base)) {
                return res.status(400).json({error: 'Model .zip name must be ASCII [A-Za-z0-9._-] with no spaces'});
            }

            // README 仅允许 .md 或 .pdf
            const readme = req.files.readme?.[0];
            if (readme && !/\.(md|pdf)$/i.test(readme.originalname)) {
                return res.status(400).json({error: 'README must be .md or .pdf'});
            }

            const artifact_uri = `/uploads/${mf.filename}`;
            const readme_uri = readme ? `/uploads/${readme.filename}` : null;
            const compliance_docs = toArrayFromFiles(req.files.compliance_docs);
            const training_data_uris = toArrayFromFiles(req.files.training_data);
            const validation_data_uris = toArrayFromFiles(req.files.validation_data);

            const baseline_latency_ms = toNum(req.body.baseline_latency_ms);
            const baseline_accuracy = toNum(req.body.baseline_accuracy);
            const baseline_f1 = toNum(req.body.baseline_f1);
            const baseline_auc = toNum(req.body.baseline_auc);

            const business_tags = safeParseArray(req.body.business_tags);

            const created = await Model.create({
                name, version, description, input_schema, risk_level,
                artifact_uri, readme_uri,
                baseline_latency_ms, baseline_accuracy, baseline_f1, baseline_auc,
                compliance_docs, business_tags, owner_contact, license,
                training_data_uris, validation_data_uris
            });
            res.status(201).json(created);
        } catch (err) {
            next(err);
        }
    }
);

// Update: uploader/admin —— 仅更新，不写日志；把变更摘要返回给前端
app.put(
    '/models/:id',
    authRequired, requireRole(['uploader', 'admin']),
    upload.fields([
        {name: 'files', maxCount: 1},          // 仅 1 个 ZIP
        {name: 'readme', maxCount: 1},
        {name: 'compliance_docs', maxCount: 20},
        {name: 'training_data', maxCount: 50},
        {name: 'validation_data', maxCount: 50},
    ]),
    async (req, res, next) => {
        try {
            const rec = await Model.findByPk(req.params.id);
            if (!rec) return res.status(404).json({error: 'Not found'});

            const updatable = ['name', 'version', 'description', 'input_schema', 'risk_level', 'owner_contact', 'license'];
            const data = {};
            updatable.forEach(f => {
                if (req.body[f] !== undefined) data[f] = req.body[f];
            });

            if (data.input_schema && !SCHEMA_MODES.includes(data.input_schema)) {
                return res.status(400).json({error: 'Invalid schema'});
            }
            if (data.risk_level && !RISK_LEVELS.includes(data.risk_level)) {
                return res.status(400).json({error: 'Invalid risk'});
            }
            if (data.license && !LICENSES.includes(data.license)) {
                return res.status(400).json({error: 'Invalid license'});
            }

            if (req.body.baseline_latency_ms !== undefined) data.baseline_latency_ms = toNum(req.body.baseline_latency_ms);
            if (req.body.baseline_accuracy !== undefined) data.baseline_accuracy = toNum(req.body.baseline_accuracy);
            if (req.body.baseline_f1 !== undefined) data.baseline_f1 = toNum(req.body.baseline_f1);
            if (req.body.baseline_auc !== undefined) data.baseline_auc = toNum(req.body.baseline_auc);

            if (req.body.business_tags !== undefined) data.business_tags = safeParseArray(req.body.business_tags);

            // 变更前快照
            const prevArtifact = rec.artifact_uri;

            // 可选替换 ZIP
            let artifactChanged = false;
            if (req.files?.files?.length) {
                const mf = req.files.files[0];
                const base = path.basename(mf.originalname);
                if (!/\.zip$/i.test(base)) {
                    return res.status(400).json({error: 'Model file must be a .zip archive'});
                }
                if (!/^[A-Za-z0-9._-]+\.zip$/.test(base)) {
                    return res.status(400).json({error: 'Model .zip name must be ASCII [A-Za-z0-9._-] with no spaces'});
                }
                data.artifact_uri = `/uploads/${mf.filename}`;
                artifactChanged = true;
            }

            // 可选替换 README（仅 .md|.pdf）
            if (req.files?.readme?.length) {
                const readme = req.files.readme[0];
                if (!/\.(md|pdf)$/i.test(readme.originalname)) {
                    return res.status(400).json({error: 'README must be .md or .pdf'});
                }
                data.readme_uri = `/uploads/${readme.filename}`;
            }

            // 变更字段集合（仅记录值有变化的）
            const maybeFields = [
                'name', 'version', 'description', 'input_schema', 'risk_level', 'owner_contact', 'license',
                'baseline_latency_ms', 'baseline_accuracy', 'baseline_f1', 'baseline_auc', 'business_tags'
            ];
            const changedFields = [];
            const prevValues = {};
            const newValues = {};
            for (const k of maybeFields) {
                if (data[k] !== undefined) {
                    const oldVal = rec[k];
                    const newVal = data[k];
                    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                        changedFields.push(k);
                        prevValues[k] = oldVal ?? null;
                        newValues[k] = newVal ?? null;
                    }
                }
            }

            await rec.update(data);

            const change_meta = {
                changed_fields: changedFields,
                artifact_changed: artifactChanged,
                prev_artifact_uri: artifactChanged ? prevArtifact : null,
                new_artifact_uri: artifactChanged ? rec.artifact_uri : null,
                // 仅用于“历史”展示 Basics & Metrics 的前后值（文件不包含）
                prev_values: Object.keys(prevValues).length ? prevValues : null,
                new_values: Object.keys(newValues).length ? newValues : null
            };

            res.json({updated: rec, change_meta});
        } catch (err) {
            next(err);
        }
    }
);

// Delete: admin only
app.delete('/models/:id', authRequired, requireRole('admin'), async (req, res, next) => {
    try {
        const rec = await Model.findByPk(req.params.id);
        if (!rec) return res.sendStatus(404);

        await sequelize.transaction(async (t) => {
            // 1) Delete all compliance docs for this model (and their files)
            const docs = await ComplianceDoc.findAll({where: {model_id: rec.id}, transaction: t});
            for (const d of docs) safeUnlinkByUri(d.uri);
            await ComplianceDoc.destroy({where: {model_id: rec.id}, transaction: t});

            // 2) Delete update history rows for this model (avoid other FK issues)
            await ModelUpdate.destroy({where: {model_id: rec.id}, transaction: t});

            // 3) Remove model artifact/readme files (if any)
            safeUnlinkByUri(rec.artifact_uri);
            safeUnlinkByUri(rec.readme_uri);

            // 4) Finally delete the model
            await rec.destroy({transaction: t});
        });

        res.sendStatus(204);
    } catch (err) {
        next(err);
    }
});

// ---- COMPLIANCE DOC ROUTES ----
app.get('/models/:id/compliance-docs', authRequired, async (req, res, next) => {
    try {
        const modelId = Number(req.params.id);
        const docs = await ComplianceDoc.findAll({
            where: {model_id: modelId},
            order: [['id', 'ASC']],
            include: [
                {model: User, as: 'uploader', attributes: ['id', 'email']},
                {model: User, as: 'reviewer', attributes: ['id', 'email']},
            ]
        });
        res.json(docs);
    } catch (err) {
        next(err);
    }
});

app.post(
    '/models/:id/compliance-docs',
    authRequired, requireRole(['uploader', 'admin']),
    upload.single('doc'),
    async (req, res, next) => {
        try {
            const modelId = Number(req.params.id);
            const {type} = req.body || {};
            if (!COMPLIANCE_TYPES.includes(type)) return res.status(400).json({error: 'Invalid type'});
            if (!req.file) return res.status(400).json({error: 'File (field: doc) is required'});
            const doc = await ComplianceDoc.create({
                model_id: modelId,
                type,
                uri: `/uploads/${req.file.filename}`,
                uploaded_by: req.user.uid,
                status: 'pending'
            });
            res.status(201).json(doc);
        } catch (err) {
            next(err);
        }
    }
);

app.put(
    '/compliance-docs/:docId/review',
    authRequired, requireRole(['auditor', 'admin']),
    async (req, res, next) => {
        try {
            const {status, note} = req.body || {};
            if (!['approved', 'rejected'].includes(status)) {
                return res.status(400).json({error: 'status must be "approved" or "rejected"'});
            }
            const doc = await ComplianceDoc.findByPk(req.params.docId);
            if (!doc) return res.status(404).json({error: 'Doc not found'});
            await doc.update({
                status,
                reviewer_id: req.user.uid,
                reviewed_at: new Date(),
                note: note || null
            });
            res.json(doc);
        } catch (err) {
            next(err);
        }
    }
);

app.delete('/compliance-docs/:docId', authRequired, async (req, res, next) => {
    try {
        const doc = await ComplianceDoc.findByPk(req.params.docId);
        if (!doc) return res.sendStatus(404);
        if (req.user.role !== 'admin' && req.user.uid !== doc.uploaded_by) {
            return res.status(403).json({error: 'Forbidden'});
        }
        const fpath = path.join(__dirname, '../', doc.uri);
        fs.unlink(fpath, () => {
        });
        await doc.destroy();
        res.sendStatus(204);
    } catch (err) {
        next(err);
    }
});

// Compliance status across models
app.get('/compliance/status', authRequired, async (_req, res, next) => {
    try {
        const models = await Model.findAll({attributes: ['id', 'name', 'risk_level']});
        const docs = await ComplianceDoc.findAll({attributes: ['id', 'model_id', 'type', 'status']});

        const byModel = new Map();
        docs.forEach(d => {
            const arr = byModel.get(d.model_id) || [];
            arr.push(d);
            byModel.set(d.model_id, arr);
        });

        const out = models.map(m => {
            const required = REQUIRED_DOCS[m.risk_level] || [];
            const list = byModel.get(m.id) || [];
            const approvedSet = new Set(list.filter(x => x.status === 'approved').map(x => x.type));
            const pending = list.filter(x => x.status === 'pending').length;
            const missing = required.filter(t => !approvedSet.has(t));
            return {
                model_id: m.id,
                name: m.name,
                risk_level: m.risk_level,
                required,
                missing,
                pending,
                approved: list.filter(x => x.status === 'approved').length
            };
        });

        res.json(out);
    } catch (err) {
        next(err);
    }
});

app.get('/compliance/requirements', authRequired, (_req, res) => {
    res.json({REQUIRED_DOCS, COMPLIANCE_TYPES, REVIEW_STATUSES});
});

/** -------- 更新历史路由（支持多选类型） -------- **/
app.get('/models/:id/updates', authRequired, async (req, res, next) => {
    try {
        const modelId = Number(req.params.id);
        const list = await ModelUpdate.findAll({
            where: {model_id: modelId},
            order: [['created_at', 'DESC']],
            include: [{model: User, as: 'actor', attributes: ['id', 'email']}]
        });
        res.json(list);
    } catch (err) {
        next(err);
    }
});

app.post('/models/:id/updates', authRequired, async (req, res, next) => {
    try {
        const modelId = Number(req.params.id);
        const {update_type, update_types, note, meta, prev_artifact_uri, new_artifact_uri} = req.body || {};

        const allowed = new Set(['model', 'basic', 'compliance_upload', 'compliance_review']);
        let types = [];

        if (Array.isArray(update_types) && update_types.length) {
            types = [...new Set(update_types.filter(t => allowed.has(String(t))))];
        } else if (typeof update_type === 'string' && allowed.has(update_type)) {
            types = [update_type];
        }

        if (!types.length) {
            return res.status(400).json({error: 'Invalid update_type(s)'});
        }

        const rec = await Model.findByPk(modelId);
        if (!rec) return res.status(404).json({error: 'Not found'});

        const rows = [];
        for (const t of types) {
            const row = await ModelUpdate.create({
                model_id: modelId,
                actor_id: req.user.uid,
                update_type: t,
                note: note || null,
                meta: meta || null,
                prev_artifact_uri: prev_artifact_uri || null,
                new_artifact_uri: new_artifact_uri || null,
                name_snapshot: rec.name,
                version_snapshot: rec.version
            });
            rows.push(row);
        }
        res.status(201).json({created: rows.length, items: rows});
    } catch (err) {
        next(err);
    }
});
/** ----------------------------------- **/

// ---- Error handler ----
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({error: err.message});
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));