
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountModule } from '@core/account';

import { AuthController } from './controller/auth.controller';
import { AuthService } from './service/auth.service';
import { AuthIdentifierService } from './service/auth-identifier.service';
import { PasswordCredentialService } from './service/password-credential.service';
import { AuthIdentifierEntity } from './data/entity/auth-identifier.entity';
import { PasswordCredentialEntity } from './data/entity/password-credential.entity';
import { PasswordHasherService } from './service/password-hasher.service';
import { PasswordPolicyService } from './service/password-policy.service';
import { AuthSessionEntity } from './data/entity/auth-session.entity';
import { AuthRefreshTokenEntity } from './data/entity/auth-refresh-token.entity';
import { AuthCookieService } from './service/auth-cookie.service';
import { AuthSessionService } from './service/auth-session.service';
import { CsrfService } from './service/csrf.service';
import { RefreshTokenService } from './service/refresh-token.service';
import { TokenCryptoService } from './service/token-crypto.service';
import { AccessAuthGuard } from './guard/access-auth.guard';
import { OriginGuard } from './guard/origin.guard';

@Module({
  imports: [
    AccountModule,
    TypeOrmModule.forFeature([
      AuthIdentifierEntity,
      PasswordCredentialEntity,
      AuthSessionEntity,
      AuthRefreshTokenEntity,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthIdentifierService,
    PasswordCredentialService,
    PasswordHasherService,
    PasswordPolicyService,
    AuthCookieService,
    AuthSessionService,
    CsrfService,
    RefreshTokenService,
    TokenCryptoService,
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AccessAuthGuard },
  ],
})
export class AuthModule {}
