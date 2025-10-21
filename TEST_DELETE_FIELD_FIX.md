# Test Guide: Delete Field Foreign Key Fix

## How to Test the Fix

### Method 1: Using Frontend UI (http://localhost:5173/shop/fields)

1. **Navigate to Shop Fields Page**
   - Go to http://localhost:5173/shop/fields
   - You should see a list of your shop's fields

2. **Delete a Field**
   - Click "Xóa Sân" (Delete Field) button on any field
   - You should see a success message (previously showed error)
   - The field should disappear from the list

3. **Verify Success**
   - Check browser console (F12) for network requests
   - You should see: `DELETE /api/shops/me/fields/30` returns 200 status
   - Response body should be:
     ```json
     {
       "success": true,
       "statusCode": 200,
       "data": { "deleted": true },
       "error": null,
       "message": "Xóa sân thành công"
     }
     ```

### Method 2: Using Postman/cURL

1. **Get a Field ID to Delete**
   - First, list your fields: `GET /api/shops/me/fields`
   - Note the field ID (e.g., 30)

2. **Delete the Field**
   ```bash
   curl -X DELETE \
     http://localhost:5050/api/shops/me/fields/30 \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json"
   ```

3. **Expected Response (200 OK)**
   ```json
   {
     "success": true,
     "statusCode": 200,
     "data": {
       "deleted": true
     },
     "error": null,
     "message": "Xóa sân thành công"
   }
   ```

### Method 3: Database Verification

1. **Before Deletion**
   ```sql
   SELECT COUNT(*) FROM Field_Pricing WHERE FieldCode = 30;
   SELECT COUNT(*) FROM Field_Images WHERE FieldCode = 30;
   SELECT COUNT(*) FROM Fields WHERE FieldCode = 30;
   ```
   - Should return: 1+ pricing records, possibly images, 1 field

2. **Delete via API**
   - Execute DELETE /api/shops/me/fields/30

3. **After Deletion**
   ```sql
   SELECT COUNT(*) FROM Field_Pricing WHERE FieldCode = 30;
   SELECT COUNT(*) FROM Field_Images WHERE FieldCode = 30;
   SELECT COUNT(*) FROM Fields WHERE FieldCode = 30;
   ```
   - Should return: 0, 0, 0 (all deleted)

## Test Scenarios

### Scenario 1: Delete Field with Pricing Only ✓
- Field 30: Has 5 pricing records, no images
- Expected: All pricing deleted, then field deleted

### Scenario 2: Delete Field with Images and Pricing ✓
- Field 31: Has 3 images and 2 pricing records
- Expected: Images deleted → Pricing deleted → Field deleted

### Scenario 3: Delete Field with Only Images (no pricing) ✓
- Field 32: Has 2 images, no pricing
- Expected: Images deleted → Field deleted

### Scenario 4: Try to Delete Field with Future Bookings ✗
- Field 33: Has bookings scheduled for future dates
- Expected: 409 Conflict error (behavior unchanged)

### Scenario 5: Try to Delete Non-Owned Field ✗
- Field from another shop
- Expected: 403 Forbidden error (behavior unchanged)

## Verification Checklist

- [ ] Can delete field with pricing records
- [ ] Can delete field with images
- [ ] Can delete field with both images and pricing
- [ ] Cannot delete field with future bookings (409 error)
- [ ] Cannot delete field from another shop (403 error)
- [ ] All associated pricing deleted automatically
- [ ] All associated images deleted automatically
- [ ] Frontend list updates correctly
- [ ] No database orphaned records remain
- [ ] API response matches expected format

## Debugging

If you encounter issues:

1. **Check API Response**
   - If still getting 500 error, verify backend restarted
   - Check backend logs for any errors

2. **Verify Database**
   - Ensure Field_Pricing records exist for the field
   - Run: `SELECT * FROM Field_Pricing WHERE FieldCode = 30;`

3. **Check Authorization**
   - Ensure you're deleting your own shop's field
   - Run: `SELECT * FROM Fields WHERE FieldCode = 30;`
   - Verify the ShopCode matches your shop

4. **Restart Backend**
   - Stop the backend server (Ctrl+C)
   - Run: `npm run dev` or `npm start`
   - Try the test again

## Success Indicators

✓ When the fix is working:
- DELETE request returns 200 status
- Response includes `"success": true`
- Field disappears from frontend list
- All associated pricing is removed
- No foreign key constraint errors in logs

