// backend/src/models/complianceDoc.js
const {DataTypes} = require('sequelize');
const sequelize = require('../config/sequelize');

const COMPLIANCE_TYPES = ['FRIA', 'DPIA', 'PRIVACY', 'TERMS', 'OTHER'];
const REVIEW_STATUSES = ['pending', 'approved', 'rejected'];

const ComplianceDoc = sequelize.define('ComplianceDoc', {
    id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
    model_id: {type: DataTypes.INTEGER, allowNull: false},
    type: {type: DataTypes.ENUM(...COMPLIANCE_TYPES), allowNull: false},
    uri: {type: DataTypes.TEXT, allowNull: false},
    uploaded_by: {type: DataTypes.INTEGER, allowNull: false},
    status: {type: DataTypes.ENUM(...REVIEW_STATUSES), allowNull: false, defaultValue: 'pending'},
    reviewer_id: {type: DataTypes.INTEGER, allowNull: true},
    reviewed_at: {type: DataTypes.DATE, allowNull: true},
    note: {type: DataTypes.TEXT, allowNull: true},
    created_at: {type: DataTypes.DATE, defaultValue: DataTypes.NOW},
    updated_at: {type: DataTypes.DATE, defaultValue: DataTypes.NOW},
}, {
    tableName: 'compliance_docs',
    timestamps: false,
});

module.exports = {ComplianceDoc, COMPLIANCE_TYPES, REVIEW_STATUSES};
