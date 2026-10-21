
import { HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ApiCodeResponse, ApiException } from '@common/api';
import { AppLogger } from '@common/logging';
import { AccountService } from '@core/account';

import { LoginRequestDto } from '../data/dto/request/login-request.dto';
import { RegisterRequestDto } from '../data/dto/request/register-request.dto';
import { RegistrationResponseDto } from '../data/dto/response/registration-response.dto';
import { PasswordHasherService } from './password-hasher.service';
import { AuthIdentifierService } from './auth-identifier.service';
import { AuthSessionService } from './auth-session.service';
import { PasswordCredentialService } from './password-credential.service';
import { PasswordPolicyService } from './password-policy.service';
import { AuthCookieService } from './auth-cookie.service';
import { TokenCryptoService } from './token-crypto.service';
import { AuthContext, AuthenticatedSession } from '../data/model/auth-context';
import { normalizeEmail } from '../utils/normalize-email.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly accountService: AccountService,
    private readonly authIdentifierService: AuthIdentifierService,
    private readonly passwordCredentialService: PasswordCredentialService,
    private readonly passwordHasherService: PasswordHasherService,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly authSessionService: AuthSessionService,
    private readonly tokenCryptoService: TokenCryptoService,
    private readonly authCookieService: AuthCookieService,
    private readonly appLogger: AppLogger,
  ) {
    this.appLogger.setContext(AuthService.name);
  }

  async register(dto: RegisterRequestDto): Promise<RegistrationResponseDto> {
    this.passwordPolicyService.assertValid(dto.password);

    const email = normalizeEmail(dto.email);

    try {
      const account = await this.dataSource.transaction(async (manager) => {
        const existingIdentifier =
          await this.authIdentifierService.findMailInTransaction(
            manager,
            email,
          );

        if (existingIdentifier) {
          throw this.emailAlreadyUsed();
        }

        const createdAccount = await this.accountService.create(manager);
        await this.authIdentifierService.create(
          manager,
          createdAccount.id,
          email,
        );
        await this.passwordCredentialService.create(
          manager,
          createdAccount.id,
          dto.password,
        );

        return createdAccount;
      });

      this.appLogger.audit({
        event: 'auth.registration.success',
        accountId: account.id,
      });

      return {
        accountId: account.id,
        email,
        status: account.status,
        emailVerified: false,
        createdAt: account.createdAt.toISOString(),
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw this.emailAlreadyUsed();
      }

      this.appLogger.security({
        event: 'auth.registration.rejected',
        reason: 'persistence_failure',
      });

      throw error;
    }
  }

  async login(dto: LoginRequestDto): Promise<AuthenticatedSession> {
    const email = normalizeEmail(dto.email);

    const result = await this.dataSource.transaction(async (manager) => {
      const identifier = await this.authIdentifierService.findMailInTransaction(
        manager,
        email,
      );

      if (!identifier) {
        await this.passwordHasherService.verifyAgainstDummy(dto.password);
        return null;
      }

      const account = await this.accountService.findByIdInTransaction(
        manager,
        identifier.accountId,
      );

      const credential =
        await this.passwordCredentialService.findByAccountIdInTransaction(
          manager,
          identifier.accountId,
        );

      const passwordMatches = credential
        ? await this.passwordHasherService.verify(
            credential.passwordHash,
            dto.password,
          )
        : await this.passwordHasherService.verifyAgainstDummy(dto.password);

      if (
        !account ||
        !credential ||
        !passwordMatches ||
        !this.accountService.canAuthenticate(account) ||
        (credential.lockedUntil !== null &&
          credential.lockedUntil > new Date())
      ) {
        if (credential && !passwordMatches) {
          await this.passwordCredentialService.recordFailedAttempt(
            manager,
            credential.id,
          );
        }

        return null;
      }

      await this.passwordCredentialService.recordSuccessfulUse(
        manager,
        credential.id,
      );

      const createdSession = await this.authSessionService.createSession(
        manager,
        account.id,
      );

      return {
        accountId: account.id,
        sessionId: createdSession.session.id,
        accessVersion: createdSession.session.accessVersion,
        refreshToken: createdSession.refreshToken,
        csrfToken: createdSession.csrfToken,
        refreshExpiresAt: createdSession.refreshExpiresAt,
      };
    });

    if (!result) {
      this.appLogger.security({
        event: 'auth.password.login.failed',
        reason: 'invalid-credentials',
      });

      throw this.invalidCredentials();
    }

    this.appLogger.security({
      event: 'auth.password.login.success',
      accountId: result.accountId,
    });

    return {
      accountId: result.accountId,
      sessionId: result.sessionId,
      accessToken: this.tokenCryptoService.signAccessToken(
        result.accountId,
        result.sessionId,
        result.accessVersion,
      ),
      refreshToken: result.refreshToken,
      csrfToken: result.csrfToken,
      refreshExpiresAt: result.refreshExpiresAt,
    };
  }

  async logout(context: AuthContext): Promise<void> {
    await this.authSessionService.revokeCurrent(context.sessionId, 'logout');
  }

  async logoutAll(context: AuthContext): Promise<void> {
    await this.dataSource.transaction((manager) =>
      this.authSessionService.revokeAll(manager, context.accountId),
    );
  }

  private invalidCredentials(): ApiException<null> {
    return new ApiException({
      statusCode: HttpStatus.UNAUTHORIZED,
      code: ApiCodeResponse.AuthInvalidCredentials,
      logMessage: 'Password authentication failed',
    });
  }

  private emailAlreadyUsed(): ApiException<null> {
    return new ApiException({
      statusCode: HttpStatus.CONFLICT,
      code: ApiCodeResponse.AuthEmailAlreadyUsed,
      logMessage: 'Registration rejected because the email is already used',
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'driverError' in error &&
      typeof error.driverError === 'object' &&
      error.driverError !== null &&
      'code' in error.driverError &&
      error.driverError.code === '23505'
    );
  }
}
