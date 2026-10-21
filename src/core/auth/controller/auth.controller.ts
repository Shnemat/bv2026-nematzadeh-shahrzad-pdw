
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Header,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiErrorEnvelopeResponse,
  ApiEnvelopeResponse,
  ApiSuccessCode,
  ApiCodeResponse,
} from '@common/api';
import { ApiCookieAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../service/auth.service';
import { LoginRequestDto } from '../data/dto/request/login-request.dto';
import { RegisterRequestDto } from '../data/dto/request/register-request.dto';
import { LoginResponseDto } from '../data/dto/response/login-response.dto';
import { RegistrationResponseDto } from '../data/dto/response/registration-response.dto';
import { AuthSessionResponseDto } from '../data/dto/response/auth-session-response.dto';
import { CurrentAuth } from '../decorator/current-auth.decorator';
import { Public } from '../decorator/public.decorator';
import type { AuthContext } from '../data/model/auth-context';
import { AuthCookieService } from '../service/auth-cookie.service';
import { RefreshTokenService } from '../service/refresh-token.service';
import type { RotatedRefresh } from '../service/refresh-token.service';
import { TokenCryptoService } from '../service/token-crypto.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  @ApiSuccessCode(ApiCodeResponse.AuthRegistrationSuccess)
  @ApiEnvelopeResponse(RegistrationResponseDto, {
    status: HttpStatus.CREATED,
    code: ApiCodeResponse.AuthRegistrationSuccess,
    description: 'Creates an account with an unverified email identifier.',
  })
  @ApiErrorEnvelopeResponse({
    status: HttpStatus.CONFLICT,
    code: ApiCodeResponse.AuthEmailAlreadyUsed,
    description: 'The canonical email is already in use.',
  })
  @ApiErrorEnvelopeResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ApiCodeResponse.AuthPasswordPolicyInvalid,
    description: 'The password does not satisfy the configured password policy.',
  })
  register(
    @Body() dto: RegisterRequestDto,
  ): Promise<RegistrationResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  @ApiSuccessCode(ApiCodeResponse.AuthLoginSuccess)
  @ApiEnvelopeResponse(LoginResponseDto, {
    code: ApiCodeResponse.AuthLoginSuccess,
    description:
      'Authenticates an email/password credential and sets hardened authentication cookies.',
  })
  @ApiErrorEnvelopeResponse({
    status: HttpStatus.UNAUTHORIZED,
    code: ApiCodeResponse.AuthInvalidCredentials,
    description: 'The supplied credentials cannot be authenticated.',
  })
  async login(
    @Body() dto: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const session = await this.authService.login(dto);
    this.cookies.setAccessCookie(response, session.accessToken);
    this.cookies.setRefreshCookie(
      response,
      session.refreshToken,
      session.refreshExpiresAt,
    );
    this.cookies.setCsrfCookie(
      response,
      session.csrfToken,
      session.refreshExpiresAt,
    );

    return {
      accountId: session.accountId,
      email: dto.email,
      authenticated: true,
    };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ global: { limit: 30, ttl: 60_000 } })
  @ApiCookieAuth('refresh-cookie')
  @ApiHeader({
    name: 'X-CSRF-Token',
    required: true,
    description: 'Session-bound CSRF token supplied by the client.',
  })
  @ApiSuccessCode(ApiCodeResponse.AuthRefreshSuccess)
  @ApiEnvelopeResponse(AuthSessionResponseDto, {
    code: ApiCodeResponse.AuthRefreshSuccess,
    description: 'Rotates the refresh cookie and issues a new access cookie.',
  })
  @ApiErrorEnvelopeResponse({
    status: HttpStatus.UNAUTHORIZED,
    code: ApiCodeResponse.AuthRefreshInvalid,
    description: 'The refresh authentication material is invalid.',
  })
  @ApiErrorEnvelopeResponse({
    status: HttpStatus.FORBIDDEN,
    code: ApiCodeResponse.AuthCsrfInvalid,
    description: 'The CSRF validation failed.',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    let rotated: RotatedRefresh;

    try {
      rotated = await this.refreshTokens.rotate(request);
    } catch (error) {
      this.cookies.clearAuthCookies(response);
      throw error;
    }

    const accessToken = this.tokenCrypto.signAccessToken(
      rotated.accountId,
      rotated.sessionId,
      rotated.accessVersion,
    );

    this.cookies.setAccessCookie(response, accessToken);
    this.cookies.setRefreshCookie(
      response,
      rotated.refreshToken,
      rotated.refreshExpiresAt,
    );

    return { accountId: rotated.accountId, authenticated: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  @ApiCookieAuth('access-cookie')
  @ApiHeader({
    name: 'X-CSRF-Token',
    required: true,
    description: 'Session-bound CSRF token supplied by the client.',
  })
  @ApiSuccessCode(ApiCodeResponse.AuthLogoutSuccess)
  @ApiEnvelopeResponse(AuthSessionResponseDto, {
    code: ApiCodeResponse.AuthLogoutSuccess,
    description: 'Revokes the current session and clears authentication cookies.',
  })
  @ApiErrorEnvelopeResponse({
    status: HttpStatus.UNAUTHORIZED,
    code: ApiCodeResponse.AuthUnauthorized,
  })
  @ApiErrorEnvelopeResponse({
    status: HttpStatus.FORBIDDEN,
    code: ApiCodeResponse.AuthCsrfInvalid,
  })
  async logout(
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    await this.authService.logout(auth);
    this.cookies.clearAuthCookies(response);
    return { accountId: auth.accountId, authenticated: false };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  @ApiCookieAuth('access-cookie')
  @ApiHeader({
    name: 'X-CSRF-Token',
    required: true,
    description: 'Session-bound CSRF token supplied by the client.',
  })
  @ApiSuccessCode(ApiCodeResponse.AuthLogoutAllSuccess)
  @ApiEnvelopeResponse(AuthSessionResponseDto, {
    code: ApiCodeResponse.AuthLogoutAllSuccess,
    description: 'Revokes all sessions for the authenticated account.',
  })
  @ApiErrorEnvelopeResponse({
    status: HttpStatus.UNAUTHORIZED,
    code: ApiCodeResponse.AuthUnauthorized,
  })
  @ApiErrorEnvelopeResponse({
    status: HttpStatus.FORBIDDEN,
    code: ApiCodeResponse.AuthCsrfInvalid,
  })
  async logoutAll(
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    await this.authService.logoutAll(auth);
    this.cookies.clearAuthCookies(response);
    return { accountId: auth.accountId, authenticated: false };
  }

  constructor(
    private readonly authService: AuthService,
    private readonly cookies: AuthCookieService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly tokenCrypto: TokenCryptoService,
  ) {}
}
