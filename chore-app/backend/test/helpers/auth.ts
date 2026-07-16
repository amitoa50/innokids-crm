import jwt from "jsonwebtoken"
import { getJwtSecret } from "../../src/lib/jwtSecret"

interface TokenUser {
  id: number
  email: string
  role: string
}

// Mirrors the token shape issued by POST /api/auth/login
export function tokenFor(user: TokenUser): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: "1h" }
  )
}
