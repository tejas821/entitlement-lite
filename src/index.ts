import { evaluate as evaluateRule } from 'rule-lite';
import type { EvaluationContext, Permission, Role, Subject } from './types';

export * from './types';

function permissionMatches(permission: Permission, action: string, resource: string): boolean {
  const actionMatches = permission.action === '*' || permission.action === action;
  const resourceMatches = permission.resource === '*' || permission.resource === resource;
  return actionMatches && resourceMatches;
}

function permissionGrants(
  permission: Permission,
  context: EvaluationContext
): boolean {
  if (!permission.condition) return true;
  return evaluateRule(permission.condition, context);
}

/**
 * EntitlementEngine resolves whether a Subject can perform an action on a
 * resource, based on the permissions attached to the subject's roles.
 * Zero framework dependency — usable from Angular, React, Node, etc.
 */
export class EntitlementEngine {
  private roles: Map<string, Role> = new Map();

  constructor(roles: Role[] = []) {
    for (const role of roles) {
      this.registerRole(role);
    }
  }

  /** Register a new role, or overwrite an existing role with the same name. */
  registerRole(role: Role): void {
    this.roles.set(role.name, role);
  }

  /**
   * Returns true if the subject holds any role with a permission matching
   * `action` + `resource` (either may be matched via a '*' wildcard on the
   * permission) whose optional condition, if present, evaluates to true
   * against `context`.
   */
  can(subject: Subject, action: string, resource: string, context: EvaluationContext = {}): boolean {
    for (const roleName of subject.roles) {
      const role = this.roles.get(roleName);
      if (!role) continue;

      for (const permission of role.permissions) {
        if (!permissionMatches(permission, action, resource)) continue;
        if (permissionGrants(permission, context)) return true;
      }
    }
    return false;
  }
}

/** Convenience one-off check without instantiating an EntitlementEngine. */
export function can(
  roles: Role[],
  subject: Subject,
  action: string,
  resource: string,
  context: EvaluationContext = {}
): boolean {
  return new EntitlementEngine(roles).can(subject, action, resource, context);
}
