# Organization Service

## Overview

| Property | Value |
|---|---|
| **Purpose** | Organization management, membership invitations, and role-based access control |
| **Port** | 3002 |
| **Database** | `org_db` (PostgreSQL, port 5434) |
| **Framework** | NestJS |
| **Gateway Route** | `/api/org/*` |

## Prisma Schema

```prisma
enum OrgPlan {
  FREE
  PRO
  ENTERPRISE
}

enum OrgMemberRole {
  ADMIN
  MEMBER
  VIEWER
}

enum OrgMemberStatus {
  PENDING
  APPROVED
  REJECTED
}

model Organization {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  name String
  slug String @unique
  plan OrgPlan @default(FREE)

  memberships OrgMembership[]
}

model OrgMembership {
  id          String          @id @default(cuid())
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  deletedAt   DateTime?

  userId      String
  role        OrgMemberRole   @default(MEMBER)
  status      OrgMemberStatus @default(PENDING)
  requestedAt DateTime        @default(now())
  resolvedAt  DateTime?

  orgId        String
  organization Organization @relation(fields: [orgId], references: [id])

  @@unique([userId, orgId])
}
```

## API Endpoints

All endpoints require `Bearer JWT` authentication. The membership endpoints are scoped under an organization and additionally require OrgMemberGuard validation.

| Method | Path | Auth | Role Required | Description |
|---|---|---|---|---|
| `POST` | `/organizations/:orgId/members/invite` | Bearer JWT | ADMIN | Invite a member to the organization |
| `GET` | `/organizations/:orgId/members` | Bearer JWT | Any member | List organization members |
| `PATCH` | `/organizations/:orgId/members/:memberId/approve` | Bearer JWT | ADMIN | Approve a pending membership |
| `PATCH` | `/organizations/:orgId/members/:memberId/reject` | Bearer JWT | ADMIN | Reject a pending membership |
| `PATCH` | `/organizations/:orgId/members/:memberId/role` | Bearer JWT | ADMIN | Change a member's role |
| `DELETE` | `/organizations/:orgId/members/:memberId` | Bearer JWT | ADMIN | Remove a member from the organization |

## Membership Invitation Flow

```mermaid
sequenceDiagram
    actor Admin
    actor InvitedUser
    participant Dashboard
    participant OrgService as Organization Service
    participant DB as PostgreSQL
    participant Redpanda
    participant NotifyService as Notification Service

    Admin->>Dashboard: Click "Invite Member"
    Dashboard->>OrgService: POST /organizations/:orgId/members/invite<br/>{email, role}
    OrgService->>DB: Check if user already a member
    alt Already a member
        OrgService-->>Dashboard: 409 Already a member
    else Not a member
        OrgService->>DB: Create OrgMembership<br/>(status: PENDING)
        OrgService->>Redpanda: Emit "membership.requested"
        Redpanda-->>NotifyService: Consume "membership.requested"
        NotifyService->>InvitedUser: Send invitation email/notification
        OrgService-->>Dashboard: 201 MembershipResponse
    end

    Note over InvitedUser,Dashboard: User sees pending invitation

    Admin->>Dashboard: Click "Approve" on pending member
    Dashboard->>OrgService: PATCH /organizations/:orgId/members/:memberId/approve
    OrgService->>DB: Update status to APPROVED<br/>Set resolvedAt
    OrgService->>Redpanda: Emit "membership.approved"
    Redpanda-->>NotifyService: Consume "membership.approved"
    NotifyService->>InvitedUser: Send approval notification
    OrgService-->>Dashboard: 200 MembershipResponse
```

## Membership Rejection Flow

```mermaid
sequenceDiagram
    actor Admin
    participant Dashboard
    participant OrgService as Organization Service
    participant DB as PostgreSQL
    participant Redpanda

    Admin->>Dashboard: Click "Reject" on pending member
    Dashboard->>OrgService: PATCH /organizations/:orgId/members/:memberId/reject
    OrgService->>DB: Update status to REJECTED<br/>Set resolvedAt
    OrgService->>Redpanda: Emit "membership.rejected"
    OrgService-->>Dashboard: 200 MembershipResponse
```

## Role-Based Access Control

### Role Hierarchy

```mermaid
graph TD
    ADMIN["ADMIN<br/>Full access"]
    MEMBER["MEMBER<br/>Read + Write"]
    VIEWER["VIEWER<br/>Read only"]

    ADMIN --> MEMBER
    MEMBER --> VIEWER
```

### Role Permissions

| Action | ADMIN | MEMBER | VIEWER |
|---|---|---|---|
| View organization details | Yes | Yes | Yes |
| List members | Yes | Yes | Yes |
| Create projects | Yes | Yes | No |
| Invite members | Yes | No | No |
| Approve/reject memberships | Yes | No | No |
| Change member roles | Yes | No | No |
| Remove members | Yes | No | No |
| Update organization settings | Yes | No | No |
| Delete organization | Yes | No | No |

## OrgMemberGuard

The `OrgMemberGuard` is a NestJS guard that performs two checks:

1. **Membership verification**: Confirms the authenticated user is a member of the organization specified by the `:orgId` route parameter and their membership status is `APPROVED`.

2. **Role authorization**: If the `@Roles()` decorator is present on the handler, it verifies the member's role matches one of the required roles.

```typescript
@Controller('organizations/:orgId/members')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class MembershipController {

  @Post('invite')
  @Roles('ADMIN')  // Only ADMIN can invite
  async invite(...) { ... }

  @Get()
  // No @Roles() -- any approved member can list
  async findAll(...) { ... }
}
```

### Guard Execution Order

```mermaid
flowchart LR
    Request["Incoming<br/>Request"] --> JwtGuard["JwtAuthGuard<br/>Validate JWT"]
    JwtGuard --> OrgGuard["OrgMemberGuard<br/>Check membership"]
    OrgGuard --> RoleCheck{"@Roles()<br/>defined?"}
    RoleCheck -- Yes --> Verify["Verify role<br/>matches"]
    RoleCheck -- No --> Handler["Route Handler"]
    Verify -- Authorized --> Handler
    Verify -- Forbidden --> Reject["403 Forbidden"]
    JwtGuard -- Invalid --> Unauth["401 Unauthorized"]
    OrgGuard -- Not member --> Forbidden["403 Forbidden"]
```
