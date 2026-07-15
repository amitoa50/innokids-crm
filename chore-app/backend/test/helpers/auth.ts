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
