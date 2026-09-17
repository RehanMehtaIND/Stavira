import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { z } from 'zod';
import { localDb } from './repositories/local';
import { mode, required } from './config';
import { AppError } from './errors';
const client = new CognitoIdentityProviderClient({
  maxAttempts: 2,
  requestHandler: { connectionTimeout: 3000, requestTimeout: 12000 },
});
const inputSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(10).max(128),
  name: z.string().trim().min(1).max(80).optional(),
});
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};
export async function authenticate() {
  const jar = await cookies();
  const token = jar.get('stavira_session')?.value;
  if (!token) throw new AppError(401, 'Please sign in to continue.');
  if (mode() === 'local') {
    const db = localDb();
    try {
      const user = db
        .prepare(
          'SELECT users.id,users.name,users.email FROM sessions JOIN users ON users.id=sessions.userId WHERE token=? AND expires>?',
        )
        .get(digest(token), Date.now());
      if (!user) throw new AppError(401, 'Your session expired. Please sign in.');
      return user as { id: string; name: string; email: string };
    } finally {
      db.close();
    }
  }
  try {
    const verifier = CognitoJwtVerifier.create({
      userPoolId: required('COGNITO_USER_POOL_ID'),
      clientId: required('COGNITO_CLIENT_ID'),
      tokenUse: 'access',
    });
    const payload = await verifier.verify(token);
    return { id: payload.sub, name: jar.get('stavira_name')?.value ?? 'Your workspace', email: '' };
  } catch {
    throw new AppError(401, 'Your session expired. Please sign in.');
  }
}
export async function authAction(action: string, body: unknown) {
  const jar = await cookies();
  const local = mode() === 'local';
  if (action === 'signout') {
    const token = jar.get('stavira_session')?.value;
    if (token) {
      if (local) {
        const db = localDb();
        try {
          db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));
        } finally {
          db.close();
        }
      } else {
        try {
          await client.send(new GlobalSignOutCommand({ AccessToken: token }));
        } catch {}
      }
    }
    for (const name of ['stavira_session', 'stavira_refresh', 'stavira_name']) jar.delete(name);
    return { ok: true };
  }
  if (action === 'refresh') {
    if (local) {
      await authenticate();
      return { ok: true };
    }
    const refresh = jar.get('stavira_refresh')?.value;
    if (!refresh) throw new AppError(401, 'Please sign in.');
    try {
      const result = await client.send(
        new InitiateAuthCommand({
          ClientId: required('COGNITO_CLIENT_ID'),
          AuthFlow: 'REFRESH_TOKEN_AUTH',
          AuthParameters: { REFRESH_TOKEN: refresh },
        }),
      );
      if (!result.AuthenticationResult?.AccessToken) throw new Error('Missing token');
      jar.set('stavira_session', result.AuthenticationResult.AccessToken, {
        ...options,
        maxAge: result.AuthenticationResult.ExpiresIn ?? 3600,
      });
      return { ok: true };
    } catch {
      throw new AppError(401, 'Please sign in again.');
    }
  }
  if (action === 'confirm') {
    const input = z
      .object({ email: z.string().email(), code: z.string().min(1).max(20) })
      .parse(body);
    if (!local)
      await client.send(
        new ConfirmSignUpCommand({
          ClientId: required('COGNITO_CLIENT_ID'),
          Username: input.email,
          ConfirmationCode: input.code,
        }),
      );
    return { ok: true };
  }
  if (!['signup', 'signin'].includes(action)) throw new AppError(404, 'Unknown account action.');
  const input = inputSchema.parse(body);
  if (local) {
    const db = localDb();
    try {
      if (action === 'signup') {
        const salt = randomBytes(16).toString('hex');
        const hash = salt + ':' + scryptSync(input.password, salt, 64).toString('hex');
        try {
          db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
            randomUUID(),
            input.email,
            input.name ?? input.email.split('@')[0],
            hash,
          );
        } catch {
          throw new AppError(409, 'An account with this email already exists. Sign in instead.');
        }
      }
      const user = db.prepare('SELECT * FROM users WHERE email=?').get(input.email);
      const [salt, hash] = String(
        user?.hash ?? 'dummy:' + scryptSync('dummy', 'dummy', 64).toString('hex'),
      ).split(':');
      if (!timingSafeEqual(scryptSync(input.password, salt, 64), Buffer.from(hash, 'hex')) || !user)
        throw new AppError(401, 'Email or password is incorrect.');
      const token = randomBytes(32).toString('hex');
      db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
      db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(
        digest(token),
        user.id,
        Date.now() + 7 * 86400000,
      );
      jar.set('stavira_session', token, { ...options, maxAge: 7 * 86400 });
      return { ok: true };
    } finally {
      db.close();
    }
  }
  try {
    if (action === 'signup') {
      await client.send(
        new SignUpCommand({
          ClientId: required('COGNITO_CLIENT_ID'),
          Username: input.email,
          Password: input.password,
          UserAttributes: [
            { Name: 'email', Value: input.email },
            { Name: 'name', Value: input.name ?? input.email.split('@')[0] },
          ],
        }),
      );
      return { confirm: true };
    }
    const result = await client.send(
      new InitiateAuthCommand({
        ClientId: required('COGNITO_CLIENT_ID'),
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: input.email, PASSWORD: input.password },
      }),
    );
    if (!result.AuthenticationResult?.AccessToken)
      throw new AppError(401, 'Complete account verification before signing in.');
    jar.set('stavira_session', result.AuthenticationResult.AccessToken, {
      ...options,
      maxAge: result.AuthenticationResult.ExpiresIn ?? 3600,
    });
    if (result.AuthenticationResult.RefreshToken)
      jar.set('stavira_refresh', result.AuthenticationResult.RefreshToken, {
        ...options,
        maxAge: 30 * 86400,
      });
    jar.set('stavira_name', input.email.split('@')[0], { ...options, maxAge: 30 * 86400 });
    return { ok: true };
  } catch (e) {
    if (e instanceof AppError) throw e;
    const name = e instanceof Error ? e.name : '';
    if (name === 'UserNotConfirmedException') return { confirm: true };
    throw new AppError(
      400,
      action === 'signup'
        ? 'Could not create account. Use a unique email and a password with upper/lowercase letters, a number, and a symbol.'
        : 'Email or password is incorrect.',
    );
  }
}
