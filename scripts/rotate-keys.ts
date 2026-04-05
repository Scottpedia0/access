/**
 * Key Rotation Script
 *
 * Re-encrypts all secrets with the current SECRET_ENCRYPTION_KEY.
 * Requires SECRET_ENCRYPTION_KEY_PREVIOUS to be set to the old key
 * so existing secrets can be decrypted during migration.
 *
 * Usage:
 *   1. Generate a new encryption key: openssl rand -base64 32
 *   2. Set SECRET_ENCRYPTION_KEY to the new key
 *   3. Set SECRET_ENCRYPTION_KEY_PREVIOUS to the old key
 *   4. Run: npx tsx scripts/rotate-keys.ts
 *   5. After success, remove SECRET_ENCRYPTION_KEY_PREVIOUS from your env
 *
 * This script is idempotent — secrets already encrypted with the current
 * key are skipped.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Import from source — tsx handles the TypeScript
const { decryptSecretValue, encryptSecretValue, needsReEncryption } = await import("../src/lib/security/encryption");

const prisma = new PrismaClient();

async function main() {
  if (!process.env.SECRET_ENCRYPTION_KEY) {
    console.error("SECRET_ENCRYPTION_KEY is required");
    process.exit(1);
  }

  if (!process.env.SECRET_ENCRYPTION_KEY_PREVIOUS) {
    console.warn(
      "WARNING: SECRET_ENCRYPTION_KEY_PREVIOUS is not set.\n" +
      "If your secrets were encrypted with a different key, decryption will fail.\n" +
      "Set SECRET_ENCRYPTION_KEY_PREVIOUS to the old key and re-run.\n"
    );
  }

  const secrets = await prisma.secret.findMany({
    select: { id: true, label: true, encryptedValue: true },
  });

  console.log(`Found ${secrets.length} secrets to check.\n`);

  let rotated = 0;
  let skipped = 0;
  let failed = 0;

  for (const secret of secrets) {
    const label = secret.label || secret.id;

    if (!needsReEncryption(secret.encryptedValue)) {
      skipped++;
      console.log(`  SKIP  ${label} (already current)`);
      continue;
    }

    try {
      // Decrypt with old or current key
      const plaintext = decryptSecretValue(secret.encryptedValue);

      // Re-encrypt with current key
      const newPayload = encryptSecretValue(plaintext);

      await prisma.secret.update({
        where: { id: secret.id },
        data: { encryptedValue: newPayload },
      });

      rotated++;
      console.log(`  OK    ${label}`);
    } catch (err) {
      failed++;
      console.error(`  FAIL  ${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nDone. Rotated: ${rotated}, Skipped: ${skipped}, Failed: ${failed}`);

  if (failed > 0) {
    console.error("\nSome secrets failed to rotate. Do NOT remove SECRET_ENCRYPTION_KEY_PREVIOUS until all failures are resolved.");
    process.exit(1);
  }

  if (rotated > 0) {
    console.log("\nAll secrets rotated successfully. You can now remove SECRET_ENCRYPTION_KEY_PREVIOUS from your environment.");
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
