// backend/src/models/model.js
const {DataTypes} = require('sequelize');
const sequelize = require('../config/sequelize');

const Model = sequelize.define('Model', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    version: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    artifact_uri: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    risk_level: {
        type: DataTypes.ENUM('low', 'medium', 'high'),
        defaultValue: 'medium',
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'models',
    timestamps: false,
});

module.exports = Model;
