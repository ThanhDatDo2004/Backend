import fieldModel, {
  FieldFilters,
  FieldPagination,
  FieldSorting,
} from "../models/field.model";

type ListParams = {
  search?: string;
  sportType?: string;
  location?: string;
  priceMin?: number;
  priceMax?: number;
  fieldCode?: number;
  page?: number;
  pageSize?: number;
  sortBy?: "price" | "rating" | "name";
  sortDir?: "asc" | "desc";
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

const STATUS_LABELS: Record<string, string> = {
  active: "trống",
  maintenance: "bảo trì",
  inactive: "đã đặt",
};

function normalizeLocation(address?: string | null) {
  if (!address) return "";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
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
  return STATUS_LABELS[value] ?? value;
}

const fieldService = {
  async list(params: ListParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number(params.pageSize) || 12)
    );
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
    };

    const pagination: FieldPagination = { limit: pageSize, offset };
    const sorting: FieldSorting = {
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    };

    const [rows, total, sportTypesDb, addresses] = await Promise.all([
      fieldModel.list(filters, pagination, sorting),
      fieldModel.count(filters),
      fieldModel.listSportTypes(filters),
      fieldModel.listAddresses(filters),
    ]);

    const items = await this.hydrateRows(rows);

    const sportTypes = Array.from(
      new Set(sportTypesDb.map((s) => mapSportTypeToLabel(s)))
    ).filter(Boolean);
    const locations = Array.from(
      new Set(addresses.map((addr) => normalizeLocation(addr)).filter(Boolean))
    );

    return {
      items,
      total,
      page,
      pageSize,
      facets: {
        sportTypes: sportTypes.sort((a, b) => a.localeCompare(b, "vi")),
        locations: locations.sort((a, b) => a.localeCompare(b, "vi")),
      },
    };
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
    const slots = await fieldModel.listSlots(fieldCode, playDate);
    return slots.map((slot) => ({
      slot_id: slot.slot_id,
      field_code: slot.field_code,
      play_date: slot.play_date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      status: slot.status,
      hold_expires_at: slot.hold_expires_at,
      is_available: slot.status === "available",
    }));
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
