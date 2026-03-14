# Organizations & Projects

## Organizations

An organization is the top-level grouping unit in Testing AI Assistant. All projects, pipelines, and settings exist within an organization.

### Creating an Organization

1. Navigate to the "Organizations" section
2. Click "New Organization"
3. Enter name and description
4. Click "Create"

You automatically become the administrator of the created organization.

### Member Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `ADMIN` | Administrator | Full access: manage members, projects, settings |
| `MEMBER` | Member | Create and manage projects, run tests |
| `VIEWER` | Viewer | Read-only access to projects and results |

### Managing Members

#### Inviting

1. Open organization → "Members"
2. Click "Invite"
3. Enter user email and role
4. Invitation is sent via email

#### Approving / Rejecting

Administrators can approve or reject membership requests:

1. Open the "Pending" section in the member list
2. Click "Approve" or "Reject"

#### Changing Role

1. Open the member list
2. Find the member
3. Select new role from the dropdown

#### Removing a Member

1. Open the member list
2. Click "Remove" next to the member
3. Confirm the action

### Organization API

```
POST   /organizations/:orgId/members/invite         — Invite member
GET    /organizations/:orgId/members                 — List members
PATCH  /organizations/:orgId/members/:id/approve     — Approve
PATCH  /organizations/:orgId/members/:id/reject      — Reject
PATCH  /organizations/:orgId/members/:id/role        — Change role
DELETE /organizations/:orgId/members/:id             — Remove
```

## Projects

A project belongs to an organization and represents a Git repository for which automated testing is configured.

### Creating a Project

1. Navigate to organization → "Projects"
2. Click "New Project"
3. Fill in:
   - **Name** — project name
   - **Description** — brief description
   - **Git provider** — GitHub, GitLab, or Bitbucket
   - **Repository URL** — link to the repository
   - **Default branch** — main branch (e.g., `main`)
4. Click "Create"

### Connecting a Webhook

A webhook allows automatic test triggering on push or pull request.

1. Open project → "Settings"
2. Click "Connect Webhook"
3. The system automatically creates a webhook in the Git provider
4. Status will show as "Connected"

> **Important:** Creating a webhook requires repository admin rights and configured Git provider OAuth tokens.

### Disconnecting a Webhook

1. Open project → "Settings"
2. Click "Disconnect Webhook"
3. The webhook will be removed from the Git provider

### Webhook Event Processing

When an event is received from a Git provider, the system:

1. Verifies the signature and event validity
2. Determines the event type (push, pull request)
3. Finds matching active pipelines
4. Automatically triggers test runs

### Project API

```
POST   /projects                           — Create project
GET    /projects?orgId=<id>                — List projects
GET    /projects/:id                       — Project details
PATCH  /projects/:id                       — Update
DELETE /projects/:id                       — Delete
POST   /projects/:id/webhook/connect       — Connect webhook
DELETE /projects/:id/webhook/disconnect    — Disconnect webhook
```

## Git Providers

### Supported Providers

| Provider | OAuth | Webhooks | Status |
|----------|-------|----------|--------|
| GitHub | Yes | Yes | Full support |
| GitLab | Yes | Yes | Full support |
| Bitbucket | Yes | Yes | Full support |

### OAuth Configuration

To integrate with a Git provider, configure an OAuth application and set the keys in `.env`:

**GitHub:**
```env
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
```

**GitLab:**
```env
GITLAB_CLIENT_ID=your-client-id
GITLAB_CLIENT_SECRET=your-client-secret
```

**Bitbucket:**
```env
BITBUCKET_CLIENT_ID=your-client-id
BITBUCKET_CLIENT_SECRET=your-client-secret
```
