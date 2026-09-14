<template>
  <NoFormStyle override status>
    <slot />
  </NoFormStyle>
</template>

<script setup lang="ts">
import { NoFormStyle, useFormItemProviderRest } from 'antdv-next/dist/form/context';

// Picker search and category controls must not trigger the enclosing field's validation.
useFormItemProviderRest();
</script>
