// backend/src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sequelize = require('./config/sequelize');
const Model = require('./models/model');

const app = express();
app.use(express.json());
app.use(cors());

// ensure uploads directory exists
const UPLOAD_DIR = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const filename = `${Date.now()}_${file.originalname}`;
        cb(null, filename);
    }
});
const upload = multer({storage});

// sync database
sequelize.sync()
    .then(() => console.log('Database synced'))
    .catch(console.error);

// define static file serving for uploads
app.use('/uploads', express.static(UPLOAD_DIR));

// root route
app.get('/', (req, res) => res.send('AI Dashboard Backend'));

// obtain model list
app.get('/models', async (req, res, next) => {
    try {
        const list = await Model.findAll({order: [['id', 'ASC']]});
        res.json(list);
    } catch (err) {
        next(err);
    }
});

// upload a new model
app.post('/models', upload.single('file'), async (req, res, next) => {
    try {
        const {name, version, risk_level = 'medium'} = req.body;
        const file = req.file;
        if (!name || !version || !file) {
            return res.status(400).json({error: 'name, version and file are required'});
        }
        const artifact_uri = `/uploads/${file.filename}`;
        const created = await Model.create({name, version, artifact_uri, risk_level});
        res.status(201).json(created);
    } catch (err) {
        next(err);
    }
});

// handle errors
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({error: err.message});
});

// start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
});
