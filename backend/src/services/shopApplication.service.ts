import queryService from "../core/database";
import shopApplicationModel from "../models/shopApplication.model";

type CreateShopRequestPayload = {
  full_name: string;
  email: string;
  phone_number: string;
  address: string;
  message?: string;
};

const shopApplicationService = {
  async createRequest(payload: CreateShopRequestPayload) {
    const result = await queryService.execTransaction(
      "create_shop_request_inbox",
      async (connection) => {
        return await shopApplicationModel.createRequest(connection, payload);
      }
    );

    return result;
  },
};

export default shopApplicationService;
