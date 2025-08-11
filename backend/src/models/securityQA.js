// backend/src/models/securityQA.js
const {DataTypes} = require('sequelize');
const sequelize = require('../config/sequelize');

const SecurityQA = sequelize.define('SecurityQA', {
    id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
    user_id: {type: DataTypes.INTEGER, allowNull: false},
    question: {type: DataTypes.STRING(255), allowNull: false},
    answer_hash: {type: DataTypes.STRING(255), allowNull: false},
    created_at: {type: DataTypes.DATE, defaultValue: DataTypes.NOW},
}, {
    tableName: 'security_qas',
    timestamps: false,
});

module.exports = {SecurityQA};
