function getAdminUserIds(): string[] {
  return (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export { getAdminUserIds };

export function isAdminUserId(userId: string): boolean {
  return getAdminUserIds().includes(userId);
}
