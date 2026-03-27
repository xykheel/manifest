import { type AuthProvider, type UserRole } from "@manifest/shared";

type UserRowForToken = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  authProvider: string;
};

export function accessTokenPayloadFromUser(user: UserRowForToken) {
  return {
    sub: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as UserRole,
    authProvider: user.authProvider as AuthProvider,
  };
}
