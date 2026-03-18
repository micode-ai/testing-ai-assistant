import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { UserService } from './user.service';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('users-internal')
@Public()
@Controller('api/v1/users')
export class UserInternalController {
  constructor(private readonly userService: UserService) {}

  @Post('batch')
  @ApiOperation({ summary: 'Get users by IDs (internal)' })
  @ApiResponse({ status: 200, type: [UserResponseDto] })
  async getUsersByIds(@Body() body: { ids: string[] }): Promise<UserResponseDto[]> {
    const users = await this.userService.findByIds(body.ids ?? []);
    return users.map(UserResponseDto.fromEntity);
  }
}
