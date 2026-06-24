import { HIERARCHY_LEVELS, SUPER_ADMIN_EMAILS } from "./constants.js?v=20";

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function currentUserEmail(state = {}) {
  return normalizeEmail(state.session?.user?.email || state.currentUserProfile?.email || "");
}

function normalizeProfile(profile = {}) {
  return {
    ...profile,
    email: normalizeEmail(profile.email),
    role: String(profile.role || "").trim().toLowerCase(),
    access_level: String(profile.access_level || "").trim().toLowerCase(),
    hierarchy_level: Number(profile.hierarchy_level || 0),
    status: String(profile.status || "active").trim().toLowerCase(),
  };
}

function isActiveProfile(profile = {}) {
  return String(profile.status || "active").trim().toLowerCase() === "active";
}

export function getCurrentUserProfile(state = {}) {
  const profile = normalizeProfile(state.currentUserProfile || {});
  const email = currentUserEmail(state);
  if (!email && !profile.email) return null;

  return {
    ...profile,
    auth_user_id: profile.auth_user_id || state.session?.user?.id || "",
    email: profile.email || email,
  };
}

export function isSuperAdmin(state = {}) {
  const email = currentUserEmail(state);
  if (SUPER_ADMIN_EMAILS.includes(email)) return true;

  const profile = getCurrentUserProfile(state);
  if (!profile || !isActiveProfile(profile)) return false;
  return (
    profile.role === "super_admin" ||
    profile.access_level === "super_admin" ||
    Number(profile.hierarchy_level || 0) >= HIERARCHY_LEVELS.super_admin
  );
}

export function isAdminOrAbove(state = {}) {
  if (isSuperAdmin(state)) return true;
  const profile = getCurrentUserProfile(state);
  if (!profile || !isActiveProfile(profile)) return false;
  return (
    profile.role === "admin" ||
    profile.access_level === "admin" ||
    Number(profile.hierarchy_level || 0) >= HIERARCHY_LEVELS.admin
  );
}

export function canAccessSettings(state = {}) {
  return isSuperAdmin(state);
}

export function canManageUsers(state = {}) {
  return isSuperAdmin(state) || isAdminOrAbove(state);
}

export function canCreateUser(state = {}) {
  return canManageUsers(state);
}

export function canEditUser(state = {}, targetProfile = null) {
  if (isSuperAdmin(state)) return true;
  if (canManageUsers(state)) {
    const targetEmail = normalizeEmail(targetProfile?.email);
    return !SUPER_ADMIN_EMAILS.includes(targetEmail);
  }
  const profile = getCurrentUserProfile(state);
  return Boolean(profile?.auth_user_id && targetProfile?.auth_user_id === profile.auth_user_id);
}

export function canDeactivateUser(state = {}, targetProfile = null) {
  if (isSuperAdmin(state)) return true;
  if (!canManageUsers(state)) return false;
  return !SUPER_ADMIN_EMAILS.includes(normalizeEmail(targetProfile?.email));
}
