// backend/src/models/user.js
const {DataTypes} = require('sequelize');
const sequelize = require('../config/sequelize');

const USER_ROLES = ['admin', 'auditor', 'uploader', 'viewer'];

const User = sequelize.define('User', {
    id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
    email: {type: DataTypes.STRING, unique: true, allowNull: false},
    password_hash: {type: DataTypes.STRING, allowNull: false},
    role: {type: DataTypes.ENUM(...USER_ROLES), allowNull: false, defaultValue: 'viewer'},
    created_at: {type: DataTypes.DATE, defaultValue: DataTypes.NOW},
    updated_at: {type: DataTypes.DATE, defaultValue: DataTypes.NOW},
}, {
    tableName: 'users',
    timestamps: false,
});

module.exports = {User, USER_ROLES};
