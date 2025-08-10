// backend/src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {Model, SCHEMA_MODES, RISK_LEVELS, LICENSES} = require('./models/model');
const sequelize = require('./config/sequelize');

const app = express();
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const UPLOAD_DIR = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Multer storage
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
const upload = multer({
    storage,
    fileFilter: (_req, file, cb) => {
        // Allow common model/doc/data extensions
        const allowed = /\.(onnx|pt|pth|h5|pb|pkl|joblib|md|txt|pdf|doc|docx|csv|json|parquet|zip)$/i;
        if (!allowed.test(file.originalname)) {
            return cb(new Error('Unsupported file type'));
        }
        cb(null, true);
    }
});

// Serve static files
app.use('/uploads', express.static(UPLOAD_DIR));

// Auto sync schema in dev
sequelize.sync({alter: true})
    .then(() => console.log('Database synced with alter'))
    .catch(console.error);

// Helpers
const toNum = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const toArrayFromFiles = (arr) => (Array.isArray(arr) ? arr.map(f => `/uploads/${f.filename}`) : null);
const safeParseArray = (v) => {
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

// Routes

// GET all
app.get('/models', async (_req, res, next) => {
    try {
        const list = await Model.findAll({order: [['id', 'ASC']]});
        res.json(list);
    } catch (err) {
        next(err);
    }
});

// GET one
app.get('/models/:id', async (req, res, next) => {
    try {
        const rec = await Model.findByPk(req.params.id);
        if (!rec) return res.status(404).json({error: 'Not found'});
        res.json(rec);
    } catch (err) {
        next(err);
    }
});

// POST create
app.post(
    '/models',
    upload.fields([
        {name: 'files', maxCount: 10},            // model artifacts
        {name: 'readme', maxCount: 1},            // readme file
        {name: 'compliance_docs', maxCount: 20},  // compliance docs
        {name: 'training_data', maxCount: 50},    // dataset dependencies
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
                return res.status(400).json({error: 'Invalid schema or risk value'});
            }
            if (license && !LICENSES.includes(license)) {
                return res.status(400).json({error: 'Invalid license'});
            }
            if (!req.files || !req.files.files || req.files.files.length === 0) {
                return res.status(400).json({error: 'Model artifact file is required'});
            }

            // Files
            const artifact_uri = `/uploads/${req.files.files[0].filename}`;
            const readme_uri = req.files.readme?.[0] ? `/uploads/${req.files.readme[0].filename}` : null;
            const compliance_docs = toArrayFromFiles(req.files.compliance_docs);
            const training_data_uris = toArrayFromFiles(req.files.training_data);
            const validation_data_uris = toArrayFromFiles(req.files.validation_data);

            // Metrics
            const baseline_latency_ms = toNum(req.body.baseline_latency_ms);
            const baseline_accuracy = toNum(req.body.baseline_accuracy);
            const baseline_f1 = toNum(req.body.baseline_f1);
            const baseline_auc = toNum(req.body.baseline_auc);

            // Business tags (JSON array string or CSV will not be accepted here; front-end sends JSON)
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

// PUT update
app.put(
    '/models/:id',
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

            const updatable = [
                'name', 'version', 'description', 'input_schema', 'risk_level',
                'owner_contact', 'license'
            ];
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

            // Metrics
            if (req.body.baseline_latency_ms !== undefined) data.baseline_latency_ms = toNum(req.body.baseline_latency_ms);
            if (req.body.baseline_accuracy !== undefined) data.baseline_accuracy = toNum(req.body.baseline_accuracy);
            if (req.body.baseline_f1 !== undefined) data.baseline_f1 = toNum(req.body.baseline_f1);
            if (req.body.baseline_auc !== undefined) data.baseline_auc = toNum(req.body.baseline_auc);

            // Business tags (JSON array)
            if (req.body.business_tags !== undefined) {
                data.business_tags = safeParseArray(req.body.business_tags);
            }

            // Files replacement if provided
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

// DELETE
app.delete('/models/:id', async (req, res, next) => {
    try {
        const rec = await Model.findByPk(req.params.id);
        if (!rec) return res.sendStatus(404);
        // Note: physical file deletion is best-effort (omitted for arrays)
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
