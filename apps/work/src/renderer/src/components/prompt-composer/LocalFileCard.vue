<script setup lang="ts">
import type { LocalFileAttachment } from "@shared/api";
import { isImageAttachment } from "@shared/local-file";
import { FileTextIcon, ImageIcon, XIcon } from "lucide-vue-next";
import { computed, ref, watch } from "vue";

export type ImageFileItem =
  | LocalFileAttachment
  | {
      path?: string;
      name?: string;
      fileType?: string;
      mimeType?: string;
      data?: string;
      type?: string;
    };

const props = withDefaults(
  defineProps<{
    file: ImageFileItem;
    compact?: boolean;
    removable?: boolean;
  }>(),
  { compact: false, removable: false },
);

const emit = defineEmits<{
  remove: [];
}>();

const imageLoadError = ref(false);

watch(
  () => props.file,
  () => {
    imageLoadError.value = false;
  },
);

const isImage = computed(() => {
  if ("type" in props.file && props.file.type === "image") return true;
  return isImageAttachment(props.file as LocalFileAttachment);
});

const imageSrc = computed(() => {
  if (imageLoadError.value) return undefined;

  if ("data" in props.file && typeof props.file.data === "string" && props.file.data !== "") {
    if (props.file.data.startsWith("data:")) return props.file.data;
    const mime = props.file.mimeType || "image/png";
    return `data:${mime};base64,${props.file.data}`;
  }

  if ("path" in props.file && typeof props.file.path === "string" && props.file.path !== "") {
    if (isImage.value) {
      return `willow-file://${encodeURI(props.file.path)}`;
    }
  }

  return undefined;
});

const fileName = computed(() => {
  if (
    "name" in props.file &&
    typeof props.file.name === "string" &&
    props.file.name.trim() !== ""
  ) {
    return props.file.name;
  }
  if (isImage.value) {
    if ("mimeType" in props.file && typeof props.file.mimeType === "string") {
      const ext = props.file.mimeType.split("/")[1];
      if (ext) return `image.${ext}`;
    }
    if (
      "fileType" in props.file &&
      typeof props.file.fileType === "string" &&
      props.file.fileType.trim() !== ""
    ) {
      return `image.${props.file.fileType.toLowerCase()}`;
    }
    return "image.png";
  }
  return "文件";
});

const fileTypeDisplay = computed(() => {
  if (
    "fileType" in props.file &&
    typeof props.file.fileType === "string" &&
    props.file.fileType !== ""
  ) {
    return props.file.fileType;
  }
  if ("mimeType" in props.file && typeof props.file.mimeType === "string") {
    const ext = props.file.mimeType.split("/")[1];
    if (ext) return ext.toUpperCase();
  }
  return isImage.value ? "图片" : "文件";
});

const fileTitle = computed(() => {
  if ("path" in props.file && typeof props.file.path === "string" && props.file.path !== "") {
    return props.file.path;
  }
  return fileName.value;
});
</script>

<template>
  <div
    class="group relative flex min-w-0 items-center border border-border bg-background"
    :class="
      props.compact
        ? 'h-9 w-fit shrink-0 gap-2 rounded-full px-3'
        : 'h-14 w-full gap-3 rounded-xl p-2'
    "
    data-slot="local-file-card"
    :data-variant="props.compact ? 'compact' : 'default'"
    :title="fileTitle"
  >
    <div
      class="flex shrink-0 items-center justify-center overflow-hidden"
      :class="props.compact ? 'size-5 rounded-full' : 'size-9 rounded-xl bg-muted'"
    >
      <img
        v-if="imageSrc"
        :src="imageSrc"
        class="size-full object-cover"
        :class="props.compact ? 'rounded-full' : 'rounded-lg'"
        alt=""
        @error="imageLoadError = true"
      />
      <ImageIcon
        v-else-if="isImage"
        class="text-muted-foreground"
        :class="props.compact ? 'size-5' : 'size-4'"
        aria-hidden="true"
      />
      <FileTextIcon
        v-else
        class="text-muted-foreground"
        :class="props.compact ? 'size-5' : 'size-4'"
        aria-hidden="true"
      />
    </div>
    <div class="min-w-0">
      <p
        class="truncate font-medium text-foreground"
        :class="props.compact ? 'text-sm' : 'text-xs'"
      >
        {{ fileName }}
      </p>
      <p v-if="!props.compact" class="mt-1 text-xs text-muted-foreground">
        {{ fileTypeDisplay }}
      </p>
    </div>
    <button
      v-if="props.removable"
      type="button"
      class="inline-flex size-4 items-center justify-center rounded-full bg-foreground text-background transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      :aria-label="`移除文件：${fileName}`"
      @click="emit('remove')"
    >
      <XIcon class="size-3" aria-hidden="true" />
    </button>
  </div>
</template>
