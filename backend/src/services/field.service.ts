import type { Express } from "express";
import { promises as fs } from "fs";
import fieldModel, {
  FieldFilters,
  FieldPagination,
  FieldPricingRow,
  FieldSlotRow,
  FieldSorting,
} from "../models/field.model";
import s3Service from "./s3.service";
import queryService from "./query";
import ApiError from "../utils/apiErrors";
import { StatusCodes } from "http-status-codes";
import localUploadService from "./localUpload.service";
import url from "url";
import path from "path";

type FieldStatusDb = "active" | "maintenance" | "inactive";

type ListParams = {
  search?: string;
  sportType?: string;
  location?: string;
  priceMin?: number;
  priceMax?: number;
  fieldCode?: number;
  shopCode?: number | string;
  page?: number;
  pageSize?: number;
  sortBy?: "price" | "rating" | "name";
  sortDir?: "asc" | "desc";
  status?: FieldStatusDb | string;
  shopStatus?: string;
  shopActive?: 0 | 1;
};

const SPORT_TYPE_LABELS: Record<string, string> = {
  badminton: "cầu lông",
  football: "bóng đá",
  baseball: "bóng chày",
  swimming: "bơi lội",
  tennis: "tennis",
};

const SPORT_TYPE_REVERSE = Object.entries(SPORT_TYPE_LABELS).reduce<
  Record<string, string>
>((acc, [db, label]) => {
  acc[label] = db;
  return acc;
}, {});

const STATUS_LABELS: Record<FieldStatusDb, string> = {
  active: "trống",
  maintenance: "bảo trì",
  inactive: "đã đặt",
};

const STATUS_REVERSE = Object.entries(STATUS_LABELS).reduce<
  Record<string, FieldStatusDb>
>((acc, [db, label]) => {
  const key = label.trim().toLowerCase();
  acc[key] = db as FieldStatusDb;
  return acc;
}, {});

["active", "available"].forEach((key) => {
  STATUS_REVERSE[key] = "active";
});
["inactive", "booked", "occupied"].forEach((key) => {
  STATUS_REVERSE[key] = "inactive";
});
STATUS_REVERSE.maintenance = "maintenance";

const SHOP_APPROVAL_LABELS: Record<string, string> = {
  Y: "Approved",
  N: "Pending",
};

const SHOP_APPROVAL_REVERSE: Record<string, "Y" | "N"> = {
  approved: "Y",
  y: "Y",
  yes: "Y",
  true: "Y",
  pending: "N",
  rejected: "N",
  n: "N",
  no: "N",
  false: "N",
};

function normalizeLocation(address?: string | null) {
  if (!address) return "";
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join(", ");
  }
  return address.trim();
}

function mapSportTypeToDb(label?: string) {
  if (!label) return undefined;
  return SPORT_TYPE_REVERSE[label] ?? label;
}

function mapSportTypeToLabel(value?: string | null) {
  if (!value) return "";
  return SPORT_TYPE_LABELS[value] ?? value;
}

function mapStatus(value?: string | null) {
  if (!value) return "trống";
  const dbValue = mapStatusToDb(value);
  if (dbValue) {
    return STATUS_LABELS[dbValue];
  }
  return value;
}

function mapStatusToDb(value?: string | null): FieldStatusDb | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return STATUS_REVERSE[normalized] ?? undefined;
}

function mapShopApprovalToLabel(value?: string | null) {
  if (!value) return "Pending";
  return SHOP_APPROVAL_LABELS[value] ?? "Pending";
}

function mapShopApprovalToDb(value?: string | null) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return SHOP_APPROVAL_REVERSE[normalized];
}

const SLOT_INTERVAL_MINUTES = 60;

function timeStringToMinutes(value: string) {
  const [hourStr, minuteStr] = value.split(":");
  const hours = Number(hourStr);
  const minutes = Number(minuteStr);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function minutesToTimeString(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function getUtcDayIndex(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.getUTCDay();
}

function matchesDayOfWeek(dbValue: number, target: number | null) {
  if (!Number.isFinite(dbValue)) return false;
  if (target === null) return false;
  if (dbValue === target) return true;
  if (dbValue === 7 && target === 0) return true;
  if (dbValue >= 1 && dbValue <= 7 && target === dbValue % 7) return true;
  if (dbValue >= 0 && dbValue <= 6 && target === ((dbValue % 7) + 7) % 7)
    return true;
  return false;
}

function buildGeneratedSlots(schedule: FieldPricingRow[], playDate: string) {
  const dayIndex = getUtcDayIndex(playDate);
  if (dayIndex === null) return [];

  const matching = schedule.filter((item) =>
    matchesDayOfWeek(Number(item.day_of_week), dayIndex)
  );

  const generated: Array<{ start_time: string; end_time: string }> = [];

  matching.forEach((item) => {
    const startMinutes = timeStringToMinutes(item.start_time);
    const endMinutes = timeStringToMinutes(item.end_time);
    if (
      startMinutes === null ||
      endMinutes === null ||
      endMinutes <= startMinutes
    ) {
      return;
    }

    let cursor = startMinutes;
    while (cursor < endMinutes) {
      const nextCursor = Math.min(cursor + SLOT_INTERVAL_MINUTES, endMinutes);
      generated.push({
        start_time: minutesToTimeString(cursor),
        end_time: minutesToTimeString(nextCursor),
      });
      cursor = nextCursor;
    }
  });

  return generated;
}

function generateSyntheticSlotId(
  fieldCode: number,
  playDate: string,
  startTime: string,
  endTime: string
) {
  const key = `${fieldCode}|${playDate}|${startTime}|${endTime}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  if (hash === 0) {
    hash = Number(playDate.replace(/-/g, "")) || fieldCode || 1;
  }
  return -Math.abs(hash);
}

function mapSlotRow(slot: FieldSlotRow) {
  // Check if hold has expired
  let status = slot.status;
  if (status === "held" && slot.hold_expires_at) {
    const holdExpiryTime = new Date(slot.hold_expires_at);
    const now = new Date();
    if (now > holdExpiryTime) {
      // Hold has expired, treat as available
      status = "available";
    }
  }
  
  return {
    slot_id: slot.slot_id,
    field_code: slot.field_code,
    play_date: slot.play_date,
    start_time: slot.start_time,
    end_time: slot.end_time,
    status: status,
    hold_expires_at: slot.hold_expires_at,
    is_available: status === "available",
  };
}

const fieldService = {
  async list(params: ListParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(params.pageSize) || 12));
    const offset = (page - 1) * pageSize;

    const filters: FieldFilters = {
      search: params.search?.trim() || undefined,
      sportType: mapSportTypeToDb(params.sportType),
      location: params.location?.trim() || undefined,
      priceMin:
        typeof params.priceMin === "number"
          ? params.priceMin
          : params.priceMin
          ? Number(params.priceMin)
          : undefined,
      priceMax:
        typeof params.priceMax === "number"
          ? params.priceMax
          : params.priceMax
          ? Number(params.priceMax)
          : undefined,
      fieldCode:
        typeof params.fieldCode === "number"
          ? params.fieldCode
          : params.fieldCode
          ? Number(params.fieldCode)
          : undefined,
      status: mapStatusToDb(params.status),
      shopApproval: mapShopApprovalToDb(params.shopStatus),
      shopCode:
        typeof params.shopCode === "number"
          ? params.shopCode
          : params.shopCode
          ? Number(params.shopCode)
          : undefined,
      shopActive: typeof params.shopActive === "number" ? params.shopActive : 1,
    };

    const pagination: FieldPagination = { limit: pageSize, offset };
    const sorting: FieldSorting = {
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    };

    const [rows, total, sportTypesDb, addresses, statusCounts, approvalCounts] =
      await Promise.all([
        fieldModel.list(filters, pagination, sorting),
        fieldModel.count(filters),
        fieldModel.listSportTypes(filters),
        fieldModel.listAddresses(filters),
        fieldModel.countByStatus(filters),
        fieldModel.countByShopApproval(filters),
      ]);

    const items = await this.hydrateRows(rows);

    const sportTypes = Array.from(
      new Set(sportTypesDb.map((s) => mapSportTypeToLabel(s)))
    ).filter(Boolean);
    const locations = Array.from(
      new Set(addresses.map((addr) => normalizeLocation(addr)).filter(Boolean))
    );

    const statusFacet = statusCounts.map((item) => {
      const total = Number(item.total ?? 0);
      return {
        value: item.status ?? "unknown",
        label: mapStatus(item.status ?? undefined),
        total,
        count: total,
      };
    });

    const shopApprovalFacet = approvalCounts.map((item) => {
      const total = Number(item.total ?? 0);
      return {
        value: item.approval ?? "N",
        label: mapShopApprovalToLabel(item.approval ?? undefined),
        total,
        count: total,
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const paginationMeta = {
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: paginationMeta.hasNext,
      hasPrev: paginationMeta.hasPrev,
      facets: {
        sportTypes: sportTypes.sort((a, b) => a.localeCompare(b, "vi")),
        locations: locations.sort((a, b) => a.localeCompare(b, "vi")),
        statuses: statusFacet,
        shopApprovals: shopApprovalFacet,
      },
      summary: {
        totals: {
          fields: total,
          available:
            statusFacet.find((item) => item.value === "active")?.total ?? 0,
          maintenance:
            statusFacet.find((item) => item.value === "maintenance")?.total ??
            0,
          booked:
            statusFacet.find((item) => item.value === "inactive")?.total ?? 0,
        },
        shops: {
          approved:
            shopApprovalFacet.find((item) => item.value === "Y")?.total ?? 0,
          pending:
            shopApprovalFacet.find((item) => item.value === "N")?.total ?? 0,
        },
      },
      pagination: paginationMeta,
    };
  },

  async deleteImages(
    fieldCode: number,
    imageCodes: number[],
    shopCode?: number
  ) {
    if (!Array.isArray(imageCodes) || imageCodes.length === 0) return [];

    const field = await fieldModel.findById(fieldCode);
    if (!field) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân");
    }
    if (shopCode && field.shop_code !== shopCode) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Bạn không có quyền xóa ảnh của sân này"
      );
    }

    const images = await fieldModel.getImagesByCodes(fieldCode, imageCodes);
    if (!images.length) return [];

    // Try deleting storage objects best-effort
    const deletions: Promise<unknown>[] = [];
    for (const img of images as Array<{ image_url: string }>) {
      const imageUrl = (img.image_url || "").trim();
      if (!imageUrl) continue;
      try {
        const parsed = new URL(imageUrl);
        const host = (parsed.host || parsed.hostname || "").toLowerCase();
        if (host.includes("amazonaws.com") || host.includes("s3")) {
          // Guess bucket and key from url
          // Formats supported: https://{bucket}.s3.{region}.amazonaws.com/{key}
          // or custom CDN where key starts after the bucket base path isn't derivable -> skip
          const pathname = parsed.pathname.replace(/^\/+/, "");
          const hostParts = parsed.hostname.split(".");
          const bucketCandidate = hostParts[0];
          const regionCandidate = hostParts.includes("amazonaws")
            ? hostParts.find(
                (p) => p && p !== "s3" && p !== "amazonaws" && p !== "com"
              )
            : undefined;
          if (bucketCandidate && pathname) {
            deletions.push(
              s3Service
                .deleteObject(bucketCandidate, pathname)
                .catch(() => undefined)
            );
          }
        } else if (
          imageUrl.startsWith("/uploads/") ||
          imageUrl.startsWith("/public/")
        ) {
          const absolutePath = path.join(
            process.cwd(),
            imageUrl.replace(/^\/+/, "")
          );
          deletions.push(fs.unlink(absolutePath).catch(() => undefined));
        }
      } catch {
        // Ignore malformed URL
      }
    }

    await Promise.allSettled(deletions);

    await fieldModel.deleteImages(fieldCode, imageCodes);

    // Return the field with remaining images hydrated
    return this.getById(fieldCode);
  },

  async deleteFieldForShop(options: {
    shopCode: number;
    fieldCode: number;
    mode?: "hard" | "soft";
  }) {
    const { shopCode, fieldCode } = options;
    const mode = options.mode === "soft" ? "soft" : "hard";

    const shop = await fieldModel.findShopByCode(shopCode);
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy shop");
    }

    const field = await fieldModel.findById(fieldCode);
    if (!field || field.shop_code !== shopCode) {
      return null;
    }

    // If there are future bookings, block hard delete and soft delete with 409
    const hasFuture = await fieldModel.hasFutureBookings(fieldCode);
    if (hasFuture) {
      const err = new ApiError(
        StatusCodes.CONFLICT,
        "Sân có đơn đặt trong tương lai, không thể xóa."
      );
      (err as any).code = "FUTURE_BOOKINGS";
      throw err;
    }

    if (mode === "soft") {
      const ok = await fieldModel.softDeleteField(fieldCode);
      return ok ? { deleted: true } : null;
    }

    // hard delete: remove images from storage, delete image rows, then delete field
    const images = await fieldModel.listAllImagesForField(fieldCode);
    const deletions: Promise<unknown>[] = [];
    for (const img of images as Array<{ image_url: string }>) {
      const imageUrl = (img.image_url || "").trim();
      if (!imageUrl) continue;
      try {
        const parsed = new URL(imageUrl);
        const host = (parsed.host || parsed.hostname || "").toLowerCase();
        if (host.includes("amazonaws.com") || host.includes("s3")) {
          const pathname = parsed.pathname.replace(/^\/+/, "");
          const bucket = parsed.hostname.split(".")[0];
          if (bucket && pathname) {
            deletions.push(
              s3Service.deleteObject(bucket, pathname).catch(() => undefined)
            );
          }
        } else if (
          imageUrl.startsWith("/uploads/") ||
          imageUrl.startsWith("/public/")
        ) {
          const absolutePath = path.join(
            process.cwd(),
            imageUrl.replace(/^\/+/, "")
          );
          deletions.push(fs.unlink(absolutePath).catch(() => undefined));
        }
      } catch {
        // ignore
      }
    }
    await Promise.allSettled(deletions);

    await fieldModel.deleteAllImagesForField(fieldCode);
    const ok = await fieldModel.hardDeleteField(fieldCode);
    return ok ? { deleted: true } : null;
  },

  async getById(fieldCode: number) {
    const rows = await fieldModel.list(
      { fieldCode },
      { limit: 1, offset: 0 },
      { sortBy: "name", sortDir: "asc" }
    );
    const items = await this.hydrateRows(rows);
    return items[0] ?? null;
  },

  async getAvailability(fieldCode: number, playDate?: string) {
    const pricingPromise: Promise<FieldPricingRow[]> = playDate
      ? fieldModel.listPricing(fieldCode)
      : Promise.resolve([]);

    const [slots, pricing] = await Promise.all([
      fieldModel.listSlots(fieldCode, playDate),
      pricingPromise,
    ]);

    const mappedSlots = slots.map(mapSlotRow);

    if (!playDate || !pricing.length) {
      return mappedSlots;
    }

    const keyFor = (slot: {
      play_date: string;
      start_time: string;
      end_time: string;
    }) => `${slot.play_date}|${slot.start_time}|${slot.end_time}`;

    const existingByKey = new Map<string, ReturnType<typeof mapSlotRow>>();
    mappedSlots
      .filter((slot) => slot.play_date === playDate)
      .forEach((slot) => {
        existingByKey.set(keyFor(slot), slot);
      });

    const generatedSlots = buildGeneratedSlots(pricing, playDate)
      .map((slot) => {
        const generated = {
          slot_id: generateSyntheticSlotId(
            fieldCode,
            playDate,
            slot.start_time,
            slot.end_time
          ),
          field_code: fieldCode,
          play_date: playDate,
          start_time: slot.start_time,
          end_time: slot.end_time,
          status: "available" as const,
          hold_expires_at: null,
          is_available: true,
        };
        return generated;
      })
      .filter((slot) => !existingByKey.has(keyFor(slot)));

    if (!generatedSlots.length) {
      return mappedSlots;
    }

    const combined = [...mappedSlots, ...generatedSlots];
    combined.sort((a, b) => {
      if (a.play_date !== b.play_date) {
        return a.play_date.localeCompare(b.play_date);
      }
      return a.start_time.localeCompare(b.start_time);
    });

    return combined;
  },

  async addImage(fieldCode: number, file: Express.Multer.File) {
    const existing = await fieldModel.findById(fieldCode);
    if (!existing) {
      return null;
    }

    const uploadResult = await s3Service.uploadFieldImage({
      fieldCode,
      file,
    });

    const imageRecord = await fieldModel.createImage(
      fieldCode,
      uploadResult.url
    );

    return {
      ...imageRecord,
      is_primary: Number(imageRecord.sort_order ?? 0) === 0 ? 1 : 0,
      storage: {
        bucket: uploadResult.bucket,
        key: uploadResult.key,
        region: uploadResult.region,
      },
    };
  },

  async createForShop(
    payload: {
      shopCode: number;
      fieldName: string;
      sportType: string;
      address?: string | null;
      pricePerHour: number;
      status?: FieldStatusDb | string;
    },
    files: Express.Multer.File[] = []
  ) {
    const shop = await fieldModel.findShopByCode(payload.shopCode);
    if (!shop) {
      const error = new Error("SHOP_NOT_FOUND");
      (error as any).code = "SHOP_NOT_FOUND";
      throw error;
    }

    const sportTypeInput = payload.sportType?.trim();
    const sportTypeDbCandidate =
      mapSportTypeToDb(sportTypeInput) ??
      mapSportTypeToDb(sportTypeInput?.toLowerCase());

    if (
      !sportTypeDbCandidate ||
      !Object.prototype.hasOwnProperty.call(
        SPORT_TYPE_LABELS,
        sportTypeDbCandidate
      )
    ) {
      const error = new Error("INVALID_SPORT_TYPE");
      (error as any).code = "INVALID_SPORT_TYPE";
      throw error;
    }

    const statusDb = mapStatusToDb(
      typeof payload.status === "string" ? payload.status : undefined
    );
    const parsedPrice = Number(payload.pricePerHour);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      const error = new Error("INVALID_PRICE");
      (error as any).code = "INVALID_PRICE";
      throw error;
    }

    const uploadedObjects: Array<{ bucket: string; key: string }> = [];
    const localStored: Array<{ absolutePath: string; publicUrl: string }> = [];

    try {
      const fieldCode = await queryService.execTransaction(
        "fieldService.createForShop",
        async (conn) => {
          const newFieldCode = await fieldModel.insertField(conn, {
            shopCode: payload.shopCode,
            fieldName: payload.fieldName.trim(),
            sportType: sportTypeDbCandidate,
            address: payload.address?.trim() || null,
            pricePerHour: parsedPrice,
            status: statusDb ?? "active",
          });

          let sortOrder = 0;
          for (const file of files ?? []) {
            try {
              const upload = await s3Service.uploadFieldImage({
                fieldCode: newFieldCode,
                file,
              });
              uploadedObjects.push({ bucket: upload.bucket, key: upload.key });
              await fieldModel.insertFieldImage(conn, {
                fieldCode: newFieldCode,
                imageUrl: upload.url,
                sortOrder: sortOrder++,
              });
            } catch (error) {
              const fallbackMode =
                (process.env.FIELD_IMAGE_FALLBACK || "").trim().toLowerCase() ||
                "s3";

              if (
                fallbackMode === "local" ||
                fallbackMode === "filesystem" ||
                fallbackMode === "fs"
              ) {
                const stored = await localUploadService.storeFieldImageLocally(
                  newFieldCode,
                  file
                );
                localStored.push(stored);
                await fieldModel.insertFieldImage(conn, {
                  fieldCode: newFieldCode,
                  imageUrl: stored.publicUrl,
                  sortOrder: sortOrder++,
                });
                continue;
              }

              const message =
                (error as Error)?.message || "Không thể tải ảnh lên bộ nhớ S3";
              throw new ApiError(
                StatusCodes.BAD_GATEWAY,
                `Upload ảnh thất bại: ${message}`
              );
            }
          }

          return newFieldCode;
        }
      );

      return await this.getById(fieldCode);
    } catch (error) {
      if (uploadedObjects.length) {
        await Promise.all(
          uploadedObjects.map((obj) =>
            s3Service.deleteObject(obj.bucket, obj.key).catch(() => undefined)
          )
        );
      }
      if (localStored.length) {
        await Promise.all(
          localStored.map((item) =>
            fs.unlink(item.absolutePath).catch(() => undefined)
          )
        );
      }
      throw error;
    }
  },

  async updateForShop(
    shopCode: number,
    fieldId: number,
    payload: Partial<{
      field_name: string;
      sport_type: string;
      address: string;
      price_per_hour: number;
      status: string;
    }>
  ) {
    const shop = await fieldModel.findShopByCode(shopCode);
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy shop");
    }

    const field = await fieldModel.findById(fieldId);
    if (!field || field.shop_code !== shopCode) {
      return null;
    }

    const dataToUpdate: Partial<{
      field_name: string;
      sport_type: string;
      address: string;
      price_per_hour: number;
      status: FieldStatusDb;
    }> = {};

    if (payload.field_name) {
      dataToUpdate.field_name = payload.field_name.trim();
    }
    if (payload.sport_type) {
      const sportTypeDb = mapSportTypeToDb(payload.sport_type);
      if (!sportTypeDb) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Loại hình thể thao không hợp lệ"
        );
      }
      dataToUpdate.sport_type = sportTypeDb;
    }
    if (payload.address) {
      dataToUpdate.address = payload.address.trim();
    }
    if (payload.price_per_hour) {
      const parsedPrice = Number(payload.price_per_hour);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Giá thuê mỗi giờ không hợp lệ"
        );
      }
      dataToUpdate.price_per_hour = parsedPrice;
    }
    if (payload.status) {
      const statusDb = mapStatusToDb(payload.status);
      if (!statusDb) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Trạng thái không hợp lệ");
      }
      dataToUpdate.status = statusDb;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return this.getById(fieldId);
    }

    const updated = await fieldModel.updateField(fieldId, dataToUpdate);

    if (!updated) {
      return null;
    }

    return this.getById(fieldId);
  },

  async hydrateRows(rows: Awaited<ReturnType<typeof fieldModel.list>>) {
    if (!rows.length) return [];
    const fieldCodes = rows.map((row) => row.field_code);
    const [images, reviews] = await Promise.all([
      fieldModel.listImages(fieldCodes),
      fieldModel.listReviews(fieldCodes),
    ]);

    const imagesByField = new Map<number, any[]>();
    images.forEach((img: any) => {
      const entry = imagesByField.get(img.field_code) ?? [];
      entry.push({
        image_code: img.image_code,
        field_code: img.field_code,
        image_url: img.image_url,
        sort_order: img.sort_order,
        is_primary: Number(img.sort_order ?? 0) === 0 ? 1 : 0,
      });
      imagesByField.set(img.field_code, entry);
    });

    const reviewsByField = new Map<number, any[]>();
    reviews.forEach((rev: any) => {
      const entry = reviewsByField.get(rev.field_code) ?? [];
      entry.push({
        review_code: rev.review_code,
        field_code: rev.field_code,
        customer_name: rev.customer_name ?? "Ẩn danh",
        rating: Number(rev.rating ?? 0),
        comment: rev.comment ?? "",
        created_at: rev.created_at,
      });
      reviewsByField.set(rev.field_code, entry);
    });

    return rows.map((row) => ({
      field_code: row.field_code,
      shop_code: row.shop_code,
      field_name: row.field_name,
      sport_type: mapSportTypeToLabel(row.sport_type),
      price_per_hour: Number(row.price_per_hour ?? 0),
      address: row.address ?? "",
      status: mapStatus(row.status),
      images: imagesByField.get(row.field_code) ?? [],
      shop: {
        shop_code: row.shop_code,
        user_code: row.shop_user_id,
        shop_name: row.shop_name,
        address: row.shop_address ?? "",
        bank_account_number: "",
        bank_name: "",
        isapproved: row.shop_is_approved === "Y" ? 1 : 0,
      },
      reviews: reviewsByField.get(row.field_code) ?? [],
      averageRating: Number(row.average_rating ?? 0),
    }));
  },
};

export default fieldService;
