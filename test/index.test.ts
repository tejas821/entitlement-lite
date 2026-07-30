import { EntitlementEngine, can, Role, Subject } from '../src/index';

describe('EntitlementEngine — basic role lookup', () => {
  const roles: Role[] = [
    {
      name: 'viewer',
      permissions: [{ action: 'view', resource: 'report' }],
    },
    {
      name: 'editor',
      permissions: [
        { action: 'view', resource: 'report' },
        { action: 'edit', resource: 'report' },
      ],
    },
  ];
  const engine = new EntitlementEngine(roles);

  it('grants access when a matching permission exists', () => {
    const subject: Subject = { roles: ['viewer'] };
    expect(engine.can(subject, 'view', 'report')).toBe(true);
  });

  it('denies access when no permission matches the action', () => {
    const subject: Subject = { roles: ['viewer'] };
    expect(engine.can(subject, 'edit', 'report')).toBe(false);
  });

  it('denies access when no permission matches the resource', () => {
    const subject: Subject = { roles: ['viewer'] };
    expect(engine.can(subject, 'view', 'invoice')).toBe(false);
  });

  it('grants access for a role with the matching permission', () => {
    const subject: Subject = { roles: ['editor'] };
    expect(engine.can(subject, 'edit', 'report')).toBe(true);
  });
});

describe('EntitlementEngine — wildcards', () => {
  it('matches any action via action wildcard', () => {
    const engine = new EntitlementEngine([
      { name: 'admin', permissions: [{ action: '*', resource: 'invoice' }] },
    ]);
    const subject: Subject = { roles: ['admin'] };
    expect(engine.can(subject, 'delete', 'invoice')).toBe(true);
    expect(engine.can(subject, 'approve', 'invoice')).toBe(true);
  });

  it('matches any resource via resource wildcard', () => {
    const engine = new EntitlementEngine([
      { name: 'superadmin', permissions: [{ action: 'delete', resource: '*' }] },
    ]);
    const subject: Subject = { roles: ['superadmin'] };
    expect(engine.can(subject, 'delete', 'invoice')).toBe(true);
    expect(engine.can(subject, 'delete', 'user')).toBe(true);
  });

  it('matches both wildcards for full access', () => {
    const engine = new EntitlementEngine([
      { name: 'root', permissions: [{ action: '*', resource: '*' }] },
    ]);
    const subject: Subject = { roles: ['root'] };
    expect(engine.can(subject, 'anything', 'whatever')).toBe(true);
  });
});

describe('EntitlementEngine — condition-gated permissions', () => {
  const roles: Role[] = [
    {
      name: 'contributor',
      permissions: [
        {
          action: 'edit',
          resource: 'invoice',
          condition: { field: 'resource.ownerId', operator: 'eq', value: 'u1' },
        },
      ],
    },
  ];

  it('grants access when the condition passes', () => {
    const engine = new EntitlementEngine(roles);
    const subject: Subject = { roles: ['contributor'], id: 'u1' };
    const context = { resource: { ownerId: 'u1' } };
    expect(engine.can(subject, 'edit', 'invoice', context)).toBe(true);
  });

  it('denies access when the condition fails', () => {
    const engine = new EntitlementEngine([
      {
        name: 'contributor',
        permissions: [
          {
            action: 'edit',
            resource: 'invoice',
            condition: { field: 'resource.ownerId', operator: 'eq', value: 'u1' },
          },
        ],
      },
    ]);
    const subject: Subject = { roles: ['contributor'], id: 'u2' };
    const context = { resource: { ownerId: 'someone-else' } };
    expect(engine.can(subject, 'edit', 'invoice', context)).toBe(false);
  });

  it('grants access unconditionally when no condition is set', () => {
    const engine = new EntitlementEngine([
      { name: 'viewer', permissions: [{ action: 'view', resource: 'invoice' }] },
    ]);
    const subject: Subject = { roles: ['viewer'] };
    expect(engine.can(subject, 'view', 'invoice')).toBe(true);
  });

  it('supports composite rule-lite conditions (all/any/not)', () => {
    const engine = new EntitlementEngine([
      {
        name: 'approver',
        permissions: [
          {
            action: 'approve',
            resource: 'invoice',
            condition: {
              all: [
                { field: 'resource.amount', operator: 'lte', value: 1000 },
                { field: 'subject.department', operator: 'eq', value: 'finance' },
              ],
            },
          },
        ],
      },
    ]);
    const subject: Subject = { roles: ['approver'], department: 'finance' };
    const okContext = { resource: { amount: 500 }, subject: { department: 'finance' } };
    const tooLargeContext = { resource: { amount: 5000 }, subject: { department: 'finance' } };
    expect(engine.can(subject, 'approve', 'invoice', okContext)).toBe(true);
    expect(engine.can(subject, 'approve', 'invoice', tooLargeContext)).toBe(false);
  });
});

describe('EntitlementEngine — multiple roles on one subject', () => {
  it('grants access if ANY held role has a matching permission', () => {
    const engine = new EntitlementEngine([
      { name: 'viewer', permissions: [{ action: 'view', resource: 'report' }] },
      { name: 'approver', permissions: [{ action: 'approve', resource: 'report' }] },
    ]);
    const subject: Subject = { roles: ['viewer', 'approver'] };
    expect(engine.can(subject, 'view', 'report')).toBe(true);
    expect(engine.can(subject, 'approve', 'report')).toBe(true);
    expect(engine.can(subject, 'delete', 'report')).toBe(false);
  });

  it('combines matching and condition-gated permissions across roles', () => {
    const engine = new EntitlementEngine([
      { name: 'viewer', permissions: [{ action: 'view', resource: 'invoice' }] },
      {
        name: 'contributor',
        permissions: [
          {
            action: 'edit',
            resource: 'invoice',
            condition: { field: 'resource.ownerId', operator: 'eq', value: 'u1' },
          },
        ],
      },
    ]);
    const subject: Subject = { roles: ['viewer', 'contributor'] };
    expect(engine.can(subject, 'view', 'invoice')).toBe(true);
    expect(engine.can(subject, 'edit', 'invoice', { resource: { ownerId: 'u1' } })).toBe(true);
    expect(engine.can(subject, 'edit', 'invoice', { resource: { ownerId: 'u9' } })).toBe(false);
  });
});

describe('EntitlementEngine — unknown role handling', () => {
  it('ignores role names the subject has that were never registered', () => {
    const engine = new EntitlementEngine([
      { name: 'viewer', permissions: [{ action: 'view', resource: 'report' }] },
    ]);
    const subject: Subject = { roles: ['ghost-role'] };
    expect(engine.can(subject, 'view', 'report')).toBe(false);
  });

  it('denies access for a subject with no roles', () => {
    const engine = new EntitlementEngine([
      { name: 'viewer', permissions: [{ action: 'view', resource: 'report' }] },
    ]);
    const subject: Subject = { roles: [] };
    expect(engine.can(subject, 'view', 'report')).toBe(false);
  });
});

describe('EntitlementEngine — registerRole', () => {
  it('adds a new role after construction', () => {
    const engine = new EntitlementEngine();
    engine.registerRole({ name: 'viewer', permissions: [{ action: 'view', resource: 'report' }] });
    const subject: Subject = { roles: ['viewer'] };
    expect(engine.can(subject, 'view', 'report')).toBe(true);
  });

  it('overwrites an existing role registered with the same name', () => {
    const engine = new EntitlementEngine([
      { name: 'viewer', permissions: [{ action: 'view', resource: 'report' }] },
    ]);
    engine.registerRole({ name: 'viewer', permissions: [{ action: 'edit', resource: 'report' }] });
    const subject: Subject = { roles: ['viewer'] };
    expect(engine.can(subject, 'view', 'report')).toBe(false);
    expect(engine.can(subject, 'edit', 'report')).toBe(true);
  });
});

describe('standalone can()', () => {
  it('evaluates without instantiating EntitlementEngine manually', () => {
    const roles: Role[] = [{ name: 'viewer', permissions: [{ action: 'view', resource: 'report' }] }];
    const subject: Subject = { roles: ['viewer'] };
    expect(can(roles, subject, 'view', 'report')).toBe(true);
    expect(can(roles, subject, 'edit', 'report')).toBe(false);
  });
});
