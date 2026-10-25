# LPG Fuel Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an editable Thai LPG log for one father's phone and one car, while teaching its owner JavaScript, React, HTTP APIs, and SQL through working increments.

**Architecture:** React/Vite calls an Express REST API through /api. Express queries PostgreSQL with parameterized SQL; in production it also serves the React build on the same origin. A private setup link provisions a remembered device session without a recurring login form.

**Tech Stack:** JavaScript ESM, React, Vite, React Router, plain CSS, Express 5, pg, PostgreSQL 18, Vitest, React Testing Library, Supertest, Playwright.

**Spec:** D:/Personal_Project/lpg-fuel-log/docs/superpowers/specs/2026-10-25-lpg-fuel-log-design.md

**Project root:** D:/Personal_Project/lpg-fuel-log (created by the user; currently contains the project docs)

**Status:** Proposed implementation plan; no application scaffold, dependencies, or project databases have been created by this plan. The recording flow and ability to edit have been discussed with the user. Review this plan with the written design before implementation. Native execution in this chat is the recommended method, in small explained increments.

## Global Constraints

- One user, one phone, one LPG car; Thai, THB, kilometers, liters, Asia/Bangkok.
- JavaScript ESM and plain CSS; no TypeScript, ORM, global state library, account registration, roles, multi-car system, or fuel-efficiency estimate in v1.
- Money is NUMERIC(12,2), liters NUMERIC(10,3); require values > 0 and reject excess decimal precision before SQL. Amount and liters cross the API as decimal strings.
- filled_on is DATE, required and not later than today in Asia/Bangkok. Odometer is optional INTEGER 0..9,999,999. Station max 120 and note max 500 characters.
- Record id is a client-generated UUID reused on retry. Store normalized original creation payload for idempotency even after edits. Mutations commit before successful responses.
- Soft-delete; exclude deleted records from all normal reads and monthly totals. PATCH uses version and DELETE uses If-Match. Stale writes return 409.
- Base Thai text 18px, line-height about 1.6, main button height >=52px, targets >=44x44px, >=8px separation, body-text contrast >=4.5:1. Support 320px widths, zoom and keyboard.
- Existing machine: Node 22.19.0, npm 10.9.3, Git, VS Code, PostgreSQL 18.6 running on 127.0.0.1:5432, installed under D:/PostgreSQL/18 with data D:/PostgreSQL/data/18. Do not reinstall or reinitialize PostgreSQL.
- Runtime dependencies must support Node >=22.12.0; use stable releases, commit lockfiles and inspect npm engine warnings. Do not use force/legacy-peer-deps to hide incompatible packages.
- Keep secrets out of Git, browser bundles, logs and screenshots. Do not print or commit D:/PostgreSQL/private/postgres-admin.xml or its decrypted password.
- No private data may be hosted publicly until device-session authorization is verified. Hosting provider, cost and actual phone/browser are pre-deployment decisions.

## Review Focus

1. A successful save whose response is lost: retry the same id; reconcile before treating a changed draft as a new fill. Task 4 and Task 7 tests.
2. Retry a creation after that row was edited/deleted: compare original payload, never overwrite edits or resurrect rows. Task 4 tests.
3. Thai month boundaries, a blank month, missing odometer, leading/trailing spaces and decimal precision: preserve intended dates and exact totals. Tasks 2, 3 and 6 tests.
4. A stale edit, a failed deletion or a draft restored tomorrow: retain unsaved input, show the real stored date, and never display a false success. Tasks 5 and 7 tests.
5. Direct API calls without a session, cross-origin requests, or a production boot with local-development bypass: deny access. Task 8 tests.

## File structure and ownership

Paths below are relative to the existing project root. Preserve the docs the user has moved here. After implementation approval, check applicable AGENTS.md files and use the worktree skill's environment detection before adding application files. This will be a new independent repo, not a subfolder of another app's repo. If no repo exists, initialize this chosen root without touching neighboring projects; do not manufacture a worktree for a repo that does not exist.

```text
package.json                         npm workspaces, top-level scripts
package-lock.json                    shared resolved dependency versions
.gitignore                           node_modules, dist, secrets, local backups, test output
README.md                            setup, commands, architecture, learning checkpoints
client/package.json                  client dependencies and scripts
client/vite.config.js                React, proxy /api to 127.0.0.1:3001
client/src/main.jsx                  React entry point
client/src/App.jsx                   router, shared navigation, app data refresh
client/src/styles.css                accessible mobile visual tokens and layout
client/src/lib/api.js                credentialed fetch and typed-by-JSDoc API errors
client/src/lib/draft.js              draft lifecycle and pending request identity
client/src/lib/dates.js              Asia/Bangkok today and Thai display helpers
client/src/features/fuel/             form, list, detail/edit, summary and fake API
client/src/test/setup.js              Vitest DOM setup
server/package.json                  Express/pg and node:test scripts
server/src/index.js                  production/development entry and shutdown
server/src/app.js                    Express factory, routes, same-origin static serving
server/src/config.js                 environment validation, loopback-only dev settings
server/src/db.js                     pg pool creation and shutdown
server/src/http/errors.js            request ids and safe JSON error responses
server/src/fuel/validation.js         normalization and query/body validation
server/src/fuel/repository.js         SQL queries and serialization
server/src/fuel/routes.js             HTTP handlers and status mapping
server/src/access/                   setup, sessions, authorization, origin checks
server/test/                         node:test/Supertest and PostgreSQL integration tests
server/.env.example                  non-secret placeholders only
db/migrate.js                        ordered transactional SQL migration runner
db/migrations/001_fuel_logs.sql       initial schema and active-record index
db/migrations/002_device_sessions.sql device access schema
tools/bootstrap-local-db.ps1          generate restricted local app/test roles and .env
tools/backup.ps1                      custom-format backup and restore verification
playwright.config.js                 local-browser end-to-end checks
e2e/fuel-log.spec.js                  primary flows and network failure behavior
docs/learning/                       per-increment explanation and small exercises
docs/operations.md                   device setup, revocation, backup, deploy and recovery
docs/portfolio.md                    honest project story and measured user feedback
```

## Shared contracts

The API uses camelCase; SQL columns use snake_case. Map them in the repository only.

```js
// FuelInput: { id, filledOn, amount, liters, odometer, fullTank, station, note }
// id: UUID; filledOn: YYYY-MM-DD; amount/liters: normalized decimal strings;
// odometer: integer|null; fullTank: boolean; station/note: trimmed string|null.
// FuelLog: FuelInput + { createdAt: ISO string, updatedAt: ISO string, version: integer }
// ListResult: { items: FuelLog[], nextCursor: string|null }
// Summary: { month, amount: string, liters: string, count: number,
//            averagePricePerLiter: string|null }
// Error JSON: { error: { code: string, message: string, fields?: object } }
```

Browser API interface: createFuelApi({baseUrl='/api', fetchImpl=fetch}) returns list({month,limit,cursor}), get(id), create(input), update(id,{...editableFields,version}), remove(id,version), summary(month), accessStatus(), setup(token). All methods return Promises; remove resolves undefined on 204. A fake adapter exposes the same fuel methods for Task 1. ApiError carries status, code and fields. The browser never sends SQL or database passwords.

Root script contract after dependent tasks exist: npm run dev (Vite 127.0.0.1:5173 + Node --watch 127.0.0.1:3001), npm run build, npm test, npm run test:db, npm run test:e2e, npm run db:migrate, npm start. Node reads server/.env using --env-file; no dotenv dependency is required. Root orchestration may use concurrently for dev. The initial client-only dev script grows in Task 4. Client test script is vitest; root npm test runs the client suite plus server validation/config unit tests. test:db explicitly lists database-backed test files and loads server/.env; helpers take TEST_DATABASE_URL, never DATABASE_URL. db:migrate targets DATABASE_URL. test:e2e starts its own isolated server using TEST_DATABASE_URL without rewriting the app's persistent configuration.

## Task 1: A usable React increment with editable sample records

**Files:** Create root/client package files, client/src/{main.jsx,App.jsx,styles.css}, client/src/lib/dates.js, client/src/features/fuel/{FuelForm.jsx,FuelHistory.jsx,FuelDetail.jsx,FuelSummary.jsx,fakeApi.js}, client/src/features/fuel/FuelFlow.test.jsx, docs/learning/01-react.md. Preserve the existing spec and plan under docs/superpowers/; do not copy over or replace them, and do not claim the written design was previously approved.

**Interfaces:** Produce fakeApi implementing the fuel methods above and FuelForm({initialValue,onSubmit,onCancel,pending,error}); App uses React Router paths /, /history, /history/:id, /history/:id/edit, /summary. The user may choose the two-step layout instead; default remains the latest single-page layout until changed explicitly.

- [ ] Scaffold the authorized new repo with npm workspaces and a Vite React JavaScript client. Install React Router and test-only Vitest, jsdom, @testing-library/react, @testing-library/dom, @testing-library/user-event, @testing-library/jest-dom. Keep Vite's ESLint setup. Do not add real credentials. Add only scripts that work at this stage; keep a client-only npm run dev.
- [ ] Write the failing user-flow test before application behavior: fill 500/32.5, save, open history, edit to 550, save; assert one row remains, amount is 550.00 and summary count stays 1. Add cancel-edit test asserting the original 500.00 survives. Run npm run test --workspace client -- --run; expect failures because flow is unimplemented, not because the test environment is broken.
- [ ] Implement the three Thai screens and detail/edit route using accessible labels and a fake in-memory adapter with decimal strings. Show "บันทึกการแก้ไข" for edits; cancel never mutates data. All main numeric input, current date, optional fields and full-tank controls follow the spec. Sample data is visibly labeled as such, with no claim of server persistence.
- [ ] Run the client tests, npm run build --workspace client and lint; inspect at 320/375/768/1024px, keyboard navigation, 200% zoom and mobile keyboard behavior. The form remains reachable with no horizontal overflow. Commit the working increment with no secrets.
- [ ] Explain components, props, state, event handlers, arrays and map through this code in docs/learning/01-react.md; provide one optional exercise (change field help text). Show the user the running increment before moving to API work, without requiring an extra permission gate unless requested.

## Task 2: Local project databases and repeatable schema creation

**Files:** Create tools/bootstrap-local-db.ps1, db/migrate.js, db/migrations/001_fuel_logs.sql, server/{package.json,.env.example}, server/src/db.js, server/test/{db-helpers.js,migrations.test.js}; update root scripts and .gitignore.

**Interfaces:** createPool(connectionString) -> pg.Pool; migrate(pool,migrationsDir) -> Promise<{applied:string[]}>. DATABASE_URL points at lpg_fuel_log; TEST_DATABASE_URL at lpg_fuel_log_test. Test helpers refuse non-loopback hosts or database names not ending _test.

- [ ] Install server pg and test-only supertest. Write migration assertions: fresh test database gets required column types and CHECK constraints; applying twice applies no SQL the second time; a failing migration rolls back and is not recorded. Bootstrap isolated test credentials in the next step before running these tests; an unavailable database is not an acceptable expected failure.
- [ ] Bootstrap two local databases with distinct login roles lpg_app and lpg_test, each owning only its database and neither SUPERUSER/CREATEDB/CREATEROLE/REPLICATION. Read the existing encrypted postgres credential only for this administrative step; generate new role passwords and write ignored server/.env with restrictive ACLs. Stop for inspection if a named database/role already exists; never drop existing data or reinitialize the server. Do not echo passwords or connection strings. Escalate only if reading the protected admin credential requires it.
- [ ] Run node --env-file=server/.env --test server/test/migrations.test.js and observe missing runner/schema failures with the isolated test database reachable. Implement the ordered SQL runner with a schema_migrations table and a transaction per migration; propagate errors and never silently mark failed SQL applied. Create fuel_logs with the exact spec columns, create_payload JSONB, normalized creation fields, version and deleted_at, and its active-record ordering index.
- [ ] Test numeric constraints with 500.00/32.500, zero, negative, optional null odometer and odometer 10,000,000. Excess precision is tested at validation in Task 3 because NUMERIC alone rounds it. Run migration tests and npm run db:migrate; verify repeated migration leaves existing records unchanged. Commit schema/tooling only, never .env or DPAPI credentials.
- [ ] Explain database/table/row, constraints, SQL migrations and separate test data in docs/learning/02-database.md.

## Task 3: Validation and safe request handling

**Files:** Create server/src/fuel/validation.js, server/src/http/errors.js, server/src/config.js, server/test/{validation.test.js,config.test.js}.

**Interfaces:** normalizeCreate(body,{today}) -> FuelInput; normalizeUpdate(body,{today}) -> editable fields + version; parseListQuery(query) -> validated filters; parseMonth(string) -> {month,startDate,endDate}; ApiProblem(status,code,message,fields?). today is YYYY-MM-DD in Asia/Bangkok, injectable in tests. loadConfig(env) returns {env,host,port,appOrigin,databaseUrl,accessMode}; only local-development mode may skip a session and only in development/test on loopback.

- [ ] Write table-driven tests for blank/whitespace money, NaN/Infinity/exponential values, amount "500.001", liters "32.5001", UUIDs, boolean strings, future dates, impossible dates, null odometer, text limits and unknown fields. Assert normalizing " 500 " -> "500.00", "32.5" -> "32.500", blank note -> null. Include a UTC time still on the previous date but already a new day in Bangkok. Test production plus local-development access mode is rejected at boot.
- [ ] Run node --test server/test/validation.test.js server/test/config.test.js and observe intended failures.
- [ ] Implement explicit validation (plain JavaScript), strict decimal string parsing, trimmed optional text and numeric/date limits. Never convert missing odometer to zero. Apply JSON body limit 16kb and generate non-secret request ids in the error boundary when integrating into the app. Reject invalid list limits outside 1..100, malformed month and cursor shape.
- [ ] Rerun these tests and commit. Explain validation at both browser and server and why SQL parameters stay separate from query text in docs/learning/03-validation.md.

## Task 4: Add/read API with safe retries

**Files:** Create server/src/{app.js,index.js}, server/src/fuel/{repository.js,routes.js}, server/test/fuel-create-list.test.js; update client/vite.config.js and root scripts.

**Interfaces:** createApp({pool,config}) -> Express app without listening; index alone listens and handles shutdown. createFuelLog(pool,input) -> {record:FuelLog,created:boolean}; getFuelLog(pool,id) -> FuelLog|null; listFuelLogs(pool,{month,limit,cursor}) -> ListResult. Sort consistently by filled_on DESC, created_at DESC, id DESC; cursor encodes and validates that tuple. Route factory uses Task 3 normalization.

- [ ] Write PostgreSQL-backed HTTP tests for POST201, GET200, optional month, two-page stable ordering for equal dates, invalid cursor/limit, GET404, and invalid fields422. Test concurrent identical POST requests create exactly one row; same id with changed payload409; original payload retry after a SQL-side edit returns the current record without overwriting that edit; original payload retry after deletion409.
- [ ] Run node --env-file=server/.env --test server/test/fuel-create-list.test.js with the guarded TEST_DATABASE_URL and observe intended failures. Tests use only test database records; no real-data cleanup.
- [ ] Implement parameterized repository SQL and normalization-based create_payload comparison in a transaction. Unique id is the database's final duplicate barrier. GET excludes deleted records; idempotent POST returns 200 instead of 201 when it already succeeded. An id collision with different input never modifies the row.
- [ ] Wire routes and safe JSON errors to createApp. Until Task 8, use explicit local-development access mode, listen only on 127.0.0.1 and reject that mode under production. Add /api/health returning no private information and Vite proxy /api to port3001; add top-level dev orchestration.
- [ ] Run the HTTP/database tests plus existing tests. Verify the API and Vite start locally, stop cleanly and never log database passwords. Commit; explain HTTP method/status, JSON, async/await and the React → API → SQL path in docs/learning/04-api.md.

## Task 5: Edit/delete API with version checks

**Files:** Modify server/src/fuel/{repository.js,routes.js}; create server/test/fuel-edit-delete.test.js.

**Interfaces:** updateFuelLog(pool,id,inputWithVersion) -> FuelLog or ApiProblem; deleteFuelLog(pool,id,version) -> void or ApiProblem. PATCH accepts editable fields and a positive integer version; DELETE If-Match is a quoted positive version, e.g. "1". Missing/invalid precondition400, stale live version409, unknown id404; repeated deletion204.

- [ ] Write failing tests: edit 500.00 to 550.00 with version1 returns the same id and version2 with one row; editing old version409; invalid data422; delete requires confirmation at UI (Task 7) and a valid version at API; deleted GET404 and no history row; repeated DELETE204.
- [ ] Run node --env-file=server/.env --test server/test/fuel-edit-delete.test.js and confirm meaningful failures.
- [ ] Implement atomic version-conditional UPDATE and soft-delete transactions. Preserve original create_payload and created_at, update updated_at/version, and use commit-before-response. Do not resurrect a soft-deleted id through PATCH or POST.
- [ ] Run all backend tests, including original creation retries after edits; commit. Explain why an edit updates an existing id rather than inserting another fill in docs/learning/05-editing.md.

## Task 6: Correct monthly summary

**Files:** Modify repository/routes; create server/test/summary.test.js; connect fake adapter's summary behavior to the same DTO shape if necessary.

**Interfaces:** getMonthlySummary(pool,month) -> Summary. GET /api/summary requires valid month=YYYY-MM. Inclusive first date, exclusive next-month first date on filled_on; aggregate active records only. Return fixed-scale amount/liters strings and a two-decimal average string or null for an empty month.

- [ ] Write failing tests with 500.00/32.500 and 450.00/29.200: totals 950.00 and 61.700, count2, weighted average15.40. Put rows on the previous month's last date and next month's first date; exclude both. Empty month returns 0.00/0.000/count0/null. Edit and delete a record and assert aggregates change immediately.
- [ ] Run node --env-file=server/.env --test server/test/summary.test.js to observe failures.
- [ ] Implement NUMERIC SUM/count/division in SQL, not average of per-row rounded prices. Do not use created_at to decide the month. Return 200; invalid month400.
- [ ] Run all backend tests and commit; document date boundaries and weighted average with these numbers in docs/learning/06-summary.md.

## Task 7: Connect React to the real API and preserve unsaved work

**Files:** Create client/src/lib/{api.js,draft.js}, client/src/features/fuel/{useFuelLogs.js,FuelApiFlow.test.jsx}, client/src/lib/draft.test.js; modify App/form/history/detail/summary and retire fake adapter from the default runtime.

**Interfaces:** Use createFuelApi contract above. Draft shape {schemaVersion:1,mode:'create'|'edit',id,input,version?,requestState:'unsent'|'uncertain',submittedInput?}; storage key lpg-fuel-log:draft:v1. readDraft(storage), saveDraft(storage,draft), clearDraft(storage) never store secrets. App invalidates/refetches history and summary after confirmed mutation.

- [ ] Write user-facing tests using a controllable fetch implementation: successful create clears draft; 422 maps field messages; 500/network failure preserves input/id; a repeated button press while pending sends once; uncertain response retries same payload/id. After uncertain save and input changes, GET by id reconciles the prior operation before starting a new UUID. A 404 permits continued creation, a network error keeps the uncertain state, and an existing row is shown with an explicit choice to edit it or start a distinct new fill.
- [ ] Add tests for edit error retaining values, cancel editing unchanged, stale409 retaining work while asking reload, cancel-delete doing nothing, failed-delete preserving the row, and a saved draft restored on a different day retaining its displayed date. Malformed/unknown-version localStorage data is safely ignored; storage-unavailable mode still works and explains draft persistence is unavailable without blocking saving.
- [ ] Run the focused client tests, observe failures, then implement credentialed API calls, form/error state and draft lifecycle. POST only clears when success is confirmed. Display odometer neighbor warnings without blocking historical entry. Show a dedicated "ยืนยันลบรายการ" confirmation with date and money. Date and decimal rules match the server.
- [ ] Run client and backend tests, build, lint, and manually save/edit through local API with dummy data. Verify the same row is still present after browser refresh and SQL data matches. Commit; explain useEffect boundaries, fetch, Promise, loading/error handling and client versus server state in docs/learning/07-integration.md.

## Task 8: Remember the father's device without a recurring login

**Files:** Create db/migrations/002_device_sessions.sql, server/src/access/{repository.js,middleware.js,routes.js}, server/test/access.test.js, tools/access-key.js; modify app/config, client/src/lib/api.js and App; create docs/operations.md.

**Interfaces:** setupDevice(pool,plainSetupToken,config) -> rawSessionToken (returned only inside server code); requireSession middleware hashes the cookie and checks expiry/revocation. Config includes SETUP_TOKEN_HASH and APP_ORIGIN. Setup reads a fragment token, removes it via history.replaceState immediately, then POSTs JSON. accessStatus returns {authorized:boolean}. No username/password form.

- [ ] Write failing tests: missing/invalid/expired/revoked session401 for all data routes; valid setup produces an opaque session and permits access; no raw token in database or errors; production cookie has __Host-fuel_session, Secure, HttpOnly, SameSite=Strict, Path=/ and sliding 180-day expiry. Different/missing Origin, non-JSON mutation and over-limit setup attempts are rejected. Production cannot start with the local-development bypass. Reject invalid setup with a generic response, not timing-leaking equality.
- [ ] Run node --env-file=server/.env --test server/test/access.test.js and observe meaningful failures.
- [ ] Implement SHA-256 storage, random >=32-byte setup/session values, constant-time setup hash comparison, session expiry and revocation. Use maintained Express cookie/rate-limit/security-header helpers as appropriate. Check same-origin on every mutation including setup, rate-limit setup (10/min/IP) and writes (60/min/IP), and return 429 with retry guidance. Disable cross-origin sharing and set private API responses Cache-Control:no-store. Development uses an explicitly named non-__Host cookie without Secure over HTTP; production never inherits that exception.
- [ ] Implement operator commands to generate/rotate setup key and revoke sessions; output secret setup links only to a restricted local file, not test logs or Git. Document rotation must invalidate both the setup link and existing sessions. Document browser-storage clearing and shortcut context may require the owner to set up again. Show father a simple contact-owner message when unprovisioned.
- [ ] Run all API tests under both explicit loopback dev mode and device-session mode. Verify fragment removal before sending and no token in browser storage, links, console or request logs. Commit; explain authentication can exist behind an easy user experience in docs/learning/08-device-access.md.

## Task 9: End-to-end check, deployment preparation and evidence

**Files:** Create playwright.config.js, e2e/fuel-log.spec.js, tools/backup.ps1, docs/portfolio.md; update README, operations and production static serving.

**Interfaces:** Express serves client/dist with SPA fallback outside /api and preserves JSON404 for unknown API routes. npm run build prepares the client; npm start runs production configuration. Backup script uses pg_dump custom format and a dedicated _restore_test database for verification; paths are ignored private .local-backups under the project unless the user chooses another location.

- [ ] Add browser tests for create → refresh → edit → summary → confirmed delete, network failure with draft recovery, and a fresh unauthorized browser context. Use Playwright with the installed Chrome channel initially; no extra browser download is needed unless the chosen environment requires one. Keep automated end-to-end data isolated in the _test database. Run tests once before final fixes to identify real failures.
- [ ] Complete static serving and request-id error handling, then run npm test, npm run test:db, npm run test:e2e, npm run build and lint. Fix only demonstrated failures; retain the results. Inspect 320/375/768/1024px, large text, keyboard, labels, contrast and motion; use real phone trial for keyboard/shortcut context before private deployment.
- [ ] Create a dummy-data backup, restore into a fresh guarded _restore_test database, and compare record counts and aggregate amounts. Refuse to restore onto the app database by default. Document weekly manual backup and backup before migration; store access files and backups outside tracked files with restrictive permissions.
- [ ] Prepare exact hosting configuration for one Node service and managed PostgreSQL with HTTPS; identify provider/cost and any needed user actions before creating external resources. Deploy only within authorization and after the access tests pass. Test installed-shortcut session behavior on the father's actual phone; add a web manifest only if it helps that tested device, with no offline-save promise or service worker cache of private API data.
- [ ] Write README run/test/migrate instructions, architecture, schema, API, limitations and recovery. Use dummy screenshots/video for Portfolio, record real feedback from the father and only measured outcomes. Keep CV claims honest about AI assistance and personal contributions. Commit, perform final whole-change review per the relevant review skill, and hand over the runnable version and learning notes.

## Self-review of this plan

- Spec coverage: mobile/add/history/edit/delete/summary in Tasks 1 and 5–7; SQL and exact data types in Tasks 2–3; repeatable saves in Task 4; remembered access and revocation in Task 8; recovery, phone trial, operations and Portfolio in Task 9.
- Contract consistency: FuelInput/FuelLog camelCase matches all API/client tasks; SQL mapping stays in repository; create/update normalize through Task 3; app factory never listens in tests. Root dev starts client-only first, then adds server when it exists.
- Review Focus: all five listed failure classes have explicit owning test assertions above.
- Execution constraints: application changes remain unstarted until the user reviews the plan/design; no secret files, admin passwords, data directories or existing databases are copied into Git. Do not turn the timing estimate into a promised delivery date.
- Remaining pre-deployment inputs: actual phone/browser, hosting account and budget. These are explicitly outside local implementation and do not require postponing Task 1.

## Reference checks for dependency selection

- [Vite Node requirements](https://vite.dev/guide/)
- [Express 5 Node requirements](https://expressjs.com/en/starter/faq/)
- [Vitest requirements](https://vitest.dev/guide/migration/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [node-postgres parameterized queries](https://node-postgres.com/features/queries)

This document is the proposed implementation plan, not evidence that its tasks or tests have run.
