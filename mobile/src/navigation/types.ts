// FILE: mobile/src/navigation/types.ts
// Shared navigation and manifest types.

export interface ManifestTenant {
  id: string;
  name: string | null;
  industry: string;
  plan: string | null;
  currency: string;
  logo: string | null;
  accent: string | null;
  accentSecondary: string | null;
  isWhiteLabel: boolean;
  partnerId: string | null;
  brandName: string | null;
}

export interface ManifestUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  permissions: string[];
}

export interface HubGroup {
  group: string;
  modules: string[];
}

export interface AppManifest {
  schemaVersion: number;
  tenant: ManifestTenant;
  user: ManifestUser;
  modules: string[];
  tabs: string[];
  labels: Record<string, string>;
  hubGroups: HubGroup[];
  home: { widgets: string[] };
  flags: Record<string, boolean>;
}

// Navigation param lists
export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
};

export type RootStackParamList = {
  Main: undefined;
  Auth: undefined;
};

// Each tab's stack can accept at minimum these params
export type ModuleStackParamList = {
  [key: string]: undefined | Record<string, unknown>;
};
