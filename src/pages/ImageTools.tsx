import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Box, Paper, Typography, Stack, Button, IconButton,
    Card, CardContent, Slider, Alert, Chip, Tooltip,
    Grid, LinearProgress, Divider, ToggleButton, ToggleButtonGroup,
    Tab, Tabs, TextField, FormControlLabel, Switch, Select,
    MenuItem, InputLabel, FormControl, InputAdornment
} from '@mui/material';
import {
    Upload, Download, Trash2, ImageIcon, Wand2, RotateCcw,
    ZoomIn, ZoomOut, Eye, EyeOff, Sparkles, Settings2,
    CheckCircle2, Info, Maximize2, Palette, Stars, Layers,
    Lock, Unlock, RefreshCw, Sun, Contrast, Droplets,
    Sliders, FlipHorizontal, FlipVertical, RotateCw,
    Brush, Eraser
} from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { saveAs } from 'file-saver';

// ─── Types ─────────────────────────────────────────────────────────────────
interface ImageState {
    original: HTMLImageElement | null;
    originalDataUrl: string;
    processedDataUrl: string;
    fileName: string;
    fileSize: number;
    width: number;
    height: number;
}

interface Point {
    x: number;
    y: number;
}

interface Stroke {
    points: Point[];
    size: number;
}

interface WatermarkOptions {
    threshold: number;
    blendMode: 'inpaint' | 'whiteFill' | 'blur' | 'transparent';
    sensitivity: number;
    iterations: number;
}

interface ResizeOptions {
    width: number;
    height: number;
    lockAspect: boolean;
    unit: 'px' | '%';
    quality: number;
    format: 'png' | 'jpeg' | 'webp';
    fit: 'stretch' | 'contain' | 'cover';
}

interface BackgroundOptions {
    mode: 'color' | 'gradient' | 'image' | 'transparent' | 'blur';
    color: string;
    gradientFrom: string;
    gradientTo: string;
    gradientAngle: number;
    blurAmount: number;
    bgImage: string | null;
    removeThreshold: number;
}

interface EnhanceOptions {
    brightness: number;
    contrast: number;
    saturation: number;
    sharpness: number;
    hue: number;
    blur: number;
    noise: number;
    vignette: number;
    filter: string;
    flipH: boolean;
    flipV: boolean;
    rotation: number;
}

// ─── Improved Watermark Removal Algorithm ────────────────────────────────
function removeWatermark(imageData: ImageData, opts: WatermarkOptions, manualMask?: Uint8Array): ImageData {
    const { data, width, height } = imageData;
    const result = new Uint8ClampedArray(data);
    const { threshold, sensitivity, blendMode, iterations } = opts;

    // ── Step 1: Tính toán Luminance và Saturation ──
    const N = width * height;
    const gray = new Float32Array(N);
    const saturation = new Float32Array(N);
    for (let i = 0; i < N; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
        gray[i] = r * 0.299 + g * 0.587 + b * 0.114;
        const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
        saturation[i] = maxC === 0 ? 0 : (maxC - minC) / maxC;
    }

    // ── Step 2: Xây dựng Integral Image (Summed Area Table) để tính Local Mean siêu tốc ──
    const intGray = new Float32Array(N);
    const intSat = new Float32Array(N);
    for (let y = 0; y < height; y++) {
        let rowSumG = 0, rowSumS = 0;
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            rowSumG += gray[i];
            rowSumS += saturation[i];
            if (y === 0) {
                intGray[i] = rowSumG;
                intSat[i] = rowSumS;
            } else {
                intGray[i] = intGray[(y - 1) * width + x] + rowSumG;
                intSat[i] = intSat[(y - 1) * width + x] + rowSumS;
            }
        }
    }

    const getSum = (intArr: Float32Array, x0: number, y0: number, x1: number, y1: number) => {
        x0 = Math.max(0, x0); y0 = Math.max(0, y0);
        x1 = Math.min(width - 1, x1); y1 = Math.min(height - 1, y1);
        const A = (x0 > 0 && y0 > 0) ? intArr[(y0 - 1) * width + (x0 - 1)] : 0;
        const B = (y0 > 0) ? intArr[(y0 - 1) * width + x1] : 0;
        const C = (x0 > 0) ? intArr[y1 * width + (x0 - 1)] : 0;
        const D = intArr[y1 * width + x1];
        return D - B - C + A;
    };

    // ── Step 3: Xây dựng Raw Mask với bán kính lớn (R=40) ──
    const rawMask = new Uint8Array(N);
    const R = 40; // Bán kính khổng lồ để quét được các chữ watermark siêu to
    const minLumDeviation = Math.max(1, 30 - (threshold * 0.25)); 
    const minSatDrop = Math.max(0, 0.12 - (sensitivity * 0.012)); 

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const x0 = x - R, y0 = y - R, x1 = x + R, y1 = y + R;
            const rx0 = Math.max(0, x0), ry0 = Math.max(0, y0);
            const rx1 = Math.min(width - 1, x1), ry1 = Math.min(height - 1, y1);
            const area = (rx1 - rx0 + 1) * (ry1 - ry0 + 1);

            const lm = getSum(intGray, x0, y0, x1, y1) / area;
            const lsm = getSum(intSat, x0, y0, x1, y1) / area;

            const lumDev = gray[i] - lm;
            const satDrop = lsm - saturation[i];
            const isWhiteWM = lumDev > minLumDeviation && satDrop > minSatDrop;
            
            const a = data[i * 4 + 3];
            const isSemiTransparent = a < 245 && a > 5;
            rawMask[i] = (isWhiteWM || isSemiTransparent) ? 1 : 0;
        }
    }

    // ── Step 4: Morphological Opening (Erosion + Dilation) ──
    const dilated = new Uint8Array(N);

    if (manualMask) {
        // Nếu dùng Brush tool thủ công, bỏ qua auto-detect và dùng trực tiếp mask
        for (let i = 0; i < N; i++) dilated[i] = manualMask[i];
    } else {
        // 4.1 Erosion: Xóa nhiễu hạt nhỏ (như lá cây lấp lánh) bằng cách yêu cầu pixel xung quanh cũng phải là mask
        const eroded = new Uint8Array(N);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = y * width + x;
                if (rawMask[i] && rawMask[i-1] && rawMask[i+1] && rawMask[i-width] && rawMask[i+width]) {
                    eroded[i] = 1;
                }
            }
        }

        // 4.2 Dilation: Phình to mask từ phần lõi đã lọc nhiễu để bao trọn viền chữ watermark
        const dilateR = 4; // Phình to 4 pixel mỗi chiều
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (eroded[y * width + x]) {
                    for (let dy = -dilateR; dy <= dilateR; dy++) {
                        for (let dx = -dilateR; dx <= dilateR; dx++) {
                            const nx = x + dx, ny = y + dy;
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                dilated[ny * width + nx] = 1;
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Step 5: Inpaint / Fill watermark pixels ──
    if (blendMode === 'transparent') {
        for (let i = 0; i < width * height; i++) {
            if (dilated[i]) result[i * 4 + 3] = 0;
        }
        return new ImageData(result, width, height);
    }
    if (blendMode === 'whiteFill') {
        for (let i = 0; i < width * height; i++) {
            if (dilated[i]) {
                result[i * 4] = 255; result[i * 4 + 1] = 255;
                result[i * 4 + 2] = 255; result[i * 4 + 3] = 255;
            }
        }
        return new ImageData(result, width, height);
    }

    // Inpaint & Blur: Trám dần từ viền ngoài vào trong tâm (Iterative Boundary Fill)
    const inpaintR = blendMode === 'inpaint' ? 3 : 1; 
    let remaining = 0;
    for (let i = 0; i < N; i++) if (dilated[i]) remaining++;
    
    const currentMask = new Uint8Array(dilated);
    const MAX_ITERS = 100; // Đủ để trám các nét cọ cực dày
    let iters = 0;
    
    while (remaining > 0 && iters < MAX_ITERS) {
        let filledThisRound = 0;
        const newMask = new Uint8Array(currentMask);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                if (!currentMask[i]) continue;
                
                const idx = i * 4;
                let sumR = 0, sumG = 0, sumB = 0, count = 0;
                
                for (let dy = -inpaintR; dy <= inpaintR; dy++) {
                    for (let dx = -inpaintR; dx <= inpaintR; dx++) {
                        if (!dx && !dy) continue;
                        const nx = x + dx, ny = y + dy;
                        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                        
                        const ni = ny * width + nx;
                        if (!currentMask[ni]) {
                            const nidx = ni * 4;
                            sumR += result[nidx];
                            sumG += result[nidx + 1];
                            sumB += result[nidx + 2];
                            count++;
                        }
                    }
                }
                
                if (count > 0) {
                    result[idx]     = Math.round(sumR / count);
                    result[idx + 1] = Math.round(sumG / count);
                    result[idx + 2] = Math.round(sumB / count);
                    result[idx + 3] = 255;
                    newMask[i] = 0; // Đã trám xong pixel này
                    filledThisRound++;
                }
            }
        }
        
        if (filledThisRound === 0) break; // Không thể trám thêm
        remaining -= filledThisRound;
        for (let i = 0; i < N; i++) currentMask[i] = newMask[i];
        iters++;
    }

    return new ImageData(result, width, height);
}

function applyEnhance(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, img: HTMLImageElement, opts: EnhanceOptions) {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    if (opts.flipH) ctx.scale(-1, 1);
    if (opts.flipV) ctx.scale(1, -1);
    ctx.rotate((opts.rotation * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    const filters: string[] = [];
    if (opts.brightness !== 100) filters.push(`brightness(${opts.brightness}%)`);
    if (opts.contrast !== 100) filters.push(`contrast(${opts.contrast}%)`);
    if (opts.saturation !== 100) filters.push(`saturate(${opts.saturation}%)`);
    if (opts.hue !== 0) filters.push(`hue-rotate(${opts.hue}deg)`);
    if (opts.blur > 0) filters.push(`blur(${opts.blur}px)`);
    if (opts.filter !== 'none') filters.push(opts.filter);

    if (filters.length > 0) {
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width; tmp.height = canvas.height;
        const tmpCtx = tmp.getContext('2d')!;
        tmpCtx.filter = filters.join(' ');
        tmpCtx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tmp, 0, 0);
    }

    // Sharpness (unsharp mask)
    if (opts.sharpness > 0) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data, w = canvas.width, h = canvas.height;
        const amount = opts.sharpness / 100;
        const blurD = new Uint8ClampedArray(d);
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const i = (y * w + x) * 4;
                for (let c = 0; c < 3; c++) {
                    const orig = d[i + c];
                    const blur = (d[((y - 1) * w + x) * 4 + c] + d[((y + 1) * w + x) * 4 + c] + d[(y * w + x - 1) * 4 + c] + d[(y * w + x + 1) * 4 + c]) / 4;
                    blurD[i + c] = Math.max(0, Math.min(255, orig + (orig - blur) * amount * 3));
                }
            }
        }
        ctx.putImageData(new ImageData(blurD, w, h), 0, 0);
    }

    // Vignette
    if (opts.vignette > 0) {
        const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 2);
        gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0,${opts.vignette / 100})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function hexToRgb(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

// ─── Shared Upload Zone ────────────────────────────────────────────────────
const DropZone: React.FC<{ onFile: (f: File) => void; compact?: boolean }> = ({ onFile, compact }) => {
    const ref = useRef<HTMLInputElement>(null);
    const [drag, setDrag] = useState(false);
    return (
        <Paper elevation={0} onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
            onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onClick={() => ref.current?.click()} sx={{
                border: '2px dashed', borderColor: drag ? '#7c3aed' : 'var(--border-color)',
                borderRadius: '16px', p: compact ? 3 : 7, textAlign: 'center', cursor: 'pointer',
                bgcolor: drag ? 'rgba(124,58,237,0.05)' : 'var(--bg-paper)',
                transition: 'all 0.3s ease', '&:hover': { borderColor: '#7c3aed', bgcolor: 'rgba(124,58,237,0.05)', transform: 'scale(1.01)' }
            }}>
            <Box sx={{ width: compact ? 52 : 72, height: compact ? 52 : 72, borderRadius: '20px', background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(168,85,247,0.12))', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>
                <Upload size={compact ? 24 : 32} color="#7c3aed" />
            </Box>
            <Typography variant={compact ? 'body1' : 'h6'} fontWeight={700} color="var(--text-primary)" mb={0.5}>Kéo thả ảnh vào đây</Typography>
            <Typography variant="body2" color="text.secondary" mb={1.5}>hoặc click để chọn từ máy tính</Typography>
            <Stack direction="row" gap={0.8} justifyContent="center" flexWrap="wrap">
                {['JPG', 'PNG', 'WEBP', 'BMP'].map(f => <Chip key={f} label={f} size="small" sx={{ bgcolor: 'rgba(124,58,237,0.1)', color: '#7c3aed', fontWeight: 600, fontSize: '0.68rem' }} />)}
            </Stack>
            <input ref={ref} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        </Paper>
    );
};

// ─── Image Preview ─────────────────────────────────────────────────────────
const ImagePreview: React.FC<{
    imageState: ImageState; hasProcessed: boolean; showOriginal: boolean;
    setShowOriginal: (v: boolean) => void; onClear: () => void; onReload: () => void;
    zoom: number; setZoom: (v: number) => void; isProcessing: boolean; progress: number;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    accentColor?: string;
    renderOverlay?: () => React.ReactNode;
}> = ({ imageState, hasProcessed, showOriginal, setShowOriginal, onClear, onReload, zoom, setZoom, isProcessing, progress, canvasRef, accentColor = '#7c3aed', renderOverlay }) => {
    const display = showOriginal ? imageState.originalDataUrl : (hasProcessed ? imageState.processedDataUrl : imageState.originalDataUrl);
    const fmt = (b: number) => b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
    return (
        <Paper elevation={0} sx={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', bgcolor: 'var(--bg-paper)' }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Stack direction="row" alignItems="center" gap={0.5} sx={{ flex: 1, minWidth: 0 }}>
                    <ImageIcon size={15} color={accentColor} />
                    <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 160 }}>{imageState.fileName}</Typography>
                    <Chip label={fmt(imageState.fileSize)} size="small" sx={{ bgcolor: `${accentColor}18`, color: accentColor, fontWeight: 600, fontSize: '0.63rem' }} />
                    <Chip label={`${imageState.width}×${imageState.height}`} size="small" sx={{ bgcolor: `${accentColor}10`, color: accentColor, fontSize: '0.63rem' }} />
                </Stack>
                {hasProcessed && (
                    <Tooltip title={showOriginal ? 'Đang xem gốc' : 'Đang xem kết quả'}>
                        <Button size="small" variant={showOriginal ? 'outlined' : 'contained'} onClick={() => setShowOriginal(!showOriginal)}
                            startIcon={showOriginal ? <Eye size={13} /> : <EyeOff size={13} />}
                            sx={{ fontSize: '0.7rem', bgcolor: showOriginal ? 'transparent' : accentColor, borderColor: accentColor, color: showOriginal ? accentColor : 'white', '&:hover': { bgcolor: showOriginal ? `${accentColor}15` : accentColor + 'cc' } }}>
                            {showOriginal ? 'Gốc' : 'Kết quả'}
                        </Button>
                    </Tooltip>
                )}
                <Stack direction="row" alignItems="center" gap={0.3}>
                    <Tooltip title="Thu nhỏ"><IconButton size="small" onClick={() => setZoom(Math.max(20, zoom - 20))}><ZoomOut size={15} /></IconButton></Tooltip>
                    <Typography variant="caption" fontWeight={600} sx={{ minWidth: 34, textAlign: 'center' }}>{zoom}%</Typography>
                    <Tooltip title="Phóng to"><IconButton size="small" onClick={() => setZoom(Math.min(250, zoom + 20))}><ZoomIn size={15} /></IconButton></Tooltip>
                </Stack>
                <Tooltip title="Ảnh khác"><IconButton size="small" onClick={onReload} sx={{ color: accentColor }}><RefreshCw size={15} /></IconButton></Tooltip>
                <Tooltip title="Xóa"><IconButton size="small" onClick={onClear} sx={{ color: '#ef4444' }}><Trash2 size={15} /></IconButton></Tooltip>
            </Box>
            <Box sx={{
                position: 'relative', overflow: 'auto', maxHeight: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, minHeight: 200,
                backgroundImage: 'linear-gradient(45deg,#e8e8e8 25%,transparent 25%),linear-gradient(-45deg,#e8e8e8 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e8e8e8 75%),linear-gradient(-45deg,transparent 75%,#e8e8e8 75%)',
                backgroundSize: '20px 20px', backgroundPosition: '0 0,0 10px,10px -10px,-10px 0'
            }}>
                <Box sx={{ position: 'relative', display: 'inline-block', maxWidth: `${zoom}%`, borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', transition: 'all 0.3s' }}>
                    {display && <img src={display} alt="preview" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8 }} />}
                    {renderOverlay && renderOverlay()}
                </Box>
                {isProcessing && (
                    <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <Sparkles size={34} color="#a855f7" />
                        <Typography color="white" fontWeight={700}>Đang xử lý...</Typography>
                        <Box sx={{ width: 180 }}>
                            <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.2)', '& .MuiLinearProgress-bar': { background: `linear-gradient(90deg, ${accentColor}, #a855f7)` } }} />
                            <Typography color="rgba(255,255,255,0.8)" variant="caption" display="block" textAlign="center" mt={0.5}>{progress}%</Typography>
                        </Box>
                    </Box>
                )}
                {hasProcessed && !isProcessing && !showOriginal && (
                    <Box sx={{ position: 'absolute', top: 10, right: 10, bgcolor: '#10b981', borderRadius: '8px', px: 1.2, py: 0.4, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CheckCircle2 size={13} color="white" />
                        <Typography variant="caption" color="white" fontWeight={700}>Đã xử lý</Typography>
                    </Box>
                )}
            </Box>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </Paper>
    );
};

// ══════════════════════════════════════════════════════════════════════════
// TAB 1 – Xóa Watermark
// ══════════════════════════════════════════════════════════════════════════
const WatermarkTab: React.FC<{ onFile: (f: File) => void }> = ({ onFile }) => {
    const { success, error: notifyError, info } = useNotification();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [img, setImg] = useState<ImageState | null>(null);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [done, setDone] = useState(false);
    const [showOrig, setShowOrig] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [opts, setOpts] = useState<WatermarkOptions>({ threshold: 40, sensitivity: 5, blendMode: 'inpaint', iterations: 2 });
    
    // --- Brush State ---
    const [isBrushMode, setIsBrushMode] = useState(false);
    const [brushSize, setBrushSize] = useState(25);
    const brushCanvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);

    const initBrushCanvas = useCallback(() => {
        if (img?.original && brushCanvasRef.current) {
            brushCanvasRef.current.width = img.original.width;
            brushCanvasRef.current.height = img.original.height;
            const ctx = brushCanvasRef.current.getContext('2d')!;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.clearRect(0, 0, brushCanvasRef.current.width, brushCanvasRef.current.height);
        }
    }, [img]);

    useEffect(() => {
        if (img) {
            setTimeout(initBrushCanvas, 50);
        }
    }, [img, initBrushCanvas]);

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isBrushMode || !brushCanvasRef.current) return;
        isDrawing.current = true;
        const ctx = brushCanvasRef.current.getContext('2d')!;
        const rect = brushCanvasRef.current.getBoundingClientRect();
        const scaleX = brushCanvasRef.current.width / rect.width;
        const scaleY = brushCanvasRef.current.height / rect.height;
        ctx.beginPath();
        ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isBrushMode || !isDrawing.current || !brushCanvasRef.current) return;
        const ctx = brushCanvasRef.current.getContext('2d')!;
        const rect = brushCanvasRef.current.getBoundingClientRect();
        const scaleX = brushCanvasRef.current.width / rect.width;
        const scaleY = brushCanvasRef.current.height / rect.height;
        ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
        ctx.lineWidth = brushSize;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; // Đỏ trong suốt để dễ nhìn
        ctx.stroke();
    };

    const handlePointerUp = () => {
        isDrawing.current = false;
    };

    const handleClearBrush = () => {
        if (brushCanvasRef.current) {
            const ctx = brushCanvasRef.current.getContext('2d')!;
            ctx.clearRect(0, 0, brushCanvasRef.current.width, brushCanvasRef.current.height);
        }
    };

    const loadImg = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) { notifyError('Vui lòng chọn file ảnh!'); return; }
        onFile(file);
        const reader = new FileReader();
        reader.onload = e => {
            const url = e.target?.result as string;
            const i = new Image();
            i.onload = () => {
                // Không dùng canvasRef ở đây vì canvas chưa được mount
                setImg({ original: i, originalDataUrl: url, processedDataUrl: url, fileName: file.name, fileSize: file.size, width: i.width, height: i.height });
                setDone(false); setShowOrig(false);
            };
            i.src = url;
        };
        reader.readAsDataURL(file);
        success(`Đã tải: ${file.name}`);
    }, [onFile, notifyError, success]);

    const handleProcess = async () => {
        if (!img || !canvasRef.current) return;
        
        let manualMask: Uint8Array | undefined;
        if (isBrushMode && brushCanvasRef.current) {
            const bCtx = brushCanvasRef.current.getContext('2d')!;
            const w = brushCanvasRef.current.width, h = brushCanvasRef.current.height;
            const bData = bCtx.getImageData(0, 0, w, h).data;
            manualMask = new Uint8Array(w * h);
            let hasBrush = false;
            for (let i = 0; i < w * h; i++) {
                if (bData[i * 4 + 3] > 0) { // Lấy các pixel có vẽ
                    manualMask[i] = 1;
                    hasBrush = true;
                }
            }
            if (!hasBrush) {
                notifyError("Chưa vẽ gì cả! Vui lòng tô lên vùng chữ hoặc tắt chế độ Cọ vẽ.");
                return;
            }
        }

        setProcessing(true); setProgress(0);
        const iv = setInterval(() => setProgress(p => Math.min(p + 12, 85)), 180);
        await new Promise<void>(res => setTimeout(() => {
        const c = canvasRef.current!; const ctx = c.getContext('2d')!;
            // ⚡ Fix: set canvas size trước khi draw (trước đây canvas mặc định 300×150)
            c.width = img.original!.width;
            c.height = img.original!.height;
            ctx.clearRect(0, 0, c.width, c.height);
            ctx.drawImage(img.original!, 0, 0);
            const id = ctx.getImageData(0, 0, c.width, c.height);
            ctx.putImageData(removeWatermark(id, opts, manualMask), 0, 0);
            const url = c.toDataURL('image/png', 1);
            setImg(p => p ? { ...p, processedDataUrl: url } : null);
            setDone(true); clearInterval(iv); res();
        }, 80));
        setProgress(100); setTimeout(() => { setProcessing(false); setProgress(0); }, 500);
        success('✅ Xóa watermark thành công!');
    };

    const handleDownload = () => {
        if (!img?.processedDataUrl || !done) return;
        const name = img.fileName.replace(/\.[^/.]+$/, '') + '_no_watermark.png';
        fetch(img.processedDataUrl).then(r => r.blob()).then(b => { saveAs(b, name); success(`Đã tải: ${name}`); });
    };

    const handleReset = () => {
        if (!img) return;
        const c = canvasRef.current; if (!c) return;
        c.getContext('2d')!.drawImage(img.original!, 0, 0);
        setImg(p => p ? { ...p, processedDataUrl: p.originalDataUrl } : null);
        setDone(false); info('Đã khôi phục ảnh gốc.');
    };

    if (!img) return (
        <Box sx={{ mt: 1 }}>
            <DropZone onFile={loadImg} />
            <Alert severity="info" sx={{ mt: 2, borderRadius: '12px' }}>
                <strong>Hỗ trợ:</strong> Watermark sáng màu, mờ, chữ bản quyền, logo trong suốt. Kết quả tốt nhất với ảnh có watermark màu sáng.
            </Alert>
        </Box>
    );

    return (
        <Grid container spacing={2.5} sx={{ mt: 0 }}>
            <Grid item xs={12} md={8}>
                <Stack gap={2}>
                    <ImagePreview imageState={img} hasProcessed={done} showOriginal={showOrig} setShowOriginal={setShowOrig}
                        onClear={() => { setImg(null); setDone(false); }} onReload={() => fileRef.current?.click()}
                        zoom={zoom} setZoom={setZoom} isProcessing={processing} progress={progress} canvasRef={canvasRef}
                        renderOverlay={() => img && (
                            <canvas
                                ref={brushCanvasRef}
                                style={{
                                    position: 'absolute', top: 0, left: 0,
                                    width: '100%', height: '100%',
                                    pointerEvents: (isBrushMode && !done && !showOrig) ? 'auto' : 'none',
                                    cursor: isBrushMode ? `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${brushSize}" height="${brushSize}" viewBox="0 0 ${brushSize} ${brushSize}"><circle cx="${brushSize/2}" cy="${brushSize/2}" r="${brushSize/2}" fill="rgba(239,68,68,0.5)"/></svg>') ${brushSize/2} ${brushSize/2}, crosshair` : 'default',
                                    zIndex: 10,
                                    opacity: (done || showOrig) ? 0 : 1
                                }}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerOut={handlePointerUp}
                            />
                        )}
                    />
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) loadImg(f); e.target.value = ''; }} />
                    <Stack direction="row" gap={1.5} flexWrap="wrap">
                        <Button variant="contained" size="large" startIcon={<Wand2 size={17} />} onClick={handleProcess} disabled={processing}
                            sx={{ flex: 1, minWidth: 140, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', fontWeight: 700, borderRadius: '12px', boxShadow: '0 4px 16px rgba(124,58,237,0.35)' }}>
                            {processing ? 'Đang xử lý...' : 'Xóa Watermark'}
                        </Button>
                        <Button variant="outlined" size="large" startIcon={<RotateCcw size={17} />} onClick={handleReset} disabled={!done || processing}
                            sx={{ fontWeight: 600, borderRadius: '12px', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>Khôi phục</Button>
                        <Button variant="contained" size="large" startIcon={<Download size={17} />} onClick={handleDownload} disabled={!done || processing}
                            sx={{ fontWeight: 700, borderRadius: '12px', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}>Tải về</Button>
                    </Stack>
                </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
                <Card elevation={0} sx={{ border: '1px solid var(--border-color)', borderRadius: '16px', bgcolor: 'var(--bg-paper)' }}>
                    <CardContent sx={{ p: 2.5 }}>
                        <Stack direction="row" alignItems="center" gap={1} mb={2}>
                            <Settings2 size={17} color="#7c3aed" /><Typography fontWeight={700}>Tùy chỉnh</Typography>
                        </Stack>
                        <Typography variant="body2" fontWeight={600} color="text.secondary" mb={1}>Phương pháp nhận diện</Typography>
                        <ToggleButtonGroup value={isBrushMode ? 'manual' : 'auto'} exclusive onChange={(_, v) => { if (v !== null) setIsBrushMode(v === 'manual'); }} size="small" fullWidth
                            sx={{ mb: 2, '& .MuiToggleButton-root': { borderRadius: '8px !important', fontSize: '0.75rem', fontWeight: 600, flex: 1, border: '1px solid var(--border-color) !important', '&.Mui-selected': { bgcolor: '#7c3aed', color: 'white' } } }}>
                            <ToggleButton value="auto"><Wand2 size={15} style={{ marginRight: 6 }} />Tự động</ToggleButton>
                            <ToggleButton value="manual"><Brush size={15} style={{ marginRight: 6 }} />Cọ vẽ thủ công</ToggleButton>
                        </ToggleButtonGroup>

                        {isBrushMode && (
                            <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <Typography variant="body2" fontWeight={700} color="#ef4444" mb={1.5}>Chế độ Cọ Vẽ: Tô lên vùng cần xóa</Typography>
                                <Stack direction="row" justifyContent="space-between" mb={0.5}>
                                    <Typography variant="body2" fontWeight={600} color="text.secondary">Kích thước cọ</Typography>
                                    <Chip label={`${brushSize}px`} size="small" sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 700, fontSize: '0.68rem', height: 18 }} />
                                </Stack>
                                <Slider value={brushSize} onChange={(_, v) => setBrushSize(v as number)} min={5} max={100} step={1} sx={{ color: '#ef4444', '& .MuiSlider-thumb': { width: 14, height: 14 } }} />
                                <Button size="small" variant="outlined" startIcon={<Eraser size={14} />} onClick={handleClearBrush} fullWidth
                                    sx={{ mt: 1, borderColor: '#ef4444', color: '#ef4444', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}>Xóa đường tô</Button>
                            </Box>
                        )}

                        <Typography variant="body2" fontWeight={600} color="text.secondary" mb={1}>Phương pháp lấp (Inpaint)</Typography>
                        <ToggleButtonGroup value={opts.blendMode} exclusive onChange={(_, v) => v && setOpts(p => ({ ...p, blendMode: v }))} size="small" fullWidth
                            sx={{ mb: 2, '& .MuiToggleButton-root': { borderRadius: '8px !important', fontSize: '0.7rem', fontWeight: 600, flex: 1, border: '1px solid var(--border-color) !important', '&.Mui-selected': { bgcolor: '#7c3aed', color: 'white' } } }}>
                            <ToggleButton value="inpaint">Inpaint</ToggleButton>
                            <ToggleButton value="blur">Blur</ToggleButton>
                            <ToggleButton value="whiteFill">Trắng</ToggleButton>
                            <ToggleButton value="transparent">Trong</ToggleButton>
                        </ToggleButtonGroup>
                        
                        {!isBrushMode && [
                            { label: 'Ngưỡng phát hiện', key: 'threshold' as const, min: 5, max: 120, step: 5 },
                            { label: 'Độ nhạy', key: 'sensitivity' as const, min: 1, max: 10, step: 1 },
                        ].map(s => (
                            <Box key={s.key} mb={2}>
                                <Stack direction="row" justifyContent="space-between" mb={0.5}>
                                    <Typography variant="body2" fontWeight={600} color="text.secondary">{s.label}</Typography>
                                    <Chip label={opts[s.key]} size="small" sx={{ bgcolor: 'rgba(124,58,237,0.1)', color: '#7c3aed', fontWeight: 700, fontSize: '0.68rem', height: 18 }} />
                                </Stack>
                                <Slider value={opts[s.key]} onChange={(_, v) => setOpts(p => ({ ...p, [s.key]: v as number }))} min={s.min} max={s.max} step={s.step} marks={s.step > 1} sx={{ color: '#7c3aed', '& .MuiSlider-thumb': { width: 14, height: 14 } }} />
                            </Box>
                        ))}
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );
};

// ══════════════════════════════════════════════════════════════════════════
// TAB 2 – Resize ảnh
// ══════════════════════════════════════════════════════════════════════════
const ResizeTab: React.FC<{ onFile: (f: File) => void }> = ({ onFile }) => {
    const { success, error: notifyError } = useNotification();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [img, setImg] = useState<ImageState | null>(null);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [done, setDone] = useState(false);
    const [showOrig, setShowOrig] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [opts, setOpts] = useState<ResizeOptions>({ width: 800, height: 600, lockAspect: true, unit: 'px', quality: 92, format: 'jpeg', fit: 'stretch' });
    const aspectRatio = useRef(1);

    const loadImg = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) { notifyError('Vui lòng chọn file ảnh!'); return; }
        onFile(file);
        const reader = new FileReader();
        reader.onload = e => {
            const url = e.target?.result as string;
            const i = new Image();
            i.onload = () => {
                aspectRatio.current = i.width / i.height;
                setOpts(p => ({ ...p, width: i.width, height: i.height }));
                // Không dùng canvasRef ở đây vì canvas chưa được mount
                setImg({ original: i, originalDataUrl: url, processedDataUrl: url, fileName: file.name, fileSize: file.size, width: i.width, height: i.height });
                setDone(false);
            };
            i.src = url;
        };
        reader.readAsDataURL(file);
        success(`Đã tải: ${file.name}`);
    }, [onFile, notifyError, success]);

    const handleWidthChange = (v: number) => {
        setOpts(p => ({ ...p, width: v, height: opts.lockAspect ? Math.round(v / aspectRatio.current) : p.height }));
    };
    const handleHeightChange = (v: number) => {
        setOpts(p => ({ ...p, height: v, width: opts.lockAspect ? Math.round(v * aspectRatio.current) : p.width }));
    };

    const computeDims = () => {
        if (!img) return { w: opts.width, h: opts.height };
        if (opts.unit === '%') return { w: Math.round(img.original!.width * opts.width / 100), h: Math.round(img.original!.height * opts.height / 100) };
        return { w: opts.width, h: opts.height };
    };

    const handleProcess = async () => {
        if (!img) return;
        setProcessing(true); setProgress(0);
        const iv = setInterval(() => setProgress(p => Math.min(p + 20, 85)), 150);
        await new Promise<void>(res => setTimeout(() => {
            const { w, h } = computeDims();
            const c = canvasRef.current!; c.width = w; c.height = h;
            const ctx = c.getContext('2d')!;
            ctx.clearRect(0, 0, w, h);
            if (opts.fit === 'contain') {
                const scale = Math.min(w / img.original!.width, h / img.original!.height);
                const sw = img.original!.width * scale, sh = img.original!.height * scale;
                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img.original!, (w - sw) / 2, (h - sh) / 2, sw, sh);
            } else if (opts.fit === 'cover') {
                const scale = Math.max(w / img.original!.width, h / img.original!.height);
                const sw = img.original!.width * scale, sh = img.original!.height * scale;
                ctx.drawImage(img.original!, (w - sw) / 2, (h - sh) / 2, sw, sh);
            } else {
                ctx.drawImage(img.original!, 0, 0, w, h);
            }
            const mime = opts.format === 'png' ? 'image/png' : opts.format === 'webp' ? 'image/webp' : 'image/jpeg';
            const url = c.toDataURL(mime, opts.quality / 100);
            setImg(p => p ? { ...p, processedDataUrl: url, width: w, height: h } : null);
            setDone(true); clearInterval(iv); res();
        }, 100));
        setProgress(100); setTimeout(() => { setProcessing(false); setProgress(0); }, 500);
        success('✅ Resize ảnh thành công!');
    };

    const handleDownload = () => {
        if (!img?.processedDataUrl || !done) return;
        const ext = opts.format;
        const name = img.fileName.replace(/\.[^/.]+$/, '') + `_resized.${ext}`;
        fetch(img.processedDataUrl).then(r => r.blob()).then(b => { saveAs(b, name); success(`Đã tải: ${name}`); });
    };

    if (!img) return <Box sx={{ mt: 1 }}><DropZone onFile={loadImg} /></Box>;

    const { w: preW, h: preH } = computeDims();

    return (
        <Grid container spacing={2.5} sx={{ mt: 0 }}>
            <Grid item xs={12} md={8}>
                <Stack gap={2}>
                    <ImagePreview imageState={img} hasProcessed={done} showOriginal={showOrig} setShowOriginal={setShowOrig}
                        onClear={() => { setImg(null); setDone(false); }} onReload={() => fileRef.current?.click()}
                        zoom={zoom} setZoom={setZoom} isProcessing={processing} progress={progress} canvasRef={canvasRef} accentColor="#0ea5e9" />
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) loadImg(f); e.target.value = ''; }} />
                    <Stack direction="row" gap={1.5} flexWrap="wrap">
                        <Button variant="contained" size="large" startIcon={<Maximize2 size={17} />} onClick={handleProcess} disabled={processing}
                            sx={{ flex: 1, minWidth: 140, background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', fontWeight: 700, borderRadius: '12px', boxShadow: '0 4px 16px rgba(14,165,233,0.35)' }}>
                            {processing ? 'Đang xử lý...' : 'Resize ảnh'}
                        </Button>
                        <Button variant="contained" size="large" startIcon={<Download size={17} />} onClick={handleDownload} disabled={!done || processing}
                            sx={{ fontWeight: 700, borderRadius: '12px', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}>Tải về</Button>
                    </Stack>
                </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
                <Stack gap={2}>
                    <Card elevation={0} sx={{ border: '1px solid var(--border-color)', borderRadius: '16px', bgcolor: 'var(--bg-paper)' }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Stack direction="row" alignItems="center" gap={1} mb={2}>
                                <Maximize2 size={17} color="#0ea5e9" /><Typography fontWeight={700}>Kích thước</Typography>
                            </Stack>
                            {/* Unit toggle */}
                            <ToggleButtonGroup value={opts.unit} exclusive onChange={(_, v) => v && setOpts(p => ({ ...p, unit: v }))} size="small" fullWidth
                                sx={{ mb: 2, '& .MuiToggleButton-root': { borderRadius: '8px !important', fontWeight: 600, flex: 1, border: '1px solid var(--border-color) !important', '&.Mui-selected': { bgcolor: '#0ea5e9', color: 'white' } } }}>
                                <ToggleButton value="px">Pixel (px)</ToggleButton>
                                <ToggleButton value="%">Phần trăm (%)</ToggleButton>
                            </ToggleButtonGroup>
                            {/* Width / Height */}
                            <Stack direction="row" gap={1} alignItems="center" mb={1.5}>
                                <TextField label={`Rộng (${opts.unit})`} type="number" size="small" fullWidth value={opts.width}
                                    onChange={e => handleWidthChange(Number(e.target.value))}
                                    InputProps={{ endAdornment: <InputAdornment position="end">{opts.unit}</InputAdornment> }} />
                                <Tooltip title={opts.lockAspect ? 'Khóa tỉ lệ' : 'Mở tỉ lệ'}>
                                    <IconButton onClick={() => setOpts(p => ({ ...p, lockAspect: !p.lockAspect }))} size="small"
                                        sx={{ color: opts.lockAspect ? '#0ea5e9' : 'var(--text-secondary)', bgcolor: opts.lockAspect ? 'rgba(14,165,233,0.1)' : 'transparent' }}>
                                        {opts.lockAspect ? <Lock size={16} /> : <Unlock size={16} />}
                                    </IconButton>
                                </Tooltip>
                                <TextField label={`Cao (${opts.unit})`} type="number" size="small" fullWidth value={opts.height}
                                    onChange={e => handleHeightChange(Number(e.target.value))}
                                    InputProps={{ endAdornment: <InputAdornment position="end">{opts.unit}</InputAdornment> }} />
                            </Stack>
                            {/* Preview dims */}
                            <Alert severity="info" sx={{ borderRadius: '10px', py: 0.3, mb: 2 }}>
                                <Typography variant="caption">Kích thước đầu ra: <strong>{preW} × {preH} px</strong></Typography>
                            </Alert>
                            <Divider sx={{ my: 1.5 }} />
                            {/* Preset sizes */}
                            <Typography variant="body2" fontWeight={600} color="text.secondary" mb={1}>Kích thước thông dụng</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                                {[['Gốc', img.original!.width, img.original!.height], ['HD', 1280, 720], ['Full HD', 1920, 1080], ['4K', 3840, 2160], ['Facebook', 1200, 630], ['Instagram', 1080, 1080], ['Thumbnail', 320, 240]].map(([label, w, h]) => (
                                    <Chip key={String(label)} label={label} size="small" clickable onClick={() => { setOpts(p => ({ ...p, width: Number(w), height: Number(h), unit: 'px', lockAspect: false })); }}
                                        sx={{ fontSize: '0.68rem', fontWeight: 600, '&:hover': { bgcolor: '#0ea5e920', color: '#0ea5e9' } }} />
                                ))}
                            </Box>
                            <Divider sx={{ my: 1.5 }} />
                            {/* Fit mode */}
                            <Typography variant="body2" fontWeight={600} color="text.secondary" mb={1}>Chế độ co giãn</Typography>
                            <ToggleButtonGroup value={opts.fit} exclusive onChange={(_, v) => v && setOpts(p => ({ ...p, fit: v }))} size="small" fullWidth
                                sx={{ mb: 2, '& .MuiToggleButton-root': { borderRadius: '8px !important', fontSize: '0.7rem', fontWeight: 600, flex: 1, border: '1px solid var(--border-color) !important', '&.Mui-selected': { bgcolor: '#0ea5e9', color: 'white' } } }}>
                                <ToggleButton value="stretch">Kéo dãn</ToggleButton>
                                <ToggleButton value="contain">Contain</ToggleButton>
                                <ToggleButton value="cover">Cover</ToggleButton>
                            </ToggleButtonGroup>
                            {/* Format & quality */}
                            <Stack direction="row" gap={1.5} mb={1}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>Định dạng</InputLabel>
                                    <Select value={opts.format} label="Định dạng" onChange={e => setOpts(p => ({ ...p, format: e.target.value as any }))}>
                                        <MenuItem value="jpeg">JPEG</MenuItem>
                                        <MenuItem value="png">PNG (lossless)</MenuItem>
                                        <MenuItem value="webp">WebP</MenuItem>
                                    </Select>
                                </FormControl>
                            </Stack>
                            {opts.format !== 'png' && (
                                <Box>
                                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                                        <Typography variant="body2" fontWeight={600} color="text.secondary">Chất lượng</Typography>
                                        <Chip label={`${opts.quality}%`} size="small" sx={{ bgcolor: 'rgba(14,165,233,0.1)', color: '#0ea5e9', fontWeight: 700, fontSize: '0.68rem', height: 18 }} />
                                    </Stack>
                                    <Slider value={opts.quality} onChange={(_, v) => setOpts(p => ({ ...p, quality: v as number }))} min={10} max={100} step={1} sx={{ color: '#0ea5e9' }} />
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Stack>
            </Grid>
        </Grid>
    );
};

// ══════════════════════════════════════════════════════════════════════════
// TAB 3 – Thay đổi Background
// ══════════════════════════════════════════════════════════════════════════
const BackgroundTab: React.FC<{ onFile: (f: File) => void }> = ({ onFile }) => {
    const { success, error: notifyError } = useNotification();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const bgFileRef = useRef<HTMLInputElement>(null);
    const [img, setImg] = useState<ImageState | null>(null);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [done, setDone] = useState(false);
    const [showOrig, setShowOrig] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [opts, setOpts] = useState<BackgroundOptions>({
        mode: 'color', color: '#ffffff', gradientFrom: '#667eea', gradientTo: '#764ba2',
        gradientAngle: 135, blurAmount: 10, bgImage: null, removeThreshold: 30
    });

    const loadImg = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) { notifyError('Vui lòng chọn file ảnh!'); return; }
        onFile(file);
        const reader = new FileReader();
        reader.onload = e => {
            const url = e.target?.result as string;
            const i = new Image();
            i.onload = () => {
                // Không dùng canvasRef ở đây vì canvas chưa được mount
                setImg({ original: i, originalDataUrl: url, processedDataUrl: url, fileName: file.name, fileSize: file.size, width: i.width, height: i.height });
                setDone(false);
            };
            i.src = url;
        };
        reader.readAsDataURL(file);
        success(`Đã tải: ${file.name}`);
    }, [onFile, notifyError, success]);

    const loadBgImage = (file: File) => {
        const reader = new FileReader();
        reader.onload = e => setOpts(p => ({ ...p, bgImage: e.target?.result as string }));
        reader.readAsDataURL(file);
    };

    const handleProcess = async () => {
        if (!img) return;
        setProcessing(true); setProgress(0);
        const iv = setInterval(() => setProgress(p => Math.min(p + 15, 85)), 150);
        await new Promise<void>(res => setTimeout(async () => {
            const c = canvasRef.current!; const ctx = c.getContext('2d')!;
            c.width = img.original!.width; c.height = img.original!.height;

            // Draw background
            if (opts.mode === 'transparent') {
                ctx.clearRect(0, 0, c.width, c.height);
            } else if (opts.mode === 'color') {
                ctx.fillStyle = opts.color;
                ctx.fillRect(0, 0, c.width, c.height);
            } else if (opts.mode === 'gradient') {
                const rad = opts.gradientAngle * Math.PI / 180;
                const x1 = c.width / 2 - Math.cos(rad) * c.width / 2;
                const y1 = c.height / 2 - Math.sin(rad) * c.height / 2;
                const x2 = c.width / 2 + Math.cos(rad) * c.width / 2;
                const y2 = c.height / 2 + Math.sin(rad) * c.height / 2;
                const grad = ctx.createLinearGradient(x1, y1, x2, y2);
                grad.addColorStop(0, opts.gradientFrom);
                grad.addColorStop(1, opts.gradientTo);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, c.width, c.height);
            } else if (opts.mode === 'image' && opts.bgImage) {
                const bgImg = new Image();
                await new Promise<void>(r => { bgImg.onload = () => r(); bgImg.src = opts.bgImage!; });
                ctx.drawImage(bgImg, 0, 0, c.width, c.height);
            } else if (opts.mode === 'blur') {
                ctx.filter = `blur(${opts.blurAmount}px)`;
                ctx.drawImage(img.original!, 0, 0, c.width, c.height);
                ctx.filter = 'none';
            }

            // Remove background of original and draw on top (simple green-screen style by edge detection)
            const tmp = document.createElement('canvas');
            tmp.width = img.original!.width; tmp.height = img.original!.height;
            const tCtx = tmp.getContext('2d')!;
            tCtx.drawImage(img.original!, 0, 0);
            const id = tCtx.getImageData(0, 0, tmp.width, tmp.height);
            const d = id.data;

            // Sample corner colors as "background color" to remove
            const corners = [[0, 0], [tmp.width - 1, 0], [0, tmp.height - 1], [tmp.width - 1, tmp.height - 1]];
            const bgColors = corners.map(([x, y]) => {
                const i = (y * tmp.width + x) * 4;
                return { r: d[i], g: d[i + 1], b: d[i + 2] };
            });
            const avgBg = { r: bgColors.reduce((s, c) => s + c.r, 0) / 4, g: bgColors.reduce((s, c) => s + c.g, 0) / 4, b: bgColors.reduce((s, c) => s + c.b, 0) / 4 };

            const thr = opts.removeThreshold;
            for (let i = 0; i < d.length; i += 4) {
                const dr = Math.abs(d[i] - avgBg.r), dg = Math.abs(d[i + 1] - avgBg.g), db = Math.abs(d[i + 2] - avgBg.b);
                if (dr < thr && dg < thr && db < thr) d[i + 3] = 0;
            }
            tCtx.putImageData(id, 0, 0);
            ctx.drawImage(tmp, 0, 0);

            const mime = opts.mode === 'transparent' ? 'image/png' : 'image/png';
            const url = c.toDataURL(mime, 1);
            setImg(p => p ? { ...p, processedDataUrl: url } : null);
            setDone(true); clearInterval(iv); res();
        }, 100));
        setProgress(100); setTimeout(() => { setProcessing(false); setProgress(0); }, 500);
        success('✅ Đổi nền thành công!');
    };

    const handleDownload = () => {
        if (!img?.processedDataUrl || !done) return;
        const name = img.fileName.replace(/\.[^/.]+$/, '') + '_new_bg.png';
        fetch(img.processedDataUrl).then(r => r.blob()).then(b => { saveAs(b, name); success(`Đã tải: ${name}`); });
    };

    const presets = [
        { label: 'Trắng', color: '#ffffff' }, { label: 'Đen', color: '#000000' },
        { label: 'Xám', color: '#f3f4f6' }, { label: 'Xanh lam', color: '#dbeafe' },
        { label: 'Xanh lá', color: '#dcfce7' }, { label: 'Vàng', color: '#fef9c3' },
        { label: 'Hồng', color: '#fce7f3' }, { label: 'Tím', color: '#f3e8ff' },
    ];

    if (!img) return (
        <Box sx={{ mt: 1 }}>
            <DropZone onFile={loadImg} />
            <Alert severity="info" sx={{ mt: 2, borderRadius: '12px' }}>
                Tính năng tự động phát hiện và thay thế nền ảnh. Hoạt động tốt nhất với ảnh có nền đơn sắc rõ ràng.
            </Alert>
        </Box>
    );

    return (
        <Grid container spacing={2.5} sx={{ mt: 0 }}>
            <Grid item xs={12} md={8}>
                <Stack gap={2}>
                    <ImagePreview imageState={img} hasProcessed={done} showOriginal={showOrig} setShowOriginal={setShowOrig}
                        onClear={() => { setImg(null); setDone(false); }} onReload={() => fileRef.current?.click()}
                        zoom={zoom} setZoom={setZoom} isProcessing={processing} progress={progress} canvasRef={canvasRef} accentColor="#f59e0b" />
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) loadImg(f); e.target.value = ''; }} />
                    <input ref={bgFileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) loadBgImage(f); e.target.value = ''; }} />
                    <Stack direction="row" gap={1.5} flexWrap="wrap">
                        <Button variant="contained" size="large" startIcon={<Palette size={17} />} onClick={handleProcess} disabled={processing}
                            sx={{ flex: 1, minWidth: 140, background: 'linear-gradient(135deg,#f59e0b,#f97316)', fontWeight: 700, borderRadius: '12px', boxShadow: '0 4px 16px rgba(245,158,11,0.35)' }}>
                            {processing ? 'Đang xử lý...' : 'Đổi nền'}
                        </Button>
                        <Button variant="contained" size="large" startIcon={<Download size={17} />} onClick={handleDownload} disabled={!done || processing}
                            sx={{ fontWeight: 700, borderRadius: '12px', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}>Tải về</Button>
                    </Stack>
                </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
                <Card elevation={0} sx={{ border: '1px solid var(--border-color)', borderRadius: '16px', bgcolor: 'var(--bg-paper)' }}>
                    <CardContent sx={{ p: 2.5 }}>
                        <Stack direction="row" alignItems="center" gap={1} mb={2}>
                            <Palette size={17} color="#f59e0b" /><Typography fontWeight={700}>Tùy chỉnh nền</Typography>
                        </Stack>
                        <Typography variant="body2" fontWeight={600} color="text.secondary" mb={1}>Loại nền</Typography>
                        <ToggleButtonGroup value={opts.mode} exclusive onChange={(_, v) => v && setOpts(p => ({ ...p, mode: v }))} size="small" fullWidth
                            sx={{ mb: 2, flexWrap: 'wrap', '& .MuiToggleButton-root': { borderRadius: '8px !important', fontSize: '0.68rem', fontWeight: 600, flex: '1 1 auto', border: '1px solid var(--border-color) !important', '&.Mui-selected': { bgcolor: '#f59e0b', color: 'white' } } }}>
                            <ToggleButton value="color">Màu</ToggleButton>
                            <ToggleButton value="gradient">Gradient</ToggleButton>
                            <ToggleButton value="image">Ảnh</ToggleButton>
                            <ToggleButton value="transparent">Trong</ToggleButton>
                            <ToggleButton value="blur">Blur</ToggleButton>
                        </ToggleButtonGroup>

                        {opts.mode === 'color' && (
                            <>
                                <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
                                    <input type="color" value={opts.color} onChange={e => setOpts(p => ({ ...p, color: e.target.value }))}
                                        style={{ width: 40, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0 }} />
                                    <TextField size="small" value={opts.color} onChange={e => setOpts(p => ({ ...p, color: e.target.value }))} label="Mã màu HEX" fullWidth />
                                </Stack>
                                <Typography variant="body2" fontWeight={600} color="text.secondary" mb={1}>Màu nhanh</Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                                    {presets.map(pr => (
                                        <Tooltip key={pr.color} title={pr.label}>
                                            <Box onClick={() => setOpts(p => ({ ...p, color: pr.color }))}
                                                sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: pr.color, cursor: 'pointer', border: opts.color === pr.color ? '2px solid #f59e0b' : '1px solid var(--border-color)', transition: 'all 0.15s', '&:hover': { transform: 'scale(1.15)' } }} />
                                        </Tooltip>
                                    ))}
                                </Box>
                            </>
                        )}
                        {opts.mode === 'gradient' && (
                            <Stack gap={1.5}>
                                <Stack direction="row" gap={1} alignItems="center">
                                    <input type="color" value={opts.gradientFrom} onChange={e => setOpts(p => ({ ...p, gradientFrom: e.target.value }))}
                                        style={{ width: 36, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0 }} />
                                    <Typography variant="body2" color="text.secondary">→</Typography>
                                    <input type="color" value={opts.gradientTo} onChange={e => setOpts(p => ({ ...p, gradientTo: e.target.value }))}
                                        style={{ width: 36, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0 }} />
                                    <Box sx={{ flex: 1, height: 36, borderRadius: '8px', background: `linear-gradient(${opts.gradientAngle}deg, ${opts.gradientFrom}, ${opts.gradientTo})`, border: '1px solid var(--border-color)' }} />
                                </Stack>
                                <Box>
                                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                                        <Typography variant="body2" fontWeight={600} color="text.secondary">Góc gradient</Typography>
                                        <Chip label={`${opts.gradientAngle}°`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 700, fontSize: '0.68rem', height: 18 }} />
                                    </Stack>
                                    <Slider value={opts.gradientAngle} onChange={(_, v) => setOpts(p => ({ ...p, gradientAngle: v as number }))} min={0} max={360} sx={{ color: '#f59e0b' }} />
                                </Box>
                                <Typography variant="body2" fontWeight={600} color="text.secondary" mb={0.5}>Gradient nhanh</Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                                    {[['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'], ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'], ['#30cfd0', '#330867']].map(([f, t]) => (
                                        <Tooltip key={f} title={`${f} → ${t}`}>
                                            <Box onClick={() => setOpts(p => ({ ...p, gradientFrom: f, gradientTo: t }))}
                                                sx={{ width: 28, height: 28, borderRadius: '8px', background: `linear-gradient(135deg, ${f}, ${t})`, cursor: 'pointer', border: '1px solid var(--border-color)', '&:hover': { transform: 'scale(1.15)' } }} />
                                        </Tooltip>
                                    ))}
                                </Box>
                            </Stack>
                        )}
                        {opts.mode === 'image' && (
                            <Stack gap={1.5}>
                                <Button variant="outlined" startIcon={<Upload size={15} />} onClick={() => bgFileRef.current?.click()}
                                    sx={{ borderRadius: '10px', borderColor: '#f59e0b', color: '#f59e0b' }}>
                                    Chọn ảnh nền
                                </Button>
                                {opts.bgImage && <Box component="img" src={opts.bgImage} sx={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--border-color)' }} />}
                            </Stack>
                        )}
                        {opts.mode === 'blur' && (
                            <Box>
                                <Stack direction="row" justifyContent="space-between" mb={0.5}>
                                    <Typography variant="body2" fontWeight={600} color="text.secondary">Mức blur</Typography>
                                    <Chip label={`${opts.blurAmount}px`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 700, fontSize: '0.68rem', height: 18 }} />
                                </Stack>
                                <Slider value={opts.blurAmount} onChange={(_, v) => setOpts(p => ({ ...p, blurAmount: v as number }))} min={1} max={30} sx={{ color: '#f59e0b' }} />
                            </Box>
                        )}
                        <Divider sx={{ my: 2 }} />
                        <Box>
                            <Stack direction="row" justifyContent="space-between" mb={0.5}>
                                <Typography variant="body2" fontWeight={600} color="text.secondary">Ngưỡng xóa nền</Typography>
                                <Chip label={opts.removeThreshold} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 700, fontSize: '0.68rem', height: 18 }} />
                            </Stack>
                            <Slider value={opts.removeThreshold} onChange={(_, v) => setOpts(p => ({ ...p, removeThreshold: v as number }))} min={5} max={80} sx={{ color: '#f59e0b' }} />
                            <Typography variant="caption" color="text.secondary">Tăng nếu còn nhiều nền, giảm nếu mất nhiều chi tiết</Typography>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );
};

// ══════════════════════════════════════════════════════════════════════════
// TAB 4 – Làm đẹp ảnh
// ══════════════════════════════════════════════════════════════════════════
const EnhanceTab: React.FC<{ onFile: (f: File) => void }> = ({ onFile }) => {
    const { success, error: notifyError, info } = useNotification();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [img, setImg] = useState<ImageState | null>(null);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [done, setDone] = useState(false);
    const [showOrig, setShowOrig] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [livePreview, setLivePreview] = useState(true);
    const [opts, setOpts] = useState<EnhanceOptions>({
        brightness: 100, contrast: 100, saturation: 100, sharpness: 0,
        hue: 0, blur: 0, noise: 0, vignette: 0, filter: 'none',
        flipH: false, flipV: false, rotation: 0
    });

    const loadImg = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) { notifyError('Vui lòng chọn file ảnh!'); return; }
        onFile(file);
        const reader = new FileReader();
        reader.onload = e => {
            const url = e.target?.result as string;
            const i = new Image();
            i.onload = () => {
                // Không dùng canvasRef ở đây vì canvas chưa được mount
                setImg({ original: i, originalDataUrl: url, processedDataUrl: url, fileName: file.name, fileSize: file.size, width: i.width, height: i.height });
                setDone(false); setOpts({ brightness: 100, contrast: 100, saturation: 100, sharpness: 0, hue: 0, blur: 0, noise: 0, vignette: 0, filter: 'none', flipH: false, flipV: false, rotation: 0 });
            };
            i.src = url;
        };
        reader.readAsDataURL(file);
        success(`Đã tải: ${file.name}`);
    }, [onFile, notifyError, success]);

    // Live preview
    useEffect(() => {
        if (!img || !livePreview || !canvasRef.current) return;
        const c = canvasRef.current; const ctx = c.getContext('2d')!;
        c.width = img.original!.width; c.height = img.original!.height;
        applyEnhance(ctx, c, img.original!, opts);
        const url = c.toDataURL('image/png', 1);
        setImg(p => p ? { ...p, processedDataUrl: url } : null);
        if (opts.brightness !== 100 || opts.contrast !== 100 || opts.saturation !== 100 || opts.sharpness > 0 || opts.hue !== 0 || opts.blur > 0 || opts.vignette > 0 || opts.filter !== 'none' || opts.flipH || opts.flipV || opts.rotation !== 0)
            setDone(true);
        else setDone(false);
    }, [opts, livePreview]);

    const handleProcess = async () => {
        if (!img) return;
        setProcessing(true); setProgress(0);
        const iv = setInterval(() => setProgress(p => Math.min(p + 20, 85)), 150);
        await new Promise<void>(res => setTimeout(() => {
            const c = canvasRef.current!; const ctx = c.getContext('2d')!;
            c.width = img.original!.width; c.height = img.original!.height;
            applyEnhance(ctx, c, img.original!, opts);
            const url = c.toDataURL('image/png', 1);
            setImg(p => p ? { ...p, processedDataUrl: url } : null);
            setDone(true); clearInterval(iv); res();
        }, 80));
        setProgress(100); setTimeout(() => { setProcessing(false); setProgress(0); }, 500);
        success('✅ Làm đẹp ảnh thành công!');
    };

    const handleDownload = () => {
        if (!img?.processedDataUrl || !done) return;
        const name = img.fileName.replace(/\.[^/.]+$/, '') + '_enhanced.png';
        fetch(img.processedDataUrl).then(r => r.blob()).then(b => { saveAs(b, name); success(`Đã tải: ${name}`); });
    };

    const handleReset = () => {
        setOpts({ brightness: 100, contrast: 100, saturation: 100, sharpness: 0, hue: 0, blur: 0, noise: 0, vignette: 0, filter: 'none', flipH: false, flipV: false, rotation: 0 });
        if (img) { setImg(p => p ? { ...p, processedDataUrl: p.originalDataUrl } : null); setDone(false); }
        info('Đã đặt lại tất cả thông số.');
    };

    const cssFilters = [
        { value: 'none', label: 'Bình thường' },
        { value: 'grayscale(100%)', label: '⬜ Đen trắng' },
        { value: 'sepia(100%)', label: '🟫 Sepia' },
        { value: 'invert(100%)', label: '🔄 Đảo màu' },
        { value: 'saturate(200%) contrast(120%)', label: '🎨 Vivid' },
        { value: 'contrast(150%) brightness(110%)', label: '☀️ HDR' },
        { value: 'hue-rotate(180deg)', label: '🌀 Hue Flip' },
        { value: 'brightness(130%) saturate(80%)', label: '🌤 Fade' },
        { value: 'contrast(80%) brightness(90%) sepia(30%)', label: '📷 Film' },
        { value: 'saturate(150%) hue-rotate(20deg)', label: '🌿 Lush' },
    ];

    const sliders = [
        { key: 'brightness' as const, label: 'Độ sáng', icon: <Sun size={15} />, min: 0, max: 200, def: 100, unit: '%' },
        { key: 'contrast' as const, label: 'Độ tương phản', icon: <Contrast size={15} />, min: 0, max: 300, def: 100, unit: '%' },
        { key: 'saturation' as const, label: 'Độ bão hòa', icon: <Droplets size={15} />, min: 0, max: 400, def: 100, unit: '%' },
        { key: 'hue' as const, label: 'Màu sắc (Hue)', icon: <Palette size={15} />, min: -180, max: 180, def: 0, unit: '°' },
        { key: 'sharpness' as const, label: 'Độ sắc nét', icon: <Stars size={15} />, min: 0, max: 100, def: 0, unit: '' },
        { key: 'blur' as const, label: 'Blur (làm mờ)', icon: <Layers size={15} />, min: 0, max: 10, def: 0, unit: 'px' },
        { key: 'vignette' as const, label: 'Vignette', icon: <Sliders size={15} />, min: 0, max: 100, def: 0, unit: '%' },
    ];

    if (!img) return (
        <Box sx={{ mt: 1 }}>
            <DropZone onFile={loadImg} />
            <Alert severity="info" sx={{ mt: 2, borderRadius: '12px' }}>
                Điều chỉnh sáng, tương phản, màu sắc, bộ lọc nghệ thuật và nhiều hiệu ứng đẹp khác.
            </Alert>
        </Box>
    );

    return (
        <Grid container spacing={2.5} sx={{ mt: 0 }}>
            <Grid item xs={12} md={8}>
                <Stack gap={2}>
                    <ImagePreview imageState={img} hasProcessed={done} showOriginal={showOrig} setShowOriginal={setShowOrig}
                        onClear={() => { setImg(null); setDone(false); }} onReload={() => fileRef.current?.click()}
                        zoom={zoom} setZoom={setZoom} isProcessing={processing} progress={progress} canvasRef={canvasRef} accentColor="#10b981" />
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) loadImg(f); e.target.value = ''; }} />
                    <Stack direction="row" gap={1.5} flexWrap="wrap">
                        <Button variant="contained" size="large" startIcon={<Stars size={17} />} onClick={handleProcess} disabled={processing}
                            sx={{ flex: 1, minWidth: 140, background: 'linear-gradient(135deg,#10b981,#34d399)', fontWeight: 700, borderRadius: '12px', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}>
                            {processing ? 'Đang xử lý...' : 'Áp dụng'}
                        </Button>
                        <Button variant="outlined" size="large" startIcon={<RotateCcw size={17} />} onClick={handleReset}
                            sx={{ fontWeight: 600, borderRadius: '12px', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>Đặt lại</Button>
                        <Button variant="contained" size="large" startIcon={<Download size={17} />} onClick={handleDownload} disabled={!done || processing}
                            sx={{ fontWeight: 700, borderRadius: '12px', bgcolor: '#0ea5e9', '&:hover': { bgcolor: '#0284c7' } }}>Tải về</Button>
                    </Stack>
                </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
                <Stack gap={2}>
                    <Card elevation={0} sx={{ border: '1px solid var(--border-color)', borderRadius: '16px', bgcolor: 'var(--bg-paper)' }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                                <Stack direction="row" alignItems="center" gap={1}>
                                    <Stars size={17} color="#10b981" /><Typography fontWeight={700}>Bộ lọc & Hiệu ứng</Typography>
                                </Stack>
                                <FormControlLabel control={<Switch size="small" checked={livePreview} onChange={e => setLivePreview(e.target.checked)} sx={{ '& .MuiSwitch-thumb': { bgcolor: '#10b981' } }} />}
                                    label={<Typography variant="caption" fontWeight={600}>Live</Typography>} sx={{ m: 0 }} />
                            </Stack>

                            {/* Quick filters */}
                            <Typography variant="body2" fontWeight={600} color="text.secondary" mb={1}>Bộ lọc nhanh</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 2 }}>
                                {cssFilters.map(f => (
                                    <Chip key={f.value} label={f.label} size="small" clickable onClick={() => setOpts(p => ({ ...p, filter: f.value }))}
                                        sx={{ fontSize: '0.68rem', fontWeight: 600, bgcolor: opts.filter === f.value ? '#10b981' : 'transparent', color: opts.filter === f.value ? 'white' : 'var(--text-secondary)', border: `1px solid ${opts.filter === f.value ? '#10b981' : 'var(--border-color)'}`, '&:hover': { bgcolor: 'rgba(16,185,129,0.1)', color: '#10b981' } }} />
                                ))}
                            </Box>

                            <Divider sx={{ mb: 2 }} />

                            {/* Flip & Rotate */}
                            <Typography variant="body2" fontWeight={600} color="text.secondary" mb={1}>Xoay & Lật</Typography>
                            <Stack direction="row" gap={1} mb={2} flexWrap="wrap">
                                <Button size="small" variant={opts.flipH ? 'contained' : 'outlined'} startIcon={<FlipHorizontal size={14} />}
                                    onClick={() => setOpts(p => ({ ...p, flipH: !p.flipH }))}
                                    sx={{ fontSize: '0.72rem', borderRadius: '8px', flex: 1, bgcolor: opts.flipH ? '#10b981' : 'transparent', borderColor: '#10b981', color: opts.flipH ? 'white' : '#10b981' }}>Lật ngang</Button>
                                <Button size="small" variant={opts.flipV ? 'contained' : 'outlined'} startIcon={<FlipVertical size={14} />}
                                    onClick={() => setOpts(p => ({ ...p, flipV: !p.flipV }))}
                                    sx={{ fontSize: '0.72rem', borderRadius: '8px', flex: 1, bgcolor: opts.flipV ? '#10b981' : 'transparent', borderColor: '#10b981', color: opts.flipV ? 'white' : '#10b981' }}>Lật dọc</Button>
                                {[0, 90, 180, 270].map(deg => (
                                    <Button key={deg} size="small" variant={opts.rotation === deg ? 'contained' : 'outlined'}
                                        startIcon={<RotateCw size={13} />} onClick={() => setOpts(p => ({ ...p, rotation: deg }))}
                                        sx={{ fontSize: '0.68rem', borderRadius: '8px', flex: 1, bgcolor: opts.rotation === deg ? '#10b981' : 'transparent', borderColor: '#10b981', color: opts.rotation === deg ? 'white' : '#10b981', minWidth: 44 }}>{deg}°</Button>
                                ))}
                            </Stack>

                            <Divider sx={{ mb: 2 }} />

                            {/* Sliders */}
                            {sliders.map(s => (
                                <Box key={s.key} mb={1.8}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.3}>
                                        <Stack direction="row" alignItems="center" gap={0.6}>
                                            <Box sx={{ color: '#10b981' }}>{s.icon}</Box>
                                            <Typography variant="body2" fontWeight={600} color="text.secondary" fontSize="0.8rem">{s.label}</Typography>
                                        </Stack>
                                        <Chip label={`${opts[s.key]}${s.unit}`} size="small"
                                            sx={{ bgcolor: opts[s.key] !== s.def ? 'rgba(16,185,129,0.12)' : 'var(--bg-default)', color: opts[s.key] !== s.def ? '#10b981' : 'var(--text-secondary)', fontWeight: 700, fontSize: '0.65rem', height: 18 }} />
                                    </Stack>
                                    <Slider value={opts[s.key]} onChange={(_, v) => setOpts(p => ({ ...p, [s.key]: v as number }))}
                                        min={s.min} max={s.max} step={1}
                                        sx={{ color: opts[s.key] !== s.def ? '#10b981' : 'var(--border-color)', py: 0.6, '& .MuiSlider-thumb': { width: 14, height: 14 } }} />
                                </Box>
                            ))}
                        </CardContent>
                    </Card>
                </Stack>
            </Grid>
        </Grid>
    );
};

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function ImageTools() {
    const [tab, setTab] = useState(0);
    const [lastFile, setLastFile] = useState<File | null>(null);

    const tabs = [
        { label: 'Xóa Watermark', icon: <Wand2 size={16} />, color: '#7c3aed' },
        { label: 'Resize ảnh', icon: <Maximize2 size={16} />, color: '#0ea5e9' },
        { label: 'Đổi nền', icon: <Palette size={16} />, color: '#f59e0b' },
        { label: 'Làm đẹp', icon: <Stars size={16} />, color: '#10b981' },
    ];

    return (
        <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
            {/* Header */}
            <Stack direction="row" alignItems="center" gap={1.5} mb={3}>
                <Box sx={{ p: 1, borderRadius: '12px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
                    <ImageIcon size={22} color="white" />
                </Box>
                <Box>
                    <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Xử lý ảnh</Typography>
                    <Typography variant="body2" color="text.secondary">Bộ công cụ chỉnh sửa ảnh chuyên nghiệp — Hoàn toàn trên trình duyệt</Typography>
                </Box>
            </Stack>

            {/* Tabs */}
            <Paper elevation={0} sx={{ borderRadius: '16px', mb: 2.5, border: '1px solid var(--border-color)', bgcolor: 'var(--bg-paper)', overflow: 'hidden' }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
                    sx={{
                        px: 1, minHeight: 52,
                        '& .MuiTab-root': { minHeight: 52, fontWeight: 600, fontSize: '0.85rem', textTransform: 'none', gap: 0.8 },
                        '& .Mui-selected': { color: tabs[tab]?.color },
                        '& .MuiTabs-indicator': { bgcolor: tabs[tab]?.color, height: 3, borderRadius: '2px 2px 0 0' }
                    }}>
                    {tabs.map((t, i) => (
                        <Tab key={i} icon={<Box sx={{ color: tab === i ? t.color : 'var(--text-secondary)' }}>{t.icon}</Box>}
                            iconPosition="start" label={t.label}
                            sx={{ color: tab === i ? t.color : 'var(--text-secondary)' }} />
                    ))}
                </Tabs>
            </Paper>

            {/* Tab content */}
            {tab === 0 && <WatermarkTab onFile={setLastFile} />}
            {tab === 1 && <ResizeTab onFile={setLastFile} />}
            {tab === 2 && <BackgroundTab onFile={setLastFile} />}
            {tab === 3 && <EnhanceTab onFile={setLastFile} />}
        </Box>
    );
}
