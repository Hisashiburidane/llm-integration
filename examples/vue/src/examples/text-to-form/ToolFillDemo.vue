<script setup lang="ts">
import ApiExpressForm from './ApiExpressForm.vue';
import { resetShippingForm, shippingFormState } from './shippingFormStore';

resetShippingForm();
</script>

<template>
  <a-card title="快递表单" size="small" class="demo-card">
    <ApiExpressForm v-model="shippingFormState" />
  </a-card>
</template>
