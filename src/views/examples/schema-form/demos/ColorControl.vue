<template>
  <input type="color" :value="color || '#1677ff'" :disabled="disabled" @input="change" />
</template>

<script setup lang="ts">
defineProps<{ color?: string; disabled?: boolean }>();
const emit = defineEmits<{ 'update:color': [value: string] }>();
function change(event: Event): void {
  if (event.target instanceof HTMLInputElement) emit('update:color', event.target.value);
}
</script>
