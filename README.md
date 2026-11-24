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

## Kiến trúc production

- **Frontend:** GitHub Pages — `https://0cuong.github.io/phu-de/`.
- **Backend API:** Render Web Service chạy Docker, Express và FFmpeg.
- **AI:** Gemini API được gọi từ backend; API key chỉ lưu trong Render Environment.

GitHub Pages không chạy được Express, Node.js hay FFmpeg. Vì vậy, để mọi người dùng được AI và render MP4, phải triển khai backend riêng và kết nối URL backend vào frontend.

## Triển khai backend trên Render

Repository đã có `Dockerfile` và `render.yaml` (Blueprint) được cấu hình cho dịch vụ `phu-de-api`, region Singapore, mức máy chủ 1 CPU / 2 GB RAM.

1. Đăng nhập [Render Dashboard](https://dashboard.render.com/) bằng GitHub.
2. Chọn **New → Blueprint** và kết nối repository `0Cuong/phu-de`, branch `main`. Render sẽ đọc `render.yaml`.
3. Kiểm tra dịch vụ `phu-de-api` và mức compute **1 CPU / 2 GB RAM**. Đây là gói trả phí; kiểm tra giá trong Dashboard trước khi bấm tạo. Không chọn Free nếu mục tiêu là render video cho người dùng thật: Free chỉ có 0.1 CPU / 512 MB, tự ngủ sau 15 phút không có truy cập và không có persistent disk.
4. Khi Render hỏi biến bí mật, nhập `GEMINI_API_KEY` bằng API key lấy từ [Google AI Studio](https://aistudio.google.com/app/apikey). Không commit key vào GitHub, không đặt key trong biến `VITE_*`.
5. Xác nhận biến `CORS_ORIGIN` là `https://0cuong.github.io`; `NODE_ENV` phải là `production`.
6. Deploy dịch vụ. Sao chép URL công khai Render, ví dụ `https://phu-de-api.onrender.com` (dùng URL thực tế được Render cấp, không đoán theo ví dụ).
7. Kiểm tra `https://<render-service-url>/api/health`. Kết quả cần có `ok: true`, `ffmpeg: true`, `geminiConfigured: true`. Điều này xác nhận tiến trình/biến môi trường, chưa thay thế việc thử một request AI thực tế.

## Kết nối GitHub Pages với Render

Workflow `.github/workflows/deploy-pages.yml` đã được cấu hình để build project path `/phu-de/` và có thêm ô nhập URL backend khi chạy thủ công.

**Cách cấu hình bền vững (khuyên dùng):**

1. Vào GitHub **Settings → Secrets and variables → Actions → Variables**.
2. Chọn **New repository variable**.
3. Điền Name: `VITE_API_BASE_URL`.
4. Điền Value: URL Render thực tế, ví dụ `https://phu-de-api.onrender.com`. Không thêm `/api` và không thêm dấu `/` ở cuối.
5. Lưu variable, rồi mở tab **Actions** và chạy workflow **Deploy Subtitle Studio to GitHub Pages**. Với những lần push tiếp theo, workflow tự dùng variable đã lưu.

**Cách kiểm thử một lần không cần lưu variable:**

1. Vào tab **Actions** → **Deploy Subtitle Studio to GitHub Pages** → **Run workflow**.
2. Trong ô `Render backend URL` / `api_base_url`, dán URL Render thực tế.
3. Nhấn **Run workflow** và đợi cả hai job build + deploy thành công.

Workflow đã tự đặt `VITE_BASE_PATH=/phu-de/`; không cần thay đổi `.env.example` khi deploy GitHub Pages. File `.env.example` giữ `VITE_BASE_PATH=/` và API URL rỗng để chạy local cùng origin trên máy tính.

## Dùng công khai cho nhiều người

Backend là dịch vụ công khai: mọi người truy cập website có thể gửi video lên máy chủ của bạn. Máy chủ sẽ dùng CPU/RAM của Render và quota/API billing Gemini của bạn. Mã nguồn hiện có giới hạn upload 300 MB và rate limit cơ bản theo IP; các giới hạn này không biến dịch vụ thành không giới hạn hoặc chống lạm dụng tuyệt đối. Theo dõi chi phí Render/Gemini, đặt budget/quota phù hợp và nâng cấp bảo vệ (ví dụ CAPTCHA, quota người dùng, hàng đợi xử lý) trước khi quảng bá rộng rãi.

Backend hiện lưu video tạm trong filesystem của instance và giữ mã video trong bộ nhớ tiến trình. Vì vậy, dùng một instance backend; đừng bật autoscaling nhiều instance nếu chưa chuyển registry và tệp upload sang storage dùng chung. Video tạm có thể mất khi dịch vụ restart/redeploy.

## Biến môi trường

| Biến | Dùng ở đâu | Ý nghĩa |
|---|---|---|
| `GEMINI_API_KEY` | Backend | API key Gemini; không công khai |
| `CORS_ORIGIN` | Backend | Origin được phép gọi API |
| `PORT` | Backend | Render tự cấp; local mặc định 3000 |
| `VITE_API_BASE_URL` | Frontend build | URL backend Render công khai, không có `/api` ở cuối |
| `VITE_BASE_PATH` | Frontend build | `/phu-de/` cho GitHub Pages project site; `/` khi chạy local |

## Lệnh kiểm tra

```powershell
npm run build
npm run lint
```
