import path from "path"

// Single source of truth for the test database location — used by both the
// prisma db push in global-setup (separate process) and the client in setup.ts.
export const TEST_DB_FILE = path.resolve(__dirname, "test.db")
export const TEST_DB_URL = `file:${TEST_DB_FILE}`
