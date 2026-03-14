import { OAuthProvider } from '@testing-ai/shared-types';

import { GitProvider } from '../interfaces/git-provider.interface';
import { GitHubProvider } from '../providers/github.provider';
import { GitLabProvider } from '../providers/gitlab.provider';
import { BitbucketProvider } from '../providers/bitbucket.provider';

export interface GitProviderOptions {
  baseUrl?: string;
}

export function createGitProvider(
  provider: OAuthProvider,
  token: string,
  options?: GitProviderOptions,
): GitProvider {
  switch (provider) {
    case OAuthProvider.GITHUB:
      return new GitHubProvider(token);

    case OAuthProvider.GITLAB:
      return new GitLabProvider(token, options?.baseUrl);

    case OAuthProvider.BITBUCKET:
      return new BitbucketProvider(token);

    default: {
      const exhaustiveCheck: never = provider;
      throw new Error(`Unsupported Git provider: ${exhaustiveCheck}`);
    }
  }
}
