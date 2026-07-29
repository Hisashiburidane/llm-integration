import { shallowRef } from 'vue';
import { defineEnchantAction, defineEnchantApi } from '@enchantforge/vue';
import {
  demoOrderService,
  type OrderDetail,
  type OrderService
} from './order-service';

export const latestOrderDetail = shallowRef<OrderDetail>();

export function createSupportApi(orderService: OrderService) {
  const getOrderDetail = defineEnchantAction<{ orderNo: string }>({
    name: 'support.get_order_detail',
    label: '查询订单详情',
    description: '根据完整订单号查询后台订单 API。订单状态、商品、客户与售后状态必须以此工具返回为准，不得根据订单号猜测。',
    effect: 'read',
    target: '订单中心',
    inputSchema: {
      type: 'object',
      required: ['orderNo'],
      additionalProperties: false,
      properties: {
        orderNo: {
          type: 'string',
          minLength: 8,
          description: '完整订单号'
        }
      }
    },
    async execute({ orderNo }, context) {
      context.reportProgress({ label: `正在查询订单 ${orderNo}` });
      const order = await orderService.getOrderDetail(orderNo, context.signal);
      latestOrderDetail.value = order;
      return {
        status: 'success' as const,
        summary: `订单 ${order.orderNo} 查询完成，当前状态为${order.status}。`,
        data: { order }
      };
    }
  });

  return defineEnchantApi({
    id: 'customer-service',
    label: '客服业务 API',
    page: 'asr-customer-service',
    provider: 'demo-order-api',
    actions: [getOrderDetail]
  });
}

export const supportApi = createSupportApi(demoOrderService);
