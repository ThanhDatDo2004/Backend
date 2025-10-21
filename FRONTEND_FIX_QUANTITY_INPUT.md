# 🎨 Frontend Fix - Add QuantityCount Input

## 📌 Problem

Trang `/shop/fields` - khi click "Thêm sân", không có input field để nhập **số lượng sân** (quantityCount).

---

## ✅ Backend Status

**READY!** Backend đã support:

- `POST /api/shops/me/fields` với `quantityCount` parameter
- Tự động tạo Field_Quantity records

---

## 🔧 Frontend Fix Required

### Location

`http://localhost:5173/shop/fields` - Form tạo sân mới

### What to Add

Thêm input field cho **"Số lượng sân"** với các yêu cầu:

```tsx
<input
  type="number"
  name="quantityCount"
  label="Số lượng sân"
  placeholder="Ví dụ: 3"
  min={1}
  max={20}
  defaultValue={1}
  required
/>
```

### Form Fields (Current vs New)

**CURRENT (Thiếu):**

```tsx
<input name="fieldName" placeholder="Tên sân" />
<input name="sportType" placeholder="Loại môn" />
<input name="address" placeholder="Địa chỉ" />
<input name="pricePerHour" type="number" placeholder="Giá" />
// ❌ MISSING: quantityCount
```

**NEEDED (Complete):**

```tsx
<input name="fieldName" placeholder="Tên sân" />
<input name="sportType" placeholder="Loại môn" />
<input name="address" placeholder="Địa chỉ" />
<input name="pricePerHour" type="number" placeholder="Giá" />
<input name="quantityCount" type="number" placeholder="Số lượng sân" min="1" />  ← ADD THIS
```

---

## 📤 API Request (What to Send)

When form is submitted, send:

```json
POST /api/shops/me/fields
{
  "fieldName": "Tennis",
  "sportType": "tennis",
  "address": "123 Nguyen Hue",
  "pricePerHour": 100000,
  "quantityCount": 3    ← NEW!
}
```

---

## 📥 API Response

Backend will return:

```json
{
  "success": true,
  "data": {
    "fieldCode": 1,
    "fieldName": "Tennis",
    "quantityCount": 3,
    "quantities": [
      { "quantityID": 1, "quantityNumber": 1, "status": "available" },
      { "quantityID": 2, "quantityNumber": 2, "status": "available" },
      { "quantityID": 3, "quantityNumber": 3, "status": "available" }
    ]
  }
}
```

---

## 🎯 Implementation Steps

### Step 1: Add Input Field to Form

```tsx
// In the Create Field form component
<FormField>
  <Label>Số lượng sân</Label>
  <input
    type="number"
    name="quantityCount"
    placeholder="Nhập số lượng sân (tối thiểu 1)"
    min={1}
    max={20}
    defaultValue={1}
    required
  />
</FormField>
```

### Step 2: Include in Form Data

```typescript
const formData = {
  fieldName: form.fieldName,
  sportType: form.sportType,
  address: form.address,
  pricePerHour: form.pricePerHour,
  quantityCount: form.quantityCount, // ← ADD THIS
};
```

### Step 3: Send to API

```typescript
const response = await fetch("/api/shops/me/fields", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(formData),
});
```

**⚠️ IMPORTANT:** Make sure `quantity_count` is actually included in the JSON body! Check the Network tab to verify!

### Step 4: Display Quantities in Response

```typescript
// After successful creation
if (response.success) {
  const field = response.data;
  console.log(`Created field with ${field.quantityCount} courts`);
  console.log(`Quantities:`, field.quantities);
  // Show quantities in UI (Sân 1, 2, 3...)
}
```

---

## 📋 Form Example (React)

```tsx
import { useState } from "react";

export function CreateFieldForm() {
  const [formData, setFormData] = useState({
    fieldName: "",
    sportType: "",
    address: "",
    pricePerHour: "",
    quantityCount: 1, // ← NEW!
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "quantityCount" || name === "pricePerHour"
          ? Number(value)
          : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/shops/me/fields", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        console.log("Field created with quantities:", result.data.quantities);
        // Refresh field list or show success message
      }
    } catch (error) {
      console.error("Error creating field:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        name="fieldName"
        placeholder="Tên sân"
        value={formData.fieldName}
        onChange={handleChange}
        required
      />

      <select
        name="sportType"
        value={formData.sportType}
        onChange={handleChange}
        required
      >
        <option value="">Chọn loại môn</option>
        <option value="tennis">Tennis</option>
        <option value="soccer">Bóng</option>
      </select>

      <input
        type="text"
        name="address"
        placeholder="Địa chỉ"
        value={formData.address}
        onChange={handleChange}
      />

      <input
        type="number"
        name="pricePerHour"
        placeholder="Giá/giờ"
        value={formData.pricePerHour}
        onChange={handleChange}
        required
      />

      {/* ✅ ADD THIS INPUT */}
      <input
        type="number"
        name="quantityCount"
        placeholder="Số lượng sân"
        value={formData.quantityCount}
        onChange={handleChange}
        min={1}
        max={20}
        required
      />

      <button type="submit">Thêm sân</button>
    </form>
  );
}
```

---

## ✅ Checklist for Frontend Team

- [ ] Add `quantityCount` input field to Create Field form
- [ ] Include `quantityCount` in form data
- [ ] Send `quantityCount` to backend API
- [ ] Display created quantities in response
- [ ] Show list of courts (Sân 1, 2, 3) after creation
- [ ] Test: Create field with quantityCount = 3
- [ ] Verify: 3 quantities created in backend

---

## 🧪 Testing

### Test Case 1: Create Field with 3 Courts

```
1. Go to /shop/fields
2. Click "Thêm sân"
3. Fill form:
   - Name: "Tennis"
   - Type: "tennis"
   - Price: 100000
   - Quantity: 3        ← NEW FIELD
4. Click Submit
5. Expected: Field created with Sân 1, 2, 3
```

### Test Case 2: Check Field Details

```
1. After field is created
2. View field in list
3. Expected to see:
   - Field name: "Tennis"
   - Number of courts: 3
   - List: Sân 1, Sân 2, Sân 3
```

---

## 🎯 Key Points

✅ **quantityCount** must be sent in request  
✅ **Min value:** 1, **Max value:** 20  
✅ **Default:** 1 (if not provided, still works)  
✅ **Response:** Includes list of quantities created

---

## ❓ Questions?

- Check backend response structure above
- Backend is ready at http://localhost:5050
- Test with Postman if needed

**This is purely frontend UI update needed!** 🎉
