import { OrgPlan, OrgMemberRole, OrgMemberStatus } from './enums';

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  createdAt: Date;
}

export interface OrgMembershipDto {
  id: string;
  userId: string;
  orgId: string;
  role: OrgMemberRole;
  status: OrgMemberStatus;
  requestedAt: Date;
  resolvedAt: Date | null;
}
