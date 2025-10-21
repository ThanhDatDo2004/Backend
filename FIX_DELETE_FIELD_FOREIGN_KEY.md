# Fix: Delete Field Foreign Key Constraint Issue

## Problem
When attempting to delete a field (DELETE /api/shops/me/fields/:fieldCode), the API was returning a 500 error with the following message:

```
"Cannot delete or update a parent row: a foreign key constraint fails (`thuere`.`Field_Pricing`, CONSTRAINT `FK_FieldPricing_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields` (`FieldCode`))"
```

This occurred because the database has a foreign key constraint between:
- `Fields` table (parent)
- `Field_Pricing` table (child)

The `Field_Pricing` table contains pricing information for each field, and cannot have orphaned references.

## Solution
The fix involves two changes:

### 1. Added `deleteAllPricingForField()` method in field.model.ts
```typescript
async deleteAllPricingForField(fieldCode: number) {
  const query = `
    DELETE FROM Field_Pricing WHERE FieldCode = ?
  `;
  const result = await queryService.execQuery(query, [fieldCode]);
  if (typeof result === "boolean") return result ? 1 : 0;
  return Number((result as ResultSetHeader)?.affectedRows ?? 0);
}
```

This method deletes all pricing records associated with a field.

### 2. Updated `deleteFieldForShop()` in field.service.ts
Modified the deletion sequence to:
1. Delete all images from storage
2. Delete all image database records
3. **Delete all pricing records** (NEW)
4. Delete the field itself

```typescript
await fieldModel.deleteAllImagesForField(fieldCode);
await fieldModel.deleteAllPricingForField(fieldCode);  // NEW LINE
const ok = await fieldModel.hardDeleteField(fieldCode);
```

## Deletion Order
The correct deletion order respects the foreign key constraints:

```
Images (Field_Images) → Field (Fields) ← Pricing (Field_Pricing)
```

All dependent tables must be cleaned up before deleting the parent record:
1. Field_Images → deleted first
2. Field_Pricing → deleted second
3. Fields → deleted last

## Files Modified
- `backend/src/models/field.model.ts` - Added `deleteAllPricingForField()` method
- `backend/src/services/field.service.ts` - Added call to `deleteAllPricingForField()` in deletion sequence

## Testing
After this fix:
- DELETE /api/shops/me/fields/:fieldCode should now work successfully
- All associated pricing records will be automatically deleted
- No foreign key constraint violations should occur
- The response will be: `{ "success": true, "data": { "deleted": true }, "message": "Xóa sân thành công" }`
