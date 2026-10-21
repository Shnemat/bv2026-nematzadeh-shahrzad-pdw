
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Request } from 'express';

import { EnvService } from '@common/config';
import { AccountService } from '@core/account';

import { AuthRefreshTokenEntity } from '../data/entity/auth-refresh-token.entity';
import { AuthSessionEntity } from '../data/entity/auth-session.entity';
import { AuthSecurityException } from '../data/exception/auth-security.exception';
import { AuthSessionService } from './auth-session.service';
import { CsrfService } from './csrf.service';
import { TokenCryptoService } from './token-crypto.service';
import { AuthCookieService } from './auth-cookie.service';

export type RotatedRefresh = {
  accountId: string;
  sessionId: string;
  accessVersion: number;
  refreshToken: string;
  refreshExpiresAt: Date;
};

type ReplayDetected = { replayDetected: true };

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tokenCrypto: TokenCryptoService,
    private readonly csrfService: CsrfService,
    private readonly authSessionService: AuthSessionService,
    private readonly envService: EnvService,
    private readonly cookies: AuthCookieService,
    private readonly accountService: AccountService,
  ) {}

  async rotate(request: Request): Promise<RotatedRefresh> {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const refreshToken = cookies?.[this.cookies.names.refresh];

    if (
      typeof refreshToken !== 'string' ||
      refreshToken.length < 40 ||
      refreshToken.length > 512
    ) {
      throw new AuthSecurityException('api.auth.refresh.invalid');
    }

    const csrfToken = request.header('X-CSRF-Token');
    if (!csrfToken) {
      throw new AuthSecurityException('api.security.csrf.invalid', 403);
    }

    const result = await this.dataSource.transaction(
      async (manager): Promise<RotatedRefresh | ReplayDetected> => {
        const tokenRepository = manager.getRepository(AuthRefreshTokenEntity);
        const sessionRepository = manager.getRepository(AuthSessionEntity);
        const tokenHash = this.tokenCrypto.fingerprint(refreshToken);
        const candidate = await tokenRepository.findOneBy({ tokenHash });

        if (!candidate) {
          throw new AuthSecurityException('api.auth.refresh.invalid');
        }

        const session = await sessionRepository.findOne({
          where: { id: candidate.sessionId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!session) {
          throw new AuthSecurityException('api.auth.refresh.invalid');
        }

        const token = await tokenRepository.findOne({
          where: { id: candidate.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (
          !token ||
          token.tokenHash !== tokenHash ||
          token.sessionId !== session.id
        ) {
          throw new AuthSecurityException('api.auth.refresh.invalid');
        }

        if (token.consumedAt !== null || token.revokedAt !== null) {
          await this.authSessionService.revoke(
            manager,
            session.id,
            'refresh-reuse',
          );
          return { replayDetected: true };
        }

        if (
          token.expiresAt <= new Date() ||
          session.expiresAt <= new Date() ||
          session.revokedAt !== null
        ) {
          throw new AuthSecurityException('api.auth.refresh.invalid');
        }

        const account = await this.accountService.findByIdInTransaction(
          manager,
          session.accountId,
        );

        if (!account || !this.accountService.canAuthenticate(account)) {
          throw new AuthSecurityException('api.auth.refresh.invalid');
        }

        this.csrfService.assertValid(request, session);

        const newRefreshToken = this.tokenCrypto.createOpaqueToken();
        const now = new Date();
        const refreshExpiresAt = new Date(
          Math.min(
            session.expiresAt.getTime(),
            now.getTime() + this.envService.refreshTokenTtlSeconds * 1000,
          ),
        );

        const replacement = await tokenRepository.save(
          tokenRepository.create({
            sessionId: session.id,
            tokenHash: this.tokenCrypto.fingerprint(newRefreshToken),
            expiresAt: refreshExpiresAt,
            consumedAt: null,
            revokedAt: null,
            replacedById: null,
            parentId: token.id,
          }),
        );

        this.throwIfInjected('after-successor-persistence');
        token.consumedAt = now;
        token.replacedById = replacement.id;
        await tokenRepository.save(token);
        this.throwIfInjected('after-parent-consumed');

        session.accessVersion += 1;
        session.lastUsedAt = now;
        await sessionRepository.save(session);

        return {
          accountId: session.accountId,
          sessionId: session.id,
          accessVersion: session.accessVersion,
          refreshToken: newRefreshToken,
          refreshExpiresAt,
        };
      },
    );

    if ('replayDetected' in result) {
      throw new AuthSecurityException('api.auth.refresh.invalid');
    }

    return result;
  }

  private throwIfInjected(point: string): void {
    if (this.envService.testRefreshFailurePoint === point) {
      throw new Error(`Injected refresh failure at ${point}`);
    }
  }
}
