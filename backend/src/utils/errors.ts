import { StatusCodes } from "http-status-codes";
import ApiError from "./apiErrors";

export const badRequest  = (msg = "Bad Request")  => new ApiError(StatusCodes.BAD_REQUEST, msg);
export const unauthorized= (msg = "Unauthorized") => new ApiError(StatusCodes.UNAUTHORIZED, msg);

export { default as ApiError } from "./apiErrors";
