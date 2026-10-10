<template>
  <div />
</template>

<script setup lang="ts">
import { unref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const { currentRoute, replace } = router;
const { params, query } = unref(currentRoute);
const { path } = params;

const redirectPath = Array.isArray(path) ? path.join('/') : path;

replace({
  path: '/' + redirectPath,
  query,
});
</script>
