import "next-auth";
import { Role } from "@/lib/rbac";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: Role;
      dealerId: string | null;
    };
  }

  interface User {
    id: string;
    username: string;
    role: Role;
    dealerId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: Role;
    dealerId: string | null;
  }
}
