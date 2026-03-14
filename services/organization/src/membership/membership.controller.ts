import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgMemberGuard, Roles } from '../common/guards/org-member.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '@testing-ai/shared-types';
import { MembershipService } from './membership.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-membership.dto';
import { MembershipResponseDto } from './dto/membership-response.dto';

@ApiTags('memberships')
@ApiBearerAuth()
@Controller('organizations/:orgId/members')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Post('invite')
  @Roles('ADMIN' as never)
  @ApiOperation({ summary: 'Invite a member to the organization' })
  @ApiResponse({ status: 201, type: MembershipResponseDto })
  @ApiResponse({ status: 409, description: 'Already a member' })
  async invite(
    @Param('orgId') orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: InviteMemberDto,
  ): Promise<MembershipResponseDto> {
    const membership = await this.membershipService.invite(orgId, user.sub, dto);
    return MembershipResponseDto.fromEntity(membership);
  }

  @Get()
  @ApiOperation({ summary: 'List organization members' })
  @ApiResponse({ status: 200, type: [MembershipResponseDto] })
  async findAll(@Param('orgId') orgId: string): Promise<MembershipResponseDto[]> {
    const members = await this.membershipService.listMembers(orgId);
    return members.map(MembershipResponseDto.fromEntity);
  }

  @Patch(':memberId/approve')
  @Roles('ADMIN' as never)
  @ApiOperation({ summary: 'Approve a pending membership' })
  @ApiResponse({ status: 200, type: MembershipResponseDto })
  async approve(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<MembershipResponseDto> {
    const membership = await this.membershipService.approve(orgId, memberId, user.sub);
    return MembershipResponseDto.fromEntity(membership);
  }

  @Patch(':memberId/reject')
  @Roles('ADMIN' as never)
  @ApiOperation({ summary: 'Reject a pending membership' })
  @ApiResponse({ status: 200, type: MembershipResponseDto })
  async reject(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<MembershipResponseDto> {
    const membership = await this.membershipService.reject(orgId, memberId, user.sub);
    return MembershipResponseDto.fromEntity(membership);
  }

  @Patch(':memberId/role')
  @Roles('ADMIN' as never)
  @ApiOperation({ summary: 'Change member role' })
  @ApiResponse({ status: 200, type: MembershipResponseDto })
  async changeRole(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<MembershipResponseDto> {
    const membership = await this.membershipService.changeRole(orgId, memberId, dto.role);
    return MembershipResponseDto.fromEntity(membership);
  }

  @Delete(':memberId')
  @Roles('ADMIN' as never)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from organization' })
  @ApiResponse({ status: 204 })
  async remove(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
  ): Promise<void> {
    await this.membershipService.removeMember(orgId, memberId);
  }
}
