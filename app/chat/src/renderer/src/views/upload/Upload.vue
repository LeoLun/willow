<script setup lang="ts">
import { ref, onMounted } from 'vue'
import FileUpload from "./FileUpload.vue"
import UploadStepper from "./UploadStepper.vue"
import BillList from "./BillList.vue"
import { electronAPI } from "@/lib/ipc"

// 状态管理
const stepIndex = ref(1)
const billList = ref<any[]>([])

const next = () => {
  stepIndex.value++
}

// 监听文件解析结果
onMounted(() => {
  electronAPI.onParseBillResult((data) => {
    console.log('文件解析结果', data);
    billList.value = data;
    next();
  });
  // 监听账单更新
  electronAPI.onUpdateBill((bill) => {
    // 找到更新的账单
    const index = billList.value.findIndex((item) => item.id === bill.id);
    if (index !== -1) {
      billList.value[index] = bill;
    }
    console.log('账单更新', bill);
  });
});

</script>

<template>
  <div class="flex flex-col w-full h-full items-center">
    <div class="flex flex-col w-10/12 h-full pt-8 pb-8">
      <UploadStepper class="mt-16 mb-4" v-model="stepIndex" />
      <div class="flex flex-col items-center justify-center w-full h-full overflow-auto">
        <template v-if="stepIndex === 1">
          <FileUpload/>
        </template>
        <template v-else>
          <BillList :billList="billList" />
        </template>
      </div>
    </div>
  </div>
</template>
