<script setup lang="ts">
import { Enchant } from '@enchantforge/vue';
import ExpressForm from './ExpressForm.vue';

const model = defineModel<Record<string, string>>({ required: true });
</script>

<template>
  <Enchant
    name="shipping-form"
    page="text-to-form-dom"
    scan="auto"
    prompt="把用户提供的收件人与物品信息填写到当前寄件单，不要提交。"
  >
    <ExpressForm v-model="model" />
  </Enchant>
</template>
