import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  type ObjectCannedACL,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

type UploadFieldImageOptions = {
  fieldCode: number;
  file: Express.Multer.File;
  sortOrder?: number;
};

type UploadedImage = {
  bucket: string;
  key: string;
  url: string;
  region: string;
};

function normalizeRegion(input?: string | null) {
  const fallback = "ap-southeast-1";
  if (!input) return fallback;
  const trimmed = input.trim();
  if (!trimmed) return fallback;
  const match = trimmed.match(/[a-z]{2}-[a-z0-9-]+-\d/);
  if (match) return match[0];
  return trimmed;
}

const REGION = normalizeRegion(
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION
);

const ENDPOINT = process.env.AWS_S3_ENDPOINT;
const FORCE_PATH_STYLE =
  (process.env.AWS_S3_FORCE_PATH_STYLE || "").toLowerCase() === "true";

const s3Client = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  forcePathStyle: FORCE_PATH_STYLE,
});

function resolveBucketName() {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error("Missing AWS_S3_BUCKET environment variable");
  }
  return bucket;
}

function buildObjectKey(fieldCode: number, originalName: string) {
  const safeName = originalName.replace(/\s+/g, "-");
  const extension = safeName.includes(".")
    ? safeName.substring(safeName.lastIndexOf("."))
    : "";
  const unique = randomUUID();
  const timestamp = Date.now();
  return `fields/${fieldCode}/${timestamp}-${unique}${extension}`;
}

function buildPublicUrl(bucket: string, key: string): string {
  const customBaseUrl = process.env.AWS_S3_PUBLIC_URL;
  if (customBaseUrl) {
    return `${customBaseUrl.replace(/\/$/, "")}/${key}`;
  }

  const regionSegment =
    REGION === "us-east-1" ? "s3.amazonaws.com" : `s3.${REGION}.amazonaws.com`;
  return `https://${bucket}.${regionSegment}/${key}`;
}

async function uploadObject(
  bucket: string,
  key: string,
  file: Express.Multer.File
) {
  const acl = (
    process.env.AWS_S3_ACL?.trim() as ObjectCannedACL | undefined
  ) ?? "public-read";
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype || "application/octet-stream",
      ACL: acl,
    })
  );
}

export async function uploadFieldImage({
  fieldCode,
  file,
}: UploadFieldImageOptions): Promise<UploadedImage> {
  if (!file) {
    throw new Error("Tệp upload không hợp lệ");
  }

  const bucket = resolveBucketName();
  const key = buildObjectKey(fieldCode, file.originalname);

  await uploadObject(bucket, key, file);

  return {
    bucket,
    key,
    region: REGION,
    url: buildPublicUrl(bucket, key),
  };
}

export async function deleteObjectFromS3(bucket: string, key: string) {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

const s3Service = {
  uploadFieldImage,
  deleteObject: deleteObjectFromS3,
};

export default s3Service;
