// backend/src/models/model.js
const {DataTypes} = require('sequelize');
const sequelize = require('../config/sequelize');

const SCHEMA_MODES = ["generic", "feature-map", "image", "text", "sequence"];
const RISK_LEVELS = ["low", "medium", "high"];
const LICENSES = ["MIT", "Apache-2.0", "GPL-3.0", "Proprietary"];

const Model = sequelize.define('Model', {
    id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
    name: {type: DataTypes.STRING, allowNull: false},
    version: {type: DataTypes.STRING, allowNull: false},

    description: {type: DataTypes.TEXT, allowNull: false, defaultValue: ""},
    input_schema: {
        type: DataTypes.ENUM(...SCHEMA_MODES), allowNull: false
    },
    risk_level: {type: DataTypes.ENUM(...RISK_LEVELS), allowNull: false, defaultValue: "medium"},

    environment_spec: {type: DataTypes.TEXT, allowNull: true},
    baseline_metrics: {type: DataTypes.JSONB, allowNull: true},
    example_io: {type: DataTypes.TEXT, allowNull: true},
    compliance_docs: {type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: true},
    business_tags: {type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true},
    owner_contact: {type: DataTypes.STRING, allowNull: true},
    license: {type: DataTypes.ENUM(...LICENSES), allowNull: true},
    dataset_dependencies: {type: DataTypes.TEXT, allowNull: true},
    additional_notes: {type: DataTypes.TEXT, allowNull: true},

    artifact_uri: {type: DataTypes.TEXT, allowNull: false},
    created_at: {type: DataTypes.DATE, defaultValue: DataTypes.NOW},
    updated_at: {type: DataTypes.DATE, defaultValue: DataTypes.NOW},
}, {
    tableName: 'models', timestamps: false,
});

module.exports = {Model, SCHEMA_MODES, RISK_LEVELS, LICENSES};
