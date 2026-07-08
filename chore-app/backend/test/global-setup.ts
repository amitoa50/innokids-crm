import { execSync } from "child_process"
import fs from "fs"
import { TEST_DB_FILE, TEST_DB_URL } from "./test-db-url"

// Runs once per vitest invocation, in its own process: create a fresh schema
// in the throwaway test database before any test file loads the Prisma client.
export default function globalSetup() {
  for (const suffix of ["", "-journal"]) {
    const file = TEST_DB_FILE + suffix
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }
  execSync("npx prisma db push --skip-generate", {
    cwd: __dirname + "/..",
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "inherit"
  })
}
