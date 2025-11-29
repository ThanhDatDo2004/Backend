"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFieldImage = uploadFieldImage;
exports.deleteObjectFromS3 = deleteObjectFromS3;
const client_s3_1 = require("@aws-sdk/client-s3");
const crypto_1 = require("crypto");
function normalizeRegion(input) {
    const fallback = "ap-southeast-1";
    if (!input)
        return fallback;
    const trimmed = input.trim();
    if (!trimmed)
        return fallback;
    const match = trimmed.match(/[a-z]{2}-[a-z0-9-]+-\d/);
    if (match)
        return match[0];
    return trimmed;
}
const REGION = normalizeRegion(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION);
const ENDPOINT = process.env.AWS_S3_ENDPOINT;
const FORCE_PATH_STYLE = (process.env.AWS_S3_FORCE_PATH_STYLE || "").toLowerCase() === "true";
const s3Client = new client_s3_1.S3Client({
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
function buildObjectKey(fieldCode, originalName) {
    const safeName = originalName.replace(/\s+/g, "-");
    const extension = safeName.includes(".")
        ? safeName.substring(safeName.lastIndexOf("."))
        : "";
    const unique = (0, crypto_1.randomUUID)();
    const timestamp = Date.now();
    return `fields/${fieldCode}/${timestamp}-${unique}${extension}`;
}
function buildPublicUrl(bucket, key) {
    const customBaseUrl = process.env.AWS_S3_PUBLIC_URL;
    if (customBaseUrl) {
        return `${customBaseUrl.replace(/\/$/, "")}/${key}`;
    }
    const regionSegment = REGION === "us-east-1" ? "s3.amazonaws.com" : `s3.${REGION}.amazonaws.com`;
    return `https://${bucket}.${regionSegment}/${key}`;
}
async function uploadObject(bucket, key, file) {
    const acl = process.env.AWS_S3_ACL?.trim() ?? "public-read";
    await s3Client.send(new client_s3_1.PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || "application/octet-stream",
        ACL: acl,
    }));
}
async function uploadFieldImage({ fieldCode, file, }) {
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
async function deleteObjectFromS3(bucket, key) {
    await s3Client.send(new client_s3_1.DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
    }));
}
const s3Service = {
    uploadFieldImage,
    deleteObject: deleteObjectFromS3,
};
exports.default = s3Service;
