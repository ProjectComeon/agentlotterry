export type Role = "admin" | "dealer" | "customer";

export interface Permission {
  viewAllDealers: boolean;
  manageDealers: boolean;
  manageAllCustomers: boolean;
  manageOwnCustomers: boolean;
  placeBets: boolean;
  viewAllSummary: boolean;
  viewOwnSummary: boolean;
  viewOwnBets: boolean;
  viewLotteryResult: boolean;
}

const permissions: Record<Role, Permission> = {
  admin: {
    viewAllDealers: true,
    manageDealers: true,
    manageAllCustomers: true,
    manageOwnCustomers: false,
    placeBets: false,
    viewAllSummary: true,
    viewOwnSummary: false,
    viewOwnBets: false,
    viewLotteryResult: true,
  },
  dealer: {
    viewAllDealers: false,
    manageDealers: false,
    manageAllCustomers: false,
    manageOwnCustomers: true,
    placeBets: false,
    viewAllSummary: false,
    viewOwnSummary: true,
    viewOwnBets: false,
    viewLotteryResult: true,
  },
  customer: {
    viewAllDealers: false,
    manageDealers: false,
    manageAllCustomers: false,
    manageOwnCustomers: false,
    placeBets: true,
    viewAllSummary: false,
    viewOwnSummary: false,
    viewOwnBets: true,
    viewLotteryResult: true,
  },
};

export function getPermissions(role: Role): Permission {
  return permissions[role];
}

export function hasPermission(role: Role, perm: keyof Permission): boolean {
  return permissions[role]?.[perm] ?? false;
}

export const PAYOUT_RATES: Record<string, number> = {
  "2_top": 70,
  "2_bottom": 70,
  "3_top": 500,
  "3_tote": 100,
  "run_top": 3,
  "run_bottom": 4.5,
};

export const BET_TYPE_LABELS: Record<string, string> = {
  "2_top": "2 ตัวบน",
  "2_bottom": "2 ตัวล่าง",
  "3_top": "3 ตัวบน",
  "3_tote": "3 ตัวโต๊ด",
  "run_top": "วิ่งบน",
  "run_bottom": "วิ่งล่าง",
};

export const ROLES_REDIRECT: Record<Role, string> = {
  admin: "/admin/dashboard",
  dealer: "/dealer/dashboard",
  customer: "/customer/dashboard",
};
