import { AuthSessionSchema } from '../schemas/auth-session.schema';
import { Types } from 'mongoose';
import { SessionService } from '../services/session.service';
import { TokenService } from '../services/token.service';
import { UnauthorizedException } from '@nestjs/common';
jest.mock('uuid', () => ({ v4: () => new (require('mongoose').Types.ObjectId)().toString() }));

const equal = (a: any, b: any) => a == null && b == null || String(a) === String(b);
function matches(row: any, filter: any): boolean {
  return Object.entries(filter).every(([key, value]: [string, any]) => {
    if (key === '$or') return value.some((f: any) => matches(row, f));
    if (value && value.$gt) return row[key] > value.$gt;
    return equal(row[key], value);
  });
}
function memoryModel() {
  const rows: any[] = [];
  const query = (value: any) => Object.assign(Promise.resolve(value), {
    select: () => query(value), lean: () => Promise.resolve(value), exec: () => Promise.resolve(value),
  });
  return { rows,
    create: jest.fn(async (input: any) => {
      if (rows.some(r => input._id && equal(r._id, input._id))) throw Object.assign(new Error('duplicate'), { code: 11000 });
      const row = { _id: new Types.ObjectId(), revoked_at: null, parent_session_id: null,
        impersonation_session_id: null, is_revoked: false, createdAt: new Date(), last_active_at: new Date(), ...input };
      rows.push(row); return { ...row };
    }),
    findOne: jest.fn((f: any) => query(rows.find(r => matches(r, f)) ? { ...rows.find(r => matches(r, f)) } : null)),
    find: jest.fn((f: any) => query(rows.filter(r => matches(r, f)).map(r => ({ ...r })))),
    findOneAndUpdate: jest.fn(async (f: any, update: any) => { const row = rows.find(r => matches(r, f));
      if (!row) return null; Object.assign(row, update.$set); return { ...row }; }),
    updateMany: jest.fn(async (f: any, update: any) => { rows.filter(r => matches(r, f)).forEach(r => Object.assign(r, update.$set)); }),
    updateOne: jest.fn(async (f: any, update: any) => { const row = rows.find(r => matches(r, f)); if (row) Object.assign(row, update.$set); }),
  };
}

describe('Session families and refresh integration', () => {
  let families: ReturnType<typeof memoryModel>, leases: ReturnType<typeof memoryModel>, tokens: ReturnType<typeof memoryModel>;
  let service: SessionService, tokenService: TokenService, logs: any, userId: Types.ObjectId, users: any, impersonation: any;
  beforeEach(() => {
    families = memoryModel(); leases = memoryModel(); tokens = memoryModel(); logs = { create: jest.fn().mockResolvedValue({}) };
    service = new SessionService(families as any, leases as any, logs);
    userId = new Types.ObjectId(); users = { findById: jest.fn(() => ({ exec: async () => ({ _id: userId, status: 'active' }) })) };
    impersonation = { validateSession: jest.fn().mockResolvedValue({}) };
    tokenService = new TokenService(tokens as any, users, { sign: (p: any) => JSON.stringify(p) } as any, impersonation, service);
  });
  const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };
  const login = async (svc: TokenService, id: Types.ObjectId, remember = true) => svc.createRefreshToken(id, remember ? 30 : 1, remember);

  it('returns one persisted replacement while another candidate write is delayed', async () => {
    const original = await login(tokenService, userId);
    const other = await login(tokenService, userId);
    const gate = deferred(); const entered = deferred(); const create = tokens.create.getMockImplementation()!;
    tokens.create.mockImplementationOnce(async input => { entered.resolve(); await gate.promise; return create(input); });
    const first = tokenService.refreshToken(original); await entered.promise;
    const second = await tokenService.refreshToken(original); gate.resolve(); const result = await first;
    expect(result.refresh_token).toBe(second.refresh_token);
    expect(tokens.rows.some(r => r.token === result.refresh_token)).toBe(true);
    await expect(tokenService.refreshToken(result.refresh_token)).resolves.toBeDefined();
    await expect(tokenService.refreshToken(other)).resolves.toBeDefined();
    expect(families.rows.every(r => !r.revoked_at)).toBe(true);
  });

  it('does not lose the old credential after a candidate write failure', async () => {
    const original = await login(tokenService, userId);
    tokens.create.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(tokenService.refreshToken(original)).rejects.toMatchObject({ status: 503 });
    await expect(tokenService.refreshToken(original)).resolves.toBeDefined();
  });

  it('persists the replacement when retry expiry passes between reading and rotation', async () => {
    const original = await login(tokenService, userId);
    const first = await tokenService.refreshToken(original);
    families.rows[0].retry_until = new Date(Date.now() + 10000);
    const rotate = service.rotate.bind(service);
    jest.spyOn(service, 'rotate').mockImplementation(async (...args) => {
      families.rows[0].retry_until = new Date(0); return rotate(...args);
    });
    const next = await tokenService.refreshToken(first.refresh_token);
    expect(tokens.rows.some(r => r.token === next.refresh_token)).toBe(true);
    await expect(tokenService.refreshToken(next.refresh_token)).resolves.toBeDefined();
  });

  it('revokes only the replayed family after grace, not another device', async () => {
    const original = await login(tokenService, userId); const other = await login(tokenService, userId);
    await tokenService.refreshToken(original); families.rows[0].retry_until = new Date(0);
    await expect(tokenService.refreshToken(original)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(tokenService.refreshToken(other)).resolves.toBeDefined();
    expect(logs.create).toHaveBeenCalledWith(expect.objectContaining({ details: expect.stringContaining('refresh_replay') }));
  });

  it('rejects old access family and refresh after logout, preserving another device', async () => {
    const original = await login(tokenService, userId); const other = await login(tokenService, userId);
    const result = await tokenService.refreshToken(original); const payload = JSON.parse(result.access_token);
    await tokenService.revokeToken(result.refresh_token);
    await expect(service.validate(payload.session_id, payload.user_id)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(tokenService.refreshToken(original)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(tokenService.refreshToken(other)).resolves.toBeDefined();
  });

  it('rejects inactive accounts before rotating credentials', async () => {
    const original = await login(tokenService, userId);
    users.findById.mockReturnValue({ exec: async () => ({ _id: userId, status: 'inactive' }) });
    await expect(tokenService.refreshToken(original)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('upgrades a valid legacy token deterministically and rejects a revoked legacy token', async () => {
    await tokens.create({ user_id: userId, token: 'legacy', expires_at: new Date(Date.now() + 60000), remember: false });
    const [a,b] = await Promise.all([tokenService.refreshToken('legacy'), tokenService.refreshToken('legacy')]);
    expect(a.refresh_token).toBe(b.refresh_token); expect(families.rows).toHaveLength(1);
    await tokens.create({ user_id: userId, token: 'revoked', expires_at: new Date(Date.now() + 60000), is_revoked: true });
    await expect(tokenService.refreshToken('revoked')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('cascades parent revocation but preserves another parent and subject real login', async () => {
    const parent = await login(tokenService, userId); const other = await login(tokenService, userId);
    const parentId = families.rows[0]._id; const leaseId = new Types.ObjectId();
    await leases.create({ _id: leaseId, parent_session_id: parentId, status: 'active' });
    const child = await tokenService.createRefreshToken(userId, 1/6, false, { sessionId: leaseId,
      actorUserId: userId, expiresAt: new Date(Date.now()+14400000), parentSessionId: parentId });
    const childResult = await tokenService.refreshToken(child);
    expect(JSON.parse(childResult.access_token).impersonation_session_id).toBe(leaseId.toString());
    await tokenService.revokeToken(parent);
    await expect(tokenService.refreshToken(childResult.refresh_token)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(tokenService.refreshToken(other)).resolves.toBeDefined();
    expect(leases.rows[0].status).toBe('ended');
  });

  it('allows child concurrent refresh without extending the fixed lease', async () => {
    await login(tokenService, userId); const expires = new Date(Date.now()+14400000);
    const child = await tokenService.createRefreshToken(userId, 1/6, false, { sessionId: new Types.ObjectId(),
      actorUserId: userId, expiresAt: expires, parentSessionId: families.rows[0]._id });
    const results = await Promise.all([tokenService.refreshToken(child), tokenService.refreshToken(child)]);
    expect(results[0].refresh_token).toBe(results[1].refresh_token);
    expect(results[0].expires_at).toEqual(expires);
  });

  it('lists redacted own ordinary sessions and rejects foreign revocation', async () => {
    await login(tokenService, userId); const otherId = new Types.ObjectId(); await login(tokenService, otherId);
    const rows = await service.list(userId.toString(), families.rows[0]._id.toString());
    expect(rows).toHaveLength(1); expect(rows[0].current).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('token');
    await expect(service.revokeOwned(userId.toString(), families.rows[1]._id.toString())).rejects.toMatchObject({ status: 403 });
    expect(families.rows[1].revoked_at).toBeNull();
  });

  it('revokes all other own families, preserving the current and foreign families', async () => {
    await login(tokenService, userId); await login(tokenService, userId); await login(tokenService, new Types.ObjectId());
    await service.revokeOthers(userId.toString(), families.rows[0]._id.toString());
    expect(families.rows.map(r => Boolean(r.revoked_at))).toEqual([false,true,false]);
  });
  it('revokes every family even when audit storage is unavailable', async () => {
    await login(tokenService, userId); await login(tokenService, userId);
    logs.create.mockRejectedValue(new Error('audit offline'));
    await tokenService.revokeAllUserTokens(userId.toString());
    expect(families.rows.every(row => row.revoked_at)).toBe(true);
  });

  it('casts session owner and parent identifiers as ObjectIds rather than Mixed', () => {
    for (const field of ['user_id','parent_session_id','impersonation_session_id']) {
      expect(AuthSessionSchema.path(field).instance).toBe('ObjectId');
    }
  });

});
