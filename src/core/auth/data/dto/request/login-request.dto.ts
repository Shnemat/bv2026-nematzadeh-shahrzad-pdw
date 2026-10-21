
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({ example: 'nicolas@example.com', maxLength: 320 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail({}, { message: 'api.auth.login.error.email.invalid' })
  @MaxLength(320, { message: 'api.auth.login.error.email.too-long' })
  email!: string;

  @ApiProperty({ example: 'a long secure passphrase...' })
  @IsString({ message: 'api.auth.login.error.password.invalid' })
  @MinLength(1, { message: 'api.auth.login.error.password.required' })
  @MaxLength(1024, { message: 'api.auth.login.error.password.too-long' })
  password!: string;
}
