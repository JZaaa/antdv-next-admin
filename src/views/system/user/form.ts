import type { FormFieldSchema } from '@/libs/form';
import type { Role, User } from '@/types/auth';

import { z } from 'zod';

import { $t } from '@/locales';

export interface UserFormValues {
  username: string;
  realName: string;
  email: string;
  phone: string;
  gender: 'male' | 'female';
  status: boolean;
  roleIds: string[];
  bio: string;
}
export function createDefaultFormValues(): UserFormValues {
  return {
    username: '',
    realName: '',
    email: '',
    phone: '',
    gender: 'male',
    status: true,
    roleIds: [],
    bio: '',
  };
}
export function toUserFormValues(user: User): UserFormValues {
  return {
    username: user.username,
    realName: user.realName,
    email: user.email,
    phone: user.phone || '',
    gender: user.gender || 'male',
    status: user.status === 'active',
    roleIds: user.roles.map((role) => role.id),
    bio: user.bio || '',
  };
}
export function toUserPayload(values: UserFormValues, roles: Role[]): Partial<User> {
  return {
    username: values.username.trim(),
    realName: values.realName.trim(),
    email: values.email.trim(),
    phone: values.phone?.trim() || '',
    gender: values.gender,
    status: values.status ? 'active' : 'inactive',
    bio: values.bio?.trim() || '',
    roles: roles.filter((role) => values.roleIds.includes(role.id)),
  };
}
export function createUserSchema(
  editing: boolean,
  roles: Role[],
  initialValues: UserFormValues,
): FormFieldSchema<string, Record<never, never>, UserFormValues>[] {
  const schema: FormFieldSchema<string, Record<never, never>, UserFormValues>[] = [
    {
      fieldName: 'username',
      label: $t('user.username'),
      component: 'Input',
      componentProps: { disabled: editing },
      rules: z
        .string()
        .min(1, $t('user.usernameRequired'))
        .min(3, $t('user.usernameLength'))
        .max(20, $t('user.usernameLength')),
    },
    { fieldName: 'realName', label: $t('user.realName'), component: 'Input', rules: 'required' },
    {
      fieldName: 'email',
      label: $t('user.email'),
      component: 'Input',
      rules: z.string().min(1, $t('user.emailRequired')).email($t('validation.email')),
    },
    {
      fieldName: 'phone',
      label: $t('user.phone'),
      component: 'Input',
      rules: z
        .string()
        .regex(/^(?:1[3-9]\d{9})?$/, $t('validation.phone'))
        .optional(),
    },
    {
      fieldName: 'gender',
      label: $t('user.gender'),
      component: 'Select',
      componentProps: {
        options: [
          { label: $t('user.male'), value: 'male' },
          { label: $t('user.female'), value: 'female' },
        ],
      },
    },
    {
      fieldName: 'status',
      label: $t('user.status'),
      component: 'Switch',
      rules: 'required',
      componentProps: {
        checkedChildren: $t('user.active'),
        unCheckedChildren: $t('user.inactive'),
      },
    },
    {
      fieldName: 'roleIds',
      label: $t('user.role'),
      component: 'Select',
      rules: z.array(z.string()).min(1, $t('user.selectRole')),
      componentProps: {
        mode: 'multiple',
        allowClear: true,
        options: roles.map((role) => ({ label: role.name, value: role.id })),
      },
    },
    {
      fieldName: 'bio',
      label: $t('user.bio'),
      component: 'Textarea',
      formItemClass: 'col-span-full',
      componentProps: { rows: 3, maxLength: 200, showCount: true },
    },
  ];
  return schema.map((field) => ({
    ...field,
    defaultValue: initialValues[field.fieldName as keyof UserFormValues],
  }));
}
