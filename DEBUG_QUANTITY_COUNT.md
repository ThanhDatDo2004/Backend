# 🔍 Debug: QuantityCount Issue

## 📊 Problem
Frontend sends `quantity_count: 4` but backend creates only 1 quantity

---

## 🧪 Test & Debug Steps

### Step 1: Restart Backend with Debug Logs
```bash
cd backend
npm run dev
```

Watch console for these logs:
- `[FIELD.SERVICE] Creating field with quantityCount:`
- `[FIELD_QUANTITY.SERVICE] createQuantitiesForField:`
- `[FIELD_QUANTITY.SERVICE] bulkCreate result:`

### Step 2: Send Postman Request
```json
POST /api/shops/me/fields
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "field_name": "Debug Test",
  "sport_type": "badminton",
  "address": "Test Address",
  "price_per_hour": 100000,
  "quantity_count": 4
}
```

### Step 3: Check Console Output
Look for these logs:

```
[FIELD.SERVICE] Creating field with quantityCount: {
  received: 4,
  parsed: 4,
  final: 4,
  type: 'number'
}

[FIELD_QUANTITY.SERVICE] createQuantitiesForField: {
  fieldCode: 63,
  count: 4,
  type: 'number'
}

[FIELD_QUANTITY.SERVICE] bulkCreate result: {
  fieldCode: 63,
  count: 4,
  created: 4
}
```

---

## 🎯 Expected Scenarios

### ✅ CORRECT
If `created: 4` → backend created 4 quantities ✅  
Response should have `quantities` array with 4 items

### ❌ WRONG
If `created: 1` → something wrong with bulkCreate  
If `count: undefined` → quantityCount not being passed correctly

---

## 🔧 If Issue Still Exists

### Check 1: Frontend Sending Correct Field Name?
```
Request body must have: "quantity_count" (snake_case)
NOT: "quantityCount" (camelCase)
```

### Check 2: Verify Controller Schema
```typescript
// backend/src/controllers/shopField.controller.ts line 17-25
quantity_count: z.coerce
  .number()
  .int()
  .positive("Số lượng sân phải lớn hơn 0")
  .optional()
  .default(1),
```

### Check 3: Verify Controller Passes Value
```typescript
// backend/src/controllers/shopField.controller.ts line 164-174
await fieldService.createForShop(
  {
    // ...
    quantityCount: parsed.data.quantity_count,  // ← CHECK THIS
  },
  files
);
```

---

## 📝 Full Debug Checklist

- [ ] Backend console shows logs
- [ ] `received` value matches what you sent
- [ ] `parsed` value is a number
- [ ] `final` value equals your quantity count
- [ ] `createQuantitiesForField` receives correct count
- [ ] `created` result equals count
- [ ] Response includes `quantities` array with correct length
- [ ] Database has N rows in Field_Quantity table

