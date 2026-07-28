import { reactive } from 'vue';

export interface ShippingForm extends Record<string, string> {
  receiverName: string;
  receiverPhone: string;
  province: string;
  city: string;
  district: string;
  receiverAddress: string;
  itemType: string;
  remark: string;
}

function createEmptyShippingForm(): ShippingForm {
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

export const shippingFormState = reactive(createEmptyShippingForm());

export function resetShippingForm() {
  Object.assign(shippingFormState, createEmptyShippingForm());
}
