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

## Kiến trúc

- **Frontend:** GitHub Pages — `https://0cuong.github.io/phu-de/`.
- **Backend API:** Render Web Service chạy Docker, Express và FFmpeg.
- **AI:** Gemini API được gọi từ backend; API key chỉ lưu trong Render Environment.

GitHub Pages chỉ host frontend tĩnh, không chạy Express, Node.js hay FFmpeg. Vì vậy cần deploy backend riêng để mọi người dùng các tính năng AI và render MP4.

## Phương án MIỄN PHÍ (Render Free)

Repository đã đặt `render.yaml` ở mức `plan: free`, region Singapore. Render cho phép chạy Docker Web Service miễn phí; gói Free có 0.1 CPU / 512 MB RAM và 750 giờ instance miễn phí mỗi workspace/tháng. Dịch vụ tự ngủ sau 15 phút không có request, thường mất khoảng một phút để thức dậy. Filesystem là tạm thời: file video và dữ liệu trong bộ nhớ sẽ mất khi dịch vụ ngủ, restart hoặc deploy lại.

**Đây là cấu hình $0 để thử nghiệm và xử lý video nhỏ, không phải máy chủ production.** FFmpeg trên 0.1 CPU / 512 MB RAM có thể rất chậm hoặc bị dừng khi xử lý video dài, độ phân giải cao hoặc nhiều người render cùng lúc. Không thể cam kết upload 300 MB hay render mọi video sẽ thành công trên gói Free. Mỗi người dùng sẽ dùng chung tài nguyên máy chủ của bạn.

## Triển khai backend miễn phí trên Render

1. Đăng nhập [Render Dashboard](https://dashboard.render.com/) bằng GitHub.
2. Chọn **New → Blueprint** và kết nối repository `0Cuong/phu-de`, branch `main`. Render sẽ đọc `render.yaml`.
3. Kiểm tra dịch vụ `phu-de-api`, region Singapore và xác nhận compute plan là **Free ($0)**. Không nâng cấp lên `1c-2g` hay plan trả phí.
4. Khi Render hỏi biến bí mật, nhập `GEMINI_API_KEY` bằng API key lấy từ [Google AI Studio](https://aistudio.google.com/app/apikey). Không commit key vào GitHub, không đặt key trong biến `VITE_*`.
5. Xác nhận `CORS_ORIGIN=https://0cuong.github.io` và `NODE_ENV=production`.
6. Deploy dịch vụ, sau đó sao chép URL công khai Render thực tế cấp cho bạn.
7. Kiểm tra `https://<render-service-url>/api/health`. Kết quả mong đợi có `ok: true`, `ffmpeg: true`, `geminiConfigured: true`. Đây chỉ là kiểm tra server/biến môi trường, chưa thay thế thử nghiệm AI và render video thực tế.

## Kết nối GitHub Pages với Render

Workflow `.github/workflows/deploy-pages.yml` build đúng project path `/phu-de/` và hỗ trợ cả biến Actions Variable lẫn ô nhập URL khi chạy thủ công.

**Cách dùng biến lưu cố định:**

1. Vào GitHub **Settings → Secrets and variables → Actions → Variables**.
2. Chọn **New repository variable**.
3. Name: `VITE_API_BASE_URL`.
4. Value: dán URL Render thực tế (ví dụ `https://phu-de-api.onrender.com`), không thêm `/api` và không thêm dấu `/` cuối.
5. Lưu variable, mở tab **Actions** và chạy workflow **Deploy Subtitle Studio to GitHub Pages**.

**Cách không cần lưu variable:**

1. Vào tab **Actions** → **Deploy Subtitle Studio to GitHub Pages** → **Run workflow**.
2. Dán URL Render vào ô `api_base_url`.
3. Nhấn **Run workflow** và đợi cả build + deploy thành công.

Workflow tự đặt `VITE_BASE_PATH=/phu-de/`. File `.env.example` giữ `VITE_API_BASE_URL=` và `VITE_BASE_PATH=/` cho chạy local cùng origin; không cần ghi URL Render vào file `.env.example`.

## AI và giới hạn miễn phí

Gemini API có Free tier cho một số model và giới hạn tốc độ/lượng request theo tài khoản, model và dự án. Model đang được code sử dụng là `gemini-4-hydrogen`; bảng giá Gemini API hiện hiển thị Standard input/output miễn phí ở Free tier, nhưng vẫn áp dụng quota, điều kiện sử dụng và chính sách dữ liệu của Google. Kiểm tra bảng giá và model khả dụng trước khi đưa website cho nhiều người dùng.

Free tier không có nghĩa là dùng vô hạn: Render có giới hạn CPU/RAM/giờ chạy/băng thông; Gemini có quota; mọi request của khách truy cập đều tiêu thụ tài nguyên và quota của bạn. Đừng quảng bá là render vô hạn hoặc tải video không giới hạn.

## Giới hạn lưu trữ / xử lý

Backend hiện lưu video tạm trong filesystem của instance và giữ mã video trong bộ nhớ tiến trình. Vì vậy:
- Nếu Render Free ngủ hoặc restart, các video đã upload và mã `serverVideoId` sẽ mất; người dùng phải tải video lại.
- Dùng một instance; không bật nhiều instance vì registry và file tạm chưa được chia sẻ giữa các instance.
- Render đồng thời có thể làm hết RAM/CPU; gói Free phù hợp thử nghiệm hoặc ít người sử dụng.
- Rate limit trong code chỉ là bảo vệ cơ bản theo IP, chưa phải hệ thống chống lạm dụng hoàn chỉnh. Theo dõi usage/quota và dừng dịch vụ nếu có hoạt động bất thường.

## Biến môi trường

| Biến | Dùng ở đâu | Ý nghĩa |
|---|---|---|
| `GEMINI_API_KEY` | Backend | API key Gemini; không công khai |
| `CORS_ORIGIN` | Backend | Origin được phép gọi API |
| `PORT` | Backend | Render tự cấp; local mặc định 3000 |
| `VITE_API_BASE_URL` | Frontend build | URL backend Render công khai, không có `/api` ở cuối |
| `VITE_BASE_PATH` | Frontend build | `/phu-de/` trên GitHub Pages; `/` khi chạy local |

## Lệnh kiểm tra

```powershell
npm run build
npm run lint
```
