export interface MiniprogramVerificationIssue {
  code: string;
  file: string;
  message: string;
}

export interface MiniprogramVerificationResult {
  appId: string;
  officialTemplateCount: number;
  packageBytes: number;
  pageCount: number;
  issues: MiniprogramVerificationIssue[];
  warnings: string[];
}

export interface MiniprogramVerificationOptions {
  expectedRoutes?: readonly string[];
}

export const REQUIRED_ROUTES: readonly string[];

export function verifyMiniprogram(
  projectRoot: string,
  options?: MiniprogramVerificationOptions,
): MiniprogramVerificationResult;
