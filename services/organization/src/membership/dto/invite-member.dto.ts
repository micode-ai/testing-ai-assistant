import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { OrgMemberRole } from '../../../generated/prisma';

export class InviteMemberDto {
  @ApiProperty({ description: 'User ID to invite' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({ enum: ['ADMIN', 'MEMBER', 'VIEWER'], default: 'MEMBER' })
  @IsEnum(OrgMemberRole)
  @IsOptional()
  role?: OrgMemberRole;
}
