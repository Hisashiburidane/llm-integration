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

export function parseShippingText(text: string): ShippingFormState {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const phone = text.match(/1\d{10}/)?.[0] ?? '';
  const rawAddress = lines.find((line) => /(省|市|区|县|街道|路|号|楼|室|村|镇|广东|揭阳)/.test(line)) ?? '';
  const province = /广东/.test(rawAddress) ? '广东省' : '';
  const city = /揭阳/.test(rawAddress) ? '揭阳市' : '';
  const districtMatch = rawAddress.match(/(榕城区|揭东区|揭西县|惠来县|普宁市)/);
  const district = districtMatch?.[1] ?? '';
  const receiverAddress = rawAddress.replace(/^广东省?/, '').replace(/^揭阳市?/, '').replace(district, '').trim();
  const receiverName = lines.find((line) => line !== phone && line !== rawAddress && /^[\u4e00-\u9fa5]{2,5}$/.test(line)) ?? '';
  const itemSource = lines.join(' ');
  const itemType = /手机|iphone|数码|电脑|平板/.test(itemSource) ? 'Digital device' : '';
  const remark = itemType ? 'Source text mentions phone. Mapped to Digital device.' : '';

  return {
    receiverName,
    receiverPhone: phone,
    province,
    city,
    district,
    receiverAddress,
    itemType,
    remark
  };
}
