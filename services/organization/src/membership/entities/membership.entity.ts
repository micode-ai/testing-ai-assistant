import { OrgMemberRole, OrgMemberStatus } from '../../../generated/prisma';

export class MembershipEntity {
  id: string;
  userId: string;
  orgId: string;
  role: OrgMemberRole;
  status: OrgMemberStatus;
  requestedAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
