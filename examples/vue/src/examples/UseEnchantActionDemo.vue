<script setup lang="ts">
import ApiActionExpressForm from './text-to-form/ApiActionExpressForm.vue';
import { resetShippingForm, shippingFormState } from './text-to-form/shippingFormStore';

resetShippingForm();
</script>

<template>
  <a-card title="异步填写寄件单" size="small" class="demo-card">
    <template #extra><a-tag color="blue">useEnchantAction</a-tag></template>
    <ApiActionExpressForm v-model="shippingFormState" />
  </a-card>
</template>
