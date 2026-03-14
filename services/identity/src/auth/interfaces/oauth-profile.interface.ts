export interface OAuthProfile {
  provider: string;
  providerUserId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
}
