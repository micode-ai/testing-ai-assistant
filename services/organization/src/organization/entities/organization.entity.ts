import { OrgPlan } from '../../../generated/prisma';

export class OrganizationEntity {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
