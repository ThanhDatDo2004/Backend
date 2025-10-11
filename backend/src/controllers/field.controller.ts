import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import fieldService from "../services/field.service";
import ApiError from "../utils/apiErrors";

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const fieldController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        search,
        sportType,
        location,
        priceMin,
        priceMax,
        page,
        pageSize,
        sortBy,
        sortDir,
      } = req.query;

      const data = await fieldService.list({
        search: typeof search === "string" ? search : undefined,
        sportType: typeof sportType === "string" ? sportType : undefined,
        location: typeof location === "string" ? location : undefined,
        priceMin: toNumber(priceMin),
        priceMax: toNumber(priceMax),
        page: toNumber(page),
        pageSize: toNumber(pageSize),
        sortBy:
          sortBy === "price" || sortBy === "rating" || sortBy === "name"
            ? sortBy
            : undefined,
        sortDir:
          sortDir === "desc" || sortDir === "asc" ? sortDir : undefined,
      });

      return apiResponse.success(
        res,
        data,
        "Fetched fields successfully",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ")
        );
      }

      const field = await fieldService.getById(id);
      if (!field) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân"));
      }

      return apiResponse.success(
        res,
        field,
        "Fetched field successfully",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async availability(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ")
        );
      }

      const date =
        typeof req.query.date === "string" ? req.query.date.trim() : undefined;

      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Định dạng ngày không hợp lệ (YYYY-MM-DD)"
          )
        );
      }

      const slots = await fieldService.getAvailability(id, date);

      return apiResponse.success(
        res,
        { field_code: id, date: date ?? null, slots },
        "Fetched field availability successfully",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },
};

export default fieldController;
