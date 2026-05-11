import React, { useState, useEffect } from 'react';
import { 
    Box, Typography, Paper, Table, TableBody, TableCell, 
    TableContainer, TableHead, TableRow, Chip, CircularProgress,
    IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Tabs, Tab, Divider
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import { GoogleSheetService } from '../../services/GoogleSheetService';

interface ActionLog {
    id: string;
    created_at: string;
    action: string;
    doc_title: string;
    total_serials: number;
    total_qrs: number;
    created_by: string;
    details: any;
}

interface AssetLog {
    id: string;
    created_at: string;
    asset_code: string;
    asset_name: string;
    action: string;
    details: string;
    employee_name: string;
    department: string;
    performed_by: string;
}

const getActionColor = (action: string) => {
    if (action === 'LOGIN') return 'success';
    if (action.includes('PRINT')) return 'primary';
    if (action.includes('EXPORT_PDF')) return 'secondary';
    if (action === 'Cấp phát') return 'info';
    if (action === 'Thu hồi') return 'warning';
    if (action === 'Điều chuyển') return 'secondary';
    if (action === 'Tăng') return 'success';
    if (action === 'Giảm') return 'error';
    return 'default';
};

const getActionLabel = (action: string) => {
    switch(action) {
        case 'LOGIN': return 'Đăng nhập';
        case 'PRINT': return 'In QR (Chuẩn)';
        case 'PRINT_HCM': return 'In QR (HCM)';
        case 'EXPORT_PDF': return 'Xuất PDF (Chuẩn)';
        case 'EXPORT_PDF_HCM': return 'Xuất PDF (HCM)';
        default: return action;
    }
};

const ActionHistory: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const [qrLogs, setQrLogs] = useState<ActionLog[]>([]);
    const [assetLogs, setAssetLogs] = useState<AssetLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDetails, setSelectedDetails] = useState<any>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (tabValue === 0) {
                const data = await GoogleSheetService.getActionLogs();
                setQrLogs(data || []);
            } else {
                const data = await GoogleSheetService.getAssetLogs();
                setAssetLogs(data || []);
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [tabValue]);

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b' }}>
                    LỊCH SỬ HỆ THỐNG
                </Typography>
                <IconButton onClick={fetchData} disabled={loading} color="primary" sx={{ background: '#f1f5f9' }}>
                    <RefreshIcon />
                </IconButton>
            </Box>

            <Tabs 
                value={tabValue} 
                onChange={(_, v) => setTabValue(v)} 
                sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
            >
                <Tab label="In QR & Xuất PDF" />
                <Tab label="Biến động tài sản" />
            </Tabs>

            <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Table size="small">
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Thời gian</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Hành động</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{tabValue === 0 ? 'Người dùng' : 'Tài sản'}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{tabValue === 0 ? 'Chi tiết' : 'Người thực hiện / Nhân viên'}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                                    <CircularProgress size={30} />
                                </TableCell>
                            </TableRow>
                        ) : (tabValue === 0 ? qrLogs : assetLogs).length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    Chưa có dữ liệu nào
                                </TableCell>
                            </TableRow>
                        ) : (
                            (tabValue === 0 ? qrLogs : assetLogs).map((log: any) => (
                                <TableRow key={log.id} hover>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={tabValue === 0 ? getActionLabel(log.action) : log.action} 
                                            color={getActionColor(log.action) as any} 
                                            size="small" 
                                            sx={{ fontWeight: 600, minWidth: 100 }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {tabValue === 0 ? (
                                            <Typography variant="body2" fontWeight={600}>{log.created_by}</Typography>
                                        ) : (
                                            <Box>
                                                <Typography variant="body2" fontWeight={600}>{log.asset_name}</Typography>
                                                <Typography variant="caption" color="text.secondary">{log.asset_code}</Typography>
                                            </Box>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {tabValue === 0 ? (
                                            log.action === 'LOGIN' ? (
                                                <Typography variant="body2" color="text.secondary">Đăng nhập</Typography>
                                            ) : (
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {log.doc_title} ({log.total_qrs} mã)
                                                    </Typography>
                                                    {log.details && (
                                                        <IconButton size="small" onClick={() => setSelectedDetails(log.details)}>
                                                            <InfoIcon fontSize="small" color="info" />
                                                        </IconButton>
                                                    )}
                                                </Box>
                                            )
                                        ) : (
                                            <Box>
                                                <Typography variant="body2">Người thực hiện: <b>{log.performed_by || 'Hệ thống'}</b></Typography>
                                                <Typography variant="body2" color="primary" fontWeight={600} sx={{ mt: 0.5 }}>
                                                    {log.details || (log.employee_name ? `Nhân viên: ${log.employee_name}` : 'Không có chi tiết')}
                                                </Typography>
                                                {log.department && (
                                                    <Typography variant="caption" display="block" color="text.secondary">
                                                        Phòng ban: {log.department}
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={Boolean(selectedDetails)} onClose={() => setSelectedDetails(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Chi tiết thùng/thiết bị in</DialogTitle>
                <DialogContent dividers>
                    {selectedDetails ? (
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14 }}>
                            {JSON.stringify(selectedDetails, null, 2)}
                        </pre>
                    ) : (
                        <Typography>Không có dữ liệu chi tiết</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSelectedDetails(null)}>Đóng</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ActionHistory;
