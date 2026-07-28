<script setup lang="ts">
import { Enchant } from '@enchantforge/vue';
import ActionExpressForm from './ActionExpressForm.vue';
import type { ShippingForm } from './shippingFormStore';

const model = defineModel<ShippingForm>({ required: true });
</script>

<template>
  <Enchant
    name="progressive-shipping-form"
    page="use-enchant-action"
    kind="form"
    prompt="把用户提供的寄件信息填写到当前表单。必须调用逐项填写寄件单能力，不要提交。"
  >
    <ActionExpressForm v-model="model" />
  </Enchant>
</template>
