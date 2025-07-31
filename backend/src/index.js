// backend/src/index.js
require('dotenv').config();
const express = require('express');
const sequelize = require('./config/sequelize');
const Model = require('./models/model');

const app = express();
app.use(express.json());

sequelize.sync().then(() => {
    console.log('Database synced');
});

app.get('/', (req, res) => res.send('AI Dashboard Backend'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
