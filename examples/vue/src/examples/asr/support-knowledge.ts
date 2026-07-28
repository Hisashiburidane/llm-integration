import { createStaticKnowledgeProvider } from '@enchantforge/vue';

export const supportKnowledgeProvider = createStaticKnowledgeProvider({
  id: 'demo-support-knowledge',
  documents: [
    {
      id: 'replica-accessory-fault',
      title: '收藏模型附件故障处理',
      source: '售后手册 / 收藏模型 / 4.2',
      content: '主体完好但底座、灯光或语音附件故障时，坐席应记录故障表现，建议客户保留包装并上传短视频。可以创建配件补发草稿，但不得在审核前承诺补发。',
      metadata: { channel: 'hotline', category: '收藏模型' }
    },
    {
      id: 'illuminated-prop-check',
      title: '发光道具单侧不亮排查',
      source: '售后手册 / 电子道具 / 3.1',
      content: '双侧发光道具单侧不亮时，先确认电池型号、正负极、绝缘片和触点。客户已完成基础排查后，记录故障侧和视频凭证，转配件检测；不得直接判断为灯管质量问题。',
      metadata: { channel: 'hotline', category: '电子道具' }
    },
    {
      id: 'battery-safety',
      title: '可更换电池商品安全提醒',
      source: '售后手册 / 电池安全 / 2.3',
      content: '出现发热、异味、漏液或外壳变形时，应立即停止使用并取出电池；仅有不亮且无安全异常时，可继续执行基础触点排查。',
      metadata: { channel: 'hotline', category: '电子道具' }
    },
    {
      id: 'collectible-missing-item',
      title: '成套收藏品缺件处理',
      source: '售后手册 / 收藏品 / 5.4',
      content: '成套卡片或收藏品缺件时，需要记录订单号、总件数、实收数量和明确缺失编号。可以创建单件补发草稿；库存和补发资格必须由后端审核，不要求客户先退回整套商品。',
      metadata: { channel: 'hotline', category: '收藏卡' }
    },
    {
      id: 'contact-window',
      title: '客户联系时段记录规则',
      source: '热线规范 / 客户联络 / 1.6',
      content: '客户给出方便联系的时段时，应按客户原话记录。无法识别具体时区或日期时不要自行补全，由后续人工回访确认。',
      metadata: { channel: 'hotline', category: '通用' }
    }
  ]
});
