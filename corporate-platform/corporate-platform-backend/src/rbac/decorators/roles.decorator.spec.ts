import { Roles, ROLES_KEY } from './roles.decorator';

describe('Roles decorator', () => {
  it('should set metadata with ROLES_KEY', () => {
    const roles = ['admin', 'manager'] as const;
    const decorator = Roles(...roles);
    expect(decorator).toBeDefined();
    // Decorator is a function that calls SetMetadata
    class Test {}
    decorator(Test);
    const metadata = Reflect.getMetadata(ROLES_KEY, Test);
    expect(metadata).toEqual(['admin', 'manager']);
  });

  it('should accept single role', () => {
    const decorator = Roles('viewer');
    class Test {}
    decorator(Test);
    expect(Reflect.getMetadata(ROLES_KEY, Test)).toEqual(['viewer']);
  });
});
