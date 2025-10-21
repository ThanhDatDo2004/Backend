# 🐛 Debug: QuantityCount Not Being Sent

## ❌ Problem

Frontend chọn `quantityCount = 4` nhưng backend chỉ nhận được `1`

---

## 🎯 Root Cause

**FIELD NAME MISMATCH:**

- Frontend sends: `quantityCount` (camelCase) ❌
- Backend expects: `quantity_count` (snake_case) ✅

Because backend rejects unknown field `quantityCount`, it gets undefined → defaults to 1!

---

## ✅ Solution

### Step 1: Check Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Fill form and click "Thêm sân"
4. Find the POST request to `/api/shops/me/fields`
5. Click on it → View Request Body
6. **Verify `quantity_count` is there!**

**Expected:**

```json
{
  "field_name": "Thành Đạt 4",
  "sport_type": "cầu lông",
  "address": "123 Lê Lợi",
  "price_per_hour": 20000,
  "quantity_count": 4     ← ✅ MUST BE snake_case!
}
```

---

### Step 2: Debug Form Data

Add this to your form submission:

```typescript
const handleSubmit = async (e) => {
  e.preventDefault();

  const formData = {
    field_name: form.fieldName,
    sport_type: form.sportType,
    address: form.address,
    price_per_hour: form.pricePerHour,
    quantity_count: form.quantityCount, // ← MUST BE snake_case!
  };

  // 🔍 DEBUG: Log to console
  console.log("📤 Sending form data:", formData);
  console.log("📊 quantity_count value:", form.quantity_count);
  console.log("📊 quantity_count type:", typeof form.quantity_count);

  const response = await fetch("/api/shops/me/fields", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });

  const result = await response.json();
  console.log("📥 Response:", result);
};
```

---

### Step 3: Common Issues

**Issue 1: Using camelCase instead of snake_case** ⚠️ MAIN ISSUE

```typescript
// ❌ WRONG - Backend rejects quantityCount
const formData = {
  quantityCount: 4, // ← Backend doesn't recognize this!
};

// ✅ CORRECT - Use snake_case
const formData = {
  quantity_count: 4, // ← Backend accepts this!
};
```

**Issue 2: Form field value is string instead of number**

```typescript
// ❌ WRONG
quantity_count: form.quantityCount; // string "4"

// ✅ CORRECT
quantity_count: Number(form.quantityCount); // number 4
```

**Issue 3: Form field is empty/undefined**

```typescript
// ❌ WRONG
quantity_count: form.quantityCount; // undefined → backend defaults to 1

// ✅ CORRECT
quantity_count: form.quantityCount || 1; // fallback to 1
```

**Issue 4: Input field not included in form**

```jsx
// ❌ WRONG - Input exists but not in form submission
<input name="quantityCount" type="number" min={1} max={20} />;
// (missing from handleSubmit!)

// ✅ CORRECT - Input is captured and sent
const handleSubmit = (e) => {
  const quantity = e.target.elements.quantityCount.value;
  // ... send quantity
};
```

---

## 🧪 Test Checklist

- [ ] Input field captured with correct name
- [ ] **Field name is `quantity_count` (snake_case), NOT camelCase** ⚠️
- [ ] Input has `type="number"`
- [ ] Input has `min={1}` validation
- [ ] Form submission uses `quantity_count: form.quantityCount`
- [ ] Console shows correct value before sending
- [ ] Network tab shows `quantity_count` in request body
- [ ] Backend creates N rows in Field_Quantity table
- [ ] QuantityNumber values are 1, 2, 3, 4, ...

---

## 📝 Example: Complete Form (React)

```tsx
export function CreateFieldForm() {
  const [form, setForm] = useState({
    field_name: '',
    sport_type: '',
    address: '',
    price_per_hour: '',
    quantity_count: 1  // ← Use snake_case in state!
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'quantity_count' || name === 'price_per_hour'
        ? Number(value)
        : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ IMPORTANT: Use quantity_count (snake_case) in request!
    const formData = {
      field_name: form.field_name,
      sport_type: form.sport_type,
      address: form.address,
      price_per_hour: form.price_per_hour,
      quantity_count: form.quantity_count  // ← snake_case!
    };

    console.log('📤 Form data:', formData);  // DEBUG

    const response = await fetch('/api/shops/me/fields', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Created with quantities:', result.data.quantities);
      // Show success message
      alert(`Created field with ${form.quantity_count} courts`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        name="field_name"
        placeholder="Tên sân"
        value={form.field_name}
        onChange={handleChange}
        required
      />

      <select
        name="sport_type"
        value={form.sport_type}
        onChange={handleChange}
        required
      >
        <option value="">Chọn loại môn</option>
        <option value="badminton">Cầu lông</option>
        <option value="football">Bóng đá</option>
        <option value="tennis">Tennis</option>
      </select>

      <input
        type="text"
        name="address"
        placeholder="Địa chỉ"
        value={form.address}
        onChange={handleChange}
        required
      />

      <input
        type="number"
        name="price_per_hour"
        placeholder="Giá/giờ"
        value={form.price_per_hour}
        onChange={handleChange}
        required
      />

      <input
        type="number"
        name="quantity_count"           ← KEY: Use snake_case!
        placeholder="Số lượng sân"
        value={form.quantity_count}
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

## 🔗 Backend API Acceptance

✅ Backend accepts:

- JSON request with `quantity_count` field (snake_case!)
- Type: number, min: 1, default: 1
- Creates N rows in Field_Quantity table with QuantityNumber = 1 to N

```json
POST /api/shops/me/fields
Content-Type: application/json

{
  "field_name": "Thành Đạt 4",
  "sport_type": "badminton",
  "address": "123 Lê Lợi, Quận 1",
  "price_per_hour": 20000,
  "quantity_count": 4
}

RESPONSE:
{
  "success": true,
  "data": {
    "field_code": 55,
    "quantity_count": 4,
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

## ❓ Need More Help?

- Check Console for errors
- Check Network tab Request Body
- **MOST IMPORTANT: Use `quantity_count` (snake_case), not `quantityCount` (camelCase)**
- Test with Postman first if unsure
