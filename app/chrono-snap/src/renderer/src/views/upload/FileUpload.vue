<script setup lang="ts">
import { ref } from "vue";
import { FileUp } from "lucide-vue-next";
import { electronAPI } from '@/lib/ipc'

const isDragging = ref<boolean>(false);

const triggerUpload = () => {
  electronAPI.importToNotion();
};

const onDragOver = () => {
  isDragging.value = true;
};

const onDragLeave = () => {
  isDragging.value = false;
};

const onDrop = (e: DragEvent) => {
  isDragging.value = false;
  const dropped = e.dataTransfer?.files?.[0];
  if (!dropped) return;
  handleFile(dropped);
};

const handleFile = (f: File) => {
  const filePath = electronAPI.getFilePath(f);
  console.log(filePath);
  electronAPI.importToNotion(filePath);
};
</script>
<template>
  <div class="w-full"  @click="triggerUpload" >
    <div
      class="border border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
      :class="{
        'border-blue-500 bg-blue-50': isDragging
      }"
    >
      <div class="flex flex-col items-center">
        <FileUp class="w-10 h-10 text-gray-400 mb-3" />
        <p class="text-gray-500">
          将账单拖到此处，或
          <span class="text-blue-600 underline cursor-pointer">点击上传</span>
        </p>
        <p class="text-gray-400 text-sm mt-2">仅支持微信/支付宝账单文件</p>
      </div>
    </div>
  </div>
</template>
