import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, TextField, Button, Grid, MenuItem, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';
import { Send, Add } from '@mui/icons-material';
import { useNotification } from '../../contexts/NotificationContext';

const API_CAMPAIGNS = '/api/zalo?action=campaigns';
const API_TEMPLATES = '/api/zalo?action=templates';

interface Campaign {
    id: string;
    name: string;
    total_recipients: number;
    status: string;
    created_at: string;
    zalo_templates: {
        template_name: string;
    };
}

const ZaloCampaigns: React.FC = () => {
    const { showNotification } = useNotification();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [form, setForm] = useState({
        name: '',
        template_id: '',
        phones: '', // comma separated or new lines
        params_json: '{}'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [campRes, tempRes] = await Promise.all([
                fetch(API_CAMPAIGNS),
                fetch(API_TEMPLATES)
            ]);
            const campJson = await campRes.json();
            const tempJson = await tempRes.json();

            if (campJson.success) setCampaigns(campJson.data);
            if (tempJson.success) setTemplates(tempJson.data.filter((t: any) => t.is_active));
        } catch (error) {
            showNotification('Lỗi khi tải dữ liệu', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!form.name || !form.template_id || !form.phones) {
            return showNotification('Vui lòng điền đủ thông tin', 'warning');
        }

        const phoneList = form.phones.split(/[\n,]+/).map(p => p.trim()).filter(p => p);
        if (phoneList.length === 0) return showNotification('Không có số điện thoại hợp lệ', 'warning');

        let template_data = {};
        try {
            template_data = JSON.parse(form.params_json);
        } catch {
            return showNotification('JSON tham số không hợp lệ', 'error');
        }

        setSending(true);
        try {
            const payload = {
                name: form.name,
                template_id: form.template_id,
                recipients: phoneList.map(phone => ({ phone })),
                template_data
            };

            const res = await fetch(API_CAMPAIGNS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            if (json.success) {
                showNotification('Đã tạo chiến dịch gửi ZNS', 'success');
                setShowForm(false);
                setForm({ name: '', template_id: '', phones: '', params_json: '{}' });
                fetchData();
            } else {
                showNotification(json.error || 'Lỗi tạo chiến dịch', 'error');
            }
        } catch (error) {
            showNotification('Lỗi kết nối máy chủ', 'error');
        } finally {
            setSending(false);
        }
    };

    return (
        <Box p={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Box>
                    <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
                        Chiến dịch gửi ZNS
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Tạo và quản lý các đợt gửi tin nhắn hàng loạt.
                    </Typography>
                </Box>
                {!showForm && (
                    <Button 
                        variant="contained" 
                        startIcon={<Add />} 
                        onClick={() => setShowForm(true)}
                        sx={{ boxShadow: 'none' }}
                    >
                        Tạo chiến dịch mới
                    </Button>
                )}
            </Box>

            {showForm && (
                <Paper sx={{ p: 3, mb: 4, borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                    <Typography variant="h6" mb={3} fontWeight={600}>Tạo chiến dịch mới</Typography>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Tên chiến dịch"
                                value={form.name}
                                onChange={e => setForm({...form, name: e.target.value})}
                                size="small"
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                select
                                fullWidth
                                label="Chọn Template"
                                value={form.template_id}
                                onChange={e => setForm({...form, template_id: e.target.value})}
                                size="small"
                            >
                                {templates.map(t => (
                                    <MenuItem key={t.id} value={t.id}>{t.template_name} ({t.template_id})</MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                label="Danh sách SĐT (cách nhau dấu phẩy hoặc xuống dòng)"
                                value={form.phones}
                                onChange={e => setForm({...form, phones: e.target.value})}
                                placeholder="84912345678, 84987654321"
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                label="Tham số Template (JSON)"
                                value={form.params_json}
                                onChange={e => setForm({...form, params_json: e.target.value})}
                                placeholder={'{\n  "customer_name": "Nguyễn Văn A",\n  "order_code": "12345"\n}'}
                                sx={{ fontFamily: 'monospace' }}
                            />
                        </Grid>
                    </Grid>
                    <Box mt={3} display="flex" gap={2} justifyContent="flex-end">
                        <Button onClick={() => setShowForm(false)} disabled={sending}>Hủy</Button>
                        <Button 
                            variant="contained" 
                            startIcon={sending ? <CircularProgress size={20} color="inherit" /> : <Send />}
                            onClick={handleCreate}
                            disabled={sending}
                            sx={{ boxShadow: 'none' }}
                        >
                            Tạo và gửi
                        </Button>
                    </Box>
                </Paper>
            )}

            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Chiến dịch</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Template</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Số lượng</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Trạng thái</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Ngày tạo</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell>
                            </TableRow>
                        ) : campaigns.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#64748b' }}>Chưa có chiến dịch nào.</TableCell>
                            </TableRow>
                        ) : (
                            campaigns.map(c => (
                                <TableRow key={c.id}>
                                    <TableCell fontWeight={500}>{c.name}</TableCell>
                                    <TableCell>{c.zalo_templates?.template_name}</TableCell>
                                    <TableCell>{c.total_recipients}</TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={c.status === 'processing' ? 'Đang xử lý' : c.status} 
                                            color={c.status === 'processing' ? 'warning' : 'default'}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>{new Date(c.created_at).toLocaleString('vi-VN')}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default ZaloCampaigns;
