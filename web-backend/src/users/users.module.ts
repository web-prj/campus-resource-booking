import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUsersController } from './admin-users.controller';
import { User } from './entities/user.entity';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { UserAccessEvents } from './user-access-events';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, UserAccessEvents, AdminBootstrapService],
  controllers: [AdminUsersController],
  exports: [UsersService, UserAccessEvents],
})
export class UsersModule {}
