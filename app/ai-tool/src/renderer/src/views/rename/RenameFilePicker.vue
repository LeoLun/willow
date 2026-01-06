<script setup lang="ts">
import { ref } from "vue";
import { FileUp } from "lucide-vue-next";
import { electronAPI } from '@/lib/ipc'

const isDragging = ref<boolean>(false);

const emit = defineEmits<{
  (e: 'selected', payload: { file: File; filePath: string; fileName: string }): void
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);

const triggerSelectFile = () => {
  fileInputRef.value?.click();
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
  if (!filePath) return;
  emit('selected', { file: f, filePath, fileName: f.name });
};

const onInputChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (!f) return;
  handleFile(f);
  // 允许重复选择同一个文件也能触发 change
  input.value = '';
};
</script>

<template>
  <div class="w-full" @click="triggerSelectFile">
    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      accept=".pdf,.txt,.md,.xlsx,.csv"
      @change="onInputChange"
    />
    <div
      class="border border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer bg-muted/20 hover:bg-muted/30 transition-colors"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
      :class="{
        'border-primary bg-primary/5': isDragging
      }"
    >
      <div class="flex flex-col items-center">
        <FileUp class="w-10 h-10 text-muted-foreground mb-3" />
        <p class="text-muted-foreground">
          将文件拖到此处，或
          <span class="text-primary underline cursor-pointer">点击选择文件</span>
        </p>
        <p class="text-muted-foreground text-sm mt-2">支持 PDF / 文本 / Markdown / Excel</p>
      </div>
    </div>
  </div>
</template>


