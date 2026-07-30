# Case study: building `entitlement-lite`

## The problem

Most permission systems in enterprise apps start as pure RBAC: a role → a list of allowed actions. It works fine until the first requirement that isn't role-shaped — "editors can edit invoices, but only their own," "approvers can approve, but only under a spending threshold," "managers can view reports, but only for their department." At that point teams usually bolt an `if` statement onto the call site (`if (user.role === 'editor' && invoice.ownerId === user.id)`), and the permission model silently splits into two places: the role table and a scatter of ad-hoc checks that never show up in the same audit as the roles do.

`entitlement-lite` is a small distillation of the pattern I keep reaching for instead: keep permissions data-driven (roles, actions, resources), but let any individual permission carry an attribute-based condition so the ownership/threshold/department logic lives next to the grant it qualifies, not buried in a controller.

## Why RBAC alone isn't enough

Pure role-based access answers "is this action allowed for this role," which is the right question maybe 80% of the time. The remaining 20% needs request-time context — who owns the resource, what state it's in, what the requester's attributes are — and that's exactly what attribute-based access control (ABAC) is for. Rather than pick one model, `entitlement-lite` treats RBAC as the default shape (roles bundle permissions) and lets ABAC opt in per-permission via an optional `condition`. Most permissions never need one; the ones that do get it without restructuring the whole system.

## Why a dependency on `rule-lite` instead of reimplementing conditions

`entitlement-lite`'s job is resolving "does this subject have a permission for this action/resource," not evaluating arbitrary boolean logic against a context object — that's a separate, already-solved problem, and I'd already solved it as `rule-lite`. Depending on it directly instead of copy-pasting or reimplementing a smaller condition evaluator means:

- one bug fix or operator addition in `rule-lite` benefits both packages
- consumers who already use `rule-lite` for form/feature-flag logic get a condition syntax they already know
- `entitlement-lite`'s own surface area stays focused on role/permission resolution — matching, wildcarding, and the "any matching permission grants access" logic — which is genuinely a different concern from condition evaluation

The trade-off is a real npm dependency instead of a zero-dependency package. That's acceptable here because `rule-lite` is itself dependency-free and tiny — the combined footprint is still small, and it avoids the much worse alternative of two divergent condition-evaluation implementations in the same "-lite" family.

## Wildcards over a separate "all access" flag

`'*'` on `action` or `resource` reuses the same matching path as a literal string, rather than introducing a separate `Permission.grantsAll` boolean or an `AdminRole` type. An admin role is just `{ action: '*', resource: '*' }` — no special-casing anywhere in `EntitlementEngine.can()`. This keeps the matching logic to a single function (`permissionMatches`) instead of a wildcard code path plus a literal-match code path.

## Any-match semantics

`can()` returns true if *any* permission across *any* held role matches and passes its condition — there's no explicit-deny or permission-priority concept. This mirrors how most role systems actually compose access (additive, union of roles) and keeps the mental model simple: adding a role can only ever grant more access, never take it away. Systems that need explicit deny rules or priority ordering between conflicting grants need a heavier policy engine — see below.

## Trade-offs vs. full policy engines (OPA, Casbin)

Tools like Open Policy Agent or Casbin are the right choice when you need: a policy language independent of your application's runtime, centralized policy administration across many services, explicit deny rules, complex model definitions (ACL, RBAC, ABAC, RESTful patterns) configurable without code changes, or a decision log/audit trail for compliance. `entitlement-lite` is not trying to compete with them.

What it optimizes for instead: staying entirely in TypeScript (no separate policy DSL or sidecar process to run), a type-checked `Role`/`Permission` shape you get IDE autocomplete on, and a footprint small enough to read end-to-end in a few minutes. For a single service or a small set of services sharing a permission model, that's usually enough — and it's a much smaller operational lift than standing up OPA or wiring Casbin's model/policy file split. For large multi-service deployments with compliance-driven audit requirements, reach for one of those instead.

## What's next

- Publish `0.1.0` to npm once real usage exercises the wildcard + condition combination further.
- Consider an optional `explain()` function that returns *why* a `can()` call resolved true/false (which role, which permission, which condition result) — useful for debugging permission denials in support tooling.
- Consider a `deny` permission list per role for explicit overrides, if a real use case shows up — deliberately left out of `0.1.0` to keep the "any match grants" model simple.
