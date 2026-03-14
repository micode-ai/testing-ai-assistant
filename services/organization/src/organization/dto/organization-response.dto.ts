import { ApiProperty } from '@nestjs/swagger';
import { OrgPlan } from '../../../generated/prisma';

export class OrganizationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ enum: ['FREE', 'PRO', 'ENTERPRISE'] }) plan: OrgPlan;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ required: false }) memberCount?: number;

  static fromEntity(
    entity: { id: string; name: string; slug: string; plan: OrgPlan; createdAt: Date },
    memberCount?: number,
  ): OrganizationResponseDto {
    const dto = new OrganizationResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.slug = entity.slug;
    dto.plan = entity.plan;
    dto.createdAt = entity.createdAt;
    if (memberCount !== undefined) dto.memberCount = memberCount;
    return dto;
  }
}
