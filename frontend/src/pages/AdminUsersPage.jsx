// frontend/src/pages/AdminUsersPage.jsx
import React, {useEffect, useMemo, useState} from 'react';
import '@ant-design/v5-patch-for-react-19';
import {
    Table, Typography, Space, Button, Select, message, Input, Tag, Popconfirm, Tooltip, Pagination
} from 'antd';
import {ReloadOutlined, DeleteOutlined, ArrowLeftOutlined} from '@ant-design/icons';
import api from '../services/api';
import {useAuth} from '../contexts/AuthContext';
import {useNavigate} from 'react-router-dom';
import dayjs from 'dayjs';
import styles from './AdminUsersPage.module.css';

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

    // pagination we control (so footer can be sticky)
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

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

    // slice the page ourselves so Table never scrolls; it only shows one page worth
    const paged = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, page, pageSize]);

    // reset to first page when filter changes or page overflows
    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
        if (page > maxPage) setPage(1);
    }, [filtered.length, page, pageSize]);

    const columns = [
        {title: 'ID', dataIndex: 'id', key: 'id', width: 0, align: 'center'},
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            width: 450,
            render: (v, r) => (
                <Space>
                    <span className="emailCell">{v}</span>
                    {me?.id === r.id && <Tag color="blue">you</Tag>}
                </Space>
            )
        },
        {
            title: 'Created At',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (value) => dayjs(value).format('MMMM D, YYYY, h:mm A')
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            width: 450,
            render: (r, record) => (
                <Space wrap>
                    <Tag
                        color={r === 'admin' ? 'red' : r === 'auditor' ? 'blue' : r === 'uploader' ? 'green' : 'default'}>
                        {r}
                    </Tag>
                    <Select
                        value={r}
                        onChange={(val) => onChangeRole(record.id, val)}
                        style={{width: 180}}
                    >
                        {ROLES.map(x => <Option key={x} value={x}>{x}</Option>)}
                    </Select>
                </Space>
            )
        },
    ];


    if (isAdmin) {
        columns.push({
            title: 'Actions',
            key: 'actions',
            width: 150,
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
        <div className={styles.page}>
            <div className={styles.main}>
                <div className={styles.header}>
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
                        <Search
                            placeholder="Search email"
                            allowClear
                            onSearch={setQ}
                            onChange={(e) => setQ(e.target.value)}
                            style={{width: 260}}
                        />
                        <Button icon={<ReloadOutlined/>} onClick={load}>Refresh</Button>
                    </Space>
                </div>

                <div className={styles.tableWrap}>
                    <Table
                        rowKey="id"
                        dataSource={paged}
                        columns={columns}
                        loading={loading}
                        pagination={false}           /* no table pager — we use sticky footer below */
                    />
                </div>
            </div>

            {/* Sticky footer paginator */}
            <div className={styles.footer}>
                <Pagination
                    current={page}
                    pageSize={pageSize}
                    total={filtered.length}
                    showSizeChanger
                    pageSizeOptions={['5', '10', '20', '50']}
                    onChange={(p, ps) => {
                        setPage(p);
                        setPageSize(ps);
                    }}
                />
            </div>
        </div>
    );
}
