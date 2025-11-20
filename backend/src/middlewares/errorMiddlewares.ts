import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";

export const errorHandlingMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!err.statusCode) err.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;

  const responseError = {
    status: "error",
    message: err.message || StatusCodes[err.statusCode], 
    stack: err.stack,
  };

  if (process.env.BUILD_MODE !== "dev") delete responseError.stack;

  return apiResponse.error(res, responseError, err.statusCode);
};
