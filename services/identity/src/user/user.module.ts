import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserInternalController } from './user-internal.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';

@Module({
  controllers: [UserController, UserInternalController],
  providers: [UserService, UserRepository],
  exports: [UserService, UserRepository],
})
export class UserModule {}
