
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { EnvService } from '@common/config';
import { AccountService } from '@core/account';

import { AuthRefreshTokenEntity } from '../data/entity/auth-refresh-token.entity';
import { AuthSessionEntity } from '../data/entity/auth-session.entity';
import { AuthSecurityException } from '../data/exception/auth-security.exception';
import { AuthContext } from '../data/model/auth-context';
import { TokenCryptoService } from './token-crypto.service';

export type CreatedSession = {
  session: AuthSessionEntity;
  refreshToken: string;
  csrfToken: string;
  refreshExpiresAt: Date;
};

@Injectable()
export class AuthSessionService {
  constructor(
    @InjectRepository(AuthSessionEntity)
    private readonly sessionRepository: Repository<AuthSessionEntity>,
    private readonly tokenCrypto: TokenCryptoService,
    private readonly accountService: AccountService,
    private readonly envService: EnvService,
    private readonly dataSource: DataSource,
  ) {}

  async createSession(
    manager: EntityManager,
    accountId: string,
  ): Promise<CreatedSession> {
    const now = new Date();
    const sessionExpiresAt = new Date(
      now.getTime() + this.accountSessionTtlMilliseconds(),
    );

    const csrfToken = this.tokenCrypto.createOpaqueToken();
    const refreshToken = this.tokenCrypto.createOpaqueToken();
    const sessionRepository = manager.getRepository(AuthSessionEntity);
    const refreshRepository = manager.getRepository(AuthRefreshTokenEntity);

    const session = await sessionRepository.save(
      sessionRepository.create({
        accountId,
        accessVersion: 1,
        csrfTokenHash: this.tokenCrypto.fingerprint(csrfToken),
        lastUsedAt: now,
        expiresAt: sessionExpiresAt,
        revokedAt: null,
        revocationReason: null,
      }),
    );

    const refreshExpiresAt = new Date(
      Math.min(
        sessionExpiresAt.getTime(),
        now.getTime() + this.refreshTtlMilliseconds(),
      ),
    );

    await refreshRepository.save(
      refreshRepository.create({
        sessionId: session.id,
        tokenHash: this.tokenCrypto.fingerprint(refreshToken),
        expiresAt: refreshExpiresAt,
        revokedAt: null,
        replacedById: null,
        parentId: null,
      }),
    );

    return { session, refreshToken, csrfToken, refreshExpiresAt };
  }

  async verifyContext(
    context: AuthContext,
  ): Promise<AuthSessionEntity> {
    const session = await this.sessionRepository.findOneBy({
      id: context.sessionId,
    });

    if (
      !session ||
      session.accountId !== context.accountId ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      throw new AuthSecurityException();
    }

    const account = await this.accountService.findById(context.accountId);

    if (!account || !this.accountService.canAuthenticate(account)) {
      throw new AuthSecurityException();
    }

    return session;
  }

  async revoke(
    manager: EntityManager,
    sessionId: string,
    reason: string,
  ): Promise<void> {
    const sessionRepository = manager.getRepository(AuthSessionEntity);
    const refreshRepository = manager.getRepository(AuthRefreshTokenEntity);

    await sessionRepository.update(sessionId, {
      revokedAt: new Date(),
      revocationReason: reason,
      accessVersion: () => 'access_version + 1',
    });

    this.throwIfInjected('during-session-revocation');

    await refreshRepository
      .createQueryBuilder()
      .update(AuthRefreshTokenEntity)
      .set({ revokedAt: new Date() })
      .where({ sessionId, revokedAt: IsNull() })
      .execute();

    this.throwIfInjected('during-family-revocation');
  }

  async revokeAll(
    manager: EntityManager,
    accountId: string,
  ): Promise<void> {
    const sessions = await manager.getRepository(AuthSessionEntity).findBy({
      accountId,
      revokedAt: IsNull(),
    });

    for (const session of sessions) {
      await this.revoke(manager, session.id, 'logout-all');
    }
  }

  async revokeCurrent(
    sessionId: string,
    reason: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.revoke(manager, sessionId, reason);
    });
  }

  private accountSessionTtlMilliseconds(): number {
    return this.envService.sessionAbsoluteTtlSeconds * 1000;
  }

  private refreshTtlMilliseconds(): number {
    return this.envService.refreshTokenTtlSeconds * 1000;
  }

  private throwIfInjected(point: string): void {
    if (this.envService.testRefreshFailurePoint === point) {
      throw new Error(`Injected auth-session failure at ${point}`);
    }
  }
}
