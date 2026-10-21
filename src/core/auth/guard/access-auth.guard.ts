import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthContext } from '../data/model/auth-context';
import { AuthSecurityException } from '../data/exception/auth-security.exception';
import { AuthCookieService } from '../service/auth-cookie.service';
import { AuthSessionService } from '../service/auth-session.service';
import { CsrfService } from '../service/csrf.service';
import { TokenCryptoService } from '../service/token-crypto.service';
import { EnvService } from '@common/config';
import { IS_PUBLIC_KEY } from '../decorator/public.decorator';

type AuthRequest = Request & { auth?: AuthContext };

@Injectable()
export class AccessAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cookies: AuthCookieService,
    private readonly tokenCrypto: TokenCryptoService,
    private readonly sessions: AuthSessionService,
    private readonly csrf: CsrfService,
    private readonly envService: EnvService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();

    if (
      request.path === `/${this.envService.swaggerPath}` ||
      request.path.startsWith(`/${this.envService.swaggerPath}/`)
    ) {
      return true;
    }

    const cookies = request.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[this.cookies.names.access];

    if (typeof token !== 'string') {
      throw new AuthSecurityException();
    }

    const claims = this.tokenCrypto.verifyAccessToken(token);

    const auth: AuthContext = {
      accountId: claims.sub,
      sessionId: claims.sid,
      tokenId: claims.jti,
    };

    const session = await this.sessions.verifyContext(auth);

    if (session.accessVersion !== claims.ver) {
      throw new AuthSecurityException();
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      this.csrf.assertValid(request, session);
    }

    request.auth = auth;
    return true;
  }
}