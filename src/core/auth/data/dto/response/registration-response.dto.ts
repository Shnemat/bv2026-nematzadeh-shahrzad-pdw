import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus } from '@core/account';

export class RegistrationResponseDto {
  @ApiProperty({ example: '01K2Z3Z4Z5Z6Z7Z8Z9ZAABBCCD' })
  accountId!: string;

  @ApiProperty({ example: 'nicolas@example.com' })
  email!: string;

  @ApiProperty({ enum: AccountStatus, example: AccountStatus.Active })
  status!: AccountStatus;

  @ApiProperty({ example: false })
  emailVerified!: boolean;

  @ApiProperty({ example: '2026-08-19T12:00:00.000Z' })
  createdAt!: string;
}
