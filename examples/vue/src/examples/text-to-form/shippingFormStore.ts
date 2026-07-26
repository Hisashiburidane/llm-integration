import { reactive } from 'vue';

function createEmptyShippingForm() {
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
