
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { EnvService } from '@common/config';

import { AuthSecurityException } from '../data/exception/auth-security.exception';

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly envService: EnvService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return true;
    }

    const origin = request.header('Origin');
    const referer = request.header('Referer');
    const candidate = origin ?? this.originFromReferer(referer);

    if (candidate && this.envService.corsOrigins.includes(candidate)) {
      return true;
    }

    if (!candidate && !this.envService.isProduction) {
      return true;
    }

    throw new AuthSecurityException('api.security.origin-invalid', 403);
  }

  private originFromReferer(referer: string | undefined): string | undefined {
    if (!referer) {
      return undefined;
    }

    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }
}
