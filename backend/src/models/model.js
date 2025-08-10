// backend/src/models/model.js
const {DataTypes} = require('sequelize');
const sequelize = require('../config/sequelize');

const SCHEMA_MODES = ['generic', 'feature-map', 'image', 'text', 'sequence'];
const RISK_LEVELS = ['low', 'medium', 'high'];

// License keywords only (ENUM values)
const LICENSES = [
    'AFL-3.0', 'Apache-2.0', 'Artistic-2.0', 'BSL-1.0', 'BSD-2-Clause', 'BSD-3-Clause',
    'BSD-3-Clause-Clear', 'BSD-4-Clause', '0BSD', 'CC', 'CC0-1.0', 'CC-BY-4.0',
    'CC-BY-SA-4.0', 'WTFPL', 'ECL-2.0', 'EPL-1.0', 'EPL-2.0', 'EUPL-1.1',
    'AGPL-3.0', 'GPL', 'GPL-2.0', 'GPL-3.0', 'LGPL', 'LGPL-2.1', 'LGPL-3.0',
    'ISC', 'LPPL-1.3c', 'MS-PL', 'MIT', 'MPL-2.0', 'OSL-3.0', 'PostgreSQL',
    'OFL-1.1', 'NCSA', 'Unlicense', 'Zlib'
];

const Model = sequelize.define('Model', {
    id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},

    name: {type: DataTypes.STRING, allowNull: false},
    version: {type: DataTypes.STRING, allowNull: false},
    description: {type: DataTypes.TEXT, allowNull: false, defaultValue: ''},

    input_schema: {type: DataTypes.ENUM(...SCHEMA_MODES), allowNull: false},
    risk_level: {type: DataTypes.ENUM(...RISK_LEVELS), allowNull: false, defaultValue: 'medium'},

    // Primary artifact (e.g., model weights)
    artifact_uri: {type: DataTypes.TEXT, allowNull: false},

    // README file (Markdown or text)
    readme_uri: {type: DataTypes.TEXT, allowNull: true},

    // Baseline metrics (numeric, optional)
    baseline_latency_ms: {type: DataTypes.FLOAT, allowNull: true},
    baseline_accuracy: {type: DataTypes.FLOAT, allowNull: true},
    baseline_f1: {type: DataTypes.FLOAT, allowNull: true},
    baseline_auc: {type: DataTypes.FLOAT, allowNull: true},

    // Compliance documents: multiple files
    compliance_docs: {type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: true},

    // Business tags: array of strings
    business_tags: {type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true},

    owner_contact: {type: DataTypes.STRING, allowNull: true},

    // License keyword
    license: {type: DataTypes.ENUM(...LICENSES), allowNull: true},

    // Dataset dependencies (uploaded files)
    training_data_uris: {type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: true},
    validation_data_uris: {type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: true},

    created_at: {type: DataTypes.DATE, defaultValue: DataTypes.NOW},
    updated_at: {type: DataTypes.DATE, defaultValue: DataTypes.NOW},
}, {
    tableName: 'models',
    timestamps: false,
});

module.exports = {Model, SCHEMA_MODES, RISK_LEVELS, LICENSES};
