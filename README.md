# Xác Suất AI

Trợ lí AI học Xác suất Thống kê (Câu 5) với 11 tính năng: quy trình 4 bước, AI Tutor chấm bài (ảnh, PDF, bảng viết tay), hỏi đáp giọng nói, bài tập tự luận và trắc nghiệm tương tự, vấn đáp, thống kê lỗi sai, bản đồ tư duy, diễn đàn, hồ sơ học tập, bản sao quy trình.

Prompt dùng để xây dựng sản phẩm: [PROMPT-nop-thay.md](PROMPT-nop-thay.md).

## Chạy trên máy

Dành cho người chấm bài. Không cần cài thư viện nào, chỉ cần Node.js và một khoá Gemini.

**Chuẩn bị (làm một lần)**
1. Cài Node.js bản 20.12 trở lên (bản LTS) từ https://nodejs.org. Kiểm tra bằng `node -v`.
2. Lấy khoá Gemini miễn phí tại https://aistudio.google.com/apikey (cần tài khoản Google, bấm "Create API key").
3. Tải mã nguồn: trên GitHub bấm **Code → Download ZIP** rồi giải nén, hoặc `git clone <địa chỉ repo>`.

**Chạy**

Mở terminal (PowerShell hoặc cmd trên Windows) trong thư mục vừa giải nén:

```
copy .env.example .env        (macOS/Linux: cp .env.example .env)
```

Mở file `.env` bằng Notepad, thay `...` sau `GEMINI_API_KEY=` bằng khoá vừa lấy (một dòng, không có dấu ngoặc kép), lưu lại. Rồi chạy:

```
npm start
```

Thấy dòng `Xác Suất AI: http://localhost:3000` thì mở địa chỉ đó bằng Chrome hoặc Edge. Chrome/Edge cần để dùng nhận dạng giọng nói (tính năng 3). Tắt bằng Ctrl+C.

**Nếu gặp lỗi**
- `API key not valid`: khoá sai hoặc chưa lưu `.env`; khoá thật dài khoảng 40 ký tự.
- `high demand`: Gemini đang quá tải, bấm lại sau vài giây.
- `thiếu GEMINI_API_KEY`: chưa có file `.env` hoặc tên biến sai.
- Cổng 3000 đang bận: chạy `set PORT=3001 && npm start` (cmd) hoặc `PORT=3001 npm start` (macOS/Linux).
- Khoá chỉ nằm trên máy này, không được đưa lên GitHub. Hồ sơ học tập lưu trong trình duyệt, diễn đàn lưu ở `data/forum.json`.

## Đưa lên mạng để thầy dùng

Dùng dịch vụ chạy Node như Render, Railway hoặc Fly.io:
1. Push repo này lên GitHub.
2. Tạo Web Service từ repo, lệnh start là `npm start`.
3. Thêm biến môi trường `GEMINI_API_KEY`. Không đưa khoá vào code hay commit file `.env`.

Biến tuỳ chọn: `MODEL` (mặc định `gemini-3.5-flash`), `RATE_PER_MIN` (15 lượt AI mỗi IP mỗi phút), `DAILY_LIMIT` (500 lượt AI mỗi ngày cho cả trang, để khoá không bị dùng quá tay).

## Cấu trúc

- `server.js`: phục vụ trang, proxy gọi Gemini (`/api/ai`), diễn đàn lưu vào `data/forum.json` (`/api/forum`).
- `public/`: `index.html`, `style.css`, `app.js`.

Diễn đàn lưu bằng file JSON, nhiều dịch vụ miễn phí xoá file khi khởi động lại; muốn bền hơn thì đổi sang SQLite hoặc Postgres. Hồ sơ và thống kê lỗi lưu trong trình duyệt của từng người.
