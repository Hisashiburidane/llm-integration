export interface AsrUtterance {
  id: string;
  partials: string[];
  final: string;
  analyze: boolean;
}

export const asrSimulation: AsrUtterance[] = [
  {
    id: 'identity',
    partials: [
      '你好，我是林...',
      '你好，我是林悦，我昨天收到...',
      '你好，我是林悦，我昨天收到的咖啡机...'
    ],
    final: '你好，我是林悦，我昨天收到的咖啡机有点问题。',
    analyze: false
  },
  {
    id: 'order',
    partials: [
      '订单号我看一下...',
      '订单号是 JD202607...',
      '订单号是 JD202607280184。'
    ],
    final: '订单号是 JD202607280184。',
    analyze: true
  },
  {
    id: 'damage',
    partials: [
      '外面的箱子压凹了...',
      '外箱压凹了，里面水箱也裂了...',
      '外箱压凹了，水箱裂了，一加水就漏。'
    ],
    final: '外箱压凹了，里面的水箱也裂了，一加水就漏。',
    analyze: false
  },
  {
    id: 'request',
    partials: [
      '我想直接换一台新的...',
      '我想换新，工作日下午三点...',
      '我想换新，工作日下午三点以后联系我。'
    ],
    final: '我想直接换一台新的，工作日下午三点以后联系我就行。',
    analyze: true
  }
];
