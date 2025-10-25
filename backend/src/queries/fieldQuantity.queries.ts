export const FIELD_QUANTITY_QUERIES = {
  CREATE: `
    INSERT INTO Field_Quantity (FieldCode, QuantityNumber, Status)
    VALUES (?, ?, 'available')
  `,

  BULK_CREATE: `
    INSERT INTO Field_Quantity (FieldCode, QuantityNumber, Status)
    VALUES {{VALUES}}
  `,

  GET_BY_FIELD_CODE: `
    SELECT
      QuantityID AS quantity_id,
      FieldCode AS field_code,
      QuantityNumber AS quantity_number,
      Status AS status,
      DATE_FORMAT(CreatedAt, '%Y-%m-%d %H:%i:%s') AS created_at,
      DATE_FORMAT(UpdatedAt, '%Y-%m-%d %H:%i:%s') AS updated_at
    FROM Field_Quantity
    WHERE FieldCode = ?
    ORDER BY QuantityNumber ASC
  `,

  GET_BY_ID: `
    SELECT
      QuantityID AS quantity_id,
      FieldCode AS field_code,
      QuantityNumber AS quantity_number,
      Status AS status,
      DATE_FORMAT(CreatedAt, '%Y-%m-%d %H:%i:%s') AS created_at,
      DATE_FORMAT(UpdatedAt, '%Y-%m-%d %H:%i:%s') AS updated_at
    FROM Field_Quantity
    WHERE QuantityID = ?
    LIMIT 1
  `,

  GET_AVAILABLE_QUANTITIES: `
    SELECT
      QuantityID AS quantity_id,
      QuantityNumber AS quantity_number,
      Status AS status
    FROM Field_Quantity
    WHERE FieldCode = ? AND Status = 'available'
    ORDER BY QuantityNumber ASC
  `,

  GET_AVAILABLE_FOR_SLOT: `
    SELECT
      fq.QuantityID AS quantity_id,
      fq.QuantityNumber AS quantity_number,
      fq.Status AS status
    FROM Field_Quantity fq
    WHERE fq.FieldCode = ?
      AND fq.Status = 'available'
      AND fq.QuantityID NOT IN (
        SELECT DISTINCT fs.QuantityID
        FROM Field_Slots fs
        WHERE fs.FieldCode = ?
          AND fs.QuantityID IS NOT NULL
          AND fs.PlayDate = ?
          AND fs.StartTime < ?
          AND fs.EndTime > ?
          AND (
            fs.Status = 'booked'
            OR (fs.Status = 'held' AND (fs.HoldExpiresAt IS NULL OR fs.HoldExpiresAt > NOW()))
          )
      )
    ORDER BY fq.QuantityNumber ASC
  `,

  GET_BOOKED_FOR_SLOT: `
    SELECT DISTINCT
      fs.QuantityID AS quantity_id,
      fq.QuantityNumber AS quantity_number,
      fs.Status AS status
    FROM Field_Slots fs
    INNER JOIN Field_Quantity fq ON fs.QuantityID = fq.QuantityID
    WHERE fs.FieldCode = ?
      AND fs.QuantityID IS NOT NULL
      AND fs.PlayDate = ?
      AND fs.StartTime < ?
      AND fs.EndTime > ?
      AND (
        fs.Status = 'booked'
        OR (fs.Status = 'held' AND (fs.HoldExpiresAt IS NULL OR fs.HoldExpiresAt > NOW()))
      )
    ORDER BY fq.QuantityNumber ASC
  `,

  UPDATE_STATUS: `
    UPDATE Field_Quantity
    SET Status = ?, UpdatedAt = NOW()
    WHERE QuantityID = ?
  `,

  IS_AVAILABLE_FOR_SLOT: `
    SELECT COUNT(*) AS cnt
    FROM Field_Quantity fq
    WHERE fq.QuantityID = ?
      AND fq.Status = 'available'
      AND NOT EXISTS (
        SELECT 1
        FROM Field_Slots fs
        WHERE fs.FieldCode = fq.FieldCode
          AND fs.QuantityID = fq.QuantityID
          AND fs.PlayDate = ?
          AND fs.StartTime < ?
          AND fs.EndTime > ?
          AND (
            fs.Status = 'booked'
            OR (fs.Status = 'held' AND (fs.HoldExpiresAt IS NULL OR fs.HoldExpiresAt > NOW()))
          )
      )
  `,

  GET_COUNT_BY_FIELD_CODE: `
    SELECT COUNT(*) AS cnt
    FROM Field_Quantity
    WHERE FieldCode = ?
  `,

  DELETE_BY_ID: `
    DELETE FROM Field_Quantity WHERE QuantityID = ?
  `,

  DELETE_BY_FIELD_CODE: `
    DELETE FROM Field_Quantity WHERE FieldCode = ?
  `,
};
