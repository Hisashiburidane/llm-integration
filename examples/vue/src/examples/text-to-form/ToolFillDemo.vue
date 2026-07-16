<script setup lang="ts">
import AiExpressForm from './AiExpressForm.vue';
import { shippingFormState } from './shippingFormStore';
</script>

<template>
  <a-card title="快递表单" size="small" class="demo-card">
    <AiExpressForm v-model="shippingFormState" />
  </a-card>
</template>