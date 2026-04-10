import crypto from 'crypto';

/**
 * Generate a short, filesystem-safe hash from a string.
 * 12 hex chars = 48 bits = 281 trillion combinations.
 * Collision probability is negligible for < 1M items.
 */
export function shortHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 12);
}
