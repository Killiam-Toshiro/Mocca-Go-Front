import type { components } from '@/lib/api/schema';

export type User = components['schemas']['UserResponse'];
export type UserPage = components['schemas']['UserPageResponse'];
export type UserRole = User['role'];
export type StaffRole = Exclude<UserRole, 'cliente'>;
