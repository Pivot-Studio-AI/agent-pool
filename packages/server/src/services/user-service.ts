import crypto from 'crypto';
import { query } from '../db/connection.js';
import { encrypt, decrypt } from './crypto.js';

// ─── Minimal JWT ──────────────────────────────────────────────────────

function signJwt(payload: object, secret: string, expiresInSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }),
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string, secret: string): { sub: string; login: string; avatar: string; iat: number; exp: number } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');

  const [header, body, signature] = parts;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');

  if (signature !== expected) throw new Error('Invalid token');

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as {
    sub: string;
    login: string;
    avatar: string;
    iat: number;
    exp: number;
  };

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

// ─── User Types ───────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  github_id: number;
  github_login: string;
  github_avatar_url: string | null;
  github_token: string;
  created_at: string;
}

// ─── Service ──────────────────────────────────────────────────────────

/**
 * Insert or update a user by github_id. Encrypts the GitHub token.
 */
export async function upsertUser(
  githubId: number,
  githubLogin: string,
  githubAvatarUrl: string | null,
  githubToken: string,
): Promise<UserRow> {
  const encryptedToken = encrypt(githubToken);

  const result = await query<UserRow>(
    `INSERT INTO users (github_id, github_login, github_avatar_url, github_token)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (github_id) DO UPDATE
       SET github_login = EXCLUDED.github_login,
           github_avatar_url = EXCLUDED.github_avatar_url,
           github_token = EXCLUDED.github_token
     RETURNING *`,
    [githubId, githubLogin, githubAvatarUrl, encryptedToken],
  );

  return result.rows[0];
}

/**
 * Get a user by id.
 */
export async function getUser(id: string): Promise<UserRow | null> {
  const result = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

/**
 * Fetch the user's GitHub token, decrypted.
 */
export async function getUserGithubToken(userId: string): Promise<string> {
  const result = await query<{ github_token: string }>(
    'SELECT github_token FROM users WHERE id = $1',
    [userId],
  );

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  return decrypt(result.rows[0].github_token);
}

/**
 * Generate a JWT for the given user. Expires in 7 days.
 */
export function generateJwt(user: UserRow): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return signJwt(
    {
      sub: user.id,
      login: user.github_login,
      avatar: user.github_avatar_url,
    },
    secret,
    7 * 24 * 60 * 60, // 7 days
  );
}
