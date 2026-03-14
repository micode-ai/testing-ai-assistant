export class UserEntity {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  avatarUrl: string | null;
  keycloakId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
