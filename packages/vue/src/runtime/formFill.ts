export type FieldId = 'receiverName' | 'receiverPhone' | 'province' | 'city' | 'district' | 'receiverAddress' | 'itemType' | 'remark';

export type FieldMeta = {
  id: FieldId;
  label: string;
  type: string;
  required?: boolean;
  aliases: string[];
};

export type ShippingFormState = Record<FieldId, string>;

export const shippingFieldMeta: FieldMeta[] = [
  { id: 'receiverName', label: '收件人', type: 'personName', required: true, aliases: ['name', 'receiver', 'contact'] },
  { id: 'receiverPhone', label: '手机号', type: 'phone', required: true, aliases: ['mobile', 'telephone', 'contact phone'] },
  { id: 'province', label: '省份', type: 'province', required: true, aliases: ['province'] },
  { id: 'city', label: '城市', type: 'city', required: true, aliases: ['city'] },
  { id: 'district', label: '区县', type: 'district', aliases: ['district', 'county'] },
  { id: 'receiverAddress', label: '详细地址', type: 'address', required: true, aliases: ['location', 'street', 'delivery address'] },
  { id: 'itemType', label: '物品类型', type: 'enum', aliases: ['goods', 'package', 'item'] },
  { id: 'remark', label: '备注', type: 'textarea', aliases: ['note', 'description'] }
];

export function createEmptyShippingForm(): ShippingFormState {
  return {
    receiverName: '',
    receiverPhone: '',
    province: '',
    city: '',
    district: '',
    receiverAddress: '',
    itemType: '',
    remark: ''
  };
}
