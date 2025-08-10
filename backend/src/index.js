// backend/src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const {Model, SCHEMA_MODES, RISK_LEVELS, LICENSES} = require('./models/model');
const {User, USER_ROLES} = require('./models/user');
const sequelize = require('./config/sequelize');

const app = express();
app.use(cors({origin: 'http://localhost:5173', credentials: true}));
app.use(express.json());

// ---- JWT helpers ----
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function signToken(user) {
    return jwt.sign({uid: user.id, role: user.role}, JWT_SECRET, {expiresIn: '7d'});
}

function authRequired(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({error: 'Unauthorized'});
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload; // {uid, role}
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
const upload = multer({
    storage,
    fileFilter: (_req, file, cb) => {
        const allowed = /\.(onnx|pt|pth|h5|pb|pkl|joblib|md|txt|pdf|doc|docx|csv|json|parquet|zip|png|jpg|jpeg|gif|svg)$/i;
        if (!allowed.test(file.originalname)) return cb(new Error('Unsupported file type'));
        cb(null, true);
    }
});
app.use('/uploads', express.static(UPLOAD_DIR));

// ---- DB sync & seed admin ----
sequelize.sync({alter: true})
    .then(async () => {
        console.log('Database synced with alter');

        // Seed admin if env provided and not exists
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

// ---- AUTH ROUTES ----
app.post('/auth/register', async (req, res) => {
    const {email, password} = req.body || {};
    if (!email || !password) return res.status(400).json({error: 'Email & password required'});
    const existed = await User.findOne({where: {email}});
    if (existed) return res.status(409).json({error: 'Email already registered'});
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({email, password_hash: hash, role: 'viewer'});
    res.status(201).json({id: user.id, email: user.email, role: user.role});
});

app.post('/auth/login', async (req, res) => {
    const {email, password} = req.body || {};
    const user = await User.findOne({where: {email}});
    if (!user) return res.status(401).json({error: 'Invalid credentials'});
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({error: 'Invalid credentials'});
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
// Everyone logged-in can list & view
app.get('/models', authRequired, async (_req, res, next) => {
    try {
        const list = await Model.findAll({order: [['id', 'ASC']]});
        res.json(list);
    } catch (err) {
        next(err);
    }
});

app.get('/models/:id', authRequired, async (req, res, next) => {
    try {
        const rec = await Model.findByPk(req.params.id);
        if (!rec) return res.status(404).json({error: 'Not found'});
        res.json(rec);
    } catch (err) {
        next(err);
    }
});

// Create: uploader/admin
app.post(
    '/models',
    authRequired, requireRole(['uploader', 'admin']),
    upload.fields([
        {name: 'files', maxCount: 10},
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
            if (!req.files || !req.files.files || req.files.files.length === 0) {
                return res.status(400).json({error: 'Model artifact file is required'});
            }

            const artifact_uri = `/uploads/${req.files.files[0].filename}`;
            const readme_uri = req.files.readme?.[0] ? `/uploads/${req.files.readme[0].filename}` : null;
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

// Update: uploader/admin
app.put(
    '/models/:id',
    authRequired, requireRole(['uploader', 'admin']),
    upload.fields([
        {name: 'files', maxCount: 10},
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

            if (req.files?.files?.length) data.artifact_uri = `/uploads/${req.files.files[0].filename}`;
            if (req.files?.readme?.length) data.readme_uri = `/uploads/${req.files.readme[0].filename}`;
            if (req.files?.compliance_docs?.length) data.compliance_docs = toArrayFromFiles(req.files.compliance_docs);
            if (req.files?.training_data?.length) data.training_data_uris = toArrayFromFiles(req.files.training_data);
            if (req.files?.validation_data?.length) data.validation_data_uris = toArrayFromFiles(req.files.validation_data);

            await rec.update(data);
            res.json(rec);
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
        if (rec.artifact_uri) {
            const filePath = path.join(__dirname, '../', rec.artifact_uri);
            fs.unlink(filePath, () => {
            });
        }
        await rec.destroy();
        res.sendStatus(204);
    } catch (err) {
        next(err);
    }
});

// Error handler
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({error: err.message});
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
