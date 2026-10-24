# Prompt xây dựng sản phẩm "Xác Suất AI" (Câu 5)

## 1. Prompt gốc đã dùng để xây dựng sản phẩm

Vai trò: Bạn là kỹ sư giáo dục toán và lập trình web. Hãy xây dựng một ứng dụng web một trang, tên "Xác Suất AI", hỗ trợ học Xác suất Thống kê bằng AI, giao diện tiếng Việt, dùng được trên máy tính, iPad và điện thoại.

Nguyên tắc sư phạm bắt buộc:
- Với bài tập, AI chỉ cung cấp **chiến lược giải** (gợi ý, câu hỏi gợi mở, công thức cần dùng), **không đưa lời giải đầy đủ hay đáp số**.
- Mọi quy trình bám đúng khung 4 bước của khoá học (xem mục 3).
- Ký hiệu toán viết bằng Unicode thuần, không dùng LaTeX.

Yêu cầu 11 tính năng:
1. **Quy trình 4 bước**: giải toán; học khái niệm (Trải nghiệm → Hình thành định nghĩa → Củng cố → Vận dụng); học định lí (Trải nghiệm → Hình thành định lí → Củng cố → Vận dụng). Người dùng nhập chủ đề, AI dựng nội dung từng bước, mỗi bước có hoạt động để học sinh trả lời và nhận xét từ AI.
2. **AI Tutor chấm bài**: nhận ảnh, PDF hoặc bài viết tay trên bảng (iPad/Apple Pencil/chuột); chấm theo barem do giáo viên sửa được; trả điểm từng ý, lỗi sai, và chiến lược sửa (không đưa lời giải).
3. **Tương tác giọng nói**: hỏi đáp bằng giọng nói (nhận dạng và đọc to tiếng Việt); câu trả lời ngắn; bài toán cần công thức thì yêu cầu học sinh viết lên bảng rồi gửi ảnh bảng cho AI.
4. **Bài tự luận tương tự**: từ một đề, AI sinh ngẫu nhiên 5 bài tương tự, mỗi bài chỉ kèm chiến lược giải.
5. **Bài trắc nghiệm tương tự**: sinh đề 5 hoặc 10 câu, chấm tức thì, hiển thị điểm; mỗi câu có ô hỏi AI "tại sao đáp án là…".
6. **Vấn đáp lí thuyết**: AI ra 5 câu hỏi lí thuyết, chấm điểm thang 10, chỉ ra lỗ hổng kiến thức và sai lầm thường gặp.
7. **Thống kê lỗi sai**: tổng hợp lỗi từ vấn đáp, trắc nghiệm, tự luận; biểu đồ theo hình thức, loại lỗi, chủ đề; AI nhận định chung và hướng khắc phục.
8. **Bản đồ tư duy**: AI sinh cây khái niệm theo chủ đề và vẽ thành sơ đồ.
9. **Diễn đàn**: đăng bài, trả lời, dùng chung cho mọi người mở trang.
10. **Hồ sơ AI**: hồ sơ từng người dùng, tự cập nhật từ lịch sử lỗi; AI chẩn đoán lỗi lặp lại và lập kế hoạch bổ trợ 2 tuần.
11. **Bản sao quy trình**: dán một bài toán, khái niệm hoặc định lí; AI tạo quy trình 4 bước đầy đủ như đối tượng gốc, có ví dụ minh hoạ, bài củng cố, hoạt động tương tác.

## 2. Prompt hệ thống (system prompt) dùng trong sản phẩm

> Bạn là gia sư Xác suất Thống kê cho học sinh, sinh viên Việt Nam. Trả lời bằng tiếng Việt, ngắn gọn, chính xác. Viết ký hiệu toán bằng Unicode thuần (P(A∩B), x̄, σ², ∑, √, ≤), không dùng LaTeX. Với bài tập: chỉ đưa chiến lược, câu hỏi gợi mở, công thức cần dùng; KHÔNG viết lời giải đầy đủ và KHÔNG nêu đáp số cuối cùng.

Prompt riêng của từng tính năng nằm trong file `public/app.js` (tìm các lời gọi `ai(`); prompt hệ thống nằm ở `server.js`, mỗi prompt yêu cầu AI trả JSON theo cấu trúc cố định để giao diện hiển thị và ghi lỗi.

## 3. Khung 4 bước (đưa vào prompt tính năng 1 và 11)

**Giải toán**: (1) Tìm hiểu nội dung bài toán; (2) Xây dựng chương trình giải; (3) Trình bày lời giải; (4) Kiểm tra và nghiên cứu lời giải.

**Học khái niệm**: (1) Trải nghiệm; (2) Hình thành định nghĩa khái niệm; (3) Củng cố; (4) Vận dụng vào thực tiễn.

**Học định lí**: (1) Trải nghiệm; (2) Hình thành định lí; (3) Củng cố; (4) Vận dụng.

Nội dung chi tiết từng bước lấy từ đề bài và được nhúng trong biến `KIND` của `public/app.js`.

## 4. Ghi chú kỹ thuật và hạn chế

- Kiến trúc: trình duyệt (`public/`) gọi server Node (`server.js`); server giữ khoá API và gọi Gemini, nên khoá không lộ ra trình duyệt. Có giới hạn tần suất theo IP và giới hạn lượt/ngày.
- Nhận dạng giọng nói dùng Web Speech API, chạy tốt trên Chrome/Edge; trình duyệt khác chỉ gõ chữ được.
- Đọc PDF dùng pdf.js (tối đa 4 trang đầu); nếu lỗi, chụp ảnh bài làm.
- Hồ sơ và thống kê lỗi lưu trên trình duyệt từng người dùng; diễn đàn lưu chung trong `data/forum.json` trên server.
