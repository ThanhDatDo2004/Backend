"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const field_model_1 = __importDefault(require("../models/field.model"));
const fieldQuantity_model_1 = __importDefault(require("../models/fieldQuantity.model"));
const s3_service_1 = __importDefault(require("./s3.service"));
const query_1 = __importDefault(require("./query"));
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const http_status_codes_1 = require("http-status-codes");
const localUpload_service_1 = __importDefault(require("./localUpload.service"));
const fieldQuantity_service_1 = __importDefault(require("./fieldQuantity.service"));
const path_1 = __importDefault(require("path"));
const SPORT_TYPE_LABELS = {
    badminton: "cầu lông",
    football: "bóng đá",
    baseball: "bóng chày",
    swimming: "bơi lội",
    tennis: "tennis",
};
const SPORT_TYPE_REVERSE = Object.entries(SPORT_TYPE_LABELS).reduce((acc, [db, label]) => {
    acc[label] = db;
    return acc;
}, {});
const STATUS_LABELS = {
    active: "trống",
    maintenance: "bảo trì",
    inactive: "đã đặt",
};
const STATUS_REVERSE = Object.entries(STATUS_LABELS).reduce((acc, [db, label]) => {
    const key = label.trim().toLowerCase();
    acc[key] = db;
    return acc;
}, {});
["active", "available"].forEach((key) => {
    STATUS_REVERSE[key] = "active";
});
["inactive", "booked", "occupied"].forEach((key) => {
    STATUS_REVERSE[key] = "inactive";
});
STATUS_REVERSE.maintenance = "maintenance";
const SHOP_APPROVAL_LABELS = {
    Y: "Approved",
    N: "Pending",
};
const SHOP_APPROVAL_REVERSE = {
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
function normalizeLocation(address) {
    if (!address)
        return "";
    const parts = address
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    if (parts.length >= 2) {
        return parts.slice(-2).join(", ");
    }
    return address.trim();
}
function mapSportTypeToDb(label) {
    if (!label)
        return undefined;
    return SPORT_TYPE_REVERSE[label] ?? label;
}
function mapSportTypeToLabel(value) {
    if (!value)
        return "";
    return SPORT_TYPE_LABELS[value] ?? value;
}
function mapStatus(value) {
    if (!value)
        return "inactive";
    const dbValue = mapStatusToDb(value);
    if (dbValue)
        return dbValue;
    const normalized = value.trim().toLowerCase();
    if (normalized && STATUS_REVERSE[normalized]) {
        return STATUS_REVERSE[normalized];
    }
    return normalized || "inactive";
}
function mapStatusToDb(value) {
    if (!value)
        return undefined;
    const normalized = value.trim().toLowerCase();
    return STATUS_REVERSE[normalized] ?? undefined;
}
function mapShopApprovalToLabel(value) {
    if (!value)
        return "Pending";
    return SHOP_APPROVAL_LABELS[value] ?? "Pending";
}
function mapShopApprovalToDb(value) {
    if (!value)
        return undefined;
    const normalized = value.trim().toLowerCase();
    return SHOP_APPROVAL_REVERSE[normalized];
}
function normalizeShopOpen24h(value) {
    if (value === null || value === undefined)
        return undefined;
    const normalized = value.toString().trim().toUpperCase();
    if (!normalized)
        return undefined;
    if (["Y", "1", "TRUE"].includes(normalized))
        return true;
    if (["N", "0", "FALSE"].includes(normalized))
        return false;
    return undefined;
}
const SLOT_INTERVAL_MINUTES = 60;
function timeStringToMinutes(value) {
    const [hourStr, minuteStr] = value.split(":");
    const hours = Number(hourStr);
    const minutes = Number(minuteStr);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes))
        return null;
    return hours * 60 + minutes;
}
function minutesToTimeString(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hh = hours.toString().padStart(2, "0");
    const mm = minutes.toString().padStart(2, "0");
    return `${hh}:${mm}`;
}
function getUtcDayIndex(date) {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed.getUTCDay();
}
function matchesDayOfWeek(dbValue, target) {
    if (!Number.isFinite(dbValue))
        return false;
    if (target === null)
        return false;
    if (dbValue === target)
        return true;
    if (dbValue === 7 && target === 0)
        return true;
    if (dbValue >= 1 && dbValue <= 7 && target === dbValue % 7)
        return true;
    if (dbValue >= 0 && dbValue <= 6 && target === ((dbValue % 7) + 7) % 7)
        return true;
    return false;
}
function buildGeneratedSlots(schedule, playDate) {
    const dayIndex = getUtcDayIndex(playDate);
    if (dayIndex === null)
        return [];
    const matching = schedule.filter((item) => matchesDayOfWeek(Number(item.day_of_week), dayIndex));
    const generated = [];
    matching.forEach((item) => {
        const startMinutes = timeStringToMinutes(item.start_time);
        const endMinutes = timeStringToMinutes(item.end_time);
        if (startMinutes === null ||
            endMinutes === null ||
            endMinutes <= startMinutes) {
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
function generateSyntheticSlotId(fieldCode, playDate, startTime, endTime) {
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
function mapSlotRow(slot) {
    // Check if hold has expired
    let status = slot.status;
    const holdExpiryEpochMs = typeof slot.hold_exp_ts === "number" && !Number.isNaN(slot.hold_exp_ts)
        ? slot.hold_exp_ts * 1000
        : null;
    if (status === "held" && holdExpiryEpochMs !== null) {
        if (Date.now() > holdExpiryEpochMs) {
            status = "available";
        }
    }
    else if (status === "held" && slot.hold_expires_at) {
        // fallback for legacy string
        const holdExpiryTime = new Date(slot.hold_expires_at);
        if (Date.now() > holdExpiryTime.getTime()) {
            status = "available";
        }
    }
    return {
        slot_id: slot.slot_id,
        field_code: slot.field_code,
        quantity_id: slot.quantity_id ?? null,
        quantity_number: slot.quantity_number ?? null,
        play_date: slot.play_date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        status: status,
        hold_expires_at: slot.hold_expires_at,
        hold_expires_at_ts: holdExpiryEpochMs ??
            (slot.hold_expires_at
                ? Math.floor(new Date(slot.hold_expires_at).getTime() / 1000)
                : null),
        is_available: status === "available",
        update_at_ts: typeof slot.update_at_ts === "number" &&
            !Number.isNaN(slot.update_at_ts)
            ? slot.update_at_ts
            : null,
    };
}
const fieldService = {
    async list(params) {
        const page = Math.max(1, Number(params.page) || 1);
        const pageSize = Math.min(50, Math.max(1, Number(params.pageSize) || 12));
        const offset = (page - 1) * pageSize;
        const filters = {
            search: params.search?.trim() || undefined,
            sportType: mapSportTypeToDb(params.sportType),
            location: params.location?.trim() || undefined,
            priceMin: typeof params.priceMin === "number"
                ? params.priceMin
                : params.priceMin
                    ? Number(params.priceMin)
                    : undefined,
            priceMax: typeof params.priceMax === "number"
                ? params.priceMax
                : params.priceMax
                    ? Number(params.priceMax)
                    : undefined,
            fieldCode: typeof params.fieldCode === "number"
                ? params.fieldCode
                : params.fieldCode
                    ? Number(params.fieldCode)
                    : undefined,
            status: mapStatusToDb(params.status),
            shopApproval: mapShopApprovalToDb(params.shopStatus),
            shopCode: typeof params.shopCode === "number"
                ? params.shopCode
                : params.shopCode
                    ? Number(params.shopCode)
                    : undefined,
            shopActive: typeof params.shopActive === "number" ? params.shopActive : 1,
        };
        const pagination = { limit: pageSize, offset };
        const sorting = {
            sortBy: params.sortBy,
            sortDir: params.sortDir,
        };
        try {
            console.log("📋 Fetching fields with filters:", filters);
            // Run main queries first
            const [rows, total] = await Promise.all([
                field_model_1.default.list(filters, pagination, sorting),
                field_model_1.default.count(filters),
            ]);
            console.log(`Got ${rows.length} rows, total: ${total}`);
            // Then run facet queries (less critical)
            const [sportTypesDb, addresses, statusCounts, approvalCounts] = await Promise.all([
                field_model_1.default.listSportTypes(filters).catch(() => []),
                field_model_1.default.listAddresses(filters).catch(() => []),
                field_model_1.default.countByStatus(filters).catch(() => []),
                field_model_1.default.countByShopApproval(filters).catch(() => []),
            ]);
            const items = await this.hydrateRows(rows);
            const sportTypes = Array.from(new Set(sportTypesDb.map((s) => mapSportTypeToLabel(s)))).filter(Boolean);
            const locations = Array.from(new Set(addresses.map((addr) => normalizeLocation(addr)).filter(Boolean)));
            const statusFacet = statusCounts.map((item) => {
                const total = Number(item.total ?? 0);
                const normalizedStatus = mapStatus(item.status ?? undefined);
                return {
                    value: normalizedStatus ?? "unknown",
                    label: (normalizedStatus && STATUS_LABELS[normalizedStatus]) ||
                        normalizedStatus ||
                        "unknown",
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
                        available: statusFacet.find((item) => item.value === "active")?.total ?? 0,
                        maintenance: statusFacet.find((item) => item.value === "maintenance")?.total ??
                            0,
                        booked: statusFacet.find((item) => item.value === "inactive")?.total ?? 0,
                    },
                    shops: {
                        approved: shopApprovalFacet.find((item) => item.value === "Y")?.total ?? 0,
                        pending: shopApprovalFacet.find((item) => item.value === "N")?.total ?? 0,
                    },
                },
                pagination: paginationMeta,
            };
        }
        catch (error) {
            console.error("Error fetching fields:", error);
            throw error;
        }
    },
    async deleteImages(fieldCode, imageCodes, shopCode) {
        if (!Array.isArray(imageCodes) || imageCodes.length === 0)
            return [];
        const field = await field_model_1.default.findById(fieldCode);
        if (!field) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy sân");
        }
        if (shopCode && field.shop_code !== shopCode) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Bạn không có quyền xóa ảnh của sân này");
        }
        const images = await field_model_1.default.getImagesByCodes(fieldCode, imageCodes);
        if (!images.length)
            return [];
        // Try deleting storage objects best-effort
        const deletions = [];
        for (const img of images) {
            const imageUrl = (img.image_url || "").trim();
            if (!imageUrl)
                continue;
            try {
                const parsed = new URL(imageUrl);
                const host = (parsed.host || parsed.hostname || "").toLowerCase();
                if (host.includes("amazonaws.com") || host.includes("s3")) {
                    // Formats supported: https://{bucket}.s3.{region}.amazonaws.com/{key}
                    const pathname = parsed.pathname.replace(/^\/+/, "");
                    const hostParts = parsed.hostname.split(".");
                    const bucketCandidate = hostParts[0];
                    if (bucketCandidate && pathname) {
                        deletions.push(s3_service_1.default
                            .deleteObject(bucketCandidate, pathname)
                            .catch(() => undefined));
                    }
                }
                else if (imageUrl.startsWith("/uploads/") ||
                    imageUrl.startsWith("/public/")) {
                    const absolutePath = path_1.default.join(process.cwd(), imageUrl.replace(/^\/+/, ""));
                    deletions.push(fs_1.promises.unlink(absolutePath).catch(() => undefined));
                }
            }
            catch {
                // Ignore malformed URL
            }
        }
        await Promise.allSettled(deletions);
        await field_model_1.default.deleteImages(fieldCode, imageCodes);
        // Return the field with remaining images hydrated
        return this.getById(fieldCode);
    },
    async deleteFieldForShop(options) {
        const { shopCode, fieldCode } = options;
        const mode = options.mode === "soft" ? "soft" : "hard";
        const shop = await field_model_1.default.findShopByCode(shopCode);
        if (!shop) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy shop");
        }
        const field = await field_model_1.default.findById(fieldCode);
        if (!field || field.shop_code !== shopCode) {
            return null;
        }
        // DELETION POLICY:
        // ✅ CÓ THỂ XÓA SÂN NẾU:
        //    - Không có booking nào, hoặc
        //    - Tất cả bookings đều QUA HẠN (PlayDate < today hoặc EndTime < current_time)
        //
        // ❌ KHÔNG THỂ XÓA NẾU:
        //    - Có booking "trong tương lai" (FUTURE booking):
        //      * PlayDate > today, hoặc
        //      * PlayDate = today nhưng EndTime > current_time
        //      * Status = 'booked' hoặc 'held'
        //
        // Khi xóa sân (nếu được phép):
        // 1. Xóa tất cả Field_Images (images + storage)
        // 2. Xóa tất cả Field_Pricing (pricing schedules)
        // 3. Xóa TẤT CẢ Bookings (bao gồm past + present + cancelled)
        // 4. Xóa Field
        // Check: Có future bookings không?
        const hasFuture = await field_model_1.default.hasFutureBookings(fieldCode);
        if (hasFuture) {
            const err = new apiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, "Đang có đơn đặt, không thể xoá sân.");
            err.code = "FUTURE_BOOKINGS";
            throw err;
        }
        // ✅ KHÔNG CÓ FUTURE BOOKINGS → CÓ THỂ XÓA
        if (mode === "soft") {
            // Soft delete: chỉ cập nhật status, không xóa booking
            const ok = await field_model_1.default.softDeleteField(fieldCode);
            return ok ? { deleted: true } : null;
        }
        try {
            const images = await field_model_1.default.listAllImagesForField(fieldCode);
            const deletions = [];
            for (const img of images) {
                const imageUrl = (img.image_url || "").trim();
                if (!imageUrl)
                    continue;
                try {
                    const parsed = new URL(imageUrl);
                    const host = (parsed.host || parsed.hostname || "").toLowerCase();
                    if (host.includes("amazonaws.com") || host.includes("s3")) {
                        const pathname = parsed.pathname.replace(/^\/+/, "");
                        const bucket = parsed.hostname.split(".")[0];
                        if (bucket && pathname) {
                            deletions.push(s3_service_1.default.deleteObject(bucket, pathname).catch(() => undefined));
                        }
                    }
                    else if (imageUrl.startsWith("/uploads/") ||
                        imageUrl.startsWith("/public/")) {
                        const absolutePath = path_1.default.join(process.cwd(), imageUrl.replace(/^\/+/, ""));
                        deletions.push(fs_1.promises.unlink(absolutePath).catch(() => undefined));
                    }
                }
                catch {
                    // ignore invalid url
                }
            }
            await Promise.allSettled(deletions);
            await field_model_1.default.deleteAllImagesForField(fieldCode);
            await field_model_1.default.deleteAllPricingForField(fieldCode);
            await field_model_1.default.deleteAllBookingsForField(fieldCode);
            const ok = await field_model_1.default.hardDeleteField(fieldCode);
            return ok ? { deleted: true } : null;
        }
        catch (error) {
            const mysqlCode = error?.code;
            const mysqlErrno = Number(error?.errno ?? 0);
            if (mysqlCode === "ER_ROW_IS_REFERENCED_2" ||
                mysqlErrno === 1451) {
                throw new apiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, "Đang có đơn đặt, không thể xoá sân.");
            }
            throw error;
        }
    },
    async getById(fieldCode) {
        const rows = await field_model_1.default.list({ fieldCode }, { limit: 1, offset: 0 }, { sortBy: "name", sortDir: "asc" });
        const items = await this.hydrateRows(rows);
        return items[0] ?? null;
    },
    async getAvailability(fieldCode, playDate, quantityId) {
        const pricingPromise = playDate
            ? field_model_1.default.listPricing(fieldCode)
            : Promise.resolve([]);
        const [slots, pricing] = await Promise.all([
            field_model_1.default.listSlots(fieldCode, playDate, quantityId),
            pricingPromise,
        ]);
        const mappedSlots = slots.map(mapSlotRow);
        const quantitySlotKey = (slot) => `${slot.play_date}|${slot.start_time}|${slot.end_time}|${slot.quantity_id ?? "null"}`;
        const quantitySlotKeys = new Set(mappedSlots
            .filter((slot) => slot.quantity_id !== null)
            .map(quantitySlotKey));
        const baseSlots = mappedSlots.filter((slot) => {
            if (slot.quantity_id === null) {
                if (quantitySlotKeys.has(quantitySlotKey(slot))) {
                    return false;
                }
                const overlapsQuantity = mappedSlots.some((qSlot) => qSlot.quantity_id !== null &&
                    qSlot.play_date === slot.play_date &&
                    qSlot.start_time < slot.end_time &&
                    qSlot.end_time > slot.start_time);
                if (overlapsQuantity) {
                    return false;
                }
            }
            return true;
        });
        const enrichedSlots = [...baseSlots];
        const playDateForDay = playDate;
        if (playDateForDay) {
            const bookingSlots = await field_model_1.default.listBookingSlots(fieldCode, playDateForDay);
            for (const slot of bookingSlots) {
                if (!slot.quantity_id)
                    continue;
                if (slot.booking_slot_status === "cancelled" ||
                    slot.booking_status === "cancelled") {
                    continue;
                }
                let status;
                if (slot.booking_slot_status === "pending") {
                    status = "held";
                }
                else if (slot.booking_slot_status === "booked") {
                    status = "booked";
                }
                else {
                    // fallback: treat pending bookings as held; others skip
                    if (slot.booking_status === "pending") {
                        status = "held";
                    }
                    else if (slot.booking_status === "confirmed") {
                        status = "booked";
                    }
                    else {
                        continue;
                    }
                }
                const syntheticSlot = {
                    slot_id: -Math.abs(1000000 + slot.booking_slot_id),
                    field_code: slot.field_code,
                    quantity_id: slot.quantity_id,
                    quantity_number: slot.quantity_number ?? null,
                    play_date: slot.play_date,
                    start_time: slot.start_time,
                    end_time: slot.end_time,
                    status,
                    hold_expires_at: null,
                    is_available: false,
                    hold_expires_at_ts: null,
                    update_at_ts: null,
                };
                const key = quantitySlotKey(syntheticSlot);
                if (!quantitySlotKeys.has(key)) {
                    quantitySlotKeys.add(key);
                    enrichedSlots.push(syntheticSlot);
                }
            }
        }
        const blockingSlots = enrichedSlots.filter((slot) => slot.status === "booked" || slot.status === "held");
        if (!playDate || !pricing.length) {
            return enrichedSlots;
        }
        const keyFor = (slot) => `${slot.play_date}|${slot.start_time}|${slot.end_time}`;
        const existingByKey = new Map();
        enrichedSlots
            .filter((slot) => slot.play_date === playDate)
            .forEach((slot) => {
            existingByKey.set(keyFor(slot), slot);
        });
        const generatedSlots = buildGeneratedSlots(pricing, playDate)
            .map((slot) => {
            const generated = {
                slot_id: generateSyntheticSlotId(fieldCode, playDate, slot.start_time, slot.end_time),
                field_code: fieldCode,
                quantity_id: null,
                quantity_number: null,
                play_date: playDate,
                start_time: slot.start_time,
                end_time: slot.end_time,
                status: "available",
                hold_expires_at: null,
                is_available: true,
                hold_expires_at_ts: null,
                update_at_ts: null,
            };
            return generated;
        })
            .filter((slot) => {
            const isCoveredByBlocking = blockingSlots.some((blocking) => blocking.play_date === slot.play_date &&
                slot.start_time >= blocking.start_time &&
                slot.end_time <= blocking.end_time);
            if (isCoveredByBlocking) {
                return false;
            }
            return !existingByKey.has(keyFor(slot));
        });
        if (!generatedSlots.length) {
            return enrichedSlots;
        }
        const combined = [...enrichedSlots, ...generatedSlots];
        combined.sort((a, b) => {
            if (a.play_date !== b.play_date) {
                return a.play_date.localeCompare(b.play_date);
            }
            return a.start_time.localeCompare(b.start_time);
        });
        return combined;
    },
    async addImage(fieldCode, file) {
        const existing = await field_model_1.default.findById(fieldCode);
        if (!existing) {
            return null;
        }
        const uploadResult = await s3_service_1.default.uploadFieldImage({
            fieldCode,
            file,
        });
        const imageRecord = await field_model_1.default.createImage(fieldCode, uploadResult.url);
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
    async createForShop(payload, files = []) {
        const shop = await field_model_1.default.findShopByCode(payload.shopCode);
        if (!shop) {
            const error = new Error("SHOP_NOT_FOUND");
            error.code = "SHOP_NOT_FOUND";
            throw error;
        }
        const sportTypeInput = payload.sportType?.trim();
        const sportTypeDbCandidate = mapSportTypeToDb(sportTypeInput) ??
            mapSportTypeToDb(sportTypeInput?.toLowerCase());
        if (!sportTypeDbCandidate ||
            !Object.prototype.hasOwnProperty.call(SPORT_TYPE_LABELS, sportTypeDbCandidate)) {
            const error = new Error("INVALID_SPORT_TYPE");
            error.code = "INVALID_SPORT_TYPE";
            throw error;
        }
        const statusDb = mapStatusToDb(typeof payload.status === "string" ? payload.status : undefined);
        const parsedPrice = Number(payload.pricePerHour);
        if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
            const error = new Error("INVALID_PRICE");
            error.code = "INVALID_PRICE";
            throw error;
        }
        // Validate quantityCount
        const quantityCount = Math.max(1, Number(payload.quantityCount) || 1);
        if (!Number.isFinite(quantityCount) || quantityCount <= 0) {
            const error = new Error("INVALID_QUANTITY_COUNT");
            error.code = "INVALID_QUANTITY_COUNT";
            throw error;
        }
        console.log("[FIELD.SERVICE] Creating field with quantityCount:", {
            received: payload.quantityCount,
            parsed: Number(payload.quantityCount),
            final: quantityCount,
            type: typeof payload.quantityCount,
        });
        const uploadedObjects = [];
        const localStored = [];
        try {
            const fieldCode = await query_1.default.execTransaction("fieldService.createForShop", async (conn) => {
                const newFieldCode = await field_model_1.default.insertField(conn, {
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
                        const upload = await s3_service_1.default.uploadFieldImage({
                            fieldCode: newFieldCode,
                            file,
                        });
                        uploadedObjects.push({ bucket: upload.bucket, key: upload.key });
                        await field_model_1.default.insertFieldImage(conn, {
                            fieldCode: newFieldCode,
                            imageUrl: upload.url,
                            sortOrder: sortOrder++,
                        });
                    }
                    catch (error) {
                        const fallbackMode = (process.env.FIELD_IMAGE_FALLBACK || "").trim().toLowerCase() ||
                            "s3";
                        if (fallbackMode === "local" ||
                            fallbackMode === "filesystem" ||
                            fallbackMode === "fs") {
                            const stored = await localUpload_service_1.default.storeFieldImageLocally(newFieldCode, file);
                            localStored.push(stored);
                            await field_model_1.default.insertFieldImage(conn, {
                                fieldCode: newFieldCode,
                                imageUrl: stored.publicUrl,
                                sortOrder: sortOrder++,
                            });
                            continue;
                        }
                        const message = error?.message || "Không thể tải ảnh lên bộ nhớ S3";
                        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_GATEWAY, `Upload ảnh thất bại: ${message}`);
                    }
                }
                return newFieldCode;
            });
            // AUTO-CREATE FIELD QUANTITIES
            // After field is created, create individual court quantities
            try {
                await fieldQuantity_service_1.default.createQuantitiesForField(fieldCode, quantityCount);
            }
            catch (quantityError) {
                console.error("[FIELD] Error creating quantities:", quantityError);
                // Continue even if quantity creation fails (non-critical)
            }
            return await this.getById(fieldCode);
        }
        catch (error) {
            if (uploadedObjects.length) {
                await Promise.all(uploadedObjects.map((obj) => s3_service_1.default.deleteObject(obj.bucket, obj.key).catch(() => undefined)));
            }
            if (localStored.length) {
                await Promise.all(localStored.map((item) => fs_1.promises.unlink(item.absolutePath).catch(() => undefined)));
            }
            throw error;
        }
    },
    async updateForShop(shopCode, fieldId, payload) {
        const shop = await field_model_1.default.findShopByCode(shopCode);
        if (!shop) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy shop");
        }
        const field = await field_model_1.default.findById(fieldId);
        if (!field || field.shop_code !== shopCode) {
            return null;
        }
        const dataToUpdate = {};
        if (payload.field_name) {
            dataToUpdate.field_name = payload.field_name.trim();
        }
        if (payload.sport_type) {
            const sportTypeDb = mapSportTypeToDb(payload.sport_type);
            if (!sportTypeDb) {
                throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Loại hình thể thao không hợp lệ");
            }
            dataToUpdate.sport_type = sportTypeDb;
        }
        if (payload.address) {
            dataToUpdate.address = payload.address.trim();
        }
        if (payload.price_per_hour !== undefined) {
            const parsedPrice = Number(payload.price_per_hour);
            if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
                throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Giá thuê mỗi giờ không hợp lệ");
            }
            dataToUpdate.price_per_hour = parsedPrice;
        }
        if (payload.status) {
            const statusDb = mapStatusToDb(payload.status);
            if (!statusDb) {
                throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Trạng thái không hợp lệ");
            }
            dataToUpdate.status = statusDb;
        }
        const quantityCountInput = payload.quantity_count;
        if (quantityCountInput !== undefined) {
            const parsedCount = Number(quantityCountInput);
            if (!Number.isInteger(parsedCount) || parsedCount <= 0) {
                throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Số lượng sân phải là số nguyên dương");
            }
            const currentCount = await fieldQuantity_service_1.default.getTotalCount(fieldId);
            if (parsedCount > currentCount) {
                const toAdd = parsedCount - currentCount;
                const maxNumber = await fieldQuantity_service_1.default.getMaxQuantityNumber(fieldId);
                for (let i = 1; i <= toAdd; i++) {
                    await fieldQuantity_model_1.default.create(fieldId, maxNumber + i);
                }
            }
            else if (parsedCount < currentCount) {
                const futureBooked = await fieldQuantity_service_1.default.countFutureBookedQuantities(fieldId);
                if (parsedCount < futureBooked) {
                    throw new apiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, `Đang có ${futureBooked} sân đã được đặt trong tương lai. Không thể giảm xuống thấp hơn ${futureBooked}.`);
                }
                const removableIds = await fieldQuantity_service_1.default.getRemovableQuantityIds(fieldId, currentCount - parsedCount);
                if (removableIds.length < currentCount - parsedCount) {
                    throw new apiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, "Đang có sân được đặt trong tương lai, không thể giảm thêm số lượng.");
                }
                await fieldQuantity_service_1.default.deleteQuantitiesByIds(removableIds);
            }
        }
        if (Object.keys(dataToUpdate).length > 0) {
            const updated = await field_model_1.default.updateField(fieldId, dataToUpdate);
            if (!updated) {
                return null;
            }
        }
        return this.getById(fieldId);
    },
    async getFieldStatsByCode(fieldCode) {
        const [rows] = await query_1.default.query(`
        SELECT
          f.FieldCode,
          f.FieldName,
          f.Rent,
          f.Rent as booking_count,
          f.Status,
          f.DefaultPricePerHour,
          f.SportType,
          s.ShopName,
          s.PhoneNumber,
          (SELECT COUNT(*) FROM Bookings
           WHERE FieldCode = f.FieldCode
           AND BookingStatus = 'confirmed') as confirmed_count,
          (SELECT COUNT(*) FROM Bookings
           WHERE FieldCode = f.FieldCode) as total_bookings
        FROM Fields f
        JOIN Shops s ON f.ShopCode = s.ShopCode
        WHERE f.FieldCode = ?
      `, [fieldCode]);
        return rows?.[0] || null;
    },
    async listFieldsWithRent(shopCode, limit, offset) {
        const [fields] = await query_1.default.query(`
        SELECT
          f.FieldCode,
          f.FieldName,
          f.Rent,
          f.Rent as booking_count,
          f.Status,
          f.DefaultPricePerHour,
          f.SportType,
          s.ShopName
        FROM Fields f
        JOIN Shops s ON f.ShopCode = s.ShopCode
        WHERE f.ShopCode = ?
        ORDER BY f.Rent DESC
        LIMIT ? OFFSET ?
      `, [shopCode, limit, offset]);
        const [countRows] = await query_1.default.query(`SELECT COUNT(*) as total FROM Fields WHERE ShopCode = ?`, [shopCode]);
        return {
            data: fields,
            total: Number(countRows?.[0]?.total ?? 0),
        };
    },
    async syncFieldRent(fieldCode) {
        const [rows] = await query_1.default.query(`
        SELECT COUNT(*) as rent_count
        FROM Bookings
        WHERE FieldCode = ?
          AND BookingStatus = 'confirmed'
      `, [fieldCode]);
        const actualRent = Number(rows?.[0]?.rent_count ?? 0);
        await query_1.default.query(`
        UPDATE Fields
        SET Rent = ?
        WHERE FieldCode = ?
      `, [actualRent, fieldCode]);
        return actualRent;
    },
    async syncAllFieldRents() {
        const [fields] = await query_1.default.query(`SELECT FieldCode FROM Fields`, []);
        let syncedCount = 0;
        if (fields && fields.length > 0) {
            for (const field of fields) {
                const fieldCode = Number(field.FieldCode);
                if (!Number.isFinite(fieldCode) || fieldCode <= 0)
                    continue;
                await this.syncFieldRent(fieldCode);
                syncedCount++;
            }
        }
        return syncedCount;
    },
    async hydrateRows(rows) {
        if (!rows.length)
            return [];
        const fieldCodes = rows.map((row) => row.field_code);
        const [images, quantities] = await Promise.all([
            field_model_1.default.listImages(fieldCodes),
            fieldQuantity_service_1.default.getMultipleFieldQuantities(fieldCodes),
        ]);
        const imagesByField = new Map();
        images.forEach((img) => {
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
        const quantitiesByField = new Map();
        quantities.forEach((qty) => {
            const entry = quantitiesByField.get(qty.field_code) ?? [];
            entry.push({
                quantity_id: qty.quantity_id,
                quantity_number: qty.quantity_number,
                status: qty.status,
            });
            quantitiesByField.set(qty.field_code, entry);
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
            quantityCount: (quantitiesByField.get(row.field_code) ?? []).length,
            shop: {
                shop_code: row.shop_code,
                user_code: row.shop_user_id,
                shop_name: row.shop_name,
                address: row.shop_address ?? "",
                phone_number: row.shop_phone_number ?? "",
                opening_time: row.shop_opening_time ?? null,
                closing_time: row.shop_closing_time ?? null,
                is_open_24h: normalizeShopOpen24h(row.shop_is_open_24h),
                bank_account_number: "",
                bank_name: "",
                isapproved: row.shop_is_approved === "Y" ? 1 : 0,
            },
            quantities: quantitiesByField.get(row.field_code) ?? [],
        }));
    },
};
exports.default = fieldService;
