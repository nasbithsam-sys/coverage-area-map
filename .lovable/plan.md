
## Fix Duplicate Phone Number Detection

### Problem
The current duplicate check fetches only 100 technicians and compares client-side. With more than 100 records, duplicates are missed entirely. There's also no database-level enforcement.

### Solution (Two Layers)

**1. Database: Add a unique index on normalized phone numbers**
- Create a unique index on the `phone` column in the `technicians` table
- This guarantees no duplicates can ever be inserted, regardless of client bugs
- The index will only apply to non-null phone values

**2. Fix the client-side check in `TechForm.tsx`**
- Instead of fetching 100 records and filtering in JavaScript, query directly for the specific phone number using `.eq("phone", formattedPhone)`
- This is faster, simpler, and works regardless of table size
- Keep the real-time warning UI and submit blocking as-is

### Technical Details

**Database migration:**
```sql
CREATE UNIQUE INDEX unique_technician_phone 
ON public.technicians (phone) 
WHERE phone IS NOT NULL;
```

**TechForm.tsx change (duplicate check useEffect):**
Replace the current logic that fetches 100 rows and filters client-side with a direct query:
```typescript
const { data } = await supabase
  .from("technicians")
  .select("id, name, phone")
  .eq("phone", formatPhone(phoneValue))
  .neq("id", tech?.id ?? "00000000-0000-0000-0000-000000000000")
  .limit(1);
```

Also add a fallback error handler in `handleSubmit` to catch the unique constraint violation and show a friendly message if somehow the client check is bypassed.

### Files Changed
- Database migration (new unique index)
- `src/components/TechForm.tsx` (fix query + add constraint error handling)
