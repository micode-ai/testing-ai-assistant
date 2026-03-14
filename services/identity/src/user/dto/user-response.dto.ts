import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  avatarUrl: string | null;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(entity: { id: string; email: string; name: string; avatarUrl?: string | null; createdAt: Date }): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = entity.id;
    dto.email = entity.email;
    dto.name = entity.name;
    dto.avatarUrl = entity.avatarUrl ?? null;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
