// frontend/src/contexts/AuthContext.jsx
import React, {useEffect, useMemo, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {Table, Typography, Space, Button, Select, message, Input, Tag} from 'antd';
import {ReloadOutlined} from '@ant-design/icons';
import api from '../services/api';

const {Title} = Typography;
const {Option} = Select;
const {Search} = Input;

const ROLES = ['admin', 'auditor', 'uploader', 'viewer'];

export default function AdminUsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [q, setQ] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/users');
            setUsers(res.data || []);
        } catch (e) {
            message.error(e.response?.data?.error || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const onChangeRole = async (id, role) => {
        try {
            await api.put(`/admin/users/${id}/role`, {role});
            message.success('Role updated');
            setUsers(prev => prev.map(u => (u.id === id ? {...u, role} : u)));
        } catch (e) {
            message.error(e.response?.data?.error || 'Update failed');
        }
    };

    const filtered = useMemo(() => {
        const k = q.trim().toLowerCase();
        if (!k) return users;
        return users.filter(u => (u.email || '').toLowerCase().includes(k));
    }, [users, q]);

    const columns = [
        {title: 'ID', dataIndex: 'id', key: 'id', width: 80},
        {title: 'Email', dataIndex: 'email', key: 'email'},
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            width: 260,
            render: (r, record) => (
                <Space>
                    <Tag
                        color={r === 'admin' ? 'red' : r === 'auditor' ? 'blue' : r === 'uploader' ? 'green' : 'default'}>{r}</Tag>
                    <Select
                        value={r}
                        onChange={(val) => onChangeRole(record.id, val)}
                        style={{width: 160}}
                    >
                        {ROLES.map(x => <Option key={x} value={x}>{x}</Option>)}
                    </Select>
                </Space>
            )
        },
        {title: 'Created At', dataIndex: 'created_at', key: 'created_at', width: 220},
    ];

    return (
        <div style={{padding: 24}}>
            <Space style={{width: '100%', justifyContent: 'space-between', marginBottom: 12}}>
                <Title level={3} style={{margin: 0}}>User Management</Title>
                <Space>
                    <Search placeholder="Search email" allowClear onSearch={setQ} style={{width: 240}}/>
                    <Button icon={<ReloadOutlined/>} onClick={load}>Refresh</Button>
                </Space>
            </Space>
            <Table
                rowKey="id"
                dataSource={filtered}
                columns={columns}
                loading={loading}
                pagination={{pageSize: 10}}
            />
        </div>
    );
}
