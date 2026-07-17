// Single source of truth for the JWT signing secret. Reading env at call time
// (not module load) keeps test setup and dotenv ordering irrelevant.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET is not set — refusing to sign or verify tokens")
  }
  return secret
}
