# Plan 014 — Deploy Blockers (Security & Broken-Flow Fixes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every security hole and broken flow that must be fixed before the CRM is deployed to a public Railway URL (verified findings from the 2026-07-15 external review, package 1).

**Architecture:** Extract the Express app from `index.ts` into `app.ts` so routes become testable with supertest, then fix each blocker TDD-style: close public registration, remove the JWT `"secret"` fallback, re-validate users against the DB on every request, require a shared secret on the mock WhatsApp webhook, recompute `phoneNormalized` on lead edits, fix the notification-bell path mismatch, and open the team list to STAFF.

**Tech Stack:** Express v5 + TypeScript, Prisma v5 + SQLite, Vitest + supertest (new devDep), React 18 frontend. Project rules: no trailing semicolons, singular route names, error shape `{ error: { code, message }, requestId }`, PrismaClient singleton only.

**Out of scope (deliberate):** the `whatsappConsent ?? true` default (owner decision pending — package 3), automation-engine hardening, transactions in `convertLead` (package 2), rate limiting/Helmet/pagination (package 4).

---

## Context for a zero-context engineer

- Backend lives in `chore-app/backend/`, frontend in `chore-app/frontend/`. All backend commands run from `chore-app/backend/`, frontend commands from `chore-app/frontend/`.
- Tests: `npm test` (Vitest) uses a throwaway SQLite DB created by `test/global-setup.ts`; `test/setup.ts` sets env vars before any app import; helpers live in `test/helpers/db.ts` (`resetDb`, `createAdmin`, `createLead`, exported `prisma`).
- `src/index.ts` currently builds the Express app AND starts cron + seeds + listen. Nothing exports the app, so no route-level tests exist yet — Task 1 fixes that.
- Roles are strings (`"ADMIN"`, `"STAFF"`), user status strings (`"ACTIVE"`, `"INACTIVE"`); SQLite has no enums.
- Express v5: async route handlers/middleware may throw — errors propagate natively, no try/catch wrappers.

## Work on a branch

- [ ] From repo root: `git checkout -b feat/deploy-blockers`

---

### Task 1: Extract `app.ts` + supertest smoke test

**Files:**
- Create: `chore-app/backend/src/app.ts`
- Modify: `chore-app/backend/src/index.ts`
- Create: `chore-app/backend/test/app.api.test.ts`
- Modify: `chore-app/backend/package.json` (via npm install)

- [ ] **Step 1: Install supertest**

Run from `chore-app/backend/`:
```bash
npm install -D supertest @types/supertest
```

- [ ] **Step 2: Write the failing smoke test**

Create `chore-app/backend/test/app.api.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import request from "supertest"
import app from "../src/app"

describe("app", () => {
  it("serves /api/health with a requestId", async () => {
    const res = await request(app).get("/api/health")
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.requestId).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `npx vitest run test/app.api.test.ts`
Expected: FAIL — `Cannot find module '../src/app'`

- [ ] **Step 4: Create `src/app.ts`**

Move the app assembly out of `index.ts` verbatim (imports of routes, middleware, mounts, static serving). New file `chore-app/backend/src/app.ts`:

```ts
import express from "express"
import cors from "cors"
import path from "path"
import fs from "fs"
import { requestIdMiddleware } from "./lib/requestId"

import authRoutes from "./routes/auth"
import leadRoutes from "./routes/lead"
import leadIntakeRoutes from "./routes/leadIntake"
import studentRoutes from "./routes/student"
import groupRoutes from "./routes/group"
import trialLessonRoutes from "./routes/trialLesson"
import taskRoutes from "./routes/task"
import reportRoutes from "./routes/report"
import userRoutes from "./routes/user"
import notificationRoutes from "./routes/notification"
import whatsappRoutes from "./routes/whatsapp"
import automationRoutes from "./routes/automation"
import tagRoutes from "./routes/tag"
import calendarRoutes from "./routes/calendar"

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }))
app.use(express.json({ verify: (req, _res, buf) => { (req as express.Request).rawBody = buf } }))
app.use(requestIdMiddleware)

app.get("/api/health", (req, res) => {
  res.json({ ok: true, requestId: req.requestId })
})

app.use("/api/auth", authRoutes)
app.use("/api/lead", leadRoutes)
app.use("/api/lead-intake", leadIntakeRoutes)
app.use("/api/student", studentRoutes)
app.use("/api/group", groupRoutes)
app.use("/api/trial-lesson", trialLessonRoutes)
app.use("/api/task", taskRoutes)
app.use("/api/report", reportRoutes)
app.use("/api/user", userRoutes)
app.use("/api/notification", notificationRoutes)
app.use("/api/whatsapp", whatsappRoutes)
app.use("/api/automation", automationRoutes)
app.use("/api/tag", tagRoutes)
app.use("/api/calendar", calendarRoutes)

// Production: serve the built frontend from the same service (relative /api
// keeps working, no CORS). Skipped in dev, where Vite serves the frontend.
const frontendDist = path.resolve(__dirname, "../../frontend/dist")
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"))
  })
}

export default app
```

- [ ] **Step 5: Slim down `src/index.ts`**

Replace the whole app-assembly section of `chore-app/backend/src/index.ts`. The file keeps: dotenv, cron jobs, seeding, listen. It becomes:

```ts
import dotenv from "dotenv"
dotenv.config()

import cron from "node-cron"
import prisma from "./lib/prisma"
import app from "./app"
import { setLeadStatus } from "./services/lead.service"
import { enqueue, dispatchDue } from "./services/automation.service"
import { seedAdmin } from "./lib/adminSeed"
import { seedAutomation } from "./lib/automationSeed"
import { seedTags } from "./services/tag.service"
import { NO_RESPONSE_AGING_DAYS } from "./lib/pipeline"
```

then keep the two existing `cron.schedule(...)` blocks and the `seedAdmin().then(...)` bootstrap **unchanged** (delete only the moved app-assembly code and its now-unused imports: express, cors, path, fs, requestIdMiddleware, all route imports).

- [ ] **Step 6: Run the smoke test — passes; run the full suite — no regressions**

Run: `npx vitest run test/app.api.test.ts` → PASS
Run: `npm test` → 47 passed (46 existing + 1 new)
Run: `npm run build` → compiles clean

- [ ] **Step 7: Commit**

```bash
git add src/app.ts src/index.ts test/app.api.test.ts package.json package-lock.json
git commit -m "refactor(backend): extract app.ts for route-level testing" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: JWT secret — fail fast, no `"secret"` fallback

**Files:**
- Create: `chore-app/backend/src/lib/jwtSecret.ts`
- Modify: `chore-app/backend/src/routes/auth.ts` (2 sign sites)
- Modify: `chore-app/backend/src/middleware/auth.ts:30`
- Modify: `chore-app/backend/src/index.ts` (startup assertion)
- Create: `chore-app/backend/test/authSecurity.api.test.ts`

- [ ] **Step 1: Write the failing test**

Create `chore-app/backend/test/authSecurity.api.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import jwt from "jsonwebtoken"
import app from "../src/app"
import { getJwtSecret } from "../src/lib/jwtSecret"
import { resetDb, createAdmin } from "./helpers/db"

beforeEach(async () => {
  await resetDb()
})

describe("JWT secret handling", () => {
  it("getJwtSecret throws when JWT_SECRET is missing", () => {
    const saved = process.env.JWT_SECRET
    delete process.env.JWT_SECRET
    try {
      expect(() => getJwtSecret()).toThrow()
    } finally {
      process.env.JWT_SECRET = saved
    }
  })

  it("rejects a token forged with the old fallback secret", async () => {
    const admin = await createAdmin()
    const forged = jwt.sign(
      { userId: admin.id, email: admin.email, role: "ADMIN" },
      "secret",
      { expiresIn: "1h" }
    )
    const res = await request(app)
      .get("/api/notification")
      .set("Authorization", `Bearer ${forged}`)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run test/authSecurity.api.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/jwtSecret'`

- [ ] **Step 3: Create `src/lib/jwtSecret.ts`**

```ts
// Single source of truth for the JWT signing secret. Reading env at call time
// (not module load) keeps test setup and dotenv ordering irrelevant.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET is not set — refusing to sign or verify tokens")
  }
  return secret
}
```

- [ ] **Step 4: Replace all three fallback sites**

In `chore-app/backend/src/routes/auth.ts` add `import { getJwtSecret } from "../lib/jwtSecret"` and replace **both** occurrences of:
```ts
    process.env.JWT_SECRET || "secret",
```
with:
```ts
    getJwtSecret(),
```

In `chore-app/backend/src/middleware/auth.ts` add `import { getJwtSecret } from "../lib/jwtSecret"` and replace:
```ts
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as JwtPayload
```
with:
```ts
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload
```

- [ ] **Step 5: Add the boot-time assertion in `src/index.ts`**

Immediately after `dotenv.config()`:
```ts
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set — refusing to start. Set it in .env / Railway variables.")
  process.exit(1)
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run test/authSecurity.api.test.ts` → PASS (2 tests)
Run: `npm test` → all pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/jwtSecret.ts src/routes/auth.ts src/middleware/auth.ts src/index.ts test/authSecurity.api.test.ts
git commit -m "fix(auth): remove JWT secret fallback, fail fast when unset" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Close public registration (API + UI)

**Files:**
- Modify: `chore-app/backend/src/routes/auth.ts` (delete `/register`)
- Modify: `chore-app/frontend/src/pages/Login.tsx` (remove register flow)
- Modify: `chore-app/backend/test/authSecurity.api.test.ts` (add test)

Admins already create users from the Team page (`POST /api/user`, admin-only) — nothing replaces `/register`; it is simply removed.

- [ ] **Step 1: Write the failing test**

Append to `test/authSecurity.api.test.ts`:
```ts
describe("registration is closed", () => {
  it("returns 404 for POST /api/auth/register", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "intruder@evil.com", password: "hack", name: "פולש" })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run test/authSecurity.api.test.ts`
Expected: the new test FAILS (currently returns 201 — anyone can self-register as STAFF)

- [ ] **Step 3: Delete the register route**

In `chore-app/backend/src/routes/auth.ts` delete the entire `router.post("/register", ...)` block (everything from `router.post("/register"` to its closing `})`). Keep the bcrypt import — `/login` still uses `bcrypt.compare`.

- [ ] **Step 4: Run the test — passes**

Run: `npx vitest run test/authSecurity.api.test.ts` → PASS

- [ ] **Step 5: Remove the register flow from `Login.tsx`**

Replace the full contents of `chore-app/frontend/src/pages/Login.tsx` with:

```tsx
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { GraduationCap } from "lucide-react"
import { useAuth } from "../hooks/useAuth"

interface LoginForm {
  email: string
  password: string
}

export default function Login() {
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      await login(data.email, data.password)
      toast.success("ברוך הבא!")
      navigate("/dashboard")
    } catch {
      toast.error("פרטי התחברות שגויים")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-xl mb-4">
            <GraduationCap className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">INNOKIDS</h1>
          <p className="text-slate-500 text-sm mt-1">מערכת ניהול לידים ותלמידים</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-5">התחברות</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">אימייל</label>
              <input
                type="email"
                {...register("email", { required: "אימייל הוא שדה חובה" })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="you@innokids.co.il"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">סיסמה</label>
              <input
                type="password"
                {...register("password", { required: "סיסמה היא שדה חובה" })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="הזן סיסמה"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? "אנא המתן..." : "התחבר"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
```

(Removed: `isRegister` state, name field, the "אין לך חשבון? הירשם" toggle, the `client.post("/auth/register")` call, and the now-unused `client` import.)

- [ ] **Step 6: Verify frontend compiles**

Run from `chore-app/frontend/`: `npm run build`
Expected: tsc + vite build succeed (unused-import errors would fail the build)

- [ ] **Step 7: Commit**

```bash
git add ../backend/src/routes/auth.ts ../backend/test/authSecurity.api.test.ts src/pages/Login.tsx
git commit -m "fix(auth): remove public self-registration (API + UI)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `authenticate` re-validates the user against the DB

**Files:**
- Modify: `chore-app/backend/src/middleware/auth.ts`
- Create: `chore-app/backend/test/helpers/auth.ts`
- Modify: `chore-app/backend/test/helpers/db.ts` (add `createStaff`)
- Modify: `chore-app/backend/test/authSecurity.api.test.ts` (add tests)

- [ ] **Step 1: Add test helpers**

Create `chore-app/backend/test/helpers/auth.ts`:
```ts
import jwt from "jsonwebtoken"

interface TokenUser {
  id: number
  email: string
  role: string
}

// Mirrors the token shape issued by POST /api/auth/login
export function tokenFor(user: TokenUser): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  )
}
```

Append to `chore-app/backend/test/helpers/db.ts` (before the final `export { prisma }`):
```ts
export async function createStaff() {
  return prisma.user.create({
    data: { email: "staff@test.local", name: "Test Staff", password: "hashed", role: "STAFF" }
  })
}
```

- [ ] **Step 2: Write the failing tests**

Append to `test/authSecurity.api.test.ts` (add `import { tokenFor } from "./helpers/auth"` and add `prisma` to the `./helpers/db` import):
```ts
describe("per-request user re-validation", () => {
  it("rejects a valid token once the user is deactivated", async () => {
    const admin = await createAdmin()
    const token = tokenFor(admin)
    await prisma.user.update({ where: { id: admin.id }, data: { status: "INACTIVE" } })

    const res = await request(app)
      .get("/api/notification")
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(401)
  })

  it("applies a role downgrade immediately, before token expiry", async () => {
    const admin = await createAdmin()
    const token = tokenFor(admin)
    await prisma.user.update({ where: { id: admin.id }, data: { role: "STAFF" } })

    const res = await request(app)
      .post("/api/user")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "new@test.local", password: "pw123456", name: "חדש" })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `npx vitest run test/authSecurity.api.test.ts`
Expected: both new tests FAIL (stale token still honored — deactivated user gets 200, demoted admin gets 201)

- [ ] **Step 4: Rewrite `authenticate`**

Replace the `authenticate` function in `chore-app/backend/src/middleware/auth.ts` (add `import prisma from "../lib/prisma"` at the top; `requireAdmin` stays unchanged):

```ts
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "No token provided" },
      requestId: req.requestId
    })
    return
  }

  const token = authHeader.split(" ")[1]
  let decoded: JwtPayload
  try {
    decoded = jwt.verify(token, getJwtSecret()) as JwtPayload
  } catch {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
      requestId: req.requestId
    })
    return
  }

  // Re-check against the DB so deactivation and role changes take effect
  // immediately instead of surviving until the 7-day token expires
  const user = await prisma.user.findUnique({ where: { id: decoded.userId } })
  if (!user || user.status !== "ACTIVE") {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Account is inactive" },
      requestId: req.requestId
    })
    return
  }

  req.user = { userId: user.id, email: user.email, role: user.role }
  next()
}
```

(Express v5 accepts async middleware natively; SQLite lookup per request is negligible at this scale.)

- [ ] **Step 5: Run tests**

Run: `npx vitest run test/authSecurity.api.test.ts` → PASS
Run: `npm test` → all pass

- [ ] **Step 6: Commit**

```bash
git add src/middleware/auth.ts test/helpers/auth.ts test/helpers/db.ts test/authSecurity.api.test.ts
git commit -m "fix(auth): re-validate user status and role from DB on every request" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Mock WhatsApp webhook requires a shared secret

**Files:**
- Modify: `chore-app/backend/src/services/whatsapp/mock.provider.ts:29-31`
- Modify: `chore-app/backend/test/setup.ts`
- Create: `chore-app/backend/test/whatsappWebhook.api.test.ts`

Design: the cloud provider already verifies Meta's HMAC (`x-hub-signature-256`). The mock provider currently returns `true` unconditionally — on a public URL that lets anyone forge inbound messages. Fix: the mock accepts a request only when the `x-hub-signature-256` header equals `WHATSAPP_APP_SECRET`, and **denies everything when the secret is unset**. Local simulation becomes: `curl -H "x-hub-signature-256: <WHATSAPP_APP_SECRET>" ...`.

- [ ] **Step 1: Add the test env secret**

Append to `chore-app/backend/test/setup.ts`:
```ts
process.env.WHATSAPP_APP_SECRET = "test-app-secret"
```

- [ ] **Step 2: Write the failing test**

Create `chore-app/backend/test/whatsappWebhook.api.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import app from "../src/app"
import { resetDb } from "./helpers/db"

beforeEach(async () => {
  await resetDb()
})

describe("mock webhook authentication", () => {
  it("rejects an unsigned webhook post", async () => {
    const res = await request(app)
      .post("/api/whatsapp/webhook")
      .send({ inbound: [], statuses: [] })
    expect(res.status).toBe(401)
  })

  it("rejects a wrong secret", async () => {
    const res = await request(app)
      .post("/api/whatsapp/webhook")
      .set("x-hub-signature-256", "wrong")
      .send({ inbound: [], statuses: [] })
    expect(res.status).toBe(401)
  })

  it("accepts a post carrying the shared secret", async () => {
    const res = await request(app)
      .post("/api/whatsapp/webhook")
      .set("x-hub-signature-256", "test-app-secret")
      .send({ inbound: [], statuses: [] })
    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)
  })
})
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `npx vitest run test/whatsappWebhook.api.test.ts`
Expected: the two rejection tests FAIL (mock currently accepts everything with 200)

- [ ] **Step 4: Implement**

In `chore-app/backend/src/services/whatsapp/mock.provider.ts` replace:
```ts
  verifySignature(): boolean {
    return true
  }
```
with:
```ts
  // Even in mock mode the public webhook must not be open: require the shared
  // app secret in the signature header. No secret configured -> deny all.
  verifySignature(signatureHeader: string | undefined): boolean {
    return !!this.config.appSecret && signatureHeader === this.config.appSecret
  }
```
Also update the file-top comment from "webhooks accept a simplified shape so inbound/status flows can be simulated with plain curl" to "webhooks accept a simplified shape; simulate with curl -H \"x-hub-signature-256: $WHATSAPP_APP_SECRET\"".

- [ ] **Step 5: Run tests**

Run: `npx vitest run test/whatsappWebhook.api.test.ts` → PASS (3 tests)
Run: `npm test` → all pass (existing automation tests call services directly, not the webhook route — but verify)

- [ ] **Step 6: Commit**

```bash
git add src/services/whatsapp/mock.provider.ts test/setup.ts test/whatsappWebhook.api.test.ts
git commit -m "fix(whatsapp): mock webhook requires shared secret, no longer open" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Lead phone edit recomputes `phoneNormalized`

**Files:**
- Modify: `chore-app/backend/src/routes/lead.ts` (PUT `/:id`)
- Create: `chore-app/backend/test/lead.api.test.ts`

`phoneNormalized` is `@unique` and is the dedup + WhatsApp send key. Today `PUT /api/lead/:id` updates `phone` only, so dedup and sends keep using the old number.

- [ ] **Step 1: Write the failing tests**

Create `chore-app/backend/test/lead.api.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import app from "../src/app"
import { prisma, resetDb, createAdmin, createLead } from "./helpers/db"
import { tokenFor } from "./helpers/auth"

beforeEach(async () => {
  await resetDb()
})

describe("PUT /api/lead/:id phone handling", () => {
  it("recomputes phoneNormalized when phone changes", async () => {
    const admin = await createAdmin()
    const lead = await createLead()

    const res = await request(app)
      .put(`/api/lead/${lead.id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ phone: "052-333-4444" })

    expect(res.status).toBe(200)
    const updated = await prisma.lead.findUnique({ where: { id: lead.id } })
    expect(updated!.phone).toBe("052-333-4444")
    expect(updated!.phoneNormalized).toBe("+972523334444")
  })

  it("returns 409 DUPLICATE_PHONE when the new phone belongs to another lead", async () => {
    const admin = await createAdmin()
    const leadA = await createLead()
    const leadB = await createLead()

    const res = await request(app)
      .put(`/api/lead/${leadA.id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ phone: leadB.phone })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe("DUPLICATE_PHONE")
  })
})
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run test/lead.api.test.ts`
Expected: test 1 FAILS on the `phoneNormalized` assertion (stays the old value); test 2 FAILS (500 from the unique-constraint crash or a 200, depending on Prisma error handling — either way not 409)

- [ ] **Step 3: Implement**

In `chore-app/backend/src/routes/lead.ts`:
1. Ensure the import exists at the top: `import { normalizePhone } from "../lib/phoneNormalizer"` (add if missing).
2. In the `router.put("/:id", ...)` handler, after the `if (!lead) { ...404... }` block, insert:

```ts
  let phoneNormalized: string | undefined
  if (phone) {
    phoneNormalized = normalizePhone(phone)
    const duplicate = await prisma.lead.findUnique({ where: { phoneNormalized } })
    if (duplicate && duplicate.id !== id) {
      res.status(409).json({
        error: { code: "DUPLICATE_PHONE", message: "Another lead already has this phone number" },
        requestId: req.requestId
      })
      return
    }
  }
```

3. In the same handler's `prisma.lead.update` data object, replace:
```ts
      ...(phone && { phone }),
```
with:
```ts
      ...(phone && { phone, phoneNormalized }),
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/lead.api.test.ts` → PASS (2 tests)
Run: `npm test` → all pass

- [ ] **Step 5: Commit**

```bash
git add src/routes/lead.ts test/lead.api.test.ts
git commit -m "fix(lead): recompute phoneNormalized on phone edit, 409 on duplicate" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Fix notification-bell path mismatch

**Files:**
- Modify: `chore-app/frontend/src/components/NotificationBell.tsx:25,32`

Backend mounts `/api/notification` (singular — the project convention). The bell calls `/notifications` (plural) → 404, so in-app notifications never render. Fix the frontend; the backend is the convention-correct side. No frontend test infra exists (documented gap, package 4) — verification is grep + build.

- [ ] **Step 1: Fix the two calls**

In `chore-app/frontend/src/components/NotificationBell.tsx` replace:
```ts
      const { data } = await client.get("/notifications?unreadOnly=true")
```
with:
```ts
      const { data } = await client.get("/notification?unreadOnly=true")
```
and replace:
```ts
    mutationFn: (id: number) => client.put(`/notifications/${id}/read`),
```
with:
```ts
    mutationFn: (id: number) => client.put(`/notification/${id}/read`),
```

- [ ] **Step 2: Verify no plural references remain**

Run from `chore-app/frontend/`: `grep -rn "notifications?" src/ --include=*.tsx --include=*.ts | grep -v queryKey`
Expected: no `client.get`/`client.put` hits on a plural path (queryKey strings like `["notifications"]` are cache keys, not URLs — leave them).

- [ ] **Step 3: Build**

Run from `chore-app/frontend/`: `npm run build` → succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/NotificationBell.tsx
git commit -m "fix(notifications): call /api/notification (singular) — bell was 404ing" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Team list readable by any authenticated user

**Files:**
- Modify: `chore-app/backend/src/routes/user.ts`
- Modify: `chore-app/backend/test/authSecurity.api.test.ts` (add tests)

Seven frontend call sites (`TaskModal`, `TrialLessonModal`, `LeadModal`, `GroupModal`, `Calendar`, `LeadDetails`, `Team`) fetch `/api/user` for assignment dropdowns, but the whole router is behind `requireAdmin` — so for STAFF every one of those flows breaks. Fix: `GET /` requires only authentication; POST/PUT/DELETE keep `requireAdmin` per-route. (Internal tool — exposing teammate names/emails to staff is fine.)

- [ ] **Step 1: Write the failing tests**

Append to `test/authSecurity.api.test.ts` (add `createStaff` to the `./helpers/db` import):
```ts
describe("team list access", () => {
  it("lets STAFF list users for assignment dropdowns", async () => {
    await createAdmin()
    const staff = await createStaff()

    const res = await request(app)
      .get("/api/user")
      .set("Authorization", `Bearer ${tokenFor(staff)}`)
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(2)
  })

  it("still blocks STAFF from creating users", async () => {
    const staff = await createStaff()

    const res = await request(app)
      .post("/api/user")
      .set("Authorization", `Bearer ${tokenFor(staff)}`)
      .send({ email: "x@test.local", password: "pw123456", name: "לא מורשה" })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run test/authSecurity.api.test.ts`
Expected: the STAFF-list test FAILS with 403; the STAFF-create test already passes (regression guard)

- [ ] **Step 3: Implement**

In `chore-app/backend/src/routes/user.ts`:
1. Delete the line `router.use(requireAdmin)` (keep `router.use(authenticate)`).
2. Add a comment above `router.get("/")`:
```ts
// Readable by any authenticated user — assignment dropdowns need the team list.
// Mutations below stay admin-only.
```
3. Add `requireAdmin` as the second argument to the three mutating routes:
```ts
router.post("/", requireAdmin, async (req: Request, res: Response) => {
```
```ts
router.put("/:id", requireAdmin, async (req: Request, res: Response) => {
```
```ts
router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/authSecurity.api.test.ts` → PASS
Run: `npm test` → all pass

- [ ] **Step 5: Commit**

```bash
git add src/routes/user.ts test/authSecurity.api.test.ts
git commit -m "fix(user): allow STAFF to read team list; mutations stay admin-only" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Full verification + docs alignment

**Files:**
- Modify: `codingacademyproject/CLAUDE.md` (API routes table + Key Notes)
- Modify: `chore-app/OWNER_ACTIONS_GUIDE.md` (route 2 env vars)

- [ ] **Step 1: Full backend suite**

Run from `chore-app/backend/`: `npm test`
Expected: all pass (46 pre-existing + ~11 new)

- [ ] **Step 2: Both builds**

Run from `chore-app/backend/`: `npm run build` → clean
Run from `chore-app/frontend/`: `npm run build` → clean

- [ ] **Step 3: Update `CLAUDE.md`**

In the repo-root `CLAUDE.md`:
1. Project structure + API table: change `auth.ts # POST /api/auth/login, /register` to `auth.ts # POST /api/auth/login (registration removed — admins create users)` and the `/api/auth` row from "Login, register" to "Login only".
2. In the routes table, change the `/api/user` row description to "Team management (list: any authenticated; mutations: admin only)".
3. In **Key Notes**, add two bullets:
   - `**Auth hardening:** JWT_SECRET is mandatory (boot fails without it); authenticate re-validates user status/role from the DB per request; public registration removed.`
   - `**Mock webhook auth:** with WHATSAPP_PROVIDER=mock, POST /api/whatsapp/webhook requires header x-hub-signature-256 == WHATSAPP_APP_SECRET.`

- [ ] **Step 4: Update `OWNER_ACTIONS_GUIDE.md` route 2 env list**

In the route-2 service-setup step, extend the env-var line that currently reads `WHATSAPP_PROVIDER=mock`, `AUTOMATION_ENABLED=false` — עד מסלול 3 with: `WHATSAPP_APP_SECRET` (נדרש גם במצב mock — מגן על ה-webhook הציבורי) ו-`WHATSAPP_VERIFY_TOKEN`.

- [ ] **Step 5: Final commit**

```bash
git add ../../CLAUDE.md ../OWNER_ACTIONS_GUIDE.md
git commit -m "docs: align CLAUDE.md and owner guide with auth/webhook hardening" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Push and open PR (per project flow — PRs into master)**

```bash
git push -u origin feat/deploy-blockers
gh pr create --title "fix: deploy blockers — auth hardening, webhook auth, broken flows" --body "Closes package 1 of the 2026-07-15 review: registration closed, JWT fallback removed, per-request user re-validation, mock webhook secret, phoneNormalized on edit, notification bell path, STAFF team-list access.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Verification checklist (after all tasks)

- [ ] `npm test` green from `chore-app/backend/`
- [ ] Both `npm run build`s clean
- [ ] Manual smoke (dev servers up): login works; no register link; bell shows a notification (create one via Prisma Studio or an overdue follow-up); STAFF user can open TaskModal and see the staff dropdown populated; editing a lead's phone updates dedup (try intaking the same number → merges)
- [ ] `git log --oneline` shows ~8 focused commits on `feat/deploy-blockers`
