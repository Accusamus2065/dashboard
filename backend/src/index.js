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
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

// Configure multer to store uploaded files locally
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR), filename: (_req, file, cb) => {
        const filename = `${Date.now()}_${file.originalname}`;
        cb(null, filename);
    }
});
const upload = multer({
    storage, fileFilter: (_req, file, cb) => {
        // allow .onnx, .pt, .pth, .h5, .pb, .pkl, .joblib
        const allowed = /\.(onnx|pt|pth|h5|pb|pkl|joblib)$/i;
        if (!allowed.test(file.originalname)) {
            return cb(new Error('Allowed file types: .onnx, .pt, .pth, .h5, .pb, .pkl, .joblib'));
        }
        cb(null, true);
    }
});

// Serve uploaded files as static resources
app.use('/uploads', express.static(UPLOAD_DIR));

// Sync database models
sequelize.sync({alter: true})
    .then(() => console.log('Database synced with alter'))
    .catch(console.error);


// GET all models
app.get('/models', async (_req, res, next) => {
    try {
        const list = await Model.findAll({order: [['id', 'ASC']]});
        res.json(list);
    } catch (err) {
        next(err);
    }
});

// GET a single model by ID
app.get('/models/:id', async (req, res, next) => {
    try {
        const rec = await Model.findByPk(req.params.id);
        if (!rec) return res.status(404).json({error: 'Not found'});
        res.json(rec);
    } catch (err) {
        next(err);
    }
});

// Create a new model (multipart/form-data)
app.post('/models', upload.array('files'), async (req, res, next) => {
    try {
        const {
            name,
            version,
            description,
            input_schema,
            risk_level,
            environment_spec,
            owner_contact,
            license,
            dataset_dependencies,
            additional_notes
        } = req.body;

        // Validate required fields
        if (!name || !version || !description || !input_schema || !risk_level || !req.files?.length) {
            return res.status(400).json({error: 'Missing required fields'});
        }
        if (!SCHEMA_MODES.includes(input_schema) || !RISK_LEVELS.includes(risk_level)) {
            return res.status(400).json({error: 'Invalid schema or risk value'});
        }

        // Process uploaded files
        const artifactUris = req.files.map(f => `/uploads/${f.filename}`);

        // Parse optional JSON fields
        let baseline_metrics = null;
        let compliance_docs = null;
        let business_tags = null;
        if (req.body.baseline_metrics) {
            baseline_metrics = JSON.parse(req.body.baseline_metrics);
        }
        if (req.body.compliance_docs) {
            compliance_docs = JSON.parse(req.body.compliance_docs);
        }
        if (req.body.business_tags) {
            business_tags = JSON.parse(req.body.business_tags);
        }

        // Create the model record
        const created = await Model.create({
            name,
            version,
            description,
            input_schema,
            risk_level,
            artifact_uri: artifactUris[0],
            environment_spec,
            baseline_metrics,
            example_io: req.body.example_io || null,
            compliance_docs,
            business_tags,
            owner_contact,
            license,
            dataset_dependencies,
            additional_notes
        });
        res.status(201).json(created);
    } catch (err) {
        next(err);
    }
});

// PUT update a model by ID
app.put('/models/:id', upload.array('files'), async (req, res, next) => {
    try {
        const rec = await Model.findByPk(req.params.id);
        if (!rec) return res.status(404).json({error: 'Not found'});

        // extract updatable fields
        const updatable = ['name', 'version', 'description', 'input_schema', 'risk_level', 'environment_spec', 'baseline_metrics', 'example_io', 'compliance_docs', 'business_tags', 'owner_contact', 'license', 'dataset_dependencies', 'additional_notes'];
        const data = {};
        updatable.forEach(f => {
            if (req.body[f] !== undefined) data[f] = req.body[f];
        });

        // handle new files if any
        if (req.files?.length) {
            const uri = `/uploads/${req.files[0].filename}`;
            data.artifact_uri = uri;
        }

        await rec.update(data);
        res.json(rec);
    } catch (err) {
        next(err);
    }
});

// Delete a model by ID
app.delete('/models/:id', async (req, res, next) => {
    try {
        const rec = await Model.findByPk(req.params.id);
        if (!rec) {
            return res.sendStatus(404);
        }
        if (rec.artifact_uri) {
            const filePath = path.join(__dirname, '../', rec.artifact_uri);
            fs.unlink(filePath, err => {
                if (err) {
                    console.error(`Failed to delete file ${filePath}:`, err);
                }
            });
        }
        await rec.destroy();
        res.sendStatus(204);
    } catch (err) {
        next(err);
    }
});

// Global error handler
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({error: err.message});
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
});
