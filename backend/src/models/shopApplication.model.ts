import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import queryService from "../core/database";

// ============ TYPES ============
export type ShopRequestPayload = {
  full_name: string;
  email: string;
  phone_number: string;
  address: string;
  message?: string;
};

export type ShopRequestRow = {
  RequestID?: number;
  FullName: string;
  Email: string;
  PhoneNumber: string;
  Address: string;
  Message: string | null;
  Status: string;
  CreatedAt: string;
};

// ============ CONSTANTS ============
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

// ============ SHOP APPLICATION MODEL ============
const shopApplicationModel = {
  /**
   * Ensure inbox table exists
   */
  async ensureInboxTable(connection: PoolConnection): Promise<void> {
    await connection.query(CREATE_TABLE_SQL);
  },

  /**
   * Create shop request (within transaction)
   */
  async createRequest(
    connection: PoolConnection,
    payload: ShopRequestPayload
  ): Promise<{
    request_id: number;
    full_name: string;
    email: string;
    phone_number: string;
    address: string;
    message: string;
    created_at: string;
    status: string;
  }> {
    // Ensure table exists
    await this.ensureInboxTable(connection);

    const [insertResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO Shop_Request_Inbox (
         FullName,
         Email,
         PhoneNumber,
         Address,
         Message,
         Status,
         CreatedAt
       ) VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
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
      request_id: Number(requestId),
      full_name: payload.full_name,
      email: payload.email,
      phone_number: payload.phone_number,
      address: payload.address,
      message: payload.message ?? "",
      created_at: new Date().toISOString(),
      status: "pending",
    };
  },
};

export default shopApplicationModel;
