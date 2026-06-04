import type { UserRole } from './session';

type RouteLike = {
  hash?: string;
  pathname?: string;
  search?: string;
  state?: unknown;
};

type RedirectState = {
  from?: RouteLike;
};

const LOGIN_PATHS = new Set([
  '/login',
  '/employee/login',
  '/hr/login',
  '/manager/login',
  '/management/login',
  '/accounting/login',
  '/forgot-password',
  '/verify-email',
]);

function roleBasePath(role: UserRole) {
  return `/${role}`;
}

function routePathFromLocation(location: RouteLike) {
  return `${location.pathname ?? ''}${location.search ?? ''}${location.hash ?? ''}`;
}

function pathnameOf(path: string) {
  const markerIndex = path.search(/[?#]/);
  return markerIndex === -1 ? path : path.slice(0, markerIndex);
}

function normalizeInternalRedirectPath(path: string | null | undefined) {
  const trimmed = path?.trim() ?? '';
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//') || /[\r\n]/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function isLoginPath(path: string) {
  return LOGIN_PATHS.has(pathnameOf(path));
}

function stateRedirectPath(state: unknown) {
  if (!state || typeof state !== 'object') return null;

  const from = (state as RedirectState).from;
  if (!from || typeof from !== 'object') return null;

  return normalizeInternalRedirectPath(routePathFromLocation(from));
}

function queryRedirectPath(search: string | undefined) {
  const params = new URLSearchParams(search ?? '');
  return normalizeInternalRedirectPath(params.get('next'));
}

function isAllowedRolePath(role: UserRole, path: string) {
  const basePath = roleBasePath(role);
  const pathname = pathnameOf(path);
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function buildLoginRedirectPathForPath(path: string | null | undefined) {
  const nextPath = normalizeInternalRedirectPath(path);
  if (!nextPath || isLoginPath(nextPath)) {
    return '/login';
  }

  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export function buildLoginRedirectPath(location: RouteLike) {
  return buildLoginRedirectPathForPath(routePathFromLocation(location));
}

export function getPostAuthRedirectPath(
  role: UserRole,
  requiresPasswordChange: boolean,
  location: RouteLike,
  fallbackPath: string
) {
  if (requiresPasswordChange) return '/change-password';

  const requestedPath = queryRedirectPath(location.search) ?? stateRedirectPath(location.state);
  if (requestedPath && !isLoginPath(requestedPath) && isAllowedRolePath(role, requestedPath)) {
    return requestedPath;
  }

  return fallbackPath;
}
