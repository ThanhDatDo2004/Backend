import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const UPLOADS_ROOT =
  process.env.FIELD_IMAGE_LOCAL_DIR ||
  path.resolve(process.cwd(), "uploads", "fields");

function ensureExtension(filename: string) {
  const ext = path.extname(filename);
  if (ext) return ext;
  return ".jpg";
}

function getPublicBaseUrl() {
  const base =
    process.env.FIELD_IMAGE_BASE_URL ||
    process.env.APP_BASE_URL ||
    process.env.APP_ORIGIN ||
    "";
  return base.replace(/\/+$/, "");
}

export async function storeFieldImageLocally(
  fieldCode: number,
  file: Express.Multer.File
) {
  const fieldDir = path.join(UPLOADS_ROOT, String(fieldCode));
  await fs.mkdir(fieldDir, { recursive: true });
  const ext = ensureExtension(file.originalname);
  const name = `${Date.now()}-${randomUUID()}${ext}`;
  const absolutePath = path.join(fieldDir, name);
  await fs.writeFile(absolutePath, file.buffer);

  const relativePath = path
    .relative(process.cwd(), absolutePath)
    .replace(/\\/g, "/");

  const baseUrl = getPublicBaseUrl();
  const publicUrl = baseUrl
    ? `${baseUrl}/${relativePath}`
    : `/${relativePath}`;

  return {
    absolutePath,
    relativePath,
    publicUrl,
  };
}

const localUploadService = {
  storeFieldImageLocally,
};

export default localUploadService;
