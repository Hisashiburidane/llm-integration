<script setup lang="ts">
import { useEnchantForm } from '@enchantforge/vue';

const model = defineModel<Record<string, string>>({ required: true });

useEnchantForm(model);
</script>

<template>
  <a-form layout="vertical">
    <a-form-item label="收件人"><a-input v-model:value="model.receiverName" /></a-form-item>
    <a-form-item label="手机号"><a-input v-model:value="model.receiverPhone" /></a-form-item>
    <a-form-item label="省份"><a-input v-model:value="model.province" /></a-form-item>
    <a-form-item label="城市"><a-input v-model:value="model.city" /></a-form-item>
    <a-form-item label="区县"><a-input v-model:value="model.district" /></a-form-item>
    <a-form-item label="详细地址"><a-input v-model:value="model.receiverAddress" /></a-form-item>
    <a-form-item label="物品类型"><a-input v-model:value="model.itemType" /></a-form-item>
    <a-form-item label="备注"><a-textarea v-model:value="model.remark" :rows="3" /></a-form-item>
  </a-form>
</template>
