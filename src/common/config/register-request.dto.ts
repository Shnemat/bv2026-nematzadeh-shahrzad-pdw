import { IsEmail, IsString, MaxLength } from 'class-validator';

export class RegisterRequestDto {
  @IsEmail({}, { message: 'api.auth.register.error.email.invalid' })
  email!: string;

  @IsString()
  @MaxLength(1024)
  password!: string;
}