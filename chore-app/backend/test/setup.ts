import { TEST_DB_URL } from "./test-db-url"

// Runs before each test file, before any application import: point the Prisma
// singleton at the throwaway test DB and force the mock WhatsApp provider.
process.env.DATABASE_URL = TEST_DB_URL
process.env.WHATSAPP_PROVIDER = "mock"
process.env.JWT_SECRET = "test-secret"
process.env.AUTOMATION_ENABLED = "false"
