import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { UserService } from '../../user/user.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let userService: jest.Mocked<UserService>;

  const mockAuthResponse = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: null,
      createdAt: new Date(),
    },
  };

  const mockJwtPayload = {
    sub: 'user-1',
    email: 'test@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: createMock<AuthService>() },
        { provide: UserService, useValue: createMock<UserService>() },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
    userService = module.get(UserService);
  });

  describe('register', () => {
    it('should register a new user and return auth response', async () => {
      // Arrange
      const dto: RegisterDto = { email: 'test@example.com', name: 'Test', password: 'password123' };
      authService.register.mockResolvedValue(mockAuthResponse);

      // Act
      const result = await controller.register(dto);

      // Assert
      expect(result).toEqual(mockAuthResponse);
      expect(authService.register).toHaveBeenCalledWith(dto);
    });

    it('should pass the DTO to auth service unchanged', async () => {
      // Arrange
      const dto: RegisterDto = { email: 'new@example.com', name: 'New User', password: 'StrongP@ss1' };
      authService.register.mockResolvedValue(mockAuthResponse);

      // Act
      await controller.register(dto);

      // Assert
      expect(authService.register).toHaveBeenCalledWith(dto);
    });

    it('should propagate errors from auth service', async () => {
      // Arrange
      const dto: RegisterDto = { email: 'test@example.com', name: 'Test', password: 'password123' };
      authService.register.mockRejectedValue(new Error('Conflict'));

      // Act & Assert
      await expect(controller.register(dto)).rejects.toThrow('Conflict');
    });
  });

  describe('login', () => {
    it('should login user and return auth response', async () => {
      // Arrange
      const dto: LoginDto = { email: 'test@example.com', password: 'password123' };
      authService.login.mockResolvedValue(mockAuthResponse);

      // Act
      const result = await controller.login(dto);

      // Assert
      expect(result).toEqual(mockAuthResponse);
      expect(authService.login).toHaveBeenCalledWith(dto);
    });

    it('should propagate unauthorized errors', async () => {
      // Arrange
      const dto: LoginDto = { email: 'test@example.com', password: 'wrong' };
      authService.login.mockRejectedValue(new Error('Unauthorized'));

      // Act & Assert
      await expect(controller.login(dto)).rejects.toThrow('Unauthorized');
    });

    it('should call authService.login with correct parameters', async () => {
      // Arrange
      const dto: LoginDto = { email: 'user@test.com', password: 'mypassword' };
      authService.login.mockResolvedValue(mockAuthResponse);

      // Act
      await controller.login(dto);

      // Assert
      expect(authService.login).toHaveBeenCalledTimes(1);
      expect(authService.login).toHaveBeenCalledWith(dto);
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      // Arrange
      const dto: RefreshTokenDto = { refreshToken: 'valid-refresh-token' };
      const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
      authService.refreshTokens.mockResolvedValue(tokens);

      // Act
      const result = await controller.refresh(dto);

      // Assert
      expect(result).toEqual(tokens);
      expect(authService.refreshTokens).toHaveBeenCalledWith(dto.refreshToken);
    });

    it('should propagate errors for invalid refresh tokens', async () => {
      // Arrange
      const dto: RefreshTokenDto = { refreshToken: 'invalid-token' };
      authService.refreshTokens.mockRejectedValue(new Error('Invalid'));

      // Act & Assert
      await expect(controller.refresh(dto)).rejects.toThrow('Invalid');
    });

    it('should pass refreshToken string to service', async () => {
      // Arrange
      const dto: RefreshTokenDto = { refreshToken: 'my-token' };
      authService.refreshTokens.mockResolvedValue({ accessToken: 'a', refreshToken: 'b' });

      // Act
      await controller.refresh(dto);

      // Assert
      expect(authService.refreshTokens).toHaveBeenCalledWith('my-token');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      // Arrange
      const dto: RefreshTokenDto = { refreshToken: 'valid-token' };
      authService.logout.mockResolvedValue(undefined);

      // Act
      await controller.logout(dto);

      // Assert
      expect(authService.logout).toHaveBeenCalledWith(dto.refreshToken);
    });

    it('should propagate errors during logout', async () => {
      // Arrange
      const dto: RefreshTokenDto = { refreshToken: 'invalid' };
      authService.logout.mockRejectedValue(new Error('Failed'));

      // Act & Assert
      await expect(controller.logout(dto)).rejects.toThrow('Failed');
    });

    it('should call logout with the refresh token string', async () => {
      // Arrange
      const dto: RefreshTokenDto = { refreshToken: 'token-to-revoke' };
      authService.logout.mockResolvedValue(undefined);

      // Act
      await controller.logout(dto);

      // Assert
      expect(authService.logout).toHaveBeenCalledWith('token-to-revoke');
    });
  });

  describe('me', () => {
    it('should return the current user profile', async () => {
      // Arrange
      const mockFoundUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        passwordHash: 'hash',
        keycloakId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      userService.findById.mockResolvedValue(mockFoundUser);

      // Act
      const result = await controller.me(mockJwtPayload);

      // Assert
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
      expect(userService.findById).toHaveBeenCalledWith('user-1');
    });

    it('should propagate not found errors', async () => {
      // Arrange
      userService.findById.mockRejectedValue(new Error('Not found'));

      // Act & Assert
      await expect(controller.me(mockJwtPayload)).rejects.toThrow('Not found');
    });

    it('should use sub from JWT payload to find user', async () => {
      // Arrange
      const payload = { sub: 'user-42', email: 'x@y.com', iat: 0, exp: 0 };
      userService.findById.mockRejectedValue(new Error('Not found'));

      // Act & Assert
      await expect(controller.me(payload)).rejects.toThrow();
      expect(userService.findById).toHaveBeenCalledWith('user-42');
    });
  });
});
