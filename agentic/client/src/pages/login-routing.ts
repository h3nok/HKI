import { type Role } from "@shared/access-control";

export function getPostLoginPath(
  role: Role | null | undefined,
  returnTo?: string | null
): string {
  const normalizedReturnTo = returnTo?.trim();
  if (normalizedReturnTo) {
    return normalizedReturnTo;
  }

  switch (role) {
    case "admin":
      return "/admin";
    case "manager":
    case "operator":
      return "/knowledge";
    case "viewer":
      return "/chat";
    default:
      return "/chat";
  }
}
