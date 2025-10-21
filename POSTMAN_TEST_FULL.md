# 🧪 Postman Test - QuantityCount Debug

## 📋 Test Request

### Request Details
```
Method: POST
URL: http://localhost:5050/api/shops/me/fields
```

### Headers
```
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

### Body (JSON)
```json
{
  "field_name": "Test Quantity Count",
  "sport_type": "badminton",
  "address": "123 Test Street",
  "price_per_hour": 100000,
  "quantity_count": 4
}
```

---

## 🎯 What to Check

### 1️⃣ Response Body
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "field_code": XX,
    "quantities": [
      { "quantity_id": 1, "quantity_number": 1, "status": "available" },
      { "quantity_id": 2, "quantity_number": 2, "status": "available" },
      { "quantity_id": 3, "quantity_number": 3, "status": "available" },
      { "quantity_id": 4, "quantity_number": 4, "status": "available" }
    ]
  }
}
```

✅ Should have 4 items in `quantities` array  
❌ If only 1 item → Backend issue

---

### 2️⃣ Backend Console Logs

**Watch terminal where backend is running:**

```
[FIELD.SERVICE] Creating field with quantityCount: {
  received: 4,
  parsed: 4,
  final: 4,
  type: 'number'
}

[FIELD_QUANTITY.SERVICE] createQuantitiesForField: {
  fieldCode: XX,
  count: 4,
  type: 'number'
}

[FIELD_QUANTITY.SERVICE] bulkCreate result: {
  fieldCode: XX,
  count: 4,
  created: 4
}
```

✅ `received: 4, final: 4, created: 4` → Everything works!  
❌ `created: 1` → Issue with bulkCreate  
❌ `count: undefined` → quantityCount not passed

---

## 🧬 Step-by-Step Test

### Step 1: Start Backend
```bash
cd backend
npm run dev
```

Wait until you see:
```
✓ Database connected
Server running on port 5050
```

### Step 2: Open Postman

1. Create new request
2. Select `POST` method
3. Enter URL: `http://localhost:5050/api/shops/me/fields`

### Step 3: Add Headers

Tab: **Headers**
```
Key: Authorization
Value: Bearer YOUR_TOKEN

Key: Content-Type
Value: application/json
```

### Step 4: Add Body

Tab: **Body** → Select **raw** → Select **JSON**

```json
{
  "field_name": "Test Quantity Count",
  "sport_type": "badminton",
  "address": "123 Test Street",
  "price_per_hour": 100000,
  "quantity_count": 4
}
```

### Step 5: Send Request

Click **Send**

### Step 6: Check Response

Response tab should show:
- ✅ `"success": true`
- ✅ `"statusCode": 201`
- ✅ `"quantities": [...]` with 4 items

### Step 7: Check Backend Console

Terminal should show the debug logs above

---

## 📊 Test Different Quantities

### Test 1: quantity_count = 2
```json
{
  "field_name": "Test 2 Courts",
  "sport_type": "badminton",
  "address": "123 Test",
  "price_per_hour": 100000,
  "quantity_count": 2
}
```
Expected: `quantities` array with 2 items

### Test 2: quantity_count = 1
```json
{
  "field_name": "Test 1 Court",
  "sport_type": "badminton",
  "address": "123 Test",
  "price_per_hour": 100000,
  "quantity_count": 1
}
```
Expected: `quantities` array with 1 item

### Test 3: quantity_count = 5
```json
{
  "field_name": "Test 5 Courts",
  "sport_type": "badminton",
  "address": "123 Test",
  "price_per_hour": 100000,
  "quantity_count": 5
}
```
Expected: `quantities` array with 5 items

---

## 🔍 If Problem Found

### Scenario 1: Always creates 1 quantity
- Check backend console log
- Look at `created:` value
- If `created: 1` but `count: 4` → bulkCreate function issue

### Scenario 2: quantity_count not received
- Check `received:` value in console
- If `undefined` → Frontend not sending `quantity_count`
- Check Network tab in Chrome DevTools

### Scenario 3: Wrong parsing
- If `parsed: NaN` or `parsed: 0` → Type issue
- Check if frontend sends as string vs number

---

## 📝 Checklist

- [ ] Backend running with `npm run dev`
- [ ] Got valid Bearer token
- [ ] Request body has all required fields
- [ ] `quantity_count: 4` in request body
- [ ] Headers include `Authorization` and `Content-Type`
- [ ] Response shows `quantities` array
- [ ] Console shows all 3 debug logs
- [ ] `created` value matches `count` value
- [ ] Field created in database with correct ID

---

## 🎉 Success Criteria

✅ **Everything Works:**
```
1. Response has "quantities" array with correct length
2. Console shows created: 4 (or whatever you sent)
3. Database has 4 rows in Field_Quantity table
4. Each row has QuantityNumber: 1, 2, 3, 4
```

❌ **Something Wrong:**
```
1. quantities array has only 1 item
2. Console shows created: 1
3. Database has only 1 row per field
```

---

## 💡 How to Get Token

If you don't have a valid token:

1. Login endpoint: `POST http://localhost:5050/api/auth/login`
2. Body:
```json
{
  "email": "your@email.com",
  "password": "password"
}
```
3. Response will include `token`
4. Copy token and use in `Authorization` header

---

**Ready? Send the request and share the console logs!** 🚀

