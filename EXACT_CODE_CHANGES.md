# Exact Code Changes for Delete Field Foreign Key Fix

## File 1: backend/src/models/field.model.ts

### Location: Line 386 (After `hardDeleteField` method)

**Added new method:**

```typescript
async deleteAllPricingForField(fieldCode: number) {
  const query = `
    DELETE FROM Field_Pricing WHERE FieldCode = ?
  `;
  const result = await queryService.execQuery(query, [fieldCode]);
  if (typeof result === "boolean") return result ? 1 : 0;
  return Number((result as ResultSetHeader)?.affectedRows ?? 0);
},
```

**Full context (lines 373-395):**

```typescript
async hardDeleteField(fieldCode: number) {
  const query = `
    DELETE FROM Fields WHERE FieldCode = ?
  `;
  const result = await queryService.execQuery(query, [fieldCode]);
  if (typeof result === "boolean") return result;
  return !!(
    result &&
    typeof (result as ResultSetHeader).affectedRows === "number" &&
    (result as ResultSetHeader).affectedRows > 0
  );
},

// ===== NEW METHOD ADDED =====
async deleteAllPricingForField(fieldCode: number) {
  const query = `
    DELETE FROM Field_Pricing WHERE FieldCode = ?
  `;
  const result = await queryService.execQuery(query, [fieldCode]);
  if (typeof result === "boolean") return result ? 1 : 0;
  return Number((result as ResultSetHeader)?.affectedRows ?? 0);
},
// ============================

async softDeleteField(fieldCode: number) {
  const query = `
    UPDATE Fields SET Status = 'inactive' WHERE FieldCode = ?
  `;
  const result = await queryService.execQuery(query, [fieldCode]);
  if (typeof result === "boolean") return result;
  return !!(
    result &&
    typeof (result as ResultSetHeader).affectedRows === "number" &&
    (result as ResultSetHeader).affectedRows > 0
  );
},
```

---

## File 2: backend/src/services/field.service.ts

### Location: Lines 537-540 (In `deleteFieldForShop` method)

**Original code (BROKEN):**
```typescript
await Promise.allSettled(deletions);

await fieldModel.deleteAllImagesForField(fieldCode);
const ok = await fieldModel.hardDeleteField(fieldCode);
return ok ? { deleted: true } : null;
```

**Fixed code (NEW):**
```typescript
await Promise.allSettled(deletions);

await fieldModel.deleteAllImagesForField(fieldCode);
await fieldModel.deleteAllPricingForField(fieldCode);  // ← NEW LINE
const ok = await fieldModel.hardDeleteField(fieldCode);
return ok ? { deleted: true } : null;
```

**Full context (lines 504-541):**

```typescript
// hard delete: remove images from storage, delete image rows, then delete field
const images = await fieldModel.listAllImagesForField(fieldCode);
const deletions: Promise<unknown>[] = [];
for (const img of images as Array<{ image_url: string }>) {
  const imageUrl = (img.image_url || "").trim();
  if (!imageUrl) continue;
  try {
    const parsed = new URL(imageUrl);
    const host = (parsed.host || parsed.hostname || "").toLowerCase();
    if (host.includes("amazonaws.com") || host.includes("s3")) {
      const pathname = parsed.pathname.replace(/^\/+/, "");
      const bucket = parsed.hostname.split(".")[0];
      if (bucket && pathname) {
        deletions.push(
          s3Service.deleteObject(bucket, pathname).catch(() => undefined)
        );
      }
    } else if (
      imageUrl.startsWith("/uploads/") ||
      imageUrl.startsWith("/public/")
    ) {
      const absolutePath = path.join(
        process.cwd(),
        imageUrl.replace(/^\/+/, "")
      );
      deletions.push(fs.unlink(absolutePath).catch(() => undefined));
    }
  } catch {
    // ignore
  }
}
await Promise.allSettled(deletions);

await fieldModel.deleteAllImagesForField(fieldCode);
await fieldModel.deleteAllPricingForField(fieldCode);  // ← NEW LINE
const ok = await fieldModel.hardDeleteField(fieldCode);
return ok ? { deleted: true } : null;
```

---

## Summary of Changes

| Aspect | Details |
|--------|---------|
| **Files Modified** | 2 files |
| | - backend/src/models/field.model.ts |
| | - backend/src/services/field.service.ts |
| **New Methods** | 1 new method added |
| | - `deleteAllPricingForField()` |
| **Lines Added** | 11 (method) + 1 (function call) = 12 total |
| **Lines Removed** | 0 |
| **Lines Modified** | 1 (service call order) |
| **Breaking Changes** | None |
| **API Changes** | None |
| **Database Changes** | None |

---

## Diff Format

```diff
--- a/backend/src/models/field.model.ts
+++ b/backend/src/models/field.model.ts
@@ -384,6 +384,17 @@
     );
   },
 
+  async deleteAllPricingForField(fieldCode: number) {
+    const query = `
+      DELETE FROM Field_Pricing WHERE FieldCode = ?
+    `;
+    const result = await queryService.execQuery(query, [fieldCode]);
+    if (typeof result === "boolean") return result ? 1 : 0;
+    return Number((result as ResultSetHeader)?.affectedRows ?? 0);
+  },
+
   async softDeleteField(fieldCode: number) {

--- a/backend/src/services/field.service.ts
+++ b/backend/src/services/field.service.ts
@@ -535,6 +535,7 @@
     await Promise.allSettled(deletions);
 
     await fieldModel.deleteAllImagesForField(fieldCode);
+    await fieldModel.deleteAllPricingForField(fieldCode);
     const ok = await fieldModel.hardDeleteField(fieldCode);
     return ok ? { deleted: true } : null;
   },
```

