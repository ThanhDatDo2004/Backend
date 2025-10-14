# Hướng dẫn cấu hình AWS S3 cho ảnh sân

## 1. Tạo hạ tầng trên AWS
- Đăng nhập AWS Console, mở dịch vụ **S3** và tạo _bucket_ mới (ví dụ: `mysport-fields-prod`).
- Chọn Region gần nhất với người dùng (ví dụ: `ap-southeast-1`).
- Quyết định chế độ public/private:
  - Nếu cần trả ảnh trực tiếp từ S3, bật quyền public read cho object hoặc triển khai cơ chế ký URL từ backend.
- Trong tab **Permissions**, thêm Bucket Policy cho phép `s3:GetObject` nếu bạn cần public read. Ví dụ:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAllRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::mysport-fields-prod/*"
    }
  ]
}
```

- Mở dịch vụ **IAM**, tạo User nhóm `Programmatic access`, gán policy `AmazonS3FullAccess` (hoặc policy giới hạn hơn chỉ cho bucket của bạn).
- Lưu lại `Access key ID` và `Secret access key` vừa tạo.

## 2. Cấu hình biến môi trường cho backend
Trong file `.env` của thư mục `backend`, bổ sung:

```
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=mysport-fields-prod
# Tùy chọn: nếu bạn muốn dùng URL tuỳ chỉnh (ví dụ domain S3 tĩnh)
# AWS_S3_PUBLIC_URL=https://mysport-fields-prod.s3.ap-southeast-1.amazonaws.com
# Tùy chọn giới hạn dung lượng upload (MB)
# FIELD_IMAGE_MAX_SIZE_MB=5
# Tùy chọn: giới hạn số ảnh tải lên mỗi lần (mặc định 5)
# FIELD_IMAGE_MAX_COUNT=5
# Tùy chọn: đặt ACL mong muốn (mặc định public-read)
# AWS_S3_ACL=public-read
# Tùy chọn: fallback lưu ảnh local thay vì S3 (local|s3 - mặc định s3)
# FIELD_IMAGE_FALLBACK=local
# Nếu dùng fallback local, có thể chỉ định thư mục và base URL public
# FIELD_IMAGE_LOCAL_DIR=/absolute/path/to/uploads/fields
# FIELD_IMAGE_BASE_URL=http://localhost:5050
```

> Lưu ý: Không commit file `.env` vào git. Dùng `dotenv` hoặc cấu hình biến môi trường trực tiếp trên server CI/CD.

## 3. Cài đặt dependencies
Từ thư mục `backend`, chạy:

```bash
npm install
```

Command này sẽ tải thêm `@aws-sdk/client-s3` và `multer`.

## 4. Sử dụng API upload & quản lý ảnh sân
- **Tạo mới sân và tải nhiều ảnh cùng lúc**  
  `POST /api/shops/:shopCode/fields`  
  Body `multipart/form-data` với:
  - Các trường text: `field_name`, `sport_type`, `address`, `price_per_hour`, `status` (tuỳ chọn).
  - Trường file: `images` (có thể chọn nhiều file, tối đa theo `FIELD_IMAGE_MAX_COUNT`).
  - Endpoint sẽ tạo bản ghi `Fields`, upload từng ảnh lên S3, lưu vào `Field_Images` và trả về thông tin sân vừa tạo.

- **Thêm ảnh cho sân đã tồn tại**  
  `POST /api/fields/:fieldId/images`  
  Body `multipart/form-data` với trường `image`.  
  Khi upload thành công, API sẽ:
  - Đưa file lên S3 tại đường dẫn `fields/{fieldId}/...`.
  - Lưu URL public vào bảng `Field_Images`.
  - Trả về thông tin ảnh (bao gồm `storage.bucket`, `storage.key`).

Ví dụ dùng `curl`:

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "image=@/path/to/field.jpg" \
  http://localhost:5050/api/fields/12/images
```

## 5. Gợi ý bảo mật & mở rộng
- Tạo IAM policy chỉ cho phép các hành động `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` trên bucket cụ thể.
- Nếu cần xóa ảnh khi shop thay ảnh, có thể gọi `s3Service.deleteObject(bucket, key)`.
- Có thể bổ sung job đồng bộ để dọn rác các object không được tham chiếu trong DB.
- Với môi trường phát triển offline, đặt `FIELD_IMAGE_FALLBACK=local`. Backend sẽ lưu ảnh vào thư mục `uploads/fields` và phục vụ qua endpoint tĩnh `/uploads/...`.

Hoàn tất các bước trên, backend sẽ tự động lưu ảnh sân lên AWS S3 mỗi khi shop upload.
