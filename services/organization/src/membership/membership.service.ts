import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrgMembership, OrgMemberRole } from '../../generated/prisma';
import { MembershipRepository } from './membership.repository';
import { InviteMemberDto } from './dto/invite-member.dto';
import { MemberInvitedEvent } from './events/member-invited.event';
import { MemberApprovedEvent } from './events/member-approved.event';
import { MemberRejectedEvent } from './events/member-rejected.event';

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async invite(orgId: string, inviterId: string, dto: InviteMemberDto): Promise<OrgMembership> {
    const existing = await this.membershipRepository.findByUserAndOrg(dto.userId, orgId);
    if (existing) {
      throw new ConflictException('User is already a member or has a pending invitation');
    }

    const membership = await this.membershipRepository.create({
      userId: dto.userId,
      orgId,
      role: dto.role || 'MEMBER',
      status: 'PENDING',
    });

    this.eventEmitter.emit(
      'member.invited',
      new MemberInvitedEvent(membership.id, {
        orgId,
        userId: dto.userId,
        invitedBy: inviterId,
        role: membership.role,
      }),
    );

    this.logger.log(`Member invited: ${dto.userId} to org ${orgId}`);
    return membership;
  }

  async listMembers(orgId: string): Promise<OrgMembership[]> {
    return this.membershipRepository.findByOrgId(orgId);
  }

  async approve(orgId: string, memberId: string, approverId: string): Promise<OrgMembership> {
    const membership = await this.findMembership(memberId, orgId);
    if (membership.status !== 'PENDING') {
      throw new ConflictException('Membership is not pending');
    }

    const updated = await this.membershipRepository.update(memberId, {
      status: 'APPROVED',
      resolvedAt: new Date(),
    });

    this.eventEmitter.emit(
      'member.approved',
      new MemberApprovedEvent(memberId, {
        orgId,
        userId: membership.userId,
        approvedBy: approverId,
      }),
    );

    this.logger.log(`Member approved: ${memberId} in org ${orgId}`);
    return updated;
  }

  async reject(orgId: string, memberId: string, rejecterId: string): Promise<OrgMembership> {
    const membership = await this.findMembership(memberId, orgId);
    if (membership.status !== 'PENDING') {
      throw new ConflictException('Membership is not pending');
    }

    const updated = await this.membershipRepository.update(memberId, {
      status: 'REJECTED',
      resolvedAt: new Date(),
    });

    this.eventEmitter.emit(
      'member.rejected',
      new MemberRejectedEvent(memberId, {
        orgId,
        userId: membership.userId,
        rejectedBy: rejecterId,
      }),
    );

    this.logger.log(`Member rejected: ${memberId} in org ${orgId}`);
    return updated;
  }

  async changeRole(
    orgId: string,
    memberId: string,
    newRole: OrgMemberRole,
  ): Promise<OrgMembership> {
    const membership = await this.findMembership(memberId, orgId);

    if (membership.role === 'ADMIN' && newRole !== 'ADMIN') {
      const adminCount = await this.membershipRepository.countAdmins(orgId);
      if (adminCount <= 1) {
        throw new ForbiddenException('Cannot remove the last admin');
      }
    }

    const updated = await this.membershipRepository.update(memberId, { role: newRole });
    this.logger.log(`Member role changed: ${memberId} to ${newRole}`);
    return updated;
  }

  async removeMember(orgId: string, memberId: string): Promise<void> {
    const membership = await this.findMembership(memberId, orgId);

    if (membership.role === 'ADMIN') {
      const adminCount = await this.membershipRepository.countAdmins(orgId);
      if (adminCount <= 1) {
        throw new ForbiddenException('Cannot remove the last admin');
      }
    }

    await this.membershipRepository.softDelete(memberId);
    this.logger.log(`Member removed: ${memberId} from org ${orgId}`);
  }

  private async findMembership(memberId: string, orgId: string): Promise<OrgMembership> {
    const membership = await this.membershipRepository.findById(memberId);
    if (!membership || membership.orgId !== orgId) {
      throw new NotFoundException('Membership not found');
    }
    return membership;
  }
}
