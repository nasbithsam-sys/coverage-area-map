

## Fix: Restore Activity Log Tab in Admin Dashboard

The Activity Log tab was accidentally removed from `src/pages/Admin.tsx` when cleaning up admin logging. The backend table and RLS policies are still in place — only the UI tab is missing.

### Changes to `src/pages/Admin.tsx`

1. **Add back the "Activity" tab** in the TabsList alongside Analytics, Coverage Zones, and Role Management.
2. **Fetch activity logs** in the `fetchAll` function from the `activity_log` table, joined with profile info to show who performed each action.
3. **Render a table** in the Activity TabsContent showing:
   - Timestamp (formatted with `date-fns`)
   - User name/email
   - Action type
   - Entity type
   - Details (JSON)
4. **Re-add necessary imports**: `date-fns` format, Table components, Badge.

No database or backend changes needed — the `activity_log` table and RLS policies already exist and allow admins to read all logs.

