<script setup lang="ts">
import { ref } from 'vue';
import { ArrowUpIcon, PlusIcon } from 'lucide-vue-next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupTextarea } from '@/components/ui/input-group'
import { Separator } from '@/components/ui/separator'
import type { SendMessage } from '@shared/api';

const message = ref("");

const emit = defineEmits<{
  send: [request: SendMessage];
}>();

function handleSend() {
  const msg = message.value.trim();
  message.value = "";
  emit("send", {
    message: msg,
  });
}

</script>
<template>
  <InputGroup>
    <InputGroupTextarea v-model="message" placeholder="Ask, Search or Chat..." />
    <InputGroupAddon align="block-end">
      <InputGroupButton variant="outline" class="rounded-full" size="icon-xs">
        <PlusIcon class="size-4" />
      </InputGroupButton>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <InputGroupButton variant="ghost">
            Auto
          </InputGroupButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" class="[--radius:0.95rem]">
          <DropdownMenuItem>Auto</DropdownMenuItem>
          <DropdownMenuItem>Agent</DropdownMenuItem>
          <DropdownMenuItem>Manual</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <InputGroupText class="ml-auto">
        52% used
      </InputGroupText>
      <Separator orientation="vertical" class="!h-4" />
      <InputGroupButton
        :disabled="!message.trim().length"
        variant="default"
        class="rounded-full"
        size="icon-xs"
        @click="handleSend">
        <ArrowUpIcon class="size-4" />
        <span class="sr-only">Send</span>
      </InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
</template>