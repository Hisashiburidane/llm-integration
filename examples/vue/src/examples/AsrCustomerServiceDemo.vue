<script setup lang="ts">
import { Enchant } from '@enchantforge/vue';
import CustomerServiceWorkbench from './asr/CustomerServiceWorkbench.vue';
</script>

<template>
  <Enchant
    name="customer-service-workbench"
    page="asr-customer-service"
    kind="page"
    prompt="辅助人工坐席从离线 ASR 中整理工单草稿。订单事实通过订单 API 查询，处理规则通过知识库检索；不得提交工单或承诺处理结果。"
    :metadata="[{
      id: 'customer-service-console',
      kind: 'region',
      label: '售后热线坐席工作台',
      description: '包含实时转写、售后工单草稿和坐席辅助提示。',
      children: []
    }]"
  >
    <CustomerServiceWorkbench />
  </Enchant>
</template>
