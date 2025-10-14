import type { RequestHandler } from "express";
import multer, { MulterError } from "multer";
import { StatusCodes } from "http-status-codes";
import ApiError from "../utils/apiErrors";

const IMAGE_SIZE_LIMIT =
  Number(process.env.FIELD_IMAGE_MAX_SIZE_MB ?? 5) * 1024 * 1024;
const IMAGE_MAX_COUNT = Math.max(
  1,
  Number(process.env.FIELD_IMAGE_MAX_COUNT ?? 5)
);

const storage = multer.memoryStorage();

const baseFieldImageUpload = multer({
  storage,
  limits: {
    fileSize: IMAGE_SIZE_LIMIT,
    files: IMAGE_MAX_COUNT,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    const error = new ApiError(
      StatusCodes.BAD_REQUEST,
      "Chỉ chấp nhận tập tin hình ảnh"
    );
    cb(error);
  },
});

function normalizeUploadError(err: unknown) {
  if (!err) return null;

  if (err instanceof ApiError) {
    return err;
  }

  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return new ApiError(
        StatusCodes.BAD_REQUEST,
        `Dung lượng ảnh vượt quá ${Math.round(
          IMAGE_SIZE_LIMIT / (1024 * 1024)
        )}MB`
      );
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return new ApiError(
        StatusCodes.BAD_REQUEST,
        `Chỉ được tải tối đa ${IMAGE_MAX_COUNT} ảnh mỗi lần`
      );
    }
    return new ApiError(
      StatusCodes.BAD_REQUEST,
      err.message || "Upload thất bại"
    );
  }

  return new ApiError(
    StatusCodes.BAD_REQUEST,
    (err as any)?.message || "Không thể tải lên hình ảnh"
  );
}

function createUploadHandler(
  fieldName: string,
  maxCount = 1
): RequestHandler {
  return (req, res, next) => {
    const handler =
      maxCount > 1
        ? baseFieldImageUpload.array(fieldName, maxCount)
        : baseFieldImageUpload.single(fieldName);
    handler(req, res, (err: unknown) => {
      const normalized = normalizeUploadError(err);
      if (normalized) {
        return next(normalized);
      }
      return next();
    });
  };
}

export const fieldImageUpload = createUploadHandler("image", 1);
export const fieldImagesUpload = createUploadHandler("images", IMAGE_MAX_COUNT);

const uploadMiddleware = {
  fieldImageUpload,
  fieldImagesUpload,
};

export default uploadMiddleware;
