export interface AsrUtterance {
  id: string;
  partials: string[];
  final: string;
  checkpoint: boolean;
  pauseAfterMs?: number;
}

export interface AsrScenario {
  id: string;
  speaker: string;
  shortName: string;
  product: string;
  voice: string;
  partialDelayMs: number;
  finalizationDelayMs: number;
  utterancePauseMs: number;
  utterances: AsrUtterance[];
}

export const asrScenarios: AsrScenario[] = [
  {
    id: 'arthas',
    speaker: '阿尔萨斯·米奈希尔',
    shortName: '阿尔萨斯',
    product: '1:1 霜之哀伤复刻模型',
    voice: '语速较慢，句子短，停顿明显',
    partialDelayMs: 1400,
    finalizationDelayMs: 1500,
    utterancePauseMs: 1200,
    utterances: [
      {
        id: 'identity',
        partials: [
          '我是阿尔萨斯……',
          '我是阿尔萨斯·米奈希尔。那把一比一的……',
          '我是阿尔萨斯·米奈希尔。那把一比一的霜之哀伤模型……'
        ],
        final: '我是阿尔萨斯·米奈希尔。那把一比一的霜之哀伤模型，已经到了。',
        checkpoint: false
      },
      {
        id: 'order',
        partials: [
          '订单号……EF2026……',
          '订单号是 EF202607280001。'
        ],
        final: '订单号是 EF202607280001。',
        checkpoint: true,
        pauseAfterMs: 1500
      },
      {
        id: 'issue',
        partials: [
          '木箱没坏。剑也没坏……',
          '是底座。一开机，只会说……',
          '是语音底座。一开机，只会说“电量不足”。'
        ],
        final: '木箱没坏，剑也没坏。是语音底座，一开机只会说“电量不足”。这不像霜之哀伤。',
        checkpoint: false
      },
      {
        id: 'request',
        partials: [
          '给我补发一个正常的底座……',
          '晚上联系。白天我要处理……',
          '晚上联系。白天我要处理诺森德的事。'
        ],
        final: '给我补发一个正常的语音底座。晚上联系，白天我要处理诺森德的事。',
        checkpoint: true
      }
    ]
  },
  {
    id: 'illidan',
    speaker: '伊利丹·怒风',
    shortName: '伊利丹',
    product: '双刃光剑模型 + GP 超霸 Greencell 电池',
    voice: '语速快，几乎不停顿，明显不耐烦',
    partialDelayMs: 850,
    finalizationDelayMs: 1000,
    utterancePauseMs: 700,
    utterances: [
      {
        id: 'identity',
        partials: [
          '伊利丹·怒风，双刃光剑……',
          '伊利丹·怒风，双刃光剑模型，刚收到。'
        ],
        final: '伊利丹·怒风。双刃光剑模型刚收到。',
        checkpoint: false
      },
      {
        id: 'order',
        partials: [
          '订单 EF202607280002……',
          '订单号 EF202607280002，记下了吗？'
        ],
        final: '订单号 EF202607280002，记下了吗？',
        checkpoint: true
      },
      {
        id: 'issue',
        partials: [
          '全新的GP超霸绿色电池，还是一头亮……',
          '正负极查了三遍，触点也擦了，还是只有一头亮。'
        ],
        final: '我装了全新的 GP 超霸 Greencell 电池，正负极查了三遍，触点也擦了，还是只有一头亮。',
        checkpoint: false
      },
      {
        id: 'request',
        partials: [
          '我已经等了一万年，不想再等七个工作日……',
          '先告诉我能不能只换灯管，今天随时联系。'
        ],
        final: '我已经等了一万年，不想再等七个工作日。先告诉我能不能只换灯管，今天随时联系。',
        checkpoint: true
      }
    ]
  },
  {
    id: 'arthur',
    speaker: '亚瑟·摩根',
    shortName: '亚瑟',
    product: '全套 144 张香烟卡',
    voice: '语速慢，经常犹豫和自我修正',
    partialDelayMs: 1800,
    finalizationDelayMs: 1900,
    utterancePauseMs: 1600,
    utterances: [
      {
        id: 'identity',
        partials: [
          '你好，我是……亚瑟……',
          '你好，我是亚瑟·摩根。那套卡，香烟卡……',
          '你好，我是亚瑟·摩根。那套一百四十四张的香烟卡……'
        ],
        final: '你好，我是亚瑟·摩根。就是那套一百四十四张的香烟卡。',
        checkpoint: false
      },
      {
        id: 'order',
        partials: [
          '订单号，我找找……',
          'EF202607280003。对，就是这个。'
        ],
        final: '订单号是 EF202607280003。对，就是这个。',
        checkpoint: true,
        pauseAfterMs: 2100
      },
      {
        id: 'issue',
        partials: [
          '我数了三遍……约翰也数了一遍……',
          '还是一百四十三张。少了一张……',
          '少了“奇妙发明”那套的第八张。'
        ],
        final: '我数了三遍，约翰也帮我数了一遍，还是一百四十三张。少了“奇妙发明”那套的第八张。',
        checkpoint: false
      },
      {
        id: 'request',
        partials: [
          '不用整套退……',
          '把少的那张补给我就行。下午……',
          '下午营地有信号的时候联系。'
        ],
        final: '不用整套退，把少的那张补给我就行。下午营地有信号的时候联系。',
        checkpoint: true
      }
    ]
  }
];
