// frontend/src/pages/AdminUsersPage.jsx
import React, {useEffect, useMemo, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {Table, Typography, Space, Button, Select, message, Input, Tag, Popconfirm, Tooltip} from 'antd';
import {ReloadOutlined, DeleteOutlined, ArrowLeftOutlined} from '@ant-design/icons';
import api from '../services/api';
import {useAuth} from '../contexts/AuthContext';
import {useNavigate} from 'react-router-dom';

const {Title} = Typography;
const {Option} = Select;
const {Search} = Input;

const ROLES = ['admin', 'auditor', 'uploader', 'viewer'];

export default function AdminUsersPage() {
    const {user: me, hasRole} = useAuth();
    const isAdmin = hasRole('admin');
    const navigate = useNavigate();

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

    const onDelete = async (id) => {
        try {
            await api.delete(`/admin/users/${id}`);
            message.success('User deleted');
            setUsers(prev => prev.filter(u => u.id !== id));
        } catch (e) {
            message.error(e.response?.data?.error || 'Delete failed');
        }
    };

    const filtered = useMemo(() => {
        const k = q.trim().toLowerCase();
        if (!k) return users;
        return users.filter(u => (u.email || '').toLowerCase().includes(k));
    }, [users, q]);

    const columns = [
        {title: 'ID', dataIndex: 'id', key: 'id', width: 80},
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            render: (v, r) => (
                <Space>
                    <span>{v}</span>
                    {me?.id === r.id && <Tag color="blue">you</Tag>}
                </Space>
            )
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            width: 300,
            render: (r, record) => (
                <Space>
                    <Tag
                        color={r === 'admin' ? 'red' : r === 'auditor' ? 'blue' : r === 'uploader' ? 'green' : 'default'}>
                        {r}
                    </Tag>
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

    if (isAdmin) {
        columns.push({
            title: 'Actions',
            key: 'actions',
            width: 140,
            render: (_t, record) => {
                const isSelf = me?.id === record.id;
                return (
                    <Tooltip title={isSelf ? 'You cannot delete yourself' : ''}>
            <span>
              <Popconfirm
                  title={`Delete user ${record.email}?`}
                  description="This action cannot be undone."
                  okText="Delete"
                  okButtonProps={{danger: true}}
                  onConfirm={() => onDelete(record.id)}
                  disabled={isSelf}
              >
                <Button danger icon={<DeleteOutlined/>} disabled={isSelf}>
                  Delete
                </Button>
              </Popconfirm>
            </span>
                    </Tooltip>
                );
            }
        });
    }

    return (
        <div style={{padding: 24}}>
            <Space style={{width: '100%', justifyContent: 'space-between', marginBottom: 12}}>
                <Space align="center">
                    <Button
                        icon={<ArrowLeftOutlined/>}
                        onClick={() => navigate(-1)}
                        aria-label="Back"
                    >
                        Back
                    </Button>
                    <Title level={3} style={{margin: 0}}>User Management</Title>
                </Space>
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
