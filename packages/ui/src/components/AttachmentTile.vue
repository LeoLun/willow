<script setup lang="ts">
import { FileSpreadsheet, FileText, X } from "lucide-vue-next";
import type { Attachment } from "../types";
import { i18n } from "../utils/i18n";

const props = withDefaults(
  defineProps<{
    attachment: Attachment;
    showDelete?: boolean;
  }>(),
  { showDelete: false },
);

const emit = defineEmits<{
  click: [attachment: Attachment];
  delete: [attachment: Attachment];
}>();

const isImage = props.attachment.type === "image";
const hasPreview = !!props.attachment.preview;
const isPdf = props.attachment.mimeType === "application/pdf";
const isExcel =
  props.attachment.mimeType?.includes("spreadsheetml") ||
  props.attachment.fileName.toLowerCase().endsWith(".xlsx") ||
  props.attachment.fileName.toLowerCase().endsWith(".xls");

function truncatedName(name: string): string {
  return name.length > 10 ? `${name.substring(0, 8)}...` : name;
}
</script>

<template>
  <div class="group relative inline-block max-h-16">
    <template v-if="hasPreview">
      <div class="relative">
        <img
          :src="`data:${isImage ? attachment.mimeType : 'image/png'};base64,${attachment.preview}`"
          class="h-16 w-16 cursor-pointer rounded-lg border border-input object-cover transition-opacity hover:opacity-80"
          :alt="attachment.fileName"
          :title="attachment.fileName"
          @click="emit('click', attachment)"
        />
        <div
          v-if="isPdf"
          class="absolute right-0 bottom-0 left-0 rounded-b-lg bg-background/90 px-1 py-0.5"
        >
          <div class="text-center text-[10px] font-medium text-muted-foreground">
            {{ i18n("PDF") }}
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <div
        class="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border border-input bg-muted p-2 text-muted-foreground transition-opacity hover:opacity-80"
        :title="attachment.fileName"
        @click="emit('click', attachment)"
      >
        <FileSpreadsheet v-if="isExcel" class="h-5 w-5" />
        <FileText v-else class="h-5 w-5" />
        <div class="w-full truncate text-center text-[10px]">
          {{ truncatedName(attachment.fileName) }}
        </div>
      </div>
    </template>
    <button
      v-if="showDelete"
      class="absolute -top-1 -right-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-input bg-background text-muted-foreground opacity-100 shadow-sm transition-opacity hover:bg-muted hover:text-foreground hover:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
      :title="i18n('Remove')"
      @click.stop="emit('delete', attachment)"
    >
      <X class="h-3 w-3" />
    </button>
  </div>
</template>
