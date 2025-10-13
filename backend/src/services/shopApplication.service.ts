import { ResultSetHeader } from "mysql2";
import queryService from "./query";

type CreateShopRequestPayload = {
  full_name: string;
  email: string;
  phone_number: string;
  address: string;
  message?: string;
};

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS Shop_Request_Inbox (
    RequestID INT AUTO_INCREMENT PRIMARY KEY,
    FullName VARCHAR(255) NOT NULL,
    Email VARCHAR(190) NOT NULL,
    PhoneNumber VARCHAR(30) NOT NULL,
    Address VARCHAR(255) NOT NULL,
    Message TEXT NULL,
    Status ENUM('pending','reviewed','approved','rejected') NOT NULL DEFAULT 'pending',
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const shopApplicationService = {
  async createRequest(payload: CreateShopRequestPayload) {
    const result = await queryService.execTransaction(
      "create_shop_request_inbox",
      async (connection) => {
        await connection.query(CREATE_TABLE_SQL);

        const [insertResult] = await connection.query<ResultSetHeader>(
          `
            INSERT INTO Shop_Request_Inbox (
              FullName,
              Email,
              PhoneNumber,
              Address,
              Message,
              Status,
              CreatedAt
            ) VALUES (?, ?, ?, ?, ?, 'pending', NOW())
          `,
          [
            payload.full_name,
            payload.email,
            payload.phone_number,
            payload.address,
            payload.message ?? "",
          ]
        );

        const requestId = insertResult.insertId;

        return {
          request_id: requestId,
          full_name: payload.full_name,
          email: payload.email,
          phone_number: payload.phone_number,
          address: payload.address,
          message: payload.message ?? "",
          created_at: new Date().toISOString(),
          status: "pending" as const,
        };
      }
    );

    return result;
  },
};

export default shopApplicationService;
