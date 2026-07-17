<script setup lang="ts">
import DomScanExpressForm from './DomScanExpressForm.vue';
import { shippingFormState } from './shippingFormStore';
</script>

<template>
  <a-card title="快递表单" size="small" class="demo-card">
    <DomScanExpressForm v-model="shippingFormState" />
  </a-card>
</template>
