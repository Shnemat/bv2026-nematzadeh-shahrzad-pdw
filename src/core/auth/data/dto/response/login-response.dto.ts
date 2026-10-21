
import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ example: '01K2Z3Z4Z5Z6Z7Z8Z9ZAABBCCD' })
  accountId!: string;

  @ApiProperty({ example: 'nicolas@example.com' })
  email!: string;

  @ApiProperty({ example: true })
  authenticated!: boolean;
}
