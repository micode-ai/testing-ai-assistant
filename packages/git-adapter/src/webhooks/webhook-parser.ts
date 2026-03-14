import { OAuthProvider } from '@testing-ai/shared-types';

export type WebhookEventType = 'push' | 'pull_request' | 'tag' | 'comment' | 'unknown';

export interface WebhookEvent {
  provider: OAuthProvider;
  event: WebhookEventType;
  repoUrl: string;
  branch: string;
  commitSha: string;
  prNumber?: number;
  sender: string;
  payload: unknown;
}

export function parseWebhookEvent(
  provider: OAuthProvider,
  headers: Record<string, string>,
  body: unknown,
): WebhookEvent {
  switch (provider) {
    case OAuthProvider.GITHUB:
      return parseGitHubWebhook(headers, body);

    case OAuthProvider.GITLAB:
      return parseGitLabWebhook(headers, body);

    case OAuthProvider.BITBUCKET:
      return parseBitbucketWebhook(headers, body);

    default: {
      const exhaustiveCheck: never = provider;
      throw new Error(`Unsupported provider: ${exhaustiveCheck}`);
    }
  }
}

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

interface GitHubPushPayload {
  ref: string;
  after: string;
  repository: { html_url: string };
  sender: { login: string };
}

interface GitHubPRPayload {
  action: string;
  pull_request: {
    number: number;
    head: { ref: string; sha: string };
  };
  repository: { html_url: string };
  sender: { login: string };
}

function parseGitHubWebhook(
  headers: Record<string, string>,
  body: unknown,
): WebhookEvent {
  const eventHeader = (headers['x-github-event'] ?? '').toLowerCase();
  const payload = body as Record<string, unknown>;

  if (eventHeader === 'push') {
    const data = payload as unknown as GitHubPushPayload;
    const branch = data.ref.replace('refs/heads/', '').replace('refs/tags/', '');

    return {
      provider: OAuthProvider.GITHUB,
      event: data.ref.startsWith('refs/tags/') ? 'tag' : 'push',
      repoUrl: data.repository.html_url,
      branch,
      commitSha: data.after,
      sender: data.sender.login,
      payload,
    };
  }

  if (eventHeader === 'pull_request') {
    const data = payload as unknown as GitHubPRPayload;

    return {
      provider: OAuthProvider.GITHUB,
      event: 'pull_request',
      repoUrl: data.repository.html_url,
      branch: data.pull_request.head.ref,
      commitSha: data.pull_request.head.sha,
      prNumber: data.pull_request.number,
      sender: data.sender.login,
      payload,
    };
  }

  return buildUnknownEvent(OAuthProvider.GITHUB, payload);
}

// ---------------------------------------------------------------------------
// GitLab
// ---------------------------------------------------------------------------

interface GitLabPushPayload {
  object_kind: string;
  ref: string;
  after: string;
  project: { web_url: string };
  user_username: string;
}

interface GitLabMRPayload {
  object_kind: string;
  object_attributes: {
    iid: number;
    source_branch: string;
    last_commit: { id: string };
  };
  project: { web_url: string };
  user: { username: string };
}

function parseGitLabWebhook(
  headers: Record<string, string>,
  body: unknown,
): WebhookEvent {
  const eventHeader = (headers['x-gitlab-event'] ?? '').toLowerCase();
  const payload = body as Record<string, unknown>;
  const objectKind = (payload.object_kind as string) ?? '';

  if (objectKind === 'push' || eventHeader.includes('push')) {
    const data = payload as unknown as GitLabPushPayload;
    const branch = data.ref.replace('refs/heads/', '').replace('refs/tags/', '');

    return {
      provider: OAuthProvider.GITLAB,
      event: data.ref.startsWith('refs/tags/') ? 'tag' : 'push',
      repoUrl: data.project.web_url,
      branch,
      commitSha: data.after,
      sender: data.user_username,
      payload,
    };
  }

  if (objectKind === 'merge_request' || eventHeader.includes('merge request')) {
    const data = payload as unknown as GitLabMRPayload;

    return {
      provider: OAuthProvider.GITLAB,
      event: 'pull_request',
      repoUrl: data.project.web_url,
      branch: data.object_attributes.source_branch,
      commitSha: data.object_attributes.last_commit.id,
      prNumber: data.object_attributes.iid,
      sender: data.user.username,
      payload,
    };
  }

  if (objectKind === 'note' || eventHeader.includes('note')) {
    return {
      provider: OAuthProvider.GITLAB,
      event: 'comment',
      repoUrl: ((payload as Record<string, Record<string, string>>).project?.web_url) ?? '',
      branch: '',
      commitSha: '',
      sender: ((payload as Record<string, Record<string, string>>).user?.username) ?? '',
      payload,
    };
  }

  return buildUnknownEvent(OAuthProvider.GITLAB, payload);
}

// ---------------------------------------------------------------------------
// Bitbucket
// ---------------------------------------------------------------------------

interface BitbucketPushPayload {
  push: {
    changes: Array<{
      new: { name: string; target: { hash: string } } | null;
    }>;
  };
  repository: { links: { html: { href: string } } };
  actor: { display_name: string };
}

interface BitbucketPRPayload {
  pullrequest: {
    id: number;
    source: { branch: { name: string }; commit: { hash: string } };
  };
  repository: { links: { html: { href: string } } };
  actor: { display_name: string };
}

function parseBitbucketWebhook(
  headers: Record<string, string>,
  body: unknown,
): WebhookEvent {
  const eventHeader = (headers['x-event-key'] ?? '').toLowerCase();
  const payload = body as Record<string, unknown>;

  if (eventHeader.startsWith('repo:push')) {
    const data = payload as unknown as BitbucketPushPayload;
    const change = data.push.changes[0];
    const branchName = change?.new?.name ?? '';
    const sha = change?.new?.target.hash ?? '';

    return {
      provider: OAuthProvider.BITBUCKET,
      event: 'push',
      repoUrl: data.repository.links.html.href,
      branch: branchName,
      commitSha: sha,
      sender: data.actor.display_name,
      payload,
    };
  }

  if (eventHeader.startsWith('pullrequest:')) {
    const data = payload as unknown as BitbucketPRPayload;

    return {
      provider: OAuthProvider.BITBUCKET,
      event: 'pull_request',
      repoUrl: data.repository.links.html.href,
      branch: data.pullrequest.source.branch.name,
      commitSha: data.pullrequest.source.commit.hash,
      prNumber: data.pullrequest.id,
      sender: data.actor.display_name,
      payload,
    };
  }

  return buildUnknownEvent(OAuthProvider.BITBUCKET, payload);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUnknownEvent(provider: OAuthProvider, payload: unknown): WebhookEvent {
  return {
    provider,
    event: 'unknown',
    repoUrl: '',
    branch: '',
    commitSha: '',
    sender: '',
    payload,
  };
}
