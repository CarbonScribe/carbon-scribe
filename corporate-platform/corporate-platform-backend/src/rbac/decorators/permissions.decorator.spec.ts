import { Permissions, PERMISSIONS_KEY } from './permissions.decorator';
import { CREDIT_VIEW, CREDIT_RETIRE } from '../constants/permissions.constants';

describe('Permissions decorator', () => {
  it('should set metadata with PERMISSIONS_KEY', () => {
    const decorator = Permissions(CREDIT_VIEW, CREDIT_RETIRE);
    expect(decorator).toBeDefined();
    class Test {}
    decorator(Test);
    const metadata = Reflect.getMetadata(PERMISSIONS_KEY, Test);
    expect(metadata).toEqual([CREDIT_VIEW, CREDIT_RETIRE]);
  });

  it('should accept single permission', () => {
    const decorator = Permissions(CREDIT_VIEW);
    class Test {}
    decorator(Test);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, Test)).toEqual([CREDIT_VIEW]);
  });
});
