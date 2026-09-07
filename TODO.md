# Data Sync Fix - Network/LAN Multi-client
Status: ✅ In Progress

## Breakdowned Steps from Approved Plan

### Phase 1: Database Layer (server/db.ts)
- [x] 1. Add `serializeClasses()`: Full recursive ClassItem serialization (classes → streams → subjects/students/assessments) with JOINs
  - Query classes → LEFT JOIN streams → subjects/students/assessments
  - Group/nest results into ClassItem structure

### Phase 2: API Endpoints
- [x] 2. app/api/classes/route.ts: 
  - GET: Return `serializeClasses()`
  - POST/PUT: Parse full ClassItem → upsert normalized tables (delete old streams/subjects → insert new)
- [x] 3. app/api/teachers/route.ts & catalog/route.ts: Add console.error logging
- [x] 4. Test API endpoints: `curl` POST full classes → verify DB + GET returns same

### Phase 3: Context Polish
- [x] 5. app/context/SchoolDataContext.tsx:
  - `syncToServer()`: Add try/catch → console.error + rethrow
  - After success: `mutate(key, data, { revalidate: true })`
  - Reduce refreshInterval: 10000 (10s)

### Phase 4: Testing/Validation
- [ ] 6. `pnpm dev`
- [ ] 7. Host: Mutate classes → Check LAN clients refresh (<15s)
- [ ] 8. Restart server → Data persists
- [ ] 9. DB inspect: `sqlite3 data/school.db "SELECT * FROM classes; SELECT * FROM streams;"`
- [ ] 10. Stretch: WebSocket broadcast (optional)
