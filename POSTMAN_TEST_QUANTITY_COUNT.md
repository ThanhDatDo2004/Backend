# 🧪 Postman Test - QuantityCount Bug

## 📋 The Issue

**Frontend sends:** `quantityCount` (camelCase) ❌  
**Backend expects:** `quantity_count` (snake_case) ✅  
**Result:** Backend rejects, defaults to 1 ❌

---

## 🔧 Postman Test Setup

### Step 1: Create New Request
- **Method:** `POST`
- **URL:** `http://localhost:5050/api/shops/me/fields`

### Step 2: Headers
```
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

### Step 3: Request Body (Test Both)

#### ❌ WRONG - camelCase (will only get 1 quantity)
```json
{
  "field_name": "Test Field Wrong",
  "sport_type": "badminton",
  "address": "123 Test St",
  "price_per_hour": 100000,
  "quantityCount": 4
}
```

**Result:** Field created with only 1 quantity (defaults to 1)

---

#### ✅ CORRECT - snake_case (will get 4 quantities)
```json
{
  "field_name": "Test Field Correct",
  "sport_type": "badminton",
  "address": "123 Test St",
  "price_per_hour": 100000,
  "quantity_count": 4
}
```

**Result:** Field created with 4 quantities (1, 2, 3, 4)

---

## 🧪 Test Steps

### Test Case 1: Wrong Format
1. Copy ❌ WRONG request above
2. Send POST request
3. Check response
4. Query database: `SELECT * FROM Field_Quantity WHERE FieldCode = <response_field_code>`
5. **Expected:** 1 row with QuantityNumber = 1

### Test Case 2: Correct Format
1. Copy ✅ CORRECT request above
2. Send POST request
3. Check response
4. Query database: `SELECT * FROM Field_Quantity WHERE FieldCode = <response_field_code>`
5. **Expected:** 4 rows with QuantityNumber = 1, 2, 3, 4

---

## 📊 Expected Responses

### Wrong Request Response
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Tạo sân thành công",
  "data": {
    "field_code": 100,
    "quantity_count": 1,  ← Only 1!
    "quantities": [
      { "quantity_id": 1, "quantity_number": 1, "status": "available" }
    ]
  }
}
```

### Correct Request Response
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Tạo sân thành công",
  "data": {
    "field_code": 101,
    "quantity_count": 4,  ← All 4!
    "quantities": [
      { "quantity_id": 1, "quantity_number": 1, "status": "available" },
      { "quantity_id": 2, "quantity_number": 2, "status": "available" },
      { "quantity_id": 3, "quantity_number": 3, "status": "available" },
      { "quantity_id": 4, "quantity_number": 4, "status": "available" }
    ]
  }
}
```

---

## 💡 Key Points

✅ **Field names are case-sensitive!**
- `quantityCount` ≠ `quantity_count`
- Backend uses snake_case naming convention
- Frontend must match exactly!

✅ **All other fields also use snake_case:**
- `field_name` (not `fieldName`)
- `sport_type` (not `sportType`)
- `price_per_hour` (not `pricePerHour`)

---

## 🚀 Share with Frontend

Tell frontend team:
> **ALL API request fields must use snake_case**, not camelCase!
> - ❌ `quantityCount` 
> - ✅ `quantity_count`

