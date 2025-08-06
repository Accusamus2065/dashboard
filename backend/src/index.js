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
const upload = multer({storage});

// Serve uploaded files as static resources
app.use('/uploads', express.static(UPLOAD_DIR));

// Sync database models
sequelize.sync({ alter: true })
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

// Delete a model by ID
app.delete('/models/:id', async (req, res, next) => {
    try {
        const count = await Model.destroy({where: {id: req.params.id}});
        res.sendStatus(count ? 204 : 404);
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
