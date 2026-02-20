
## Delete All Sample Technician Data

This will permanently remove all records from the `technicians` table. No schema changes are needed — this is purely a data cleanup.

### What will be deleted
- All rows in the `technicians` table (the 500 sample/test records)
- No table structure, columns, or settings are changed
- No other tables are affected (activity logs remain intact)

### What will NOT be deleted
- The `technicians` table itself (structure stays)
- ZIP centroid data
- Coverage zones
- User accounts and roles

### Technical Details
A single SQL statement will be executed against the database:
```sql
DELETE FROM public.technicians;
```

This runs with the service role, bypassing RLS, so all rows will be removed regardless of who created them.

### After Deletion
- The Technicians page will show "No technicians found"
- The Coverage Map (Dashboard) will show 0 techs and an empty map
- You can immediately start adding real technician data via the Add Technician form or CSV import
