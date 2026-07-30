# entitlement-lite

Tiny, framework-agnostic **RBAC/ABAC permission-checking engine** for TypeScript — role-based access with an attribute-based escape hatch, built on [`rule-lite`](https://github.com/tejas821/rule-lite).

[![CI](https://github.com/tejas821/entitlement-lite/actions/workflows/ci.yml/badge.svg)](https://github.com/tejas821/entitlement-lite/actions/workflows/ci.yml)
![license](https://img.shields.io/badge/license-MIT-blue)

Framework-agnostic — drop it into Angular, React, Node, or plain JS.

## Why

"Can this user edit this invoice?" is rarely a pure role question in enterprise apps — it's usually "can this user edit this invoice, *and* do they own it / is it in their department / is it under the approval threshold." Pure RBAC (role → permission) handles the first half well but forces the second half into scattered `if` statements at call sites. Pure ABAC (attribute rules only) is powerful but overkill when 90% of checks really are "does this role allow this action."

`entitlement-lite` gives you both in one small API:

- roles bundle permissions (`action` + `resource`), the RBAC part
- any permission can carry an optional `condition` — a [`rule-lite`](https://github.com/tejas821/rule-lite) `Rule` evaluated against request-time context — the ABAC escape hatch
- `'*'` wildcards on `action` and/or `resource` for broad grants (e.g. admin roles)
- zero framework dependency, one real dependency (`rule-lite`) for condition evaluation

## Install

```bash
npm install entitlement-lite
```

## Quick start

```ts
import { EntitlementEngine } from 'entitlement-lite';

const engine = new EntitlementEngine([
  {
    name: 'viewer',
    permissions: [{ action: 'view', resource: 'invoice' }],
  },
  {
    name: 'contributor',
    permissions: [
      {
        action: 'edit',
        resource: 'invoice',
        // attribute-based condition, evaluated via rule-lite
        condition: { field: 'resource.ownerId', operator: 'eq', value: 'u1' },
      },
    ],
  },
]);

const subject = { roles: ['viewer', 'contributor'], id: 'u1' };

engine.can(subject, 'view', 'invoice'); // true — plain RBAC match
engine.can(subject, 'edit', 'invoice', { resource: { ownerId: 'u1' } }); // true — condition passes
engine.can(subject, 'edit', 'invoice', { resource: { ownerId: 'u9' } }); // false — condition fails
```

### One-off check (no need to instantiate)

```ts
import { can } from 'entitlement-lite';

can(roles, subject, 'delete', 'report'); // boolean
```

## API

| Member | Signature | Description |
|---|---|---|
| `EntitlementEngine` | `new EntitlementEngine(roles?: Role[])` | Construct with an initial set of roles. |
| `.can()` | `can(subject, action, resource, context?): boolean` | True if any role the subject holds has a matching permission whose condition (if any) passes. |
| `.registerRole()` | `registerRole(role: Role): void` | Add a new role, or overwrite an existing role with the same name. |
| `can()` (standalone) | `can(roles, subject, action, resource, context?): boolean` | One-off check without instantiating an engine. |

### Shapes

```ts
interface Permission {
  action: string;      // e.g. 'edit', 'view', 'delete', 'approve' — or '*'
  resource: string;    // e.g. 'invoice', 'report', 'user' — or '*'
  condition?: Rule;     // optional rule-lite Rule evaluated against `context`
}

interface Role {
  name: string;
  permissions: Permission[];
}

interface Subject {
  roles: string[];
  [key: string]: unknown; // arbitrary attributes usable in conditions
}
```

`Rule` and `EvaluationContext` are re-exported from `rule-lite` — see [its docs](https://github.com/tejas821/rule-lite#rule-shape) for the full condition syntax (`all` / `any` / `not`, built-in operators, custom operators).

## Wildcards

A permission's `action` or `resource` can be `'*'` to match anything:

```ts
{ action: '*', resource: 'invoice' }   // any action on invoices
{ action: 'delete', resource: '*' }    // delete on any resource
{ action: '*', resource: '*' }         // full access — typical "admin" role
```

## Use with Angular

`entitlement-lite` has no framework dependency, so it drops straight into a service:

```ts
@Injectable({ providedIn: 'root' })
export class EntitlementService {
  private engine = new EntitlementEngine(APP_ROLES);

  can(subject: Subject, action: string, resource: string, context?: EvaluationContext): boolean {
    return this.engine.can(subject, action, resource, context);
  }
}
```

Pair it with a structural directive or an `*ngIf="entitlementService.can(currentUser, 'edit', 'invoice', { resource: invoice }) "` binding to drive UI-level permission checks from the same role/condition config used on the backend.

## Design notes

See [CASE_STUDY.md](./CASE_STUDY.md) for why RBAC alone isn't enough, why `rule-lite` is a dependency instead of reimplemented condition logic, and how this compares to full policy engines like OPA/Casbin.

## Development

```bash
npm install
npm test
npm run build
```

## License

MIT © Tejas Kadam
