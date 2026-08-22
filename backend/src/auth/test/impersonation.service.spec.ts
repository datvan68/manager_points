import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import {
  ImpersonationSessionSchema,
  ImpersonationSessionStatus,
} from '../schemas/impersonation-session.schema';
import { UserStatus } from '../schemas/user.schema';
import { ImpersonationService } from '../services/impersonation.service';

function query<T>(value: () => T | Promise<T>) {
  return {
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockImplementation(value),
  };
}

describe('ImpersonationService', () => {
  const actorId = new Types.ObjectId();
  const adminRole = { name: 'Admin', role_code: 'ADMIN' };
  const userRole = { name: 'User', role_code: 'USER' };
  let users: Map<string, any>;
  let sessions: any[];
  let sessionModel: any;
  let userModel: any;
  let loginLogModel: any;
  let service: ImpersonationService;

  beforeEach(() => {
    sessions = [];
    users = new Map([
      [
        actorId.toString(),
        {
          _id: actorId,
          user_name: 'admin',
          status: UserStatus.ACTIVE,
          role: adminRole,
        },
      ],
    ]);
    for (let index = 0; index < 10; index += 1) {
      const id = new Types.ObjectId();
      users.set(id.toString(), {
        _id: id,
        user_name: `target-${index}`,
        status: UserStatus.ACTIVE,
        role: userRole,
      });
    }

    const matches = (session: any, filter: any) => {
      if (filter._id && session._id.toString() !== filter._id.toString())
        return false;
      if (
        filter.subject_user_id &&
        session.subject_user_id.toString() !== filter.subject_user_id.toString()
      )
        return false;
      if (
        filter.actor_user_id &&
        session.actor_user_id.toString() !== filter.actor_user_id.toString()
      )
        return false;
      if (filter.status && session.status !== filter.status) return false;
      if (filter.expires_at?.$gt && session.expires_at <= filter.expires_at.$gt)
        return false;
      return true;
    };

    sessionModel = {
      createIndexes: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockImplementation((filter, update) => {
        for (const session of sessions) {
          if (
            session.status === filter.status &&
            session.expires_at <= filter.expires_at.$lte
          ) {
            Object.assign(session, update.$set);
          }
        }
        return Promise.resolve({ acknowledged: true });
      }),
      findOne: jest
        .fn()
        .mockImplementation((filter) =>
          query(
            () => sessions.find((session) => matches(session, filter)) || null,
          ),
        ),
      create: jest.fn().mockImplementation((input) => {
        const collision = sessions.some(
          (session) =>
            session.status === ImpersonationSessionStatus.ACTIVE &&
            (session.slot === input.slot ||
              session.subject_user_id.toString() ===
                input.subject_user_id.toString()),
        );
        if (collision) {
          const error: any = new Error('duplicate key');
          error.code = 11000;
          throw error;
        }
        const session = {
          ...input,
          _id: new Types.ObjectId(),
          ended_at: null,
          ended_reason: null,
        };
        sessions.push(session);
        return session;
      }),
      findOneAndUpdate: jest.fn().mockImplementation((filter, update) =>
        query(() => {
          const session = sessions.find((item) => matches(item, filter));
          if (!session) return null;
          Object.assign(session, update.$set);
          return session;
        }),
      ),
    };
    userModel = {
      findById: jest
        .fn()
        .mockImplementation((id) =>
          query(() => users.get(id.toString()) || null),
        ),
    };
    loginLogModel = {
      create: jest.fn().mockImplementation((input) => ({
        ...input,
        populate: jest.fn().mockResolvedValue(input),
      })),
    };
    service = new ImpersonationService(sessionModel, userModel, loginLogModel);
  });

  it('declares the two active partial unique indexes that enforce the cap', () => {
    const indexes = ImpersonationSessionSchema.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        [
          { slot: 1 },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: { status: 'active' },
          }),
        ],
        [
          { subject_user_id: 1 },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: { status: 'active' },
          }),
        ],
      ]),
    );
  });

  it('creates exactly five distinct active leases under concurrent requests', async () => {
    const targetIds = [...users.keys()].filter(
      (id) => id !== actorId.toString(),
    );
    const results = await Promise.allSettled(
      targetIds.map((targetId, index) =>
        service.acquire(
          actorId.toString(),
          targetId,
          `browser_session_${String(index).padStart(2, '0')}`,
          '127.0.0.1',
        ),
      ),
    );

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(5);
    expect(
      sessions.filter(
        (session) => session.status === ImpersonationSessionStatus.ACTIVE,
      ),
    ).toHaveLength(5);
    for (const result of results.filter(
      (item): item is PromiseRejectedResult => item.status === 'rejected',
    )) {
      expect(result.reason).toBeInstanceOf(ConflictException);
      expect(result.reason.getResponse().code).toBe(
        'IMPERSONATION_LIMIT_REACHED',
      );
    }

    await service.release(sessions[0]._id.toString(), 'logout');
    const replacementTarget = targetIds.find(
      (targetId) =>
        !sessions.some(
          (session) =>
            session.status === ImpersonationSessionStatus.ACTIVE &&
            session.subject_user_id.toString() === targetId,
        ),
    );
    await service.acquire(
      actorId.toString(),
      replacementTarget!,
      'browser_session_released',
      '127.0.0.1',
    );
    expect(
      sessions.filter(
        (session) => session.status === ImpersonationSessionStatus.ACTIVE,
      ),
    ).toHaveLength(5);
  });

  it('rejects a duplicate active subject with a stable conflict code', async () => {
    const targetId = [...users.keys()][1];
    await service.acquire(
      actorId.toString(),
      targetId,
      'browser_session_first',
      '127.0.0.1',
    );
    await expect(
      service.acquire(
        actorId.toString(),
        targetId,
        'browser_session_again',
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'IMPERSONATION_TARGET_ALREADY_ACTIVE',
      }),
    });
  });

  it('requires the current actor role_code ADMIN even with other admin signals', async () => {
    users.get(actorId.toString()).role = {
      name: 'Manager',
      role_code: 'USER',
      permissions: ['ADMIN_FULL'],
    };
    await expect(
      service.acquire(
        actorId.toString(),
        [...users.keys()][1],
        'browser_session_adminfull',
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects self, inactive targets, and ADMIN targets', async () => {
    await expect(
      service.acquire(
        actorId.toString(),
        actorId.toString(),
        'browser_session_self',
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'IMPERSONATION_SELF_NOT_ALLOWED',
      }),
    });

    const target = users.get([...users.keys()][1]);
    target.status = UserStatus.LOCKED;
    await expect(
      service.acquire(
        actorId.toString(),
        target._id.toString(),
        'browser_session_locked',
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'IMPERSONATION_TARGET_INACTIVE',
      }),
    });

    target.status = UserStatus.ACTIVE;
    target.role = adminRole;
    await expect(
      service.acquire(
        actorId.toString(),
        target._id.toString(),
        'browser_session_targetadmin',
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reclaims expired leases and invalidates a lease after actor demotion', async () => {
    const firstTargetId = [...users.keys()][1];
    const { session } = await service.acquire(
      actorId.toString(),
      firstTargetId,
      'browser_session_expiry',
      '127.0.0.1',
    );
    session.expires_at = new Date(Date.now() - 1);

    await service.acquire(
      actorId.toString(),
      [...users.keys()][2],
      'browser_session_reclaim',
      '127.0.0.1',
    );
    expect(session.status).toBe(ImpersonationSessionStatus.EXPIRED);

    const active = sessions.find(
      (item) => item.status === ImpersonationSessionStatus.ACTIVE,
    );
    users.get(actorId.toString()).role = userRole;
    await expect(
      service.validateSession(
        active._id.toString(),
        active.subject_user_id.toString(),
        actorId.toString(),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(active.status).toBe(ImpersonationSessionStatus.ENDED);
  });
});
