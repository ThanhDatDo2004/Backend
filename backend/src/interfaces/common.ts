export interface IPaging {
  offset?: number;
  limit?: number;
}

export interface ICount {
  cnt?: string; // number
}

export interface IModelList {
  total: number;
  list: any[];
}

export interface IFilter {
  filterName: string;
  filterCode: string;
}

export interface IError {
  status: string;
  message: string; // Nếu lỗi mà không có message thì lấy ReasonPhrases chuẩn theo mã Status Code
  stack: string;
}

export interface IApiSuccessResponse<T = any> {
  success: true;
  statusCode: number;
  message: string;
  data: T | null;
  error: null;
}

export interface IApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  data: null;
  error: IError;
}