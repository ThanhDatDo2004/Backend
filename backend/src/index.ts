import compression from "compression";
import cors from "cors";

import helmet from "helmet";
import express, { NextFunction, Request, Response } from "express";
import ApiError from "./utils/apiErrors";
import { errorHandlingMiddleware } from "./middlewares/errorMiddlewares";
import morgan from "morgan";
const app = express();
const allowedOrigins = ["http://localhost:5173"];
// sau này deploy thì thêm "https://ten-mien-cua-ban.com"

const corsOptions: cors.CorsOptions = {
  origin: allowedOrigins,
  credentials: true, // nếu dùng cookie; nếu không dùng cookie thì có thể bỏ
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
// Cho phép preflight
//use pakage
app.use(express.json());
app.use(morgan("dev"));
app.use(helmet());
app.use(compression());

//routes

const PORT = process.env.PORT || 5050;

import authRouter from "./routes/auth.routes";
import fieldRouter from "./routes/field.routes";

app.use("/api/auth", authRouter);
app.use("/api/fields", fieldRouter);
//error handler 404
app.use((req: Request, res: Response, next: NextFunction) => {
  const error = new ApiError(404, `Not Found - ${req.originalUrl}`);
  next(error); // đẩy vào errorHandlingMiddleware
});
app.use(errorHandlingMiddleware);
//error handler
app.listen(PORT, () => {
  console.log("Server is running on ", process.env.HOST + ":" + PORT);
});
