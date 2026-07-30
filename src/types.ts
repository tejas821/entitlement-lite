/**
 * entitlement-lite — type definitions
 *
 * A Subject holds the roles it has plus arbitrary attributes usable in
 * attribute-based conditions (evaluated via rule-lite). A Role bundles a set
 * of Permissions; a Permission grants an action on a resource, optionally
 * gated by a rule-lite Rule evaluated against an EvaluationContext.
 */

import type { Rule } from 'rule-lite';

/** A single grant: action + resource, optionally gated by an attribute-based condition. */
export interface Permission {
  /** e.g. 'edit', 'view', 'delete', 'approve'. Use '*' to match any action. */
  action: string;
  /** e.g. 'invoice', 'report', 'user'. Use '*' to match any resource. */
  resource: string;
  /** Optional rule-lite Rule evaluated against the EvaluationContext passed to `can()`. */
  condition?: Rule;
}

/** A named bundle of permissions, e.g. 'editor', 'approver'. */
export interface Role {
  name: string;
  permissions: Permission[];
}

/** The entity being checked for access. `roles` are role names; other keys are attributes. */
export interface Subject {
  roles: string[];
  /** Arbitrary attributes usable in conditions, e.g. subject.id, subject.department */
  [key: string]: unknown;
}

/** Re-exported from rule-lite so consumers don't need a direct dependency on it. */
export type { Rule, EvaluationContext } from 'rule-lite';
