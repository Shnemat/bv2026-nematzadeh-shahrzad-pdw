
import { ApiProperty } from '@nestjs/swagger';

export class AuthSessionResponseDto {
  @ApiProperty({ example: '01K2Z3Z4Z5Z6Z7Z8Z9ZAABBCCD' })
  accountId!: string;

  @ApiProperty({ example: true })
  authenticated!: boolean;
}
