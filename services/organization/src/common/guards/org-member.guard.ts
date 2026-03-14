import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgMemberRole } from '../../../generated/prisma';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: OrgMemberRole[]) => {
  return (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(ROLES_KEY, roles, descriptor.value);
    }
    return descriptor;
  };
};

@Injectable()
export class OrgMemberGuard implements CanActivate {
  private readonly logger = new Logger(OrgMemberGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;
    const orgId = request.params.orgId;

    if (!userId || !orgId) {
      throw new ForbiddenException('Missing user or organization context');
    }

    const membership = await this.prisma.orgMembership.findFirst({
      where: {
        userId,
        orgId,
        status: 'APPROVED',
        deletedAt: null,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const requiredRoles = this.reflector.get<OrgMemberRole[]>(ROLES_KEY, context.getHandler());
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(membership.role)) {
        throw new ForbiddenException('Insufficient role');
      }
    }

    request.membership = membership;
    return true;
  }
}
