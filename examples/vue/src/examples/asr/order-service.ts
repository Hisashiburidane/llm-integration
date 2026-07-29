export interface OrderDetail {
  orderNo: string;
  customerName: string;
  product: string;
  sku: string;
  status: '待发货' | '运输中' | '已签收';
  placedAt: string;
  deliveredAt?: string;
  afterSaleStatus: '未申请' | '处理中' | '已完成';
  serviceHint: string;
}

export interface OrderService {
  getOrderDetail(orderNo: string, signal?: AbortSignal): Promise<OrderDetail>;
}

export function createHttpOrderService(endpoint = '/api/orders'): OrderService {
  return {
    async getOrderDetail(orderNo, signal) {
      const response = await fetch(`${endpoint}/${encodeURIComponent(orderNo)}`, { signal });
      if (!response.ok) throw new Error(`订单查询失败：HTTP ${response.status}。`);
      return response.json() as Promise<OrderDetail>;
    }
  };
}

const demoOrders: Record<string, OrderDetail> = {
  EF202607280001: {
    orderNo: 'EF202607280001',
    customerName: '阿尔萨斯·米奈希尔',
    product: '1:1 霜之哀伤复刻模型',
    sku: 'FROSTMOURNE-VOICE-01',
    status: '已签收',
    placedAt: '2026-07-24 20:16',
    deliveredAt: '2026-07-28 09:42',
    afterSaleStatus: '未申请',
    serviceHint: '签收 7 天内；主体与配件问题需分别记录。'
  },
  EF202607280002: {
    orderNo: 'EF202607280002',
    customerName: '伊利丹·怒风',
    product: '双刃光剑模型',
    sku: 'DUAL-LIGHTBLADE-GREEN',
    status: '已签收',
    placedAt: '2026-07-18 10:08',
    deliveredAt: '2026-07-27 16:35',
    afterSaleStatus: '未申请',
    serviceHint: '电子道具仍在检测期；需先记录故障侧与基础排查结果。'
  },
  EF202607280003: {
    orderNo: 'EF202607280003',
    customerName: '亚瑟·摩根',
    product: '全套 144 张香烟卡',
    sku: 'CIGARETTE-CARDS-144',
    status: '已签收',
    placedAt: '2026-07-20 14:32',
    deliveredAt: '2026-07-28 11:20',
    afterSaleStatus: '未申请',
    serviceHint: '仓库出库复核数量为 144 张；缺件申请需记录具体系列与编号。'
  }
};

function delay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      window.clearTimeout(timer);
      reject(signal?.reason ?? new Error('订单查询已取消。'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

export const demoOrderService: OrderService = {
  async getOrderDetail(orderNo, signal) {
    await delay(680, signal);
    const order = demoOrders[orderNo.trim().toUpperCase()];
    if (!order) throw new Error(`没有找到订单 ${orderNo}。`);
    return { ...order };
  }
};
