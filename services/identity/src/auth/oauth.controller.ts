import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from './decorators/public.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';

@ApiTags('auth')
@Controller('auth')
export class OAuthController {
  constructor(private readonly configService: ConfigService) {}

  // --- GitHub ---

  @Get('github')
  @Public()
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Initiate GitHub OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to GitHub authorization' })
  githubLogin(): void {
    // Guard redirects to GitHub
  }

  @Get('github/callback')
  @Public()
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  githubCallback(@Req() req: Request, @Res() res: Response): void {
    const authResponse = req.user as AuthResponseDto;
    this.handleOAuthCallback(res, authResponse);
  }

  // --- GitLab ---

  @Get('gitlab')
  @Public()
  @UseGuards(AuthGuard('gitlab'))
  @ApiOperation({ summary: 'Initiate GitLab OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to GitLab authorization' })
  gitlabLogin(): void {
    // Guard redirects to GitLab
  }

  @Get('gitlab/callback')
  @Public()
  @UseGuards(AuthGuard('gitlab'))
  @ApiOperation({ summary: 'GitLab OAuth callback' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  gitlabCallback(@Req() req: Request, @Res() res: Response): void {
    const authResponse = req.user as AuthResponseDto;
    this.handleOAuthCallback(res, authResponse);
  }

  // --- Bitbucket ---

  @Get('bitbucket')
  @Public()
  @UseGuards(AuthGuard('bitbucket'))
  @ApiOperation({ summary: 'Initiate Bitbucket OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Bitbucket authorization' })
  bitbucketLogin(): void {
    // Guard redirects to Bitbucket
  }

  @Get('bitbucket/callback')
  @Public()
  @UseGuards(AuthGuard('bitbucket'))
  @ApiOperation({ summary: 'Bitbucket OAuth callback' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  bitbucketCallback(@Req() req: Request, @Res() res: Response): void {
    const authResponse = req.user as AuthResponseDto;
    this.handleOAuthCallback(res, authResponse);
  }

  // --- Shared ---

  private handleOAuthCallback(res: Response, authResponse: AuthResponseDto): void {
    const frontendUrl = this.configService.get<string>('DASHBOARD_URL', 'http://localhost:4200');
    const params = new URLSearchParams({
      accessToken: authResponse.accessToken,
      refreshToken: authResponse.refreshToken,
    });

    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }
}
