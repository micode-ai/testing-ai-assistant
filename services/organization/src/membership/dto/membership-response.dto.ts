import { ApiProperty } from '@nestjs/swagger';
import { OrgMemberRole, OrgMemberStatus } from '../../../generated/prisma';

export class MembershipResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() orgId: string;
  @ApiProperty({ enum: ['ADMIN', 'MEMBER', 'VIEWER'] }) role: OrgMemberRole;
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED'] }) status: OrgMemberStatus;
  @ApiProperty() requestedAt: Date;
  @ApiProperty({ nullable: true }) resolvedAt: Date | null;

  static fromEntity(entity: {
    id: string;
    userId: string;
    orgId: string;
    role: OrgMemberRole;
    status: OrgMemberStatus;
    requestedAt: Date;
    resolvedAt: Date | null;
  }): MembershipResponseDto {
    const dto = new MembershipResponseDto();
    Object.assign(dto, entity);
    return dto;
  }
}
