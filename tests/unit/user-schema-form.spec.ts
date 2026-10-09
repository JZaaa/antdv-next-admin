import type { Role, User } from '@/types/auth';
import type { UserFormValues } from '@/views/system/user/form';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { FormApi } from '@/libs/form/core/api';
import {
  createDefaultFormValues,
  createUserSchema,
  toUserFormValues,
  toUserPayload,
} from '@/views/system/user/form';

vi.mock('@/locales', () => ({ $t: (key: string) => key }));
const dispose: Array<() => void> = [];
afterEach(() => dispose.splice(0).forEach((stop) => stop()));
const roles: Role[] = [
  {
    id: '3',
    name: 'User',
    code: 'user',
    description: '',
    permissions: [],
    createdAt: '',
    updatedAt: '',
  },
];
function mount(values = createDefaultFormValues(), save = vi.fn()) {
  const api = new FormApi<UserFormValues>({
    schema: createUserSchema(false, roles, values),
    handleSubmit: save,
  });
  api.mount();
  dispose.push(api.dispose);
  return { api, save };
}
const valid: UserFormValues = {
  ...createDefaultFormValues(),
  username: 'testuser',
  realName: 'Test',
  email: 'test@example.com',
  roleIds: ['3'],
};
describe('user page SchemaForm migration', () => {
  it('blocks empty required fields and malformed username, email and phone', async () => {
    const { api, save } = mount();
    await api.submit();
    expect(save).not.toHaveBeenCalled();
    expect(Object.keys((await api.validate()).errors)).toEqual(
      expect.arrayContaining(['username', 'realName', 'email', 'roleIds']),
    );
    await api.setValues({ ...valid, username: 'ab', email: 'bad', phone: '123' });
    expect(Object.keys((await api.validate()).errors)).toEqual(
      expect.arrayContaining(['username', 'email', 'phone']),
    );
  });
  it('allows an empty optional phone and inactive status, and maps selected roles to the API', async () => {
    const { api, save } = mount({ ...valid, status: false });
    expect((await api.validate()).valid).toBe(true);
    await api.submit();
    expect(save).toHaveBeenCalledOnce();
    const payload = toUserPayload(await api.getValues(), roles);
    expect(payload).toMatchObject({ status: 'inactive', phone: '', roles });
  });
  it('isolates edit values and starts a later create session with empty values and no validation errors', async () => {
    const user: User = {
      id: '100',
      ...valid,
      avatar: '',
      status: 'inactive',
      createdAt: '',
      updatedAt: '',
      roles,
      permissions: [],
    };
    const values = toUserFormValues(user);
    const edited = mount(values);
    await edited.api.setValues({ realName: 'Changed', roleIds: [] });
    expect(user.realName).toBe('Test');
    expect(user.roles).toEqual(roles);
    edited.api.dispose();
    const created = mount();
    expect(await created.api.getValues()).toEqual(createDefaultFormValues());
    expect(created.api.form.errors).toEqual({});
  });
  it('preserves a draft after a failed save and permits a retry without duplicate concurrent submissions', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('save failed'))
      .mockResolvedValue(undefined);
    const { api } = mount(valid, save);
    await expect(api.submit()).rejects.toThrow('save failed');
    expect(await api.getValues()).toEqual(valid);
    const retry = api.submit();
    expect(api.submit()).toBe(retry);
    await retry;
    expect(save).toHaveBeenCalledTimes(2);
  });
});
