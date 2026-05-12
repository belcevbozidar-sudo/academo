import { SignJWT, importPKCS8 } from "jose";
import type { Id } from "./_generated/dataModel.d.ts";

const issuer = process.env.AUTH_JWT_ISSUER;
const audience = process.env.AUTH_JWT_AUDIENCE;
const privateKeyBase64 = process.env.AUTH_JWT_PRIVATE_KEY_BASE64;
const keyId = process.env.AUTH_JWT_KEY_ID ?? "academo-auth-key";

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required auth environment variable: ${name}`);
  }
  return value;
}

export async function issueAuthToken(args: {
  userId: Id<"users">;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role: string;
}) {
  const resolvedIssuer = requireEnv(issuer, "AUTH_JWT_ISSUER");
  const resolvedAudience = requireEnv(audience, "AUTH_JWT_AUDIENCE");
  const resolvedPrivateKeyBase64 = requireEnv(
    privateKeyBase64,
    "AUTH_JWT_PRIVATE_KEY_BASE64",
  );
  const resolvedPrivateKeyPem = Buffer.from(
    resolvedPrivateKeyBase64,
    "base64",
  ).toString("utf8");

  const signingKey = await importPKCS8(resolvedPrivateKeyPem, "RS256");
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    email: args.email,
    name: args.name,
    given_name: args.firstName,
    family_name: args.lastName,
    role: args.role,
  })
    .setProtectedHeader({
      alg: "RS256",
      kid: keyId,
      typ: "JWT",
    })
    .setIssuer(resolvedIssuer)
    .setAudience(resolvedAudience)
    .setSubject(String(args.userId))
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60 * 12)
    .sign(signingKey);
}
