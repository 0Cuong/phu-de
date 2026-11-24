# 0CUONG — Phụ đề Studio

Ứng dụng React/Vite để xem video, biên tập phụ đề song ngữ Anh–Việt, nhập/xuất SRT/VTT/ASS. Các tính năng AI và render MP4 dùng backend Express, Gemini API và FFmpeg.

## Chạy cục bộ trên Windows

Yêu cầu Node.js 22.12+ và FFmpeg/FFprobe có trong `PATH`.

```powershell
npm ci
Copy-Item .env.example .env
# Mở .env và điền GEMINI_API_KEY nếu muốn dùng AI
npm run dev
```

Mở `http://localhost:3000`.

## Triển khai website lên GitHub Pages

Repository được cấu hình để build đúng project path `/phu-de/` bằng workflow `.github/workflows/deploy-pages.yml`.

1. Đẩy mã nguồn lên nhánh `main` của repository `0Cuong/phu-de`.
2. Trong GitHub, mở **Settings → Pages → Build and deployment**, chọn **GitHub Actions**.
3. Push một commit lên `main` hoặc chạy workflow **Deploy Subtitle Studio to GitHub Pages** trong tab Actions.
4. Website sau khi deploy: `https://0cuong.github.io/phu-de/`.

## Triển khai backend (bắt buộc để dùng AI và render MP4)

GitHub Pages chỉ host frontend tĩnh; nó không chạy được Express, Node.js, FFmpeg hay giữ tệp video tải lên. Backend cần được deploy riêng bằng Docker. Project có `Dockerfile` và `render.yaml` làm cấu hình mẫu cho Render.

1. Tạo Web Service từ repository này trên Render, chọn Blueprint nếu được hỏi để đọc `render.yaml`.
2. Trong Environment của dịch vụ, đặt `GEMINI_API_KEY` bằng Gemini API key của bạn. Đây là biến bí mật chỉ nằm trên máy chủ, tuyệt đối không đưa vào mã frontend hoặc biến `VITE_*`.
3. Giữ `CORS_ORIGIN=https://0cuong.github.io`.
4. Sau khi Render cấp URL backend dạng `https://<ten-dich-vu>.onrender.com`, vào GitHub **Settings → Secrets and variables → Actions → Variables**, tạo biến `VITE_API_BASE_URL` bằng URL đó (không thêm dấu `/` cuối).
5. Chạy lại workflow GitHub Pages để frontend được build với địa chỉ API mới.
6. Mở `https://<ten-dich-vu>.onrender.com/api/health`; kết quả cần có `ok: true` và `geminiConfigured: true`.

Nếu chưa cấu hình backend, website vẫn cho phép tải video lên trình duyệt, xem trước, nhập/chỉnh sửa phụ đề và xuất SRT/VTT/ASS. Các tính năng tạo phụ đề AI, dịch AI, video mẫu và render MP4 sẽ báo cần backend.

## Biến môi trường

| Biến | Dùng ở đâu | Ý nghĩa |
|---|---|---|
| `GEMINI_API_KEY` | Backend | API key Gemini; không công khai |
| `CORS_ORIGIN` | Backend | Origin được phép gọi API |
| `PORT` | Backend | Render tự cấp; mặc định local là 3000 |
| `VITE_API_BASE_URL` | Frontend build | URL backend công khai, ví dụ `https://phu-de-api.onrender.com` |
| `VITE_BASE_PATH` | Frontend build | `/phu-de/` cho GitHub Pages project site |

## Lệnh kiểm tra

```powershell
npm run build
npm run lint
```
