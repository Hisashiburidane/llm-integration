import type { Ref } from 'vue';
import {
  useEnchant,
  useEnchantAction,
  useEnchantForge,
  type EnchantProgressEvent
} from '@enchantforge/vue';

export interface TicketDraft {
  customerName: string;
  orderNo: string;
  category: string;
  product: string;
  issue: string;
  request: string;
  contactWindow: string;
  urgency: string;
}

export type TicketField = keyof TicketDraft;

export interface AssistantNotice {
  id: string;
  kind: 'knowledge' | 'coach' | 'result' | 'error';
  title: string;
  content: string;
  timestamp: string;
}

const fieldLabels: Record<TicketField, string> = {
  customerName: '客户姓名',
  orderNo: '订单号',
  category: '问题分类',
  product: '相关商品',
  issue: '问题描述',
  request: '客户诉求',
  contactWindow: '联系时段',
  urgency: '紧急程度'
};

const fieldKeys = Object.keys(fieldLabels) as TicketField[];

function timestamp() {
  return new Date().toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function useCustomerServiceAgent(
  draft: TicketDraft,
  highlightedFields: Ref<TicketField[]>,
  notices: Ref<AssistantNotice[]>
) {
  const enchant = useEnchant();
  const forge = useEnchantForge();

  useEnchantAction<{ query: string }>({
    id: 'customer-service:search-knowledge',
    name: 'support.search_knowledge',
    label: '检索售后知识库',
    description: '根据当前客户问题检索真实售后规则。给坐席建议前必须先调用，并以返回 chunks 为规则依据。',
    provider: 'customer-service-demo',
    effect: 'read',
    target: '售后知识库',
    inputSchema: {
      type: 'object',
      required: ['query'],
      additionalProperties: false,
      properties: {
        query: {
          type: 'string',
          minLength: 2,
          description: '包含商品、故障表现和客户诉求的检索问题'
        }
      }
    },
    async execute({ query }, context) {
      const result = await forge.retrieveKnowledge({
        query,
        topK: 3,
        filters: { channel: 'hotline' },
        signal: context.signal
      });
      notices.value = [{
        id: `knowledge-${Date.now()}`,
        kind: 'knowledge',
        title: '知识库命中',
        content: result.chunks.length
          ? result.chunks.map((chunk) => `${chunk.title} · ${chunk.source}`).join('\n')
          : '没有找到匹配的售后规则，建议转人工复核。',
        timestamp: timestamp()
      }, ...notices.value];
      return {
        status: 'success' as const,
        summary: `知识库返回 ${result.chunks.length} 条规则。`,
        data: {
          providerId: result.providerId,
          chunks: result.chunks.map((chunk) => ({
            id: chunk.id,
            title: chunk.title,
            content: chunk.content,
            source: chunk.source,
            score: chunk.score
          }))
        }
      };
    }
  });

  useEnchantAction<{ values: Partial<TicketDraft> }>({
    id: 'customer-service:update-ticket-draft',
    name: 'support.update_ticket_draft',
    label: '更新工单草稿',
    description: '把离线 ASR 中明确出现的客服工单信息写入草稿。只填写有证据的字段，不提交工单。',
    provider: 'customer-service-demo',
    effect: 'draft',
    target: '当前售后工单草稿',
    inputSchema: {
      type: 'object',
      required: ['values'],
      additionalProperties: false,
      properties: {
        values: {
          type: 'object',
          additionalProperties: false,
          properties: {
            customerName: { type: 'string', description: '客户明确说出的姓名' },
            orderNo: { type: 'string', description: '客户明确说出的完整订单号' },
            category: {
              type: 'string',
              description: '问题分类',
              enum: ['商品破损', '物流异常', '使用故障', '退换货']
            },
            product: { type: 'string', description: '涉及的商品' },
            issue: { type: 'string', description: '基于原话整理的客观问题描述' },
            request: { type: 'string', description: '客户明确提出的处理诉求' },
            contactWindow: { type: 'string', description: '客户明确提出的方便联系时段' },
            urgency: {
              type: 'string',
              description: '只根据明确风险判断紧急程度',
              enum: ['低', '普通', '高']
            }
          }
        }
      }
    },
    async execute({ values }, context) {
      const entries = Object.entries(values).filter(
        (entry): entry is [TicketField, string] =>
          fieldKeys.includes(entry[0] as TicketField)
          && typeof entry[1] === 'string'
          && entry[1].trim().length > 0
      );

      for (const [index, [field, value]] of entries.entries()) {
        if (context.signal?.aborted) throw new Error('分析已取消。');
        context.reportProgress({
          label: `正在更新${fieldLabels[field]}`,
          current: index + 1,
          total: entries.length
        });
        await new Promise((resolve) => window.setTimeout(resolve, 180));
        draft[field] = value.trim();
      }

      highlightedFields.value = entries.map(([field]) => field);
      return {
        status: 'success' as const,
        summary: `已根据离线转写更新 ${entries.length} 个草稿字段，未提交工单。`,
        data: { updatedFields: highlightedFields.value }
      };
    }
  });

  useEnchantAction<{ message: string; fieldIds?: TicketField[] }>({
    id: 'customer-service:present-coaching',
    name: 'support.present_coaching',
    label: '向坐席显示辅助建议',
    description: '根据当前已确认的信息给坐席一条简短、可执行的下一步建议，并高亮相关草稿字段。',
    provider: 'customer-service-demo',
    effect: 'visual',
    target: '坐席辅助提示区',
    inputSchema: {
      type: 'object',
      required: ['message'],
      additionalProperties: false,
      properties: {
        message: {
          type: 'string',
          minLength: 4,
          maxLength: 100,
          description: '给人工坐席的简短建议，不要对客户作出未经授权的承诺'
        },
        fieldIds: {
          type: 'array',
          items: { type: 'string', enum: fieldKeys },
          description: '建议坐席关注的工单字段'
        }
      }
    },
    execute({ message, fieldIds = [] }) {
      highlightedFields.value = fieldIds.filter((field) => fieldKeys.includes(field));
      notices.value = [{
        id: `coach-${Date.now()}`,
        kind: 'coach',
        title: '坐席建议',
        content: message,
        timestamp: timestamp()
      }, ...notices.value];
      return {
        status: 'success' as const,
        summary: '坐席建议已显示。',
        data: { highlightedFields: highlightedFields.value }
      };
    }
  });

  async function analyzeTranscript(options: {
    latest: string;
    transcript: string;
    signal: AbortSignal;
    onProgress(event: EnchantProgressEvent): void;
  }) {
    const coachingCount = notices.value.filter((notice) => notice.kind === 'coach').length;
    const result = await enchant.run({
      input: [
        '你收到了一段客服通话的离线 ASR 转写。',
        `本次新增：${options.latest}`,
        `累计转写：${options.transcript}`,
        '提取有明确证据的工单字段，并给人工坐席一条下一步建议。'
      ].join('\n'),
      prompt: [
        '先调用 support.search_knowledge 检索当前问题的售后规则；没有检索结果时也不得自行编造规则。',
        '必须调用 support.update_ticket_draft 更新已确认的信息，禁止补全客户没有说过的事实。',
        '只有看到知识库 tool result 后，才能调用 support.present_coaching 给坐席简短建议，并在建议中说明规则依据。',
        '建议可以要求继续确认信息，但不能承诺退款、换新、补发或赔付已经获批。',
        '工单只能保持草稿状态。'
      ].join('\n'),
      signal: options.signal,
      onProgress: options.onProgress
    });

    if (
      notices.value.filter((notice) => notice.kind === 'coach').length === coachingCount
      && result.message.trim()
    ) {
      notices.value = [{
        id: `result-${Date.now()}`,
        kind: 'result',
        title: '分析结果',
        content: result.message,
        timestamp: timestamp()
      }, ...notices.value];
    }
    return result;
  }

  return { analyzeTranscript };
}
