import type { AuthConfig } from "convex/server";

const issuer = process.env.AUTH_JWT_ISSUER;
const audience = process.env.AUTH_JWT_AUDIENCE;
const jwks = process.env.AUTH_JWT_PUBLIC_JWKS;

if (!issuer) {
  throw new Error("Missing AUTH_JWT_ISSUER for Convex auth configuration.");
}

if (!audience) {
  throw new Error("Missing AUTH_JWT_AUDIENCE for Convex auth configuration.");
}

if (!jwks) {
  throw new Error("Missing AUTH_JWT_PUBLIC_JWKS for Convex auth configuration.");
}

export default {
  providers: [
    {
      type: "customJwt",
      issuer,
      applicationID: audience,
      jwks,
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
