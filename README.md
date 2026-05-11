# Hệ thống Quản Lý Kho GGS (Warehouse Management System)

Ứng dụng quản lý kho tích hợp Google Sheets và Supabase, hỗ trợ quét mã QR, quản lý tài sản, vật tư và báo cáo chuyên sâu.

## Công nghệ sử dụng

- **Frontend**: React 19, Vite, Material UI (MUI), Redux Toolkit.
- **Backend**: Vercel Serverless Functions (Node.js/TypeScript).
- **Database**: Supabase (PostgreSQL).
- **Integration**: Google Sheets API, Google Drive API.
- **PWA**: Hỗ trợ cài đặt ứng dụng trên thiết bị di động.

## Cấu trúc dự án

- `/src`: Mã nguồn frontend React.
- `/api`: Các hàm serverless xử lý logic backend và tích hợp API bên thứ 3.
- `vercel.json`: Cấu hình triển khai trên Vercel.

## Hướng dẫn cài đặt local

1. Sao chép file `.env.example` thành `.env` và điền đầy đủ thông tin.
2. Cài đặt dependencies:
   ```bash
   npm install
   ```
3. Chạy ứng dụng trong môi trường phát triển (cả frontend và local API):
   ```bash
   npm run dev
   ```

## Triển khai lên Vercel

1. Đẩy mã nguồn lên GitHub.
2. Kết nối kho lưu trữ GitHub với Vercel.
3. Trong cấu hình dự án trên Vercel, thêm các biến môi trường từ file `.env`.
   - **Lưu ý**: Đối với `GOOGLE_PRIVATE_KEY`, hãy đảm bảo copy toàn bộ chuỗi bao gồm `-----BEGIN PRIVATE KEY-----` và `-----END PRIVATE KEY-----`.
4. Vercel sẽ tự động nhận diện `vercel.json` và triển khai ứng dụng.

## Biến môi trường quan trọng

Xem chi tiết tại [.env.example](./.env.example).

---
*Phát triển bởi đội ngũ GGS.*
