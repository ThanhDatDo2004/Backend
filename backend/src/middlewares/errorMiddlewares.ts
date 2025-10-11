import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";

export const errorHandlingMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // If the dev is not careful and misses the statusCode, the default will be 500 INTERNAL_SERVER_ERROR
  if (!err.statusCode) err.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;

  // Create a responseError variable to control what to return
  const responseError = {
    status: "error",
    message: err.message || StatusCodes[err.statusCode], // If the error does not have a message, get the standard ReasonPhrases according to the Status Code
    stack: err.stack,
  };

  if (process.env.BUILD_MODE !== "dev") delete responseError.stack;

  // This section can be expanded later, such as writing the Error Log to a file, sending error messages to Slack, Telegram, Email groups...etc. Or you can write a separate Code in another Middleware file depending on the project.
  // ...
  // console.error(responseError)

  // Return responseError to Front-end
  return apiResponse.error(res, responseError, err.statusCode);
};
