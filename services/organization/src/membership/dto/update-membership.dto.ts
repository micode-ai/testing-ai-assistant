import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrgMemberRole } from '../../../generated/prisma';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['ADMIN', 'MEMBER', 'VIEWER'] })
  @IsEnum(OrgMemberRole)
  role: OrgMemberRole;
}
