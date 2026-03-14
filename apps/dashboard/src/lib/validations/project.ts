import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  repoUrl: z.string().url('Must be a valid URL'),
  repoProvider: z.enum(['GITHUB', 'GITLAB', 'BITBUCKET']),
  defaultBranch: z.string().min(1, 'Default branch is required').max(100).default('main'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  repoUrl: z.string().url('Must be a valid URL').optional(),
  defaultBranch: z.string().min(1, 'Default branch is required').max(100).optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
