<template>
  <div class="page-container">
    <div class="card">
      <h2>{{ $t('form.title') }}</h2>
      <p class="mb-lg">{{ $t('exampleForm.description') }}</p>

      <Form :schema="formItems" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FormFieldSchema } from '@/libs/form';
import type { TreeSelectProps } from 'antdv-next';

import { message } from 'antdv-next';
import { computed, ref, onBeforeUnmount } from 'vue';
import { z } from 'zod';

import { useSchemaForm } from '@/adapters/form';
import { $t } from '@/locales';

import {
  createLazyChildren,
  searchRemoteTree,
  searchRemoteUsers,
  type RemoteTreeNode,
} from './remoteData';

const lazyTreeLoading = ref(false);
const remoteUsers = ref<ReturnType<typeof searchRemoteUsers>>([]);
const remoteTree = ref<RemoteTreeNode[]>([]);
const userLoading = ref(false);
const treeLoading = ref(false);
let userVersion = 0;
let treeVersion = 0;
let userTimer: ReturnType<typeof setTimeout> | undefined;
let treeTimer: ReturnType<typeof setTimeout> | undefined;
function searchUsers(keyword: string): void {
  const version = ++userVersion;
  clearTimeout(userTimer);
  userLoading.value = true;
  userTimer = setTimeout(async () => {
    try {
      await waitForRemoteData();
      if (version === userVersion) remoteUsers.value = searchRemoteUsers(keyword);
    } finally {
      if (version === userVersion) userLoading.value = false;
    }
  }, 300);
}
function searchTree(keyword: string): void {
  const version = ++treeVersion;
  clearTimeout(treeTimer);
  treeLoading.value = true;
  treeTimer = setTimeout(async () => {
    try {
      await waitForRemoteData();
      if (version === treeVersion) remoteTree.value = searchRemoteTree(keyword);
    } finally {
      if (version === treeVersion) treeLoading.value = false;
    }
  }, 300);
}
onBeforeUnmount(() => {
  userVersion++;
  treeVersion++;
  clearTimeout(userTimer);
  clearTimeout(treeTimer);
});
const lazyTreeData = ref<RemoteTreeNode[]>([
  { title: 'North Region', value: 'north-region' },
  { title: 'South Region', value: 'south-region' },
  { title: 'Headquarters', value: 'headquarters', isLeaf: true },
]);

async function waitForRemoteData(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 500));
}

const formItems = computed<FormFieldSchema[]>(() => [
  {
    fieldName: 'username',
    label: $t('user.username'),
    component: 'Input',
    defaultValue: '',
    rules: z
      .string()
      .min(3, $t('validation.lengthRange', { min: 3, max: 20 }))
      .max(20, $t('validation.lengthRange', { min: 3, max: 20 }))
      .regex(/^[a-zA-Z0-9_]+$/, $t('validation.usernamePattern')),
    componentProps: {
      placeholder: $t('login.usernamePlaceholder'),
    },
  },
  {
    fieldName: 'email',
    label: $t('user.email'),
    component: 'Input',
    defaultValue: '',
    rules: z.email($t('validation.email')),
    componentProps: {},
  },
  {
    fieldName: 'password',
    label: $t('login.password'),
    component: 'InputPassword',
    defaultValue: '',
    rules: z
      .string()
      .regex(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/, $t('validation.passwordPattern')),
    componentProps: {},
  },
  {
    fieldName: 'confirmPassword',
    dependencies: {
      triggerFields: ['password'],
      resolve: ({ values }) => ({
        rules: z
          .string()
          .min(1, $t('validation.required'))
          .refine((value) => value === values.password, $t('validation.confirmPassword')),
      }),
    },
    label: $t('profile.confirmPassword'),
    component: 'InputPassword',
    defaultValue: '',
    rules: 'required',
    componentProps: {},
  },
  {
    fieldName: 'phone',
    label: $t('user.phone'),
    component: 'Input',
    defaultValue: '',
    rules: z
      .string()
      .regex(/^(?:1[3-9]\d{9})?$/, $t('validation.phone'))
      .optional(),
    componentProps: {},
  },
  {
    fieldName: 'age',
    label: $t('exampleForm.age'),
    component: 'InputNumber',
    rules: z
      .number()
      .min(1, $t('exampleForm.ageRange'))
      .max(150, $t('exampleForm.ageRange'))
      .nullish(),
    componentProps: {
      min: 1,
      max: 150,
    },
  },
  {
    fieldName: 'gender',
    label: $t('user.gender'),
    component: 'Select',
    rules: 'required',
    componentProps: {
      options: [
        { label: $t('user.male'), value: 'male' },
        { label: $t('user.female'), value: 'female' },
      ],
    },
  },
  {
    fieldName: 'role',
    label: $t('user.role'),
    component: 'Select',
    rules: 'required',
    componentProps: {
      options: [
        { label: $t('exampleForm.roles.admin'), value: 'admin' },
        { label: $t('exampleForm.roles.user'), value: 'user' },
        { label: $t('exampleForm.roles.guest'), value: 'guest' },
      ],
    },
  },
  {
    fieldName: 'interests',
    label: $t('exampleForm.interests'),
    component: 'CheckboxGroup',
    componentProps: {
      options: [
        { label: $t('exampleForm.interestOptions.reading'), value: 'reading' },
        { label: $t('exampleForm.interestOptions.sports'), value: 'sports' },
        { label: $t('exampleForm.interestOptions.music'), value: 'music' },
        { label: $t('exampleForm.interestOptions.travel'), value: 'travel' },
      ],
    },
  },
  {
    fieldName: 'birthDate',
    label: $t('exampleForm.birthDate'),
    component: 'DatePicker',
    componentProps: {
      format: 'YYYY-MM-DD',
    },
  },
  {
    fieldName: 'status',
    label: $t('common.status'),
    component: 'Switch',
    defaultValue: true,
    componentProps: {},
  },
  {
    fieldName: 'score',
    label: $t('exampleForm.score'),
    component: 'Rate',
    defaultValue: 3,
    componentProps: {},
  },
  {
    fieldName: 'progress',
    label: $t('exampleForm.progress'),
    component: 'Slider',
    defaultValue: 50,
    componentProps: {
      min: 0,
      max: 100,
    },
  },
  {
    fieldName: 'remoteUser',
    label: $t('exampleForm.remote.selectTitle'),
    component: 'Select',
    componentProps: {
      placeholder: $t('exampleForm.remote.selectPlaceholder'),
      options: remoteUsers.value,
      showSearch: true,
      filterOption: false,
      loading: userLoading.value,
      onSearch: searchUsers,
    },
    help: $t('exampleForm.remote.selectHint'),
  },
  {
    fieldName: 'lazyOrganization',
    label: $t('exampleForm.remote.lazyTreeTitle'),
    component: 'TreeSelect',
    componentProps: {
      showSearch: false,
      loadData: loadLazyTreeData,
      loading: lazyTreeLoading.value,
      treeData: lazyTreeData.value,
      placeholder: $t('exampleForm.remote.lazyTreePlaceholder'),
    },
    help: $t('exampleForm.remote.lazyTreeHint'),
  },
  {
    fieldName: 'remoteOrganization',
    label: $t('exampleForm.remote.searchTreeTitle'),
    component: 'TreeSelect',
    componentProps: {
      placeholder: $t('exampleForm.remote.searchTreePlaceholder'),
      treeData: remoteTree.value,
      showSearch: true,
      filterTreeNode: false,
      treeDefaultExpandAll: true,
      loading: treeLoading.value,
      onSearch: searchTree,
    },
    help: $t('exampleForm.remote.searchTreeHint'),
  },
  {
    fieldName: 'bio',
    labelClass: 'w-1/4 md:w-[calc((100%-1.5rem)/8)]',
    label: $t('user.bio'),
    component: 'Textarea',
    formItemClass: 'col-span-full',
    componentProps: {
      rows: 4,
      maxLength: 500,
      showCount: true,
      placeholder: $t('exampleForm.bioPlaceholder'),
    },
  },
]);

const handleSubmit = (values: Record<string, unknown>) => {
  console.log('Form values:', values);
  message.success($t('exampleForm.submitSuccess'));
};

function appendLazyChildren(nodes: RemoteTreeNode[], parentValue: string): RemoteTreeNode[] {
  return nodes.map((node) => {
    if (node.value === parentValue) {
      return node.children ? node : { ...node, children: createLazyChildren(parentValue) };
    }
    if (!node.children) return node;
    return { ...node, children: appendLazyChildren(node.children, parentValue) };
  });
}

const loadLazyTreeData: TreeSelectProps['loadData'] = async (node) => {
  const parentValue = typeof node.value === 'string' ? node.value : '';
  if (!parentValue || node.children) return;

  lazyTreeLoading.value = true;
  await new Promise<void>((resolve) => setTimeout(resolve, 500));
  lazyTreeData.value = appendLazyChildren(lazyTreeData.value, parentValue);
  lazyTreeLoading.value = false;
};
const [Form] = useSchemaForm({
  schema: formItems.value,
  layout: 'horizontal',
  commonConfig: { labelWidth: '25%', colon: true },
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  scrollToFirstError: true,
  handleSubmit,
  submitButtonOptions: { content: () => $t('common.submit') },
});
</script>

<style scoped lang="scss">
.mb-lg {
  margin-bottom: var(--spacing-lg);
}
</style>
