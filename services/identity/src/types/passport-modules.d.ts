declare module 'passport-bitbucket-oauth20' {
  import { Strategy as PassportStrategy } from 'passport';
  export class Strategy extends PassportStrategy {
    constructor(options: any, verify: any);
  }
  export interface Profile {
    id: string;
    displayName: string;
    username?: string;
    emails?: Array<{ value: string }>;
    photos?: Array<{ value: string }>;
  }
}

declare module 'passport-gitlab2' {
  import { Strategy as PassportStrategy } from 'passport';
  export class Strategy extends PassportStrategy {
    constructor(options: any, verify: any);
  }
  export interface Profile {
    id: string;
    displayName: string;
    username?: string;
    emails?: Array<{ value: string }>;
    photos?: Array<{ value: string }>;
    avatarUrl?: string;
  }
}
