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
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationResponseDto } from './dto/organization-response.dto';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, type: OrganizationResponseDto })
  @ApiResponse({ status: 409, description: 'Organization name already taken' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const org = await this.organizationService.create(user.sub, dto);
    return OrganizationResponseDto.fromEntity(org, 1);
  }

  @Get()
  @ApiOperation({ summary: 'List organizations for current user' })
  @ApiResponse({ status: 200, type: [OrganizationResponseDto] })
  async findAll(@CurrentUser() user: JwtPayload): Promise<OrganizationResponseDto[]> {
    const orgs = await this.organizationService.findByUser(user.sub);
    return orgs.map((org) => OrganizationResponseDto.fromEntity(org));
  }

  @Get(':orgId')
  @UseGuards(OrgMemberGuard)
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiResponse({ status: 200, type: OrganizationResponseDto })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async findOne(@Param('orgId') orgId: string): Promise<OrganizationResponseDto> {
    const org = await this.organizationService.findById(orgId);
    const memberCount = await this.organizationService.getMemberCount(orgId);
    return OrganizationResponseDto.fromEntity(org, memberCount);
  }

  @Patch(':orgId')
  @UseGuards(OrgMemberGuard)
  @Roles('ADMIN' as never)
  @ApiOperation({ summary: 'Update organization' })
  @ApiResponse({ status: 200, type: OrganizationResponseDto })
  async update(
    @Param('orgId') orgId: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const updated = await this.organizationService.update(orgId, dto);
    return OrganizationResponseDto.fromEntity(updated);
  }

  @Delete(':orgId')
  @UseGuards(OrgMemberGuard)
  @Roles('ADMIN' as never)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete organization' })
  @ApiResponse({ status: 204 })
  async remove(@Param('orgId') orgId: string): Promise<void> {
    await this.organizationService.softDelete(orgId);
  }
}
